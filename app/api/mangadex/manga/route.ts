import { NextRequest, NextResponse } from "next/server";
import {
  appendMangaDexAvailableLanguageFilters,
  getMangaDexRequestHeaders,
  normalizeMangaStoonLanguage,
  toMangaDexApiUrl,
} from "../../../utils/mangadex-config";

export const revalidate = 3600;

const RETRY_DELAY_MS = 1200;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = 1) {
  const response = await fetch(url, {
    headers: getMangaDexRequestHeaders(),
    next: { revalidate: 3600 },
  });

  if (response.status === 429 && retries > 0) {
    const retryAfter = Number(response.headers.get("retry-after"));
    await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RETRY_DELAY_MS);
    return fetchWithRetry(url, retries - 1);
  }

  return response;
}

export async function GET(request: NextRequest) {
  try {
    const rawParams = new URLSearchParams(request.nextUrl.searchParams);
    
    // Normalizar las llaves para evitar duplicados o errores debido a la codificación URL (%5B%5D -> [])
    const params = new URLSearchParams();
    for (const [key, value] of rawParams.entries()) {
      const normalizedKey = key.replace(/%5B%5D/gi, "[]");
      params.append(normalizedKey, value);
    }

    const hasLanguageFilter = params.has("availableTranslatedLanguage[]") || params.has("availableTranslatedLanguage");
    const skipLanguageFilter = params.get("skipLanguageFilter") === "1";
    const language = normalizeMangaStoonLanguage(
      params.get("lang") ?? request.cookies.get("lang")?.value
    );

    params.delete("lang");
    params.delete("skipLanguageFilter");

    if (!skipLanguageFilter && !hasLanguageFilter) {
      appendMangaDexAvailableLanguageFilters(params, language);
    }

    // Asegurarse de que hasAvailableChapters esté en true si no hay filtros específicos de bypass
    if (!params.has("hasAvailableChapters")) {
      params.set("hasAvailableChapters", "true");
    }

    const response = await fetchWithRetry(
      toMangaDexApiUrl(`/manga?${params.toString()}`)
    );
    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ data: [], total: 0, error: msg }, { status: 200 });
  }
}
