import { logger } from "../../../utils/logger";
import { getCached, getOrSetCached, setCached, stableCacheKey } from "../../../utils/server-cache";
import { NextRequest, NextResponse } from "next/server";
import { getMangaDexRequestHeaders, toMangaDexApiUrl } from "../../../utils/mangadex-config";
import { getLocalizedTitleAsync } from "../../../utils/get-localized-title";
import {
  buildMonlineChapterSegments,
  fetchMonlinePagesFromRoute,
  toMonlineSegment,
  uniqueNonEmpty,
} from "../../../utils/monline";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CONSUMET_API_URL = "https://consumet-api-one.vercel.app/manga/manganato";
const LOCAL_API_URL = (
  process.env.MONLINE_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://46.224.213.127:8085"
).replace(/\/$/, "");

type SupportedLanguage = "es" | "en" | "pt";

type ChapterFeedItem = {
  id: string;
  localPages?: string[];
  attributes?: {
    chapter?: string | null;
    title?: string | null;
    translatedLanguage?: string | null;
    readableAt?: string | null;
    publishAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
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

type LocalComic = Record<string, unknown>;
type LocalComicScan = Record<string, unknown> & {
  scanGroup?: Record<string, unknown>;
  chapters?: unknown;
};

type LocalComicsResponse = {
  data?: LocalComic[] | {
    comics?: LocalComic[];
    items?: LocalComic[];
    results?: LocalComic[];
  };
  comics?: LocalComic[];
  items?: LocalComic[];
  results?: LocalComic[];
};

type LocalPagesResponse = {
  data?: {
    url_pages?: unknown;
  } | null;
};

const RETRY_DELAY_MS = 1200;
const FETCH_TIMEOUT_MS = 8000;
const READ_RESPONSE_TTL_SECONDS = 60 * 5;
const MANGA_IDENTITY_TTL_SECONDS = 60 * 60 * 24;
const CHAPTER_LIST_TTL_SECONDS = 60 * 30;
const CHAPTER_PAGES_TTL_SECONDS = 60 * 60 * 6;
const LOCAL_DATA_TTL_SECONDS = 60 * 10;

type ReaderApiPayload = Record<string, unknown>;

function readResponseCacheKey(id: string, lang: SupportedLanguage, chapterId: string | null) {
  return stableCacheKey("read-api", [id, lang, chapterId ?? "default"]);
}

function readCacheHeaders(cacheStatus: "HIT" | "MISS" | "BYPASS" = "MISS", ttl = READ_RESPONSE_TTL_SECONDS) {
  return {
    "Cache-Control": `public, max-age=60, s-maxage=${ttl}, stale-while-revalidate=${ttl * 12}`,
    "X-Mangastoon-Cache": cacheStatus,
  };
}

async function cachedReadResponse(
  cacheKey: string,
  payload: ReaderApiPayload,
  options?: { status?: number; ttl?: number; cache?: boolean }
) {
  const status = options?.status ?? 200;
  const ttl = options?.ttl ?? READ_RESPONSE_TTL_SECONDS;
  const shouldCache = options?.cache !== false && status >= 200 && status < 300;

  if (shouldCache) {
    await setCached(cacheKey, payload, ttl);
  }

  return NextResponse.json(payload, {
    status,
    headers: readCacheHeaders(shouldCache ? "MISS" : "BYPASS", ttl),
  });
}

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

function isMangaDexUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function getStringValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
}


function getLocalTitleMap(source: Record<string, unknown>) {
  const title = getStringValue(source, ["title", "name", "comic_title", "original_title"]);
  const englishTitle = getStringValue(source, ["english_title", "title_en", "en_title"]);
  const spanishTitle = getStringValue(source, ["spanish_title", "title_es", "es_title"]);
  const portugueseTitle = getStringValue(source, ["portuguese_title", "title_pt", "pt_title"]);

  return {
    ...(title ? { es: title } : {}),
    ...(englishTitle ? { en: englishTitle } : {}),
    ...(spanishTitle ? { es: spanishTitle } : {}),
    ...(portugueseTitle ? { pt: portugueseTitle } : {}),
  };
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

function extractLocalComics(payload: LocalComicsResponse) {
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.data?.comics)) return payload.data.comics;
  if (Array.isArray(payload.data?.items)) return payload.data.items;
  if (Array.isArray(payload.data?.results)) return payload.data.results;
  if (payload.data && typeof payload.data === "object") return [payload.data as LocalComic];
  if (Array.isArray(payload.comics)) return payload.comics;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  if (
    payload &&
    typeof payload === "object" &&
    ("id" in payload || "slug" in payload || "title" in payload)
  ) {
    return [payload as LocalComic];
  }
  return [];
}

