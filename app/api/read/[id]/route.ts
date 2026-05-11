import { NextRequest, NextResponse } from "next/server";
import { getMangaDexRequestHeaders, toMangaDexApiUrl } from "../../../utils/mangadex-config";
import {
  buildMonlineChapterSegments,
  fetchMonlinePagesFromRoute,
  toMonlineSegment,
  uniqueNonEmpty,
} from "../../../utils/monline";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CONSUMET_API_URL = "https://consumet-api-one.vercel.app/manga/manganato";

type SupportedLanguage = "es" | "en" | "pt";

type ChapterFeedItem = {
  id: string;
  attributes?: {
    chapter?: string | null;
    title?: string | null;
    translatedLanguage?: string | null;
  };
};

type ChapterFeedResponse = {
  data?: ChapterFeedItem[];
  total?: number;
  limit?: number;
  offset?: number;
};

type MangaDetailsResponse = {
  data?: {
    id?: string;
    attributes?: {
      title?: Record<string, string>;
      altTitles?: Record<string, string>[];
    };
    relationships?: Array<{
      type: string;
      attributes?: {
        fileName?: string;
      };
    }>;
  };
};

type AtHomeResponse = {
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];
    dataSaver?: string[];
  };
};

const RETRY_DELAY_MS = 1200;
const FETCH_TIMEOUT_MS = 8000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getLanguageVariants(lang: SupportedLanguage) {
  if (lang === "es") return ["es-la", "es"];
  if (lang === "pt") return ["pt-br", "pt"];
  return ["en"];
}

function normalizeLanguage(value: string | null): SupportedLanguage {
  if (value === "en" || value === "pt") return value;
  return "es";
}

async function fetchMangaDex(url: string, init?: RequestInit, retries = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(toMangaDexApiUrl(url), {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        ...getMangaDexRequestHeaders(),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429 && retries > 0) {
    const retryAfter = Number(response.headers.get("retry-after"));
    await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RETRY_DELAY_MS);
    return fetchMangaDex(url, init, retries - 1);
  }

  return response;
}

function buildFeedUrl(mangaId: string, lang: SupportedLanguage, limit: number, offset: number) {
  const search = new URLSearchParams();

  getLanguageVariants(lang).forEach((variant) => {
    search.append("translatedLanguage[]", variant);
  });

  search.set("order[chapter]", "asc");
  search.set("limit", String(limit));
  search.set("offset", String(offset));

  return `https://api.mangadex.org/manga/${mangaId}/feed?${search.toString()}`;
}

async function fetchMangaIdentity(mangaId: string) {
  const response = await fetchMangaDex(`https://api.mangadex.org/manga/${mangaId}?includes[]=cover_art`);

  if (!response.ok) return { title: "Mangastoon", coverImage: "", segments: ["mangastoon"] };

  const payload = (await response.json()) as MangaDetailsResponse;
  const attributes = payload.data?.attributes;
  const titles = attributes?.title ?? {};
  const title = titles.en ?? titles.es ?? titles["es-la"] ?? titles.pt ?? Object.values(titles)[0] ?? "Mangastoon";
  const mainTitles = Object.values(titles);
  const altTitles = (attributes?.altTitles ?? []).flatMap((titleMap) => Object.values(titleMap));
  const coverFileName = payload.data?.relationships?.find((relationship) => relationship.type === "cover_art")
    ?.attributes?.fileName;

  return {
    title,
    coverImage: coverFileName ? `https://uploads.mangadex.org/covers/${mangaId}/${coverFileName}` : "",
    segments: uniqueNonEmpty([title, ...mainTitles, ...altTitles].map(toMonlineSegment)),
  };
}

