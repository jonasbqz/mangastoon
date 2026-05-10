import { NextRequest, NextResponse } from "next/server";
import { getMangaDexRequestHeaders, toMangaDexApiUrl } from "../../../../utils/mangadex-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = await params;

  // Si no es un UUID de MangaDex, significa que viene de Consumet
  const isMangaDexUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chapterId);

  if (!isMangaDexUuid) {
    try {
      const res = await fetch(`https://consumet-api-one.vercel.app/manga/manganato/read?chapterId=${chapterId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const pages = data?.map((p: any) => p.img) || [];
      return NextResponse.json({ pages }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ pages: [], error: "No se pudieron cargar las p?ginas", code: "CONSUMET_FAILED" }, { status: 503 });
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