function getLocalChapters(comic: LocalComic): ChapterFeedItem[] {
  const scans = Array.isArray(comic.comicScans)
    ? comic.comicScans.filter((scan): scan is LocalComicScan => Boolean(scan) && typeof scan === "object")
    : [];

  return scans.flatMap((scan) => {
    const chapters = Array.isArray(scan.chapters)
      ? scan.chapters.filter((chapter): chapter is Record<string, unknown> => Boolean(chapter) && typeof chapter === "object")
      : [];

    return chapters.flatMap((chapter) => {
      const id = getStringValue(chapter, ["id", "chapterId", "chapter_id"]);
      const chapterNumber = getStringValue(chapter, ["chapterNumber", "chapter_number", "chapter", "number"]);

      if (!id || !chapterNumber) {
        return [];
      }

      const title = getStringValue(chapter, ["title", "name"]);
      const createdAt = getStringValue(chapter, ["releaseDate", "release_date", "created_at", "createdAt", "readableAt", "updated_at", "updatedAt"]);
      const pages = Array.isArray(chapter.urlPages)
        ? chapter.urlPages.filter((url): url is string => typeof url === "string" && url.trim().length > 0)
        : [];

      return [{
        id,
        localPages: pages.map(normalizeLocalImageUrl),
        attributes: {
          chapter: chapterNumber,
          title,
          translatedLanguage: "es",
          readableAt: createdAt || null,
          publishAt: createdAt || null,
          createdAt: createdAt || null,
          updatedAt: createdAt || null,
        },
      }];
    });
  });
}

