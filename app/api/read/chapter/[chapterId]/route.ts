import { NextRequest, NextResponse } from "next/server";
import { getMangaDexRequestHeaders, toMangaDexApiUrl } from "../../../../utils/mangadex-config";
import { filterMonlineChapterPageUrls, fetchMonlinePagesFromRoute, toMonlineSegment, uniqueNonEmpty, fetchLocalAPI } from "../../../../utils/monline";
import { MONLINE_API_URL } from "../../../../utils/monline-config";
import { resolveBestSource, fetchMangaVfDetailsBySlug, fetchMangaVfPages, mapMangaVfChapters } from "../../../../utils/mangadex";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LOCAL_API_URL = MONLINE_API_URL;

type AtHomeResponse = {
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];
    dataSaver?: string[];
  };
};

type LocalPagesResponse = {
  data?: {
    url_pages?: unknown;
  } | null;
};

const RETRY_DELAY_MS = 1200;
const FETCH_TIMEOUT_MS = 8000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMangaDex(url: string, retries = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(toMangaDexApiUrl(url), {
      headers: getMangaDexRequestHeaders(),
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429 && retries > 0) {
    const retryAfter = Number(response.headers.get("retry-after"));
    await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RETRY_DELAY_MS);
    return fetchMangaDex(url, retries - 1);
  }

  return response;
}

function normalizeLocalImageUrl(value: string) {
  if (!value) return "";
  const imageUrl =
    value.startsWith("http://") || value.startsWith("https://")
      ? value
      : value.startsWith("//")
        ? `https:${value}`
        : `${LOCAL_API_URL}/${value.replace(/^\/+/, "")}`;
  return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
}


async function fetchLocalChapterPages(chapterId: string) {
  try {
    const response = await fetchLocalAPI(`/api/chapters/${encodeURIComponent(chapterId)}/pages`, {
      cache: "no-store",
    });

    if (!response.ok) return [];

    const payload = (await response.json()) as LocalPagesResponse;
    const rawPages = payload.data?.url_pages ?? (payload.data as Record<string, unknown> | null | undefined)?.urlPages;
    const pages = filterMonlineChapterPageUrls(rawPages);

    return pages.map(normalizeLocalImageUrl);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = await params;

  if (chapterId && chapterId.startsWith("lc-ch-")) {
    const mangaTitle = request.nextUrl.searchParams.get("mangaTitle");
    const referer = request.headers.get("referer");
    let extractedMangaSlug = "";
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const match = refererUrl.pathname.match(/^\/comics\/([^/]+)\/chapters\//);
        if (match) {
          extractedMangaSlug = match[1];
        }
      } catch {}
    }

    const queryTitle = mangaTitle || extractedMangaSlug;
    if (queryTitle) {
      try {
        const resolution = await resolveBestSource(queryTitle, queryTitle);
        if (resolution.leercapituloSlug) {
          const details = await fetchMangaVfDetailsBySlug(resolution.leercapituloSlug);
          if (details) {
            const chapters = mapMangaVfChapters(details);
            const currentChapter = chapters.find((ch) => ch.id === chapterId);
            if (currentChapter) {
              const extPages = await fetchMangaVfPages(details, currentChapter.id);
              if (extPages.length > 0) {
                return NextResponse.json(
                  { pages: extPages.map(normalizeLocalImageUrl) },
                  { headers: { "Cache-Control": "no-store" } }
                );
              }
            }
          }
        }
      } catch (err) {
        console.error("[GET /api/read/chapter] Error resolving LeerCapitulo pages:", err);
      }
    }
  }

  const mangaSegments = uniqueNonEmpty([
    ...request.nextUrl.searchParams.getAll("mangaSegment"),
    toMonlineSegment(request.nextUrl.searchParams.get("mangaTitle")),
  ]);
  const chapterSegments = uniqueNonEmpty([
    ...request.nextUrl.searchParams.getAll("chapterSegment"),
    toMonlineSegment(request.nextUrl.searchParams.get("chapterTitle")),
    toMonlineSegment(request.nextUrl.searchParams.get("chapterNumber")),
    toMonlineSegment(chapterId),
  ]);
  const monlinePages = await fetchMonlinePagesFromRoute({ mangaSegments, chapterSegments });

  if (monlinePages.length > 0) {
    return NextResponse.json(
      { pages: monlinePages.map(normalizeLocalImageUrl) },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Si no es un UUID de MangaDex, significa que viene de Consumet
  const isMangaDexUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chapterId);

  if (!isMangaDexUuid) {
    try {
      const localPages = await fetchLocalChapterPages(chapterId);
      if (localPages.length > 0) {
        return NextResponse.json({ pages: localPages }, { headers: { "Cache-Control": "no-store" } });
      }

      const res = await fetch(`https://consumet-api-one.vercel.app/manga/manganato/read?chapterId=${chapterId}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Array<{ img?: string }> | null;
      const pages = data?.map((p) => p.img).filter((img): img is string => typeof img === "string") || [];
      return NextResponse.json({ pages }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ pages: [], error: "No se pudieron cargar las páginas", code: "CONSUMET_FAILED" }, { status: 503 });
    }
  }

  try {
    const response = await fetchMangaDex(`https://api.mangadex.org/at-home/server/${chapterId}`);

    if (!response.ok) {
      return NextResponse.json(
        {
          pages: [],
          error: response.status === 429 ? "Servidor ocupado, reintentando..." : "No pudimos cargar este capitulo.",
          code: response.status === 429 ? "RATE_LIMIT" : "AT_HOME_FAILED",
        },
        { status: response.status === 429 ? 429 : 503 }
      );
    }

    const payload = (await response.json()) as AtHomeResponse;
    const hash = payload.chapter?.hash;
    const files = payload.chapter?.data?.length
      ? payload.chapter.data
      : payload.chapter?.dataSaver ?? [];
    const mode = payload.chapter?.data?.length ? "data" : "data-saver";
    const pages = hash ? files.map((filename) => `https://uploads.mangadex.org/${mode}/${hash}/${filename}`) : [];

    return NextResponse.json(
      { pages },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { pages: [], error: "Servidor ocupado, reintentando...", code: "MANGADEX_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
