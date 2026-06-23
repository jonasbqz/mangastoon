import { logger } from "../../../utils/logger";
import { getCached, getOrSetCached, setCached, stableCacheKey } from "../../../utils/server-cache";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getMangaDexRequestHeaders, toMangaDexApiUrl } from "../../../utils/mangadex-config";
import { getLocalizedTitleAsync } from "../../../utils/get-localized-title";
import { MONLINE_API_URL } from "../../../utils/monline-config";
import {
  resolveBestSource,
  fetchMangaVfPages,
  mapMangaVfChapters,
  getMangaVfChapterId,
  fetchMangaVfDetailsBySlug,
  fetchMangaDexChaptersOnly,
  fetchLeerCapituloChaptersOnly,
  fetchMangaVfSourceBySlug,
  searchLeerCapituloByTitle
} from "../../../utils/mangadex";
import {
  buildMonlineChapterSegments,
  filterMonlineChapterPageUrls,
  fetchMonlinePagesFromRoute,
  toMonlineSegment,
  uniqueNonEmpty,
  fetchLocalAPI,
  fetchMangaVfAPI,
} from "../../../utils/monline";
import { slugify } from "../../../utils/slugify";
import { isDmcaBlocked } from "../../../utils/dmca";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CONSUMET_API_URL = "https://consumet-api-one.vercel.app/manga/manganato";
const LOCAL_API_URL = MONLINE_API_URL;
const MANGAVF_API_URL = process.env.MANGAVF_API_URL || process.env.NEXT_PUBLIC_MANGAVF_API_URL || "http://localhost:3001";