async function resolveLocalMangaIdentity(slug: string, lang: SupportedLanguage) {
  const params = new URLSearchParams();
  params.set("limit", "100");

  try {
    const response = await fetch(`${LOCAL_API_URL}/api/comics?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as LocalComicsResponse;
    const comic = extractLocalComics(payload).find((item) => {
      const comicSlug = getStringValue(item, ["slug", "manga_slug", "comic_slug"]);
      return comicSlug === slug || slug.endsWith(`-${comicSlug}`);
    });

    if (!comic) {
      return null;
    }

    const numericId = getStringValue(comic, ["id"]);
    const detailResponse = numericId
      ? await fetch(`${LOCAL_API_URL}/api/comics/${encodeURIComponent(numericId)}`, { cache: "no-store" })
      : null;
    const fullComic = detailResponse?.ok ? ((await detailResponse.json()) as LocalComic) : comic;
    const rawTitle = getStringValue(fullComic, ["title", "name", "comic_title", "original_title"]);
    const title = await getLocalizedTitleAsync({ titleMap: getLocalTitleMap(fullComic), title: rawTitle }, lang) || "Mangastoon";
    const coverImage = normalizeLocalImageUrl(
      getStringValue(fullComic, ["coverImage", "cover_image", "cover", "thumbnail", "image", "poster", "url_cover"])
    );

    return {
      title,
      coverImage,
      segments: uniqueNonEmpty([slug, title].map(toMonlineSegment)),
      chapters: getLocalChapters(fullComic),
    };
  } catch {
    return null;
  }
}

async function fetchLocalMangaIdentity(slug: string, lang: SupportedLanguage) {
  return getOrSetCached(
    stableCacheKey("local-manga-identity", [slug, lang]),
    LOCAL_DATA_TTL_SECONDS,
    () => resolveLocalMangaIdentity(slug, lang),
    { shouldCache: (value) => value !== null }
  );
}


function stripChapterForClient(chapter: ChapterFeedItem | null | undefined): ChapterFeedItem | null {
  if (!chapter) return null;

  return {
    id: chapter.id,
    attributes: chapter.attributes,
  };
}

function stripChaptersForClient(chapters: ChapterFeedItem[]) {
  return chapters.map((chapter) => stripChapterForClient(chapter)).filter(Boolean) as ChapterFeedItem[];
}

async function resolveLocalChapterPages(chapterId: string) {
  try {
    const response = await fetch(`${LOCAL_API_URL}/api/chapters/${encodeURIComponent(chapterId)}/pages`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as LocalPagesResponse;
    const rawPages = payload.data?.url_pages ?? (payload.data as Record<string, unknown> | null | undefined)?.urlPages;
    const pages = Array.isArray(rawPages)
      ? rawPages.filter((url): url is string => typeof url === "string" && url.trim().length > 0)
      : [];

    return pages.map(normalizeLocalImageUrl);
  } catch {
    return [];
  }
}

async function fetchLocalChapterPages(chapterId: string) {
  return getOrSetCached(
    stableCacheKey("local-chapter-pages", [chapterId]),
    CHAPTER_PAGES_TTL_SECONDS,
    () => resolveLocalChapterPages(chapterId),
    { shouldCache: (pages) => pages.length > 0 }
  );
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

async function resolveMangaIdentity(mangaId: string, lang: SupportedLanguage) {
  const response = await fetchMangaDex(`https://api.mangadex.org/manga/${mangaId}?includes[]=cover_art`);

  if (!response.ok) return { title: "Mangastoon", coverImage: "", segments: ["mangastoon"] };

  const payload = (await response.json()) as MangaDetailsResponse;
  const attributes = payload.data?.attributes;
  const titles = attributes?.title ?? {};
  const mainTitles = Object.values(titles);
  const altTitles = (attributes?.altTitles ?? []).flatMap((titleMap) => Object.values(titleMap));
  const coverFileName = payload.data?.relationships?.find((relationship) => relationship.type === "cover_art")
    ?.attributes?.fileName;
  const title = await getLocalizedTitleAsync({
    attributes: {
      title: titles,
      altTitles: attributes?.altTitles ?? [],
    },
  }, lang);

  return {
    title,
    coverImage: coverFileName ? `https://uploads.mangadex.org/covers/${mangaId}/${coverFileName}` : "",
    segments: uniqueNonEmpty([title, ...mainTitles, ...altTitles].map(toMonlineSegment)),
  };
}

async function resolveAllChapters(mangaId: string, lang: SupportedLanguage) {
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

function buildMangaDexPageUrls(payload: AtHomeResponse) {
  const hash = payload.chapter?.hash;
  const files = payload.chapter?.data?.length
    ? payload.chapter.data
    : payload.chapter?.dataSaver ?? [];

  if (!payload.baseUrl || !hash || files.length === 0) return [];

  const mode = payload.chapter?.data?.length ? "data" : "data-saver";
  return files.map((filename) => `https://uploads.mangadex.org/${mode}/${hash}/${filename}`);
}

async function fetchMangaDexChapterPages(chapterId: string) {
  const response = await fetchMangaDex(`https://api.mangadex.org/at-home/server/${chapterId}`);

  if (!response.ok) {
    throw new Error(response.status === 429 ? "RATE_LIMIT" : "AT_HOME_FAILED");
  }

  const payload = (await response.json()) as AtHomeResponse;
  return buildMangaDexPageUrls(payload);
}

async function fetchConsumetChapterPages(chapterId: string) {
  const res = await fetch(`https://consumet-api-one.vercel.app/manga/manganato/read?chapterId=${chapterId}`);
  if (!res.ok) throw new Error("CONSUMET_FAILED");
  const data = await res.json();
  return data?.map((page: { img?: string }) => page.img).filter(Boolean) || [];
}

async function fetchMonlineFallbackPages(
  chapterId: string,
  options?: { mangaSegments?: string[]; chapter?: ChapterFeedItem | null }
) {
  const monlinePages = await fetchMonlinePagesFromRoute({
    mangaSegments: options?.mangaSegments ?? [],
    chapterSegments: buildMonlineChapterSegments(options?.chapter ?? { id: chapterId }),
  });

  return monlinePages.map(normalizeLocalImageUrl);
}

async function resolveChapterPages(
  chapterId: string,
  options?: { mangaSegments?: string[]; chapter?: ChapterFeedItem | null }
) {
  const isMangaDexChapterId = isMangaDexUuid(chapterId);

  if (isMangaDexChapterId) {
    try {
      const mangaDexPages = await fetchMangaDexChapterPages(chapterId);
      if (mangaDexPages.length > 0) return mangaDexPages;
    } catch (error) {
      if (error instanceof Error && error.message === "RATE_LIMIT") {
        throw error;
      }
    }

    // Monline is only a fallback for MangaDex chapters. Trying it first caused
    // dozens of sequential route lookups per request when a title has many alt names.
    return fetchMonlineFallbackPages(chapterId, options);
  }

  const monlinePages = await fetchMonlineFallbackPages(chapterId, options);
  if (monlinePages.length > 0) return monlinePages;

  return fetchConsumetChapterPages(chapterId);
}

async function fetchMangaIdentity(mangaId: string, lang: SupportedLanguage) {
  return getOrSetCached(
    stableCacheKey("mangadex-manga-identity", [mangaId, lang]),
    MANGA_IDENTITY_TTL_SECONDS,
    () => resolveMangaIdentity(mangaId, lang)
  );
}

async function fetchAllChapters(mangaId: string, lang: SupportedLanguage) {
  return getOrSetCached(
    stableCacheKey("mangadex-chapters", [mangaId, lang]),
    CHAPTER_LIST_TTL_SECONDS,
    () => resolveAllChapters(mangaId, lang),
    { shouldCache: (chapters) => chapters.length > 0 }
  );
}

async function fetchChapterPages(
  chapterId: string,
  options?: { mangaSegments?: string[]; chapter?: ChapterFeedItem | null }
) {
  const chapterKey = stableCacheKey("chapter-pages", [
    chapterId,
    options?.mangaSegments?.join("|") ?? "",
    options?.chapter?.attributes?.chapter ?? "",
    options?.chapter?.attributes?.title ?? "",
  ]);

  return getOrSetCached(
    chapterKey,
    CHAPTER_PAGES_TTL_SECONDS,
    () => resolveChapterPages(chapterId, options),
    { shouldCache: (pages) => pages.length > 0 }
  );
}

async function fetchChapterDetails(chapterId: string) {
  return getOrSetCached(
    stableCacheKey("mangadex-chapter-details", [chapterId]),
    MANGA_IDENTITY_TTL_SECONDS,
    () => resolveChapterDetails(chapterId),
    { shouldCache: (chapter) => chapter !== null }
  );
}

async function findChapterByNumber(
  mangaId: string,
  lang: SupportedLanguage,
  chapterNumber: string | null | undefined
) {
  if (!chapterNumber) return null;

  return getOrSetCached(
    stableCacheKey("mangadex-chapter-by-number", [mangaId, lang, chapterNumber]),
    CHAPTER_LIST_TTL_SECONDS,
    () => resolveChapterByNumber(mangaId, lang, chapterNumber),
    { shouldCache: (chapter) => chapter !== null }
  );
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

async function resolveChapterDetails(chapterId: string) {
  const response = await fetchMangaDex(`https://api.mangadex.org/chapter/${chapterId}`);

  if (!response.ok) return null;

  const payload = (await response.json()) as { data?: ChapterFeedItem };
  return payload.data ?? null;
}

async function resolveChapterByNumber(
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
  const responseCacheKey = readResponseCacheKey(id, lang, chapterId);
  const cachedPayload = await getCached<ReaderApiPayload>(responseCacheKey);

  if (cachedPayload) {
    return NextResponse.json(cachedPayload, {
      headers: readCacheHeaders("HIT"),
    });
  }

  try {
    const localManga = await fetchLocalMangaIdentity(id, lang);

    if (localManga) {
      const currentChapter =
        localManga.chapters.find((chapter) => chapter.id === chapterId) ??
        localManga.chapters[0] ??
        null;
      const pages =
        currentChapter?.localPages && currentChapter.localPages.length > 0
          ? currentChapter.localPages
          : currentChapter?.id
            ? await fetchLocalChapterPages(currentChapter.id)
            : [];

      return cachedReadResponse(responseCacheKey, {
        mangaTitle: localManga.title,
        coverImage: localManga.coverImage,
        chapters: stripChaptersForClient(localManga.chapters),
        currentChapter: stripChapterForClient(currentChapter),
        pages,
        englishFallbackChapter: null,
        fallbackReason: null,
        isExternalSource: false,
        isLocal: true,
      });
    }

    if (!isMangaDexUuid(id)) {
      const pages = chapterId ? await fetchLocalChapterPages(chapterId) : [];

      return cachedReadResponse(
        responseCacheKey,
        {
          mangaTitle: "Mangastoon",
          coverImage: "",
          chapters: chapterId
            ? [{ id: chapterId, attributes: { chapter: null, title: null, translatedLanguage: "es" } }]
            : [],
          currentChapter: chapterId
            ? { id: chapterId, attributes: { chapter: null, title: null, translatedLanguage: "es" } }
            : null,
          pages,
          englishFallbackChapter: null,
          fallbackReason: null,
          isExternalSource: false,
          isLocal: true,
          error: pages.length > 0 ? undefined : "No pudimos cargar las páginas locales.",
          code: pages.length > 0 ? undefined : "LOCAL_PAGES_UNAVAILABLE",
        },
        { status: pages.length > 0 ? 200 : 404, cache: pages.length > 0 }
      );
    }

    const [mangaIdentity, chapters, requestedChapter] = await Promise.all([
      fetchMangaIdentity(id, lang),
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

      return cachedReadResponse(responseCacheKey, {
        mangaTitle,
        coverImage,
        chapters: stripChaptersForClient(finalChapters),
        currentChapter: stripChapterForClient(requestedChapter),
        pages: [],
        englishFallbackChapter,
        fallbackReason,
      });
    }

    currentChapter = currentChapter ?? finalChapters[0] ?? null;
    const readableChapter = isExternalSource
      ? { chapter: currentChapter, pages: [] }
      : await findReadableChapterWithPages(finalChapters, currentChapter, mangaSegments);
    currentChapter = readableChapter.chapter;
    let pages = readableChapter.pages;

    if (pages.length === 0 && lang !== "en" && currentChapter?.attributes?.chapter) {
      const englishChapter = await findChapterByNumber(id, "en", currentChapter.attributes.chapter);

      if (englishChapter) {
        const englishPages = await fetchChapterPages(englishChapter.id, {
          mangaSegments,
          chapter: englishChapter,
        }).catch(() => []);

        if (englishPages.length > 0) {
          currentChapter = englishChapter;
          pages = englishPages;
        }
      }
    }

    return cachedReadResponse(responseCacheKey, {
      mangaTitle,
      coverImage,
      chapters: stripChaptersForClient(finalChapters),
      currentChapter: stripChapterForClient(currentChapter),
      pages,
      englishFallbackChapter: null,
      fallbackReason: null,
      isExternalSource,
    });
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
        translatedLanguage: "en"
      },
      isConsumet: true // Bandera para saber que viene de fuente externa
    })) || [];
  } catch (e) {
    logger.error("Error en Consumet Fallback", e);
    return null;
  }
}