async function fetchAllChapters(mangaId: string, lang: SupportedLanguage) {
  const limit = 100;
  let offset = 0;
  let total = 0;
  const chapters: ChapterFeedItem[] = [];

  do {
    const response = await fetchMangaDex(buildFeedUrl(mangaId, lang, limit, offset));

    if (!response.ok) {
      throw new Error(response.status === 429 ? "RATE_LIMIT" : "CHAPTER_FEED_FAILED");
    }

    const payload = (await response.json()) as ChapterFeedResponse;
    const batch = payload.data ?? [];
    total = payload.total ?? batch.length;
    chapters.push(...batch);
    offset += payload.limit ?? limit;
  } while (offset < total);

  return chapters;
}

async function fetchChapterPages(
  chapterId: string,
  options?: { mangaSegments?: string[]; chapter?: ChapterFeedItem | null }
) {
  const monlinePages = await fetchMonlinePagesFromRoute({
    mangaSegments: options?.mangaSegments ?? [],
    chapterSegments: buildMonlineChapterSegments(options?.chapter ?? { id: chapterId }),
  });

  if (monlinePages.length > 0) {
    return monlinePages;
  }

  // Si no es un UUID de MangaDex, significa que viene de Consumet
  const isMangaDexUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chapterId);

  if (!isMangaDexUuid) {
    const res = await fetch(`https://consumet-api-one.vercel.app/manga/manganato/read?chapterId=${chapterId}`);
    if (!res.ok) throw new Error("CONSUMET_FAILED");
    const data = await res.json();
    return data?.map((p: any) => p.img) || [];
  }

  const response = await fetchMangaDex(`https://api.mangadex.org/at-home/server/${chapterId}`);

  if (!response.ok) {
    throw new Error(response.status === 429 ? "RATE_LIMIT" : "AT_HOME_FAILED");
  }

  const payload = (await response.json()) as AtHomeResponse;
  const hash = payload.chapter?.hash;
  const files = payload.chapter?.data?.length
    ? payload.chapter.data
    : payload.chapter?.dataSaver ?? [];

  if (!payload.baseUrl || !hash || files.length === 0) return [];

  const mode = payload.chapter?.data?.length ? "data" : "data-saver";
  return files.map((filename) => `https://uploads.mangadex.org/${mode}/${hash}/${filename}`);
}

async function findReadableChapterWithPages(
  chapters: ChapterFeedItem[],
  preferredChapter: ChapterFeedItem | null,
  mangaSegments: string[]
) {
  const preferredIndex = preferredChapter
    ? chapters.findIndex((chapter) => chapter.id === preferredChapter.id)
    : -1;
  const orderedChapters = [
    ...(preferredChapter ? [preferredChapter] : []),
    ...chapters.slice(Math.max(0, preferredIndex + 1)),
    ...chapters.slice(0, Math.max(0, preferredIndex)),
  ];
  const seen = new Set<string>();

  for (const chapter of orderedChapters.slice(0, 8)) {
    if (!chapter?.id || seen.has(chapter.id)) {
      continue;
    }

    seen.add(chapter.id);

    try {
      const pages = await fetchChapterPages(chapter.id, { mangaSegments, chapter });

      if (pages.length > 0) {
        return { chapter, pages };
      }
    } catch (error) {
      if (error instanceof Error && error.message === "RATE_LIMIT") {
        throw error;
      }
    }
  }

  return { chapter: preferredChapter ?? chapters[0] ?? null, pages: [] };
}

async function fetchChapterDetails(chapterId: string) {
  const response = await fetchMangaDex(`https://api.mangadex.org/chapter/${chapterId}`);

  if (!response.ok) return null;

  const payload = (await response.json()) as { data?: ChapterFeedItem };
  return payload.data ?? null;
}