function normalizePageUrlToProxy(url: string): string {
  if (!url) return "";
  if (url.startsWith("/api/proxy-image")) return url;
  if (url.startsWith("/")) return url;
  if (url.includes("mangadex.org")) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

async function reportBrokenChapter(
  mangaId: string,
  mangaTitle: string,
  chapterId: string,
  chapterNumber: string
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xlcsqqwelopzpslxgdni.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = serviceRoleKey
      ? createSupabaseClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      : await createClient();

    const { data: existing, error: findError } = await supabase
      .from("broken_chapters")
      .select("manga_id, chapter_id")
      .eq("manga_id", mangaId)
      .eq("chapter_id", chapterId)
      .maybeSingle();

    if (!findError && !existing) {
      const { error: insertError } = await supabase.from("broken_chapters").insert({
        manga_id: mangaId,
        manga_title: mangaTitle,
        chapter_id: chapterId,
        chapter_number: chapterNumber,
        detected_at: new Date().toISOString(),
      });
      if (insertError) {
        logger.error("[broken_chapters] Error inserting broken chapter:", insertError);
      } else {
        logger.info(`[broken_chapters] Successfully reported new broken chapter ${chapterNumber} for manga ${mangaId}`);
      }
    } else if (!findError && existing) {
      const { error: updateError } = await supabase.from("broken_chapters")
        .update({
          manga_title: mangaTitle,
          chapter_number: chapterNumber,
          detected_at: new Date().toISOString(),
        })
        .eq("manga_id", mangaId)
        .eq("chapter_id", chapterId);
      if (updateError) {
        logger.error("[broken_chapters] Error updating broken chapter:", updateError);
      } else {
        logger.info(`[broken_chapters] Successfully updated broken chapter ${chapterNumber} detection time for manga ${mangaId}`);
      }
    } else if (findError) {
      logger.error("[broken_chapters] Error searching broken chapter in database:", findError);
    }

    // Auto-enqueue logic for broken chapters to prioritize scraper fetching
    try {
      const cleanSlug = mangaId.startsWith("lc-") ? mangaId.substring(3) : mangaId;
      let leercapituloSlug: string | null = null;

      // Try resolving via searchLeerCapituloByTitle first
      try {
        leercapituloSlug = await searchLeerCapituloByTitle(mangaTitle);
      } catch (err) {
        logger.error("[broken_chapters] Error in searchLeerCapituloByTitle:", err);
      }

      if (!leercapituloSlug) {
        // Fallback: build a guess slug
        if (isMangaDexUuid(cleanSlug)) {
          leercapituloSlug = slugify(mangaTitle);
        } else {
          const uuidMatch = cleanSlug.match(/^(.*?)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
          leercapituloSlug = uuidMatch && uuidMatch[1] ? uuidMatch[1] : cleanSlug;
        }
      }

      if (leercapituloSlug) {
        const sourceUrl = `https://www.leercapitulo.co/manga/${leercapituloSlug}/`;

        // Check DMCA blocklist
        const blockedKeywords = ["ruridragon", "ruriragon", "ultimo-saiyuki", "ultimo saiyuki", "saiyuki", "pokemon-adventures", "pokemon adventures", "steel-ball-run", "steel ball run", "jojo"];
        const isBlocked = blockedKeywords.some(kw => mangaTitle.toLowerCase().includes(kw) || leercapituloSlug!.toLowerCase().includes(kw));

        if (!isBlocked && !isDmcaBlocked(mangaId)) {
          // Check if already in queue
          const { data: existingJob, error: checkQueueError } = await supabase
            .from("scraper_queue")
            .select("id, status")
            .eq("source_url", sourceUrl)
            .maybeSingle();

          if (!checkQueueError) {
            if (!existingJob) {
              const { error: insertQueueError } = await supabase
                .from("scraper_queue")
                .insert({
                  manga_title: mangaTitle,
                  source_url: sourceUrl,
                  status: "pending",
                  priority: 5, // Medium priority
                  requested_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });

              if (insertQueueError) {
                logger.error("[broken_chapters] Error auto-enqueueing scraper job:", insertQueueError);
              } else {
                logger.info(`[broken_chapters] Auto-enqueued ${mangaTitle} (${sourceUrl}) with priority 5`);
              }
            } else if (existingJob.status === "failed") {
              const { error: updateQueueError } = await supabase
                .from("scraper_queue")
                .update({
                  status: "pending",
                  priority: 5,
                  error_message: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existingJob.id);

              if (updateQueueError) {
                logger.error("[broken_chapters] Error resetting failed scraper job:", updateQueueError);
              } else {
                logger.info(`[broken_chapters] Reset failed scraper job for ${mangaTitle} to pending`);
              }
            }
          }
        } else {
          logger.info(`[broken_chapters] Auto-enqueue skipped for ${mangaTitle} due to DMCA blocklist`);
        }
      }
    } catch (enqueueErr) {
      logger.error("[broken_chapters] Error in auto-enqueue workflow:", enqueueErr);
    }
  } catch (dbErr) {
    logger.error("[broken_chapters] Error reporting broken chapter:", dbErr);
  }
}

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
    externalUrl?: string | null;
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
type MangaVfChapter = {
  number?: string;
  title?: string;
  url?: string;
};
type MangaVfDetails = {
  manga_title?: string;
  title?: string;
  cover?: string;
  synopsis?: string;
  status?: string;
  genres?: string[];
  chapters?: MangaVfChapter[];
};
type MangaVfExtractResponse = {
  pages?: string[];
  images?: string[];
};
type MangaVfSearchResponse = {
  results?: Array<{ title?: string; slug?: string; url?: string; cover?: string }>;
};
type MangaVfLatestResponse = {
  recientes?: Array<{
    title?: string;
    slug?: string;
    cover?: string;
    chapters?: MangaVfChapter[];
  }>;
};

const RETRY_DELAY_MS = 1200;
const FETCH_TIMEOUT_MS = 8000;
const READ_RESPONSE_TTL_SECONDS = 60 * 5;
const MANGA_IDENTITY_TTL_SECONDS = 60 * 60 * 24;
const CHAPTER_LIST_TTL_SECONDS = 60 * 30;
const CHAPTER_PAGES_TTL_SECONDS = 60 * 60 * 6;
const LOCAL_DATA_TTL_SECONDS = 60 * 10;

type ReaderApiPayload = Record<string, unknown>;

function readResponseCacheKey(id: string, lang: SupportedLanguage, chapterId: string | null, excludeChapters?: boolean) {
  return stableCacheKey("read-api-v2", [id, lang, chapterId ?? "default", excludeChapters ? "exclude" : "full"]);
}

function readCacheHeaders(cacheStatus: "HIT" | "MISS" | "BYPASS" = "MISS", ttl = READ_RESPONSE_TTL_SECONDS) {
  if (cacheStatus === "BYPASS") {
    return {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      "X-Mangastoon-Cache": "BYPASS",
    };
  }
  return {
    "Cache-Control": `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${ttl * 12}`,
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

function appendReadableContentRatings(search: URLSearchParams) {
  ["safe", "suggestive", "erotica", "pornographic"].forEach((rating) => {
    search.append("contentRating[]", rating);
  });
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
  const scans = Array.isArray(comic.comicScans) ? comic.comicScans : [];
  const scanName = scans[0]?.scanGroup?.name || (comic as any).scan_group_name || null;

  let chaptersToProcess: any[] = [];
  const hasChaptersInScans = scans.some(scan => Array.isArray(scan.chapters) && scan.chapters.length > 0);

  if (hasChaptersInScans) {
    chaptersToProcess = scans.flatMap((scan) => {
      const chapters = Array.isArray(scan.chapters) ? scan.chapters : [];
      return chapters.map((ch: any) => ({ ...ch, scanName: scan.scanGroup?.name || scanName }));
    });
  } else {
    const recent = Array.isArray((comic as any).recent_chapters)
      ? (comic as any).recent_chapters
      : Array.isArray((comic as any).chapters)
        ? (comic as any).chapters
        : [];
    chaptersToProcess = recent.map((ch: any) => ({ ...ch, scanName }));
  }

  return chaptersToProcess
    .flatMap((chapter) => {
      const id = getStringValue(chapter, ["id", "chapterId", "chapter_id"]);
      const chapterNumber = getStringValue(chapter, ["chapterNumber", "chapter_number", "chapter", "number"]);

      if (!id || !chapterNumber) {
        return [];
      }

      const title = getStringValue(chapter, ["title", "name"]);
      const createdAt = getStringValue(chapter, ["releaseDate", "release_date", "created_at", "createdAt", "readableAt", "updated_at", "updatedAt"]);
      const rawPages = chapter.urlPages || chapter.url_pages || [];
      const pages = filterMonlineChapterPageUrls(rawPages);
      const chScanName = chapter.scanName || scanName;

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
        relationships: chScanName ? [{ id: "local-scan", type: "scanlation_group", attributes: { name: chScanName } }] : [],
      }];
    })
    .sort((a, b) => Number(b.attributes.chapter) - Number(a.attributes.chapter));
}

// LeerCapitulo/MangaVf helpers are imported from mangadex utils

function cleanMangaSlug(slug: string): string {
  let cleaned = slug.replace(/-\d{8}-[a-zA-Z0-9]+$/, "");
  while (true) {
    if (cleaned.length % 2 === 1) {
      const mid = Math.floor(cleaned.length / 2);
      if (cleaned[mid] === '-') {
        const firstHalf = cleaned.substring(0, mid);
        const secondHalf = cleaned.substring(mid + 1);
        if (firstHalf === secondHalf) {
          cleaned = firstHalf;
          continue;
        }
      }
    }
    break;
  }
  return cleaned;
}

function slugToReadableTitle(slug: string): string {
  const clean = cleanMangaSlug(slug);
  return clean
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || "Mangastoon";
}

function getRequestedLeerCapituloChapterNumber(chapterId: string | null) {
  return chapterId?.match(/^lc-ch-(\d+(?:\.\d+)?)$/)?.[1] ?? null;
}

async function resolvePredictiveLeerCapituloChapterUrl(mangaSlug: string, chapterNumber: string): Promise<string | null> {
  try {
    const source = await fetchMangaVfSourceBySlug(mangaSlug);
    const mangaUrl = source?.url?.trim();
    if (!mangaUrl) return null;

    const cleanUrl = mangaUrl.replace(/\/$/, "");
    const parts = cleanUrl.split("/manga/");
    if (parts.length < 2) return null;

    return `${parts[0]}/leer/${parts[1]}/${chapterNumber}/`;
  } catch (error) {
    logger.error("[PredictiveURL] Error resolving predictive URL:", error);
    return null;
  }
}

async function resolveLatestLeerCapituloChapter(slug: string, chapterNumber: string) {
  const cacheKey = stableCacheKey("leercapitulo-latest-chapter", [slug, chapterNumber]);
  return getOrSetCached(
    cacheKey,
    60 * 5,
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const response = await fetchMangaVfAPI(`/api/v1/manga/latest`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return null;

        const payload = (await response.json()) as MangaVfLatestResponse;
        const cleanSlug = cleanMangaSlug(slug.startsWith("lc-") ? slug.substring(3) : slug);
        const item = (payload.recientes ?? []).find((entry) => cleanMangaSlug(entry.slug ?? "") === cleanSlug);
        const chapter = item?.chapters?.find((entry) => entry.number?.trim() === chapterNumber);
        const chapterUrl = chapter?.url?.trim();
        if (!item || !chapter || !chapterUrl) return null;

        return {
          title: item.title || slugToReadableTitle(slug),
          cover: item.cover || "",
          chapter,
        };
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    },
    { shouldCache: (value) => value !== null }
  );
}

async function fetchLeerCapituloPagesByUrl(chapterUrl: string) {
  const cacheKey = stableCacheKey("leercapitulo-pages-url", [chapterUrl]);
  return getOrSetCached(
    cacheKey,
    300, // 5 minutos (evita URLs de CDN rotadas/expiradas de LeerCapitulo)
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetchMangaVfAPI(
          `/api/v1/manga/extract?url=${encodeURIComponent(chapterUrl)}`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!response.ok) return [];
        const payload = (await response.json()) as MangaVfExtractResponse;
        return (payload.images ?? payload.pages ?? []).filter(Boolean);
      } catch {
        return [];
      } finally {
        clearTimeout(timeout);
      }
    },
    { shouldCache: (pages) => pages.length > 0 }
  );
}



async function resolveLocalMangaIdentity(slug: string, lang: SupportedLanguage) {
  try {
    const normalizedSlug = slug.startsWith("lc-") ? slug.substring(3) : slug;
    const cleanSlug = cleanMangaSlug(normalizedSlug);
    const cleanTitle = cleanSlug.replace(/-/g, " ");
    const searchParams = new URLSearchParams();
    searchParams.set("title", cleanTitle);
    searchParams.set("limit", "15");

    const controller1 = new AbortController();
    const timeout1 = setTimeout(() => controller1.abort(), 8000);
    let response: Response;
    try {
      response = await fetchLocalAPI(`/api/comics?${searchParams.toString()}`, {
        cache: "no-store",
        signal: controller1.signal,
      });
    } finally {
      clearTimeout(timeout1);
    }

    let comics: any[] = [];
    if (response && response.ok) {
      const payload = await response.json();
      comics = extractLocalComics(payload);
    }

    let comic = comics.find((item) => {
      const comicSlug = getStringValue(item, ["slug", "manga_slug", "comic_slug"]);
      const cleanComicSlug = cleanMangaSlug(comicSlug);
      return cleanComicSlug === cleanSlug || cleanSlug.endsWith(`-${cleanComicSlug}`);
    });

    if (!comic) {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 8000);
      let fallbackResponse: Response;
      try {
        fallbackResponse = await fetchLocalAPI("/api/comics?limit=300", {
          cache: "no-store",
          signal: controller2.signal,
        });
      } finally {
        clearTimeout(timeout2);
      }

      if (fallbackResponse && fallbackResponse.ok) {
        const payload = await fallbackResponse.json();
        const allComics = extractLocalComics(payload);
        comic = allComics.find((item) => {
          const comicSlug = getStringValue(item, ["slug", "manga_slug", "comic_slug"]);
          const cleanComicSlug = cleanMangaSlug(comicSlug);
          return cleanComicSlug === cleanSlug || cleanSlug.endsWith(`-${cleanComicSlug}`);
        });
      }
    }

    if (!comic) {
      return null;
    }

    const numericId = getStringValue(comic, ["id"]);
    const controller3 = new AbortController();
    const timeout3 = setTimeout(() => controller3.abort(), 8000);
    let detailResponse: Response | null = null;
    try {
      if (numericId) {
        detailResponse = await fetchLocalAPI(`/api/comics/${encodeURIComponent(numericId)}`, {
          cache: "no-store",
          signal: controller3.signal,
        });
      }
    } finally {
      clearTimeout(timeout3);
    }

    let fullComic = comic;
    if (detailResponse?.ok) {
      const details = extractLocalComics(await detailResponse.json())[0];
      if (details) {
        fullComic = {
          ...comic,
          ...details,
          recent_chapters: details.recent_chapters || comic.recent_chapters || (comic as any).recent_chapters
        };
      }
    }
    const comicSlug = getStringValue(fullComic, ["slug", "manga_slug", "comic_slug"]) || cleanSlug;
    const rawTitle = getStringValue(fullComic, ["title", "name", "comic_title", "original_title"]);
    const title = await getLocalizedTitleAsync({ titleMap: getLocalTitleMap(fullComic), title: rawTitle, isLocal: true }, lang) || "Mangastoon";
    const coverImage = normalizeLocalImageUrl(
      getStringValue(fullComic, ["coverImage", "cover_image", "cover", "thumbnail", "image", "poster", "url_cover"])
    );

    return {
      slug: comicSlug,
      title,
      coverImage,
      segments: uniqueNonEmpty([comicSlug, title].map(toMonlineSegment)),
      chapters: getLocalChapters(fullComic),
    };
  } catch (error) {
    logger.error(`[resolveLocalMangaIdentity] Error resolving manga for slug ${slug}:`, error);
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetchLocalAPI(`/api/chapters/${encodeURIComponent(chapterId)}/pages`, {
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as LocalPagesResponse;
    const rawPages = payload.data?.url_pages ?? (payload.data as Record<string, unknown> | null | undefined)?.urlPages;
    const pages = filterMonlineChapterPageUrls(rawPages);

    return pages.map(normalizeLocalImageUrl);
  } catch (error) {
    logger.error(`[resolveLocalChapterPages] Error fetching pages for chapter ${chapterId}:`, error);
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
  appendReadableContentRatings(search);

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

  // Realizar el primer request para obtener la primera tanda de capítulos y el total
  const firstResponse = await fetchMangaDex(buildFeedUrl(mangaId, lang, limit, offset));

  if (!firstResponse.ok) {
    throw new Error(firstResponse.status === 429 ? "RATE_LIMIT" : "CHAPTER_FEED_FAILED");
  }

  const firstPayload = (await firstResponse.json()) as ChapterFeedResponse;
  const chapters: ChapterFeedItem[] = [...(firstPayload.data ?? [])].filter((ch) => !ch.attributes?.externalUrl);
  const total = firstPayload.total ?? (firstPayload.data?.length ?? 0);
  const limitReturned = firstPayload.limit ?? limit;

  // Si hay más capítulos que el límite retornado, descargar el resto en paralelo
  if (total > limitReturned) {
    const promises: Promise<Response>[] = [];
    offset = limitReturned;

    while (offset < total) {
      promises.push(fetchMangaDex(buildFeedUrl(mangaId, lang, limit, offset)));
      offset += limitReturned;
    }

    const responses = await Promise.all(promises);

    for (const response of responses) {
      if (!response.ok) {
        if (response.status === 429) {
          // Rate limit en un batch parcial: no abortamos todo, seguimos con lo que tenemos
          logger.warn("[resolveAllChapters] Rate limit (429) en un batch parcial, devolviendo resultados parciales");
          continue;
        }
        // Otro error no crítico: logueamos y continuamos
        logger.warn(`[resolveAllChapters] Request fallido con status ${response.status}, saltando batch`);
        continue;
      }
      const payload = (await response.json()) as ChapterFeedResponse;
      chapters.push(...(payload.data ?? []).filter((ch) => !ch.attributes?.externalUrl));
    }
  }

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
  const targetChapter = preferredChapter ?? chapters[0] ?? null;
  if (!targetChapter?.id) {
    return { chapter: null, pages: [] };
  }

  try {
    const pages = await fetchChapterPages(targetChapter.id, { mangaSegments, chapter: targetChapter });
    if (pages.length > 0) {
      return { chapter: targetChapter, pages };
    }
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      throw error;
    }
  }

  // Fallback rápido: si el capítulo solicitado no tiene páginas, probamos con el primero de la lista
  if (preferredChapter && chapters[0] && chapters[0].id !== preferredChapter.id) {
    try {
      const pages = await fetchChapterPages(chapters[0].id, { mangaSegments, chapter: chapters[0] });
      if (pages.length > 0) {
        return { chapter: chapters[0], pages };
      }
    } catch {}
  }

  return { chapter: targetChapter, pages: [] };
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
  search.set("manga", mangaId);
  search.set("chapter", chapterNumber);
  search.set("limit", "1");
  appendReadableContentRatings(search);

  const response = await fetchMangaDex(`https://api.mangadex.org/chapter?${search.toString()}`);

  if (!response.ok) return null;

  const payload = (await response.json()) as ChapterFeedResponse;
  const chapter = payload.data?.[0] ?? null;
  if (chapter?.attributes?.externalUrl) {
    return null;
  }
  return chapter;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isDmcaBlocked(id)) {
    return NextResponse.json(
      { error: "Content removed due to copyright complaint", code: "CONTENT_REMOVED_DMCA" },
      { status: 451 }
    );
  }
  const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"));
  const chapterId = request.nextUrl.searchParams.get("chapter");
  const slug = request.nextUrl.searchParams.get("slug");
  const limit = Math.max(0, Number(request.nextUrl.searchParams.get('limit')) || 20);
  const offset = Math.max(0, Number(request.nextUrl.searchParams.get('offset')) || 0);
  const excludeChapters = request.nextUrl.searchParams.get("excludeChapters") === "true";
  const responseCacheKey = readResponseCacheKey(id, lang, chapterId, excludeChapters);
  const cachedPayload = await getCached<ReaderApiPayload>(responseCacheKey);

  if (cachedPayload) {
    const pages = cachedPayload.pages;
    const hasBrokenOlympus = Array.isArray(pages) && (pages as string[]).some(
      (page) => page && (page.includes("olympusxyz.com") || page.includes("olympusbiblioteca.com"))
    );
    if (!hasBrokenOlympus) {
      return NextResponse.json(cachedPayload, {
        headers: readCacheHeaders("HIT"),
      });
    }
  }

  try {
    const localManga = await fetchLocalMangaIdentity(id, lang);

    if (localManga) {
      let mergedChapters = [...localManga.chapters];
      let lcDetails: any = null;
      let paginatedChapters = mergedChapters;

      // Try to fetch and merge external chapters (Spanish from LeerCapitulo/MangaDex, others from MangaDex)
      // Bypassed for local mangas to avoid slow external API queries and transition timeouts (8s limit)
      if (excludeChapters) {
        paginatedChapters = [];
      } else {
        paginatedChapters = mergedChapters;
      }

      const currentChapter =
        mergedChapters.find((chapter) => chapter.id === chapterId) ??
        mergedChapters[0] ??
        null;

      let pages: string[] = [];
      if (currentChapter) {
        const isLocalChapter = localManga.chapters.some((ch) => ch.id === currentChapter.id);
        if (isLocalChapter) {
          pages =
            currentChapter.localPages && currentChapter.localPages.length > 0
              ? currentChapter.localPages
              : await fetchLocalChapterPages(currentChapter.id);

          const hasBrokenOlympus = pages.some(
            (page) => page.includes("olympusxyz.com") || page.includes("olympusbiblioteca.com")
          );

          // Fallback robusto: si las páginas locales están vacías (p. ej. fueron filtradas porque eran portadas
          // o hubo error en base de datos) o contienen URLs rotas de Olympus, intentamos traerlas de fuentes externas (LeerCapitulo / MangaDex)
          if ((pages.length === 0 || hasBrokenOlympus) && currentChapter.attributes?.chapter) {
            logger.info(`[Fallback] Capítulo local ${currentChapter.id} (número ${currentChapter.attributes.chapter}) ${hasBrokenOlympus ? "contiene URLs rotas de Olympus" : "no tiene páginas válidas"}. Buscando en fuentes externas...`);
            try {
              const queryTitle = localManga.title || slug || id;
              const resolution = await resolveBestSource(queryTitle, queryTitle);
              let fallbackPages: string[] = [];

              // 1. Intentar con LeerCapitulo
              if (resolution.leercapituloSlug) {
                const extDetails = resolution.leercapituloDetails || await fetchMangaVfDetailsBySlug(resolution.leercapituloSlug);
                if (extDetails) {
                  const extChapters = mapMangaVfChapters(extDetails);
                  const matchingExtChapter = extChapters.find(
                    (ch) => ch.attributes?.chapter === currentChapter.attributes?.chapter
                  );
                  if (matchingExtChapter) {
                    fallbackPages = await fetchMangaVfPages(extDetails, matchingExtChapter.id);
                    if (fallbackPages.length > 0) {
                      logger.info(`[Fallback] Páginas recuperadas exitosamente desde LeerCapitulo para el capítulo ${currentChapter.attributes.chapter}`);
                    }
                  }
                }
              }

              // 2. Intentar con MangaDex si LeerCapitulo falló o no estaba disponible
              if (fallbackPages.length === 0 && resolution.mangadexId) {
                const matchingExtChapter = await findChapterByNumber(
                  resolution.mangadexId,
                  lang,
                  currentChapter.attributes.chapter
                );
                if (matchingExtChapter) {
                  fallbackPages = await fetchChapterPages(matchingExtChapter.id, {
                    mangaSegments: localManga.segments || [localManga.slug],
                    chapter: matchingExtChapter,
                  });
                  if (fallbackPages.length > 0) {
                    logger.info(`[Fallback] Páginas recuperadas exitosamente desde MangaDex para el capítulo ${currentChapter.attributes.chapter}`);
                  }
                }
              }

              if (fallbackPages.length > 0) {
                pages = fallbackPages;
              }
            } catch (fallbackErr) {
              logger.error(`[Fallback] Error al intentar resolver páginas externas para el capítulo local ${currentChapter.id}:`, fallbackErr);
            }
          }
        } else {
          // External chapter pages resolution
          const isMangaDexChapterId = isMangaDexUuid(currentChapter.id);
          if (isMangaDexChapterId) {
            pages = await fetchChapterPages(currentChapter.id, {
              mangaSegments: [localManga.slug],
              chapter: currentChapter,
            });
          } else if (lcDetails) {
            pages = await fetchMangaVfPages(lcDetails, currentChapter.id);
          }
        }
      }

      // Registrar capítulo roto en Supabase si no tiene páginas
      if (pages.length === 0 && currentChapter) {
        await reportBrokenChapter(
          localManga.slug,
          localManga.title,
          currentChapter.id,
          currentChapter.attributes?.chapter || "0"
        );
      }

      return cachedReadResponse(responseCacheKey, {
        mangaTitle: localManga.title,
        comicSlug: localManga.slug,
        coverImage: localManga.coverImage,
        chapters: excludeChapters ? [] : stripChaptersForClient(paginatedChapters),
      currentChapter: stripChapterForClient(currentChapter),
        pages: pages.map(normalizePageUrlToProxy),
        englishFallbackChapter: null,
        fallbackReason: null,
        isExternalSource: false,
        isLocal: true,
      });
    }

    const latestChapterNumber = getRequestedLeerCapituloChapterNumber(chapterId);
    if (!localManga && lang === "es" && latestChapterNumber) {
      let latestChapter = await resolveLatestLeerCapituloChapter(id, latestChapterNumber);
      let chapterUrl = latestChapter?.chapter.url?.trim();
      let cover = latestChapter?.cover || "";
      let mangaTitle = latestChapter?.title || slugToReadableTitle(id);

      if (!chapterUrl) {
        const resolution = await resolveBestSource(id, slug);
        if (resolution.leercapituloSlug) {
          chapterUrl = await resolvePredictiveLeerCapituloChapterUrl(
            resolution.leercapituloSlug,
            latestChapterNumber
          ) ?? undefined;
          
          if (resolution.leercapituloDetails) {
            cover = resolution.leercapituloDetails.cover || cover;
            mangaTitle = resolution.leercapituloDetails.manga_title || resolution.leercapituloDetails.title || mangaTitle;
          }
        }
      }

      const pages = chapterUrl ? await fetchLeerCapituloPagesByUrl(chapterUrl) : [];

      if (pages.length > 0) {
        const currentChapter = {
          id: chapterId || `lc-ch-${latestChapterNumber}`,
          attributes: {
            chapter: latestChapterNumber,
            title: `Capítulo ${latestChapterNumber}`,
            translatedLanguage: "es",
            readableAt: new Date().toISOString(),
            publishAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };

        let fullChapters: ChapterFeedItem[] = [currentChapter];
        try {
          const resolution = await resolveBestSource(id, slug);
          if (resolution.leercapituloSlug) {
            const details = resolution.leercapituloDetails || await fetchMangaVfDetailsBySlug(resolution.leercapituloSlug);
            if (details) {
              const mapped = mapMangaVfChapters(details);
              if (mapped.length > 0) {
                fullChapters = mapped;
              }
            }
          }
        } catch (err) {
          logger.error("[Shortcut] Error fetching full chapter list for navigation:", err);
        }

        if (!fullChapters.some(ch => ch.id === currentChapter.id)) {
          fullChapters.push(currentChapter);
        }

        // Sort descending by chapter number
        fullChapters.sort((a, b) => {
          const aNum = parseFloat(a.attributes?.chapter || "0");
          const bNum = parseFloat(b.attributes?.chapter || "0");
          return bNum - aNum;
        });

        return cachedReadResponse(responseCacheKey, {
          mangaTitle,
          comicSlug: id,
          coverImage: cover,
          chapters: excludeChapters ? [] : stripChaptersForClient(fullChapters),
          currentChapter: stripChapterForClient(currentChapter),
          pages: pages.map(normalizePageUrlToProxy),
          englishFallbackChapter: null,
          fallbackReason: null,
          isExternalSource: false,
          isLocal: true,
        });
      }
    }

    const resolution = await resolveBestSource(id, slug);

    if ((resolution.source === "leercapitulo" || (chapterId && chapterId.startsWith("lc-ch-"))) && resolution.leercapituloSlug) {
      const details = resolution.leercapituloDetails || await fetchMangaVfDetailsBySlug(resolution.leercapituloSlug);

      if (details) {
        const chapters = mapMangaVfChapters(details);
        
        let requestedChapterNumber: string | null = null;
        if (chapterId && isMangaDexUuid(chapterId)) {
          try {
            const mdChapter = await fetchChapterDetails(chapterId);
            requestedChapterNumber = mdChapter?.attributes?.chapter ?? null;
          } catch {}
        }
        
        const currentChapter =
          chapters.find((chapter) => chapter.id === chapterId) ??
          (requestedChapterNumber ? chapters.find((chapter) => chapter.attributes?.chapter === requestedChapterNumber) : null) ??
          chapters[0] ??
          null;
        const pages = currentChapter ? await fetchMangaVfPages(details, currentChapter.id) : [];

        if (pages.length === 0 && currentChapter) {
          await reportBrokenChapter(
            id,
            details.manga_title || details.title || "MangaStoon",
            currentChapter.id,
            currentChapter.attributes?.chapter || "0"
          );
        }

        return cachedReadResponse(responseCacheKey, {
          mangaTitle: details.manga_title || details.title || "MangaStoon",
          comicSlug: id,
          coverImage: details.cover || "",
          chapters: excludeChapters ? [] : stripChaptersForClient(chapters),
          currentChapter: stripChapterForClient(currentChapter),
          pages: pages.map(normalizePageUrlToProxy),
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
            mangaTitle: slugToReadableTitle(id),
            coverImage: "",
            chapters: chapterId
              ? [{ id: chapterId, attributes: { chapter: null, title: null, translatedLanguage: "es" } }]
              : [],
            currentChapter: chapterId
              ? { id: chapterId, attributes: { chapter: null, title: null, translatedLanguage: "es" } }
              : null,
            pages: pages.map(normalizePageUrlToProxy),
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
    }

    const targetMangaDexId = resolution.mangadexId || id;
    
    if (!isMangaDexUuid(targetMangaDexId)) {
      const pages = chapterId ? await fetchLocalChapterPages(chapterId) : [];

      return cachedReadResponse(
        responseCacheKey,
        {
          mangaTitle: slugToReadableTitle(id),
          coverImage: "",
          chapters: chapterId
            ? [{ id: chapterId, attributes: { chapter: null, title: null, translatedLanguage: "es" } }]
            : [],
          currentChapter: chapterId
            ? { id: chapterId, attributes: { chapter: null, title: null, translatedLanguage: "es" } }
            : null,
          pages: pages.map(normalizePageUrlToProxy),
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

    // Shortcut si se solicita excluir capítulos y tenemos el ID de capítulo actual
    if (excludeChapters && chapterId && isMangaDexUuid(chapterId)) {
      const [mangaIdentity, requestedChapter] = await Promise.all([
        fetchMangaIdentity(targetMangaDexId, lang),
        fetchChapterDetails(chapterId),
      ]);

      if (requestedChapter) {
        const isExternal = !!requestedChapter.attributes?.externalUrl;

        if (isExternal) {
          return cachedReadResponse(responseCacheKey, {
            mangaTitle: mangaIdentity.title,
            coverImage: mangaIdentity.coverImage,
            chapters: [],
            currentChapter: stripChapterForClient(requestedChapter),
            pages: [],
            englishFallbackChapter: null,
            fallbackReason: "unavailable",
            error: "Capítulo externo no disponible.",
            code: "LOCAL_PAGES_UNAVAILABLE",
          }, { status: 404 });
        }

        const pages = await fetchChapterPages(chapterId, {
          mangaSegments: mangaIdentity.segments,
          chapter: requestedChapter,
        });

        if (pages.length === 0) {
          await reportBrokenChapter(
            targetMangaDexId || id,
            mangaIdentity.title || "MangaStoon",
            requestedChapter.id,
            requestedChapter.attributes?.chapter || "0"
          );
        }

        return cachedReadResponse(responseCacheKey, {
          mangaTitle: mangaIdentity.title,
          coverImage: mangaIdentity.coverImage,
          chapters: [],
          currentChapter: stripChapterForClient(requestedChapter),
          pages: pages.map(normalizePageUrlToProxy),
          englishFallbackChapter: null,
          fallbackReason: null,
          isExternalSource: false,
        });
      }
    }

    let requestedChapterNumber: string | null = null;
    if (chapterId && !isMangaDexUuid(chapterId)) {
      const match = chapterId.match(/(?:lc-ch-)?(\d+(?:\.\d+)?)/);
      requestedChapterNumber = match ? match[1] : null;
    }

    const [mangaIdentity, chapters, requestedChapter] = await Promise.all([
      fetchMangaIdentity(targetMangaDexId, lang),
      fetchAllChapters(targetMangaDexId, lang),
      chapterId && isMangaDexUuid(chapterId) ? fetchChapterDetails(chapterId) : Promise.resolve(null),
    ]);
    const mangaTitle = mangaIdentity.title;
    const coverImage = mangaIdentity.coverImage;
    const mangaSegments = mangaIdentity.segments;

    let finalChapters = chapters;
    let servedLanguage: SupportedLanguage = lang;
    let isExternalSource = false;

    if (finalChapters.length === 0 && lang === "en") {
      const backupChapters = await fetchConsumetChapters(mangaTitle);
      if (backupChapters && backupChapters.length > 0) {
        finalChapters = backupChapters;
        isExternalSource = true;
      }
    }

    let currentChapter = finalChapters.find((chapter) => chapter.id === chapterId) ?? null;

    if (!currentChapter && requestedChapterNumber) {
      currentChapter = await findChapterByNumber(targetMangaDexId, servedLanguage, requestedChapterNumber);
    } else if (!currentChapter && requestedChapter?.attributes?.chapter) {
      currentChapter = await findChapterByNumber(targetMangaDexId, servedLanguage, requestedChapter.attributes.chapter);
    }

    let englishFallbackChapter: ChapterFeedItem | null = null;
    let fallbackReason: "english" | "unavailable" | null = null;
    if (!currentChapter && chapterId && (requestedChapter || requestedChapterNumber)) {
      if (servedLanguage !== "en") {
        const fallbackNum = requestedChapterNumber || requestedChapter?.attributes?.chapter;
        if (fallbackNum) {
          try {
            englishFallbackChapter = await findChapterByNumber(targetMangaDexId, "en", fallbackNum);
            if (englishFallbackChapter) {
              fallbackReason = "english";
            }
          } catch (err) {
            logger.error(`[GET /api/read/[id]] Error resolving English fallback chapter:`, err);
          }
        }
      }

      if (!englishFallbackChapter) {
        fallbackReason = "unavailable";
      }

      const isEnglishFallbackExternal = !!englishFallbackChapter?.attributes?.externalUrl;
      const hasNoNativeFallback = !englishFallbackChapter || isEnglishFallbackExternal;

      if (hasNoNativeFallback) {
        return cachedReadResponse(responseCacheKey, {
          mangaTitle,
          coverImage,
          chapters: excludeChapters ? [] : stripChaptersForClient(finalChapters),
          currentChapter: stripChapterForClient(requestedChapter ?? { id: chapterId, attributes: { chapter: requestedChapterNumber, translatedLanguage: servedLanguage } } as any),
          pages: [],
          englishFallbackChapter: null,
          fallbackReason: "unavailable",
          error: "Capítulo no disponible nativamente.",
          code: "LOCAL_PAGES_UNAVAILABLE",
        }, { status: 404 });
      }

      return cachedReadResponse(responseCacheKey, {
        mangaTitle,
        coverImage,
        chapters: excludeChapters ? [] : stripChaptersForClient(finalChapters),
        currentChapter: stripChapterForClient(requestedChapter ?? { id: chapterId, attributes: { chapter: requestedChapterNumber, translatedLanguage: servedLanguage } } as any),
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

    if (pages.length === 0 && currentChapter) {
      await reportBrokenChapter(
        targetMangaDexId || id,
        mangaTitle || "MangaStoon",
        currentChapter.id,
        currentChapter.attributes?.chapter || "0"
      );

      if (servedLanguage !== "en") {
        const fallbackNum = currentChapter.attributes?.chapter;
        if (fallbackNum) {
          try {
            englishFallbackChapter = await findChapterByNumber(targetMangaDexId, "en", fallbackNum);
            if (englishFallbackChapter) {
              fallbackReason = "english";
            }
          } catch (err) {
            logger.error(`[GET /api/read/[id]] Error resolving English fallback chapter for empty pages:`, err);
          }
        }
      }

      if (!englishFallbackChapter) {
        fallbackReason = "unavailable";
      }
    }

    const isEnglishFallbackExternal = !!englishFallbackChapter?.attributes?.externalUrl;
    const hasNoNativeFallback = !englishFallbackChapter || isEnglishFallbackExternal;
    const isCurrentChapterExternal = !!currentChapter?.attributes?.externalUrl;

    if ((pages.length === 0 || isCurrentChapterExternal) && hasNoNativeFallback && !isExternalSource) {
      return cachedReadResponse(responseCacheKey, {
        mangaTitle,
        coverImage,
        chapters: excludeChapters ? [] : stripChaptersForClient(finalChapters),
        currentChapter: stripChapterForClient(currentChapter),
        pages: [],
        englishFallbackChapter: null,
        fallbackReason: "unavailable",
        error: "Capítulo no disponible nativamente.",
        code: "LOCAL_PAGES_UNAVAILABLE",
      }, { status: 404 });
    }

    const payload = {
      mangaTitle,
      coverImage,
      chapters: excludeChapters ? [] : stripChaptersForClient(finalChapters),
      currentChapter: stripChapterForClient(currentChapter),
      pages: pages.map(normalizePageUrlToProxy),
      englishFallbackChapter,
      fallbackReason,
      isExternalSource,
    };

    const options = {
      cache: finalChapters.length > 0 || pages.length > 0,
    };

    const readResponse = await cachedReadResponse(responseCacheKey, payload, options);

    return readResponse;
  } catch (error) {
    logger.error("[GET /api/read/[id]] Error occurred in GET handler:", error);
    const isRateLimit = error instanceof Error && error.message === "RATE_LIMIT";

    return NextResponse.json(
      {
        error: isRateLimit ? "Servidor ocupado, reintentando..." : "No pudimos conectar con MangaDex.",
        code: isRateLimit ? "RATE_LIMIT" : "MANGADEX_UNAVAILABLE",
      },
      {
        status: isRateLimit ? 429 : 503,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "X-Mangastoon-Cache": "BYPASS",
        },
      }
    );
  }
}

async function fetchConsumetChapters(title: string) {
  try {
    // Paso 1: Buscar el manga por título para obtener su ID en Manganato
    const searchRes = await fetch(`${CONSUMET_API_URL}/${encodeURIComponent(title)}`);
    const searchData = await searchRes.json();
    const mangaId = searchData.results?.[0]?.id;

    if (!mangaId) return null;

    // Paso 2: Obtener la lista de capítulos usando ese ID
    const infoRes = await fetch(`https://consumet-api-one.vercel.app/manga/manganato/info?id=${mangaId}`);
    const infoData = await infoRes.json();
    
    type ConsumetChapter = {
      id: string;
      number?: string | number;
      title?: string;
    };

    return (infoData.chapters as ConsumetChapter[])?.map((ch) => ({
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