async function findChapterByNumber(
  mangaId: string,
  lang: SupportedLanguage,
  chapterNumber: string | null | undefined
) {
  if (!chapterNumber) return null;

  const search = new URLSearchParams();
  getLanguageVariants(lang).forEach((variant) => {
    search.append("translatedLanguage[]", variant);
  });
  search.set("chapter", chapterNumber);
  search.set("limit", "1");

  const response = await fetchMangaDex(`https://api.mangadex.org/manga/${mangaId}/feed?${search.toString()}`);

  if (!response.ok) return null;

  const payload = (await response.json()) as ChapterFeedResponse;
  return payload.data?.[0] ?? null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"));
  const chapterId = request.nextUrl.searchParams.get("chapter");

  try {
    const [mangaIdentity, chapters, requestedChapter] = await Promise.all([
      fetchMangaIdentity(id),
      fetchAllChapters(id, lang),
      chapterId ? fetchChapterDetails(chapterId) : Promise.resolve(null),
    ]);
    const mangaTitle = mangaIdentity.title;
    const coverImage = mangaIdentity.coverImage;
    const mangaSegments = mangaIdentity.segments;

    let finalChapters = chapters;
    let isExternalSource = false;

    // Si MangaDex no devolvi? cap?tulos, intentamos con Consumet
    if (finalChapters.length === 0) {
      const backupChapters = await fetchConsumetChapters(mangaTitle);
      if (backupChapters && backupChapters.length > 0) {
        finalChapters = backupChapters;
        isExternalSource = true;
      }
    }

    let currentChapter = finalChapters.find((chapter) => chapter.id === chapterId) ?? null;

    if (!currentChapter && requestedChapter?.attributes?.chapter) {
      currentChapter = await findChapterByNumber(id, lang, requestedChapter.attributes.chapter);
    }

    let englishFallbackChapter: ChapterFeedItem | null = null;
    let fallbackReason: "english" | "unavailable" | null = null;

    if (!currentChapter && chapterId && requestedChapter) {
      englishFallbackChapter = await findChapterByNumber(id, "en", requestedChapter.attributes?.chapter);
      fallbackReason = englishFallbackChapter ? "english" : "unavailable";

      return NextResponse.json(
        {
          mangaTitle,
          coverImage,
          chapters: finalChapters,
          currentChapter: requestedChapter,
          pages: [],
          englishFallbackChapter,
          fallbackReason,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    currentChapter = currentChapter ?? finalChapters[0] ?? null;
    const readableChapter = isExternalSource
      ? { chapter: currentChapter, pages: [] }
      : await findReadableChapterWithPages(finalChapters, currentChapter, mangaSegments);
    currentChapter = readableChapter.chapter;
    const pages = readableChapter.pages;

    return NextResponse.json(
      { mangaTitle, coverImage, chapters: finalChapters, currentChapter, pages, englishFallbackChapter: null, fallbackReason: null, isExternalSource },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const isRateLimit = error instanceof Error && error.message === "RATE_LIMIT";

    return NextResponse.json(
      {
        error: isRateLimit ? "Servidor ocupado, reintentando..." : "No pudimos conectar con MangaDex.",
        code: isRateLimit ? "RATE_LIMIT" : "MANGADEX_UNAVAILABLE",
      },
      {
        status: isRateLimit ? 429 : 503,
        headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=86400" },
      }
    );
  }
}

async function fetchConsumetChapters(title: string) {
  try {
    // Paso 1: Buscar el manga por t?tulo para obtener su ID en Manganato
    const searchRes = await fetch(`${CONSUMET_API_URL}/${encodeURIComponent(title)}`);
    const searchData = await searchRes.json();
    const mangaId = searchData.results?.[0]?.id;

    if (!mangaId) return null;

    // Paso 2: Obtener la lista de cap?tulos usando ese ID
    const infoRes = await fetch(`https://consumet-api-one.vercel.app/manga/manganato/info?id=${mangaId}`);
    const infoData = await infoRes.json();
    
    return infoData.chapters?.map((ch: any) => ({
      id: ch.id,
      attributes: {
        chapter: ch.number?.toString() || ch.title?.match(/\d+/)?.[0] || "1",
        title: ch.title,
        translatedLanguage: "es" // Lo marcamos como es para que el front lo acepte
      },
      isConsumet: true // Bandera para saber que viene de fuente externa
    })) || [];
  } catch (e) {
    console.error("Error en Consumet Fallback:", e);
    return null;
  }
}
