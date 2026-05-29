import { logger } from "./logger";
import type { MangaShowcaseItem } from "../components/home-carousel";
import type { SupportedLanguage } from "../components/language-provider";
import { getLocalizedTitle } from "./get-localized-title";
import { sanitizeText } from "./translation";
import {
  appendMangaDexAvailableLanguageFilters,
  getMangaDexAvailableLanguages,
  getMangaDexRequestHeaders,
  toMangaDexApiUrl,
} from "./mangadex-config";
import { translateTagName } from "./tagTranslations";
import { buildComicPath, slugify } from "./slugify";
import { MONLINE_API_URL as MONLINE_CONFIG_API_URL } from "./monline-config";
import { getCached, setCached, getOrSetCached } from "./server-cache";

export type MangaDexLocalizedText = Record<string, string>;

export type MangaDexManga = {
  id: string;
  type: "manga";
  attributes: {
    title?: MangaDexLocalizedText;
    altTitles?: MangaDexLocalizedText[];
    description?: MangaDexLocalizedText;
    originalLanguage?: string;
    contentRating?: string;
    createdAt?: string;
    updatedAt?: string;
    tags?: Array<{
      id: string;
      type: "tag";
      attributes?: {
        name?: MangaDexLocalizedText;
        group?: string;
      };
    }>;
  };
  relationships?: Array<{
    id: string;
    type: string;
    attributes?: {
      fileName?: string;
    };
  }>;
};

export type MangaDetails = {
  id: string;
  type?: string;
  author?: string;
  attributes?: {
    title?: MangaDexLocalizedText;
    altTitles?: MangaDexLocalizedText[];
    description?: MangaDexLocalizedText;
    status?: string;
    contentRating?: string;
    originalLanguage?: string;
    createdAt?: string;
    updatedAt?: string;
    tags?: Array<{
      id: string;
      type?: string;
      attributes?: {
        name?: MangaDexLocalizedText;
        group?: string;
      };
    }>;
  };
  relationships?: Array<{
    id: string;
    type: string;
    attributes?: {
      name?: string;
      fileName?: string;
    };
  }>;
};

export type MangaDexCollectionResponse = {
  data?: MangaDexManga[];
  total?: number;
  limit?: number;
  offset?: number;
  pagination?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
};

export type MangaDexStatisticsResponse = {
  statistics?: Record<
    string,
    {
      rating?: {
        average?: number | null;
      };
    }
  >;
};

export type MangaDexShowcaseItem = MangaShowcaseItem & {
  synopsis: string | null;
  titleMap?: MangaDexLocalizedText;
  altTitles?: MangaDexLocalizedText[];
  originalLanguage?: string;
  genres?: Array<{
    mal_id: number;
    name: string;
  }>;
  themes?: string[];
  tags?: string[];
  featuredTag?: string | null;
  createdAt?: string | null;
  isNsfw?: boolean;
};

export type LocalApiComic = Record<string, unknown>;

export type LocalApiComicsResponse = {
  data?: LocalApiComic[] | {
    comics?: LocalApiComic[];
    items?: LocalApiComic[];
    results?: LocalApiComic[];
    total?: number;
  };
  comics?: LocalApiComic[];
  items?: LocalApiComic[];
  results?: LocalApiComic[];
  total?: number;
  pagination?: {
    total?: number;
  };
};

export const SUPPORTED_READING_LANGUAGES = ["es", "es-la", "en", "pt-br"] as const;
export const SAFE_CONTENT_RATINGS = ["safe", "suggestive"] as const;
export const ADULT_CONTENT_RATINGS = ["erotica", "pornographic"] as const;

export function getAvailableTranslatedLanguageVariants(language: SupportedLanguage) {
  return getMangaDexAvailableLanguages(language);
}

export function getPreferredLanguageKeys(language: SupportedLanguage) {
  if (language === "es") {
    return ["es", "es-la", "en", "ja-ro", "ja"];
  }

  if (language === "pt") {
    return ["pt-br", "pt", "en", "ja-ro", "ja"];
  }

  return ["en", "ja-ro", "ja"];
}

export function getLocalizedValue(
  value: MangaDexLocalizedText | undefined,
  language: SupportedLanguage,
  fallbacks: string[] = []
) {
  if (!value) {
    return null;
  }

  const preferredKeys = [...getPreferredLanguageKeys(language), ...fallbacks];

  for (const key of preferredKeys) {
    if (value[key]) {
      return value[key];
    }
  }

  return Object.values(value)[0] ?? null;
}

export function getMangaTitle(manga: MangaDexManga, language: SupportedLanguage) {
  const title =
    getLocalizedValue(manga.attributes.title, language) ??
    manga.attributes.altTitles
      ?.map((entry) => getLocalizedValue(entry, language))
      .find(Boolean);

  return title ?? "Untitled Manga";
}

export function getMangaSynopsis(manga: MangaDexManga, language: SupportedLanguage) {
  return sanitizeText(getLocalizedValue(manga.attributes.description, language, ["en"]) ?? "");
}

export function getCoverUrl(manga: MangaDexManga) {
  const coverArt = manga.relationships?.find((relationship) => relationship.type === "cover_art");
  const fileName = coverArt?.attributes?.fileName;

  if (!fileName) {
    return "";
  }

  return `https://uploads.mangadex.org/covers/${manga.id}/${fileName}`;
}

export function getGenreTags(manga: MangaDexManga, language: SupportedLanguage) {
  const hiddenSensitiveTags = new Set(["Sexual Violence", "Erotica", "Hentai", "Gore"]);

  return (manga.attributes.tags ?? [])
    .filter((tag) => tag.attributes?.group === "genre")
    .filter((tag) => {
      const rawName = tag.attributes?.name?.en ?? Object.values(tag.attributes?.name ?? {})[0] ?? "";
      return !hiddenSensitiveTags.has(rawName);
    })
    .slice(0, 4)
    .map((tag, index) => ({
      mal_id: Number.parseInt(tag.id.replace(/\D/g, "").slice(0, 8) || `${index + 1}`, 10),
      name: translateTagName(getLocalizedValue(tag.attributes?.name, language, ["en"]) ?? "Genre", language),
    }));
}

export function getThemeTags(manga: MangaDexManga, language: SupportedLanguage) {
  return (manga.attributes.tags ?? [])
    .filter((tag) => tag.attributes?.group === "theme")
    .map((tag) => translateTagName(getLocalizedValue(tag.attributes?.name, language, ["en"]) ?? "Theme", language));
}

export function getAllTagNames(manga: MangaDexManga) {
  return (manga.attributes.tags ?? [])
    .map((tag) => tag.attributes?.name?.en ?? Object.values(tag.attributes?.name ?? {})[0] ?? null)
    .filter((tagName): tagName is string => Boolean(tagName));
}

const FEATURED_FORMAT_PRIORITY = ["Long Strip", "Full Color", "Web Comic"] as const;

export function getFeaturedFormatTag(manga: MangaDexManga, language: SupportedLanguage) {
  const formatTags = (manga.attributes.tags ?? []).filter(
    (entry) => entry.attributes?.group === "format"
  );

  const tag = FEATURED_FORMAT_PRIORITY
    .map((priorityName) =>
      formatTags.find((entry) => {
        const rawName = entry.attributes?.name?.en ?? Object.values(entry.attributes?.name ?? {})[0];
        return rawName === priorityName;
      })
    )
    .find(Boolean);

  if (!tag) {
    return null;
  }

  const rawName = getLocalizedValue(tag.attributes?.name, language, ["en"]) ?? null;
  return rawName ? translateTagName(rawName, language) : null;
}

export function isRecentlyCreated(manga: MangaDexManga) {
  const dateString = manga.attributes.createdAt ?? manga.attributes.updatedAt;

  if (!dateString) {
    return false;
  }

  const createdAt = new Date(dateString).getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt < 7 * 24 * 60 * 60 * 1000;
}

export function hasSensitiveAdultTag(manga: MangaDexManga | MangaDetails) {
  if (!manga.attributes) return false;
  const sensitiveTags = new Set(["Sexual Violence", "Erotica", "Hentai"]);
  const hasSensitiveTag = (manga.attributes.tags ?? []).some((tag) => {
    const rawName = tag.attributes?.name?.en ?? Object.values(tag.attributes?.name ?? {})[0] ?? "";
    return sensitiveTags.has(rawName);
  });

  return (
    hasSensitiveTag ||
    manga.attributes.contentRating === "erotica" ||
    manga.attributes.contentRating === "pornographic"
  );
}

export function isAdultShowcaseItem(item: Pick<MangaShowcaseItem, "isNsfw" | "genres" | "tags">) {
  if (item.isNsfw === true) {
    return true;
  }

  const adultKeywords = new Set([
    "hentai",
    "ecchi",
    "erotica",
    "nsfw",
    "+18",
    "18+",
    "erotic",
    "erotico",
    "adult",
    "porn",
    "xxx",
    "sexual violence",
    "sexual-violence"
  ]);

  const genres = item.genres?.map((g) => g.name.toLowerCase()) ?? [];
  const tags = item.tags?.map((t) => t.toLowerCase()) ?? [];

  return (
    genres.some((g) => adultKeywords.has(g) || /\b(adult|nsfw|hentai|erotic|erotico|porn|xxx|\+18|18\+|ecchi|sexual violence)\b/i.test(g)) ||
    tags.some((t) => adultKeywords.has(t) || /\b(adult|nsfw|hentai|erotic|erotico|porn|xxx|\+18|18\+|ecchi|sexual violence)\b/i.test(t))
  );
}

export async function fetchMangaDexCollection(url: string, signal?: AbortSignal) {
  try {
    const response = await fetch(url, {
      headers: getMangaDexRequestHeaders(),
      next: { revalidate: 3600 },
      signal,
    });

    if (!response.ok) {
      return { data: [], total: 0 };
    }

    const payload = (await response.json()) as MangaDexCollectionResponse;

    return {
      data: payload.data ?? [],
      total: payload.total ?? payload.pagination?.total ?? 0,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    logger.error("[mangadex] Failed to fetch collection", error);
    return { data: [], total: 0 };
  }
}

export async function fetchMangaDexStatistics(ids: string[], signal?: AbortSignal) {
  if (ids.length === 0) {
    return {};
  }

  const params = new URLSearchParams();
  ids.forEach((id) => params.append("manga[]", id));

  const url =
    typeof window === "undefined"
      ? toMangaDexApiUrl(`/statistics/manga?${params.toString()}`)
      : `/api/mangadex/statistics?${params.toString()}`;

  try {
    const response =
      typeof window === "undefined"
        ? await fetch(url, {
            headers: getMangaDexRequestHeaders(),
            next: { revalidate: 3600 },
            signal,
          })
        : await fetch(url, { signal });

    if (!response.ok) {
      return {};
    }

    const payload = (await response.json()) as MangaDexStatisticsResponse;
    return payload.statistics ?? {};
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    logger.error("[mangadex] Failed to fetch statistics", error);
    return {};
  }
}

export function mapToShowcaseItems(
  mangas: MangaDexManga[],
  statistics: Record<string, { rating?: { average?: number | null } }>,
  language: SupportedLanguage
): MangaDexShowcaseItem[] {
  return mangas.map((manga) => ({
    mal_id: Number.parseInt(manga.id.replace(/\D/g, "").slice(0, 9) || "0", 10),
    title: getLocalizedTitle(
      {
        titleMap: manga.attributes.title,
        altTitles: manga.attributes.altTitles,
      },
      language
    ),
    synopsis: getMangaSynopsis(manga, language),
    score: statistics[manga.id]?.rating?.average ?? null,
    url: buildComicPath(getLocalizedTitle(
      {
        titleMap: manga.attributes.title,
        altTitles: manga.attributes.altTitles,
      },
      language
    ), manga.id),
    mangaDexId: manga.id,
    titleMap: manga.attributes.title,
    altTitles: manga.attributes.altTitles,
    originalLanguage: manga.attributes.originalLanguage,
    images: {
      webp: {
        large_image_url: getCoverUrl(manga),
        image_url: getCoverUrl(manga),
      },
      jpg: {
        large_image_url: getCoverUrl(manga),
        image_url: getCoverUrl(manga),
      },
    },
    genres: getGenreTags(manga, language),
    themes: getThemeTags(manga, language),
    tags: getAllTagNames(manga).map((tagName) => translateTagName(tagName, language)),
    featuredTag: getFeaturedFormatTag(manga, language) ?? (isRecentlyCreated(manga) ? "NUEVO" : null),
    createdAt: manga.attributes.createdAt ?? null,
    isLocal: false,
    isNsfw: hasSensitiveAdultTag(manga),
  }));
}

function getLocalStringValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
}

function normalizeLocalImageUrl(value: string, apiBaseUrl: string) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return `/api/proxy-image?url=${encodeURIComponent(value)}`;
  }
  if (value.startsWith("//")) {
    return `/api/proxy-image?url=${encodeURIComponent(`https:${value}`)}`;
  }

  if (apiBaseUrl.startsWith("/")) {
    return `${apiBaseUrl.replace(/\/$/, "")}/${value.replace(/^\/+/, "")}`;
  }

  const imageUrl = `${apiBaseUrl.replace(/\/$/, "")}/${value.replace(/^\/+/, "")}`;
  return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
}

function getLocalGenres(source: LocalApiComic) {
  const rawGenres = source.genres ?? source.genre ?? source.tags ?? source.categories;
  const values = Array.isArray(rawGenres)
    ? rawGenres
    : typeof rawGenres === "string"
      ? rawGenres.split(",")
      : [];

  return values
    .map((genre) => {
      if (typeof genre === "string") return genre.trim();
      if (genre && typeof genre === "object") {
        return getLocalStringValue(genre as Record<string, unknown>, ["name", "title", "slug"]);
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 4);
}

function formatLocalRelativeTime(dateString: string | null | undefined, language: SupportedLanguage = "es") {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) {
    return language === "en" ? "just now" : language === "pt" ? "agora mesmo" : "hace instantes";
  }
  if (minutes < 60) {
    return language === "en" ? `${minutes} min ago` : language === "pt" ? `ha ${minutes} min` : `hace ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return language === "en" ? `${hours}h ago` : language === "pt" ? `ha ${hours} h` : `hace ${hours} h`;
  }

  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years >= 1) return language === "en" ? `${years}y ago` : language === "pt" ? `ha ${years}a` : `hace ${years} año${years === 1 ? "" : "s"}`;
  if (months >= 1) return language === "en" ? `${months}mo ago` : language === "pt" ? `ha ${months}m` : `hace ${months} mes${months === 1 ? "" : "es"}`;
  return language === "en" ? `${days}d ago` : language === "pt" ? `ha ${days}d` : `hace ${days} d`;
}

function getLocalChapterDate(chapter: Record<string, unknown>) {
  return getLocalStringValue(chapter, [
    "releaseDate",
    "release_date",
    "publishedAt",
    "published_at",
    "publishAt",
    "readableAt",
    "createdAt",
    "created_at",
    "updatedAt",
    "updated_at",
  ]);
}

function getLocalChapterTimestamp(chapter: Record<string, unknown>) {
  const rawDate = getLocalChapterDate(chapter);
  const timestamp = rawDate ? new Date(rawDate).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getLocalChapterNumber(chapter: Record<string, unknown>) {
  return getLocalStringValue(chapter, [
    "chapterNumber",
    "chapter_number",
    "chapter",
    "number",
    "name",
    "title",
  ]);
}

function getLocalChapterNumericNumber(chapter: Record<string, unknown>) {
  const cleaned = cleanLocalChapterLabel(getLocalChapterNumber(chapter));
  const parsed = Number.parseFloat(cleaned.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanLocalChapterLabel(value: string) {
  return value.replace(/^Cap[íi]tulo\s*/i, "").replace(/^Cap\.\s*/i, "").trim();
}

function getLocalChapterSortValue(chapter: Record<string, unknown>) {
  const numericNumber = getLocalChapterNumericNumber(chapter);

  if (numericNumber !== null) {
    return numericNumber;
  }

  return getLocalChapterTimestamp(chapter);
}

function selectLatestAndPenultimateLocalChapters(chapters: Record<string, unknown>[]) {
  const uniqueChapters = new Map<string, Record<string, unknown>>();

  chapters.forEach((chapter) => {
    const id = getLocalStringValue(chapter, ["id", "chapterId", "chapter_id", "mangadex_chapter_id", "mangaDexChapterId"]);
    const chapterNumber = cleanLocalChapterLabel(getLocalChapterNumber(chapter));
    const key = id || chapterNumber;

    if (key && !uniqueChapters.has(key)) {
      uniqueChapters.set(key, chapter);
    }
  });

  const ordered = [...uniqueChapters.values()]
    .filter((chapter) => {
      const numericNumber = getLocalChapterNumericNumber(chapter);
      return numericNumber === null || numericNumber > 0;
    })
    .sort((a, b) => getLocalChapterSortValue(a) - getLocalChapterSortValue(b));

  const latest = ordered[ordered.length - 1];
  const penultimate = ordered[ordered.length - 2];

  return [latest, penultimate].filter((chapter): chapter is Record<string, unknown> => Boolean(chapter));
}

function mapLocalChapterPreviews(chapters: Record<string, unknown>[]) {
  const uniqueChapters = new Map<string, Record<string, unknown>>();

  chapters.forEach((chapter) => {
    const id = getLocalStringValue(chapter, ["id", "chapterId", "chapter_id", "mangadex_chapter_id", "mangaDexChapterId"]);
    const chapterNumber = getLocalChapterNumber(chapter);
    const key = id || chapterNumber;

    if (key && !uniqueChapters.has(key)) {
      uniqueChapters.set(key, chapter);
    }
  });

  return selectLatestAndPenultimateLocalChapters([...uniqueChapters.values()]).flatMap((chapter) => {
    const publishedAt = getLocalChapterDate(chapter);
    const chapterNumber = cleanLocalChapterLabel(getLocalChapterNumber(chapter));

    if (!chapterNumber) {
      return [];
    }

    return [{
      id: getLocalStringValue(chapter, ["id", "chapterId", "chapter_id", "mangadex_chapter_id", "mangaDexChapterId"]) || null,
      chapter: chapterNumber,
      timeAgo: formatLocalRelativeTime(publishedAt),
      publishedAt: publishedAt || null,
    }];
  }).slice(0, 2);
}

function getLocalTitleMap(source: LocalApiComic) {
  const title = getLocalStringValue(source, ["title", "name", "comic_title", "original_title"]);
  const englishTitle = getLocalStringValue(source, ["english_title", "title_en", "en_title"]);
  const spanishTitle = getLocalStringValue(source, ["spanish_title", "title_es", "es_title"]);
  const portugueseTitle = getLocalStringValue(source, ["portuguese_title", "title_pt", "pt_title"]);

  return {
    ...(title ? { es: title } : {}),
    ...(englishTitle ? { en: englishTitle } : {}),
    ...(spanishTitle ? { es: spanishTitle } : {}),
    ...(portugueseTitle ? { pt: portugueseTitle } : {}),
  };
}

function getLocalLatestChapters(source: LocalApiComic) {
  const primaryChapter =
    source.last_chapter && typeof source.last_chapter === "object"
      ? [source.last_chapter as Record<string, unknown>]
      : [];
  const rawChapters =
    source.latestChapters ??
    source.latest_chapters ??
    source.recentChapters ??
    source.recent_chapters ??
    source.chapters;
  const chapters = Array.isArray(rawChapters)
    ? rawChapters.filter((chapter): chapter is Record<string, unknown> => Boolean(chapter) && typeof chapter === "object")
    : [];

  return mapLocalChapterPreviews([...primaryChapter, ...chapters]);
}

export async function fetchLocalChapterPreviews(
  comic: LocalApiComic,
  apiBaseUrl: string,
  signal?: AbortSignal
) {
  const comicId = getLocalStringValue(comic, ["id"]);

  if (!comicId) {
    return getLocalLatestChapters(comic);
  }

  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/comics/${comicId}`, {
      next: { revalidate: 120 },
      signal,
    });

    if (!response.ok) {
      return getLocalLatestChapters(comic);
    }

    const payload = (await response.json()) as LocalApiComicsResponse;
    const detail = extractLocalApiComics(payload)[0];
    const scans = detail?.comicScans;
    const chapters = Array.isArray(scans)
      ? scans.flatMap((scan) => {
          if (!scan || typeof scan !== "object") return [];
          const rawChapters = (scan as Record<string, unknown>).chapters;
          return Array.isArray(rawChapters)
            ? rawChapters.filter((chapter): chapter is Record<string, unknown> => Boolean(chapter) && typeof chapter === "object")
            : [];
        })
      : [];

    return chapters.length > 0 ? mapLocalChapterPreviews(chapters) : getLocalLatestChapters(comic);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    return getLocalLatestChapters(comic);
  }
}

export function extractLocalApiComics(payload: LocalApiComicsResponse) {
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.data?.comics)) return payload.data.comics;
  if (Array.isArray(payload.data?.items)) return payload.data.items;
  if (Array.isArray(payload.data?.results)) return payload.data.results;
  if (payload.data && typeof payload.data === "object") return [payload.data as LocalApiComic];
  if (Array.isArray(payload.comics)) return payload.comics;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  if (
    payload &&
    typeof payload === "object" &&
    ("id" in payload || "slug" in payload || "title" in payload)
  ) {
    return [payload as LocalApiComic];
  }
  return [];
}

export function getLocalApiTotal(payload: LocalApiComicsResponse, fallback: number) {
  if (typeof payload.total === "number") return payload.total;
  if (typeof payload.pagination?.total === "number") return payload.pagination.total;
  if (!Array.isArray(payload.data) && typeof payload.data?.total === "number") return payload.data.total;
  return fallback;
}

export function mapLocalApiComicsToShowcaseItems(
  comics: LocalApiComic[],
  language: SupportedLanguage,
  apiBaseUrl: string
): MangaDexShowcaseItem[] {
  return comics.map((comic, index) => {
    const slug = getLocalStringValue(comic, ["slug", "manga_slug", "comic_slug", "id"]);
    const rawTitle = getLocalStringValue(comic, ["title", "name", "comic_title", "original_title"]);
    const titleMap = getLocalTitleMap(comic);
    const title = getLocalizedTitle({ titleMap, title: rawTitle }, language);
    const coverImage = normalizeLocalImageUrl(
      getLocalStringValue(comic, ["coverImage", "cover_image", "cover", "thumbnail", "image", "poster", "url_cover"]),
      apiBaseUrl
    );
    const genres = getLocalGenres(comic);
    const createdAt = getLocalStringValue(comic, ["created_at", "createdAt", "uploaded_at", "updated_at", "updatedAt"]);

    return {
      mal_id: index + 1,
      title,
      synopsis: getLocalStringValue(comic, ["synopsis", "description", "summary"]) || null,
      score: null,
      url: slug ? buildComicPath(title, slug) : "#",
      mangaDexId: slug || null,
      titleMap,
      altTitles: [],
      originalLanguage: undefined,
      images: {
        webp: { large_image_url: coverImage, image_url: coverImage },
        jpg: { large_image_url: coverImage, image_url: coverImage },
      },
      genres: genres.map((genre, genreIndex) => ({ mal_id: genreIndex + 1, name: genre })),
      themes: [],
      tags: genres,
      latestChapters: getLocalLatestChapters(comic),
      featuredTag: null,
      createdAt: createdAt || null,
      isLocal: true,
      isNsfw: Boolean(comic.isNsfw ?? comic.nsfw ?? comic.adult),
    };
  });
}

export async function fetchLocalTop(limit = 10, language: SupportedLanguage = "es", isAdult = false) {
  const apiBaseUrl = MONLINE_CONFIG_API_URL;

  try {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("order", "views");
    params.set("v", "2");

    const response = await fetch(`${apiBaseUrl}/api/comics?${params.toString()}`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as LocalApiComicsResponse;
    return mapLocalApiComicsToShowcaseItems(extractLocalApiComics(payload), language, apiBaseUrl)
      .filter((comic) => isAdult || !isAdultShowcaseItem(comic));
  } catch (error) {
    logger.error("Error al conectar con la API local", error);
    return [];
  }
}

export function appendStandardMangaDexFilters(
  params: URLSearchParams,
  isAdult: boolean = false,
  language: SupportedLanguage = "es"
) {
  params.append("includes[]", "cover_art");
  params.set("hasAvailableChapters", "true");
  appendMangaDexAvailableLanguageFilters(params, language);

  const baseContent = [...SAFE_CONTENT_RATINGS];
  const adultContent = [...ADULT_CONTENT_RATINGS];
  const ratings = isAdult ? [...baseContent, ...adultContent] : baseContent;

  ratings.forEach((rating) => {
    params.append("contentRating[]", rating);
  });
}

export function buildMangaDexMangaUrl(
  baseParams: Record<string, string | undefined>,
  isAdult: boolean = false,
  language?: SupportedLanguage
) {
  const params = new URLSearchParams();

  Object.entries(baseParams).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  appendStandardMangaDexFilters(params, isAdult, language);
  return toMangaDexApiUrl(`/manga?${params.toString()}`);
}

export async function fetchMangaDexChapterPreviews(
  mangaId: string,
  language: SupportedLanguage,
  signal?: AbortSignal
) {
  const params = new URLSearchParams();
  params.set("limit", "100");
  params.set("order[chapter]", "asc");

  getMangaDexAvailableLanguages(language).forEach((translatedLanguage) => {
    params.append("translatedLanguage[]", translatedLanguage);
  });

  try {
    const response = await fetch(
      `/api/mangadex/feed/${mangaId}?${params.toString()}`,
      { signal }
    );

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    const total = payload.total ?? payload.data?.length ?? 0;
    let chapters = payload.data ?? [];

    if (total > chapters.length) {
      const tailParams = new URLSearchParams(params);
      tailParams.set("offset", String(Math.max(0, total - 100)));
      const tailResponse = await fetch(
        `/api/mangadex/feed/${mangaId}?${tailParams.toString()}`,
        { signal }
      );

      if (tailResponse.ok) {
        const tailPayload = await tailResponse.json();
        chapters = tailPayload.data ?? chapters;
      }
    }

    // Deduplicate chapters by chapter number (attributes.chapter)
    const uniqueChaptersMap = new Map<string, any>();
    chapters.forEach((ch: any) => {
      const chNum = ch.attributes?.chapter ?? "";
      if (chNum) {
        uniqueChaptersMap.set(chNum, ch);
      } else {
        uniqueChaptersMap.set(ch.id, ch);
      }
    });

    const dedupedChapters = [...uniqueChaptersMap.values()].sort((a, b) => {
      const aNum = Number.parseFloat(a.attributes?.chapter ?? "0");
      const bNum = Number.parseFloat(b.attributes?.chapter ?? "0");
      return aNum - bNum;
    });

    const selectedChapters = [dedupedChapters[dedupedChapters.length - 1], dedupedChapters[dedupedChapters.length - 2]]
      .filter((chapter): chapter is NonNullable<typeof chapter> => Boolean(chapter));

    return selectedChapters.map((chapter) => {
      const chapterNum = chapter.attributes?.chapter ?? "";
      const publishAt = chapter.attributes?.publishAt || chapter.attributes?.readableAt;
      return {
        id: chapter.id,
        chapter: chapterNum,
        timeAgo: formatLocalRelativeTime(publishAt, language),
        publishedAt: publishAt || null,
      };
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    return [];
  }
}

const LOCAL_API_URL = MONLINE_CONFIG_API_URL;
const LOCAL_COMIC_LOOKUP_LIMIT = 2000;
const MANGAVF_API_URL = process.env.NEXT_PUBLIC_MANGAVF_API_URL || process.env.MANGAVF_API_URL || "http://localhost:3001";
const MANGADEX_RETRY_DELAY_MS = 1200;

export type MangaDetailsResponse = {
  data?: MangaDetails;
};

export type MangaVfChapter = {
  number?: string;
  title?: string;
  url?: string;
};

export type MangaVfDetails = {
  manga_title?: string;
  title?: string;
  cover?: string;
  synopsis?: string;
  status?: string;
  genres?: string[];
  chapters?: MangaVfChapter[];
};

export type MangaVfSearchResponse = {
  results?: Array<{ title?: string; slug?: string; url?: string; cover?: string }>;
};

function isMangaDexUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function fetchMangaDex(url: string, retries = 1): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(toMangaDexApiUrl(url), {
      headers: getMangaDexRequestHeaders(),
      next: { revalidate: 3600 },
    });
  } catch (error) {
    logger.error("[mangadex-fetch-details] MangaDex fetch failed", error);
    return new Response(null, { status: 502 });
  }

  if (response.status === 429 && retries > 0) {
    const retryAfter = Number(response.headers.get("retry-after"));
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : MANGADEX_RETRY_DELAY_MS
      )
    );
    return fetchMangaDex(url, retries - 1);
  }

  return response;
}

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

async function fetchLocalComicBySlug(slug: string) {
  const cleanSlug = cleanMangaSlug(slug);
  const cacheKey = `local-comic-slug:${cleanSlug}`;
  return getOrSetCached(cacheKey, 300, async () => {
    try {
      const cleanTitle = cleanSlug.replace(/-/g, " ");
      const searchParams = new URLSearchParams();
      searchParams.set("title", cleanTitle);
      searchParams.set("limit", "15");

      let listResponse = await fetch(
        `${LOCAL_API_URL}/api/comics?${searchParams.toString()}`,
        { cache: "no-store" }
      );
      let comics: any[] = [];

      if (listResponse.ok) {
        comics = extractLocalApiComics(await listResponse.json());
      }

      let summary = comics.find((comic) => {
        const comicSlug = getLocalStringValue(comic, ["slug", "manga_slug", "comic_slug"]);
        return comicSlug === cleanSlug || cleanSlug.endsWith(`-${comicSlug}`);
      });

      if (!summary) {
        const fallbackResponse = await fetch(
          `${LOCAL_API_URL}/api/comics?limit=300`,
          { cache: "no-store" }
        );
        if (fallbackResponse.ok) {
          const allComics = extractLocalApiComics(await fallbackResponse.json());
          summary = allComics.find((comic) => {
            const comicSlug = getLocalStringValue(comic, ["slug", "manga_slug", "comic_slug"]);
            return comicSlug === cleanSlug || cleanSlug.endsWith(`-${comicSlug}`);
          });
        }
      }

      const numericId = getLocalStringValue(summary ?? {}, ["id"]);

      if (!summary || !numericId) return null;

      const detailResponse = await fetch(
        `${LOCAL_API_URL}/api/comics/${encodeURIComponent(numericId)}`,
        { cache: "no-store" }
      );
      if (!detailResponse.ok) return summary;

      return extractLocalApiComics(await detailResponse.json())[0] ?? summary;
    } catch {
      return null;
    }
  });
}

function getLocalTextMap(source: LocalApiComic, baseKeys: string[], prefix: string) {
  const baseText = getLocalStringValue(source, baseKeys);
  const englishText = getLocalStringValue(source, [`english_${prefix}`, `${prefix}_en`, `en_${prefix}`]);
  const spanishText = getLocalStringValue(source, [`spanish_${prefix}`, `${prefix}_es`, `es_${prefix}`]);
  const portugueseText = getLocalStringValue(source, [`portuguese_${prefix}`, `${prefix}_pt`, `pt_${prefix}`]);

  const map: Record<string, string> = {};
  if (baseText) map.es = baseText;
  if (englishText) map.en = englishText;
  if (spanishText) map.es = spanishText;
  if (portugueseText) map.pt = portugueseText;

  return map;
}

function mapLocalComicToMangaDetails(comic: LocalApiComic): MangaDetails | null {
  const slug = getLocalStringValue(comic, ["slug", "manga_slug", "comic_slug", "id"]);
  if (!slug) return null;

  const title = getLocalStringValue(comic, ["title", "name", "comic_title", "original_title"]) || slug;
  const description = getLocalStringValue(comic, ["synopsis", "description", "summary"]);
  const titleMap = getLocalTextMap(comic, ["title", "name", "comic_title", "original_title"], "title");
  const descriptionMap = getLocalTextMap(comic, ["synopsis", "description", "summary"], "description");
  const coverImage = normalizeLocalImageUrl(
    getLocalStringValue(comic, ["coverImage", "cover_image", "cover", "thumbnail", "image", "poster", "url_cover"]),
    LOCAL_API_URL
  );
  const genres = getLocalGenres(comic);
  const author = getLocalStringValue(comic, ["author", "artist", "creator"]);

  return {
    id: slug,
    author,
    attributes: {
      title: Object.keys(titleMap).length > 0 ? titleMap : { es: title },
      altTitles: [],
      description: Object.keys(descriptionMap).length > 0 ? descriptionMap : description ? { es: description } : {},
      contentRating: comic.isNsfw || comic.nsfw || comic.adult ? "erotica" : "safe",
      tags: genres.map((genre, index) => ({
        id: `local-${index}-${genre.toLowerCase().replace(/\s+/g, "-")}`,
        attributes: { name: { es: genre, en: genre }, group: "genre" },
      })),
    },
    relationships: [
      ...(coverImage ? [{ id: slug, type: "cover_art", attributes: { fileName: coverImage } }] : []),
      {
        id: "local-author",
        type: "author",
        attributes: { name: author || "Autor desconocido" },
      },
    ],
  };
}

async function fetchMangaVfSourceBySlug(id: string) {
  const cleanId = id.startsWith("lc-") ? id.substring(3) : id;
  const lookupId = cleanId.replace(/^manga[-_]?vf[-_]?/i, "");
  const query = lookupId.replace(/-/g, " ");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(
      `${MANGAVF_API_URL}/api/v1/manga/search?q=${encodeURIComponent(query)}`,
      { cache: "no-store", signal: controller.signal }
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as MangaVfSearchResponse;
    const results = payload.results ?? [];

    const source =
      results.find((item) => item.slug === lookupId) ??
      results.find((item) => slugify(item.title) === lookupId) ??
      null;

    return source?.url?.includes("leercapitulo.co") ? source : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchMangaVfDetailsBySlug(id: string) {
  const source = await fetchMangaVfSourceBySlug(id);
  const sourceUrl = source?.url?.trim();
  if (!sourceUrl) return null;

  try {
    const response = await fetch(
      `${MANGAVF_API_URL}/api/v1/manga/chapters?url=${encodeURIComponent(sourceUrl)}`,
      { cache: "no-store" }
    );
    if (!response.ok) return null;
    return (await response.json()) as MangaVfDetails;
  } catch {
    return null;
  }
}

function mapMangaVfToMangaDetails(id: string, details: MangaVfDetails): MangaDetails | null {
  const title = details.manga_title?.trim() || details.title?.trim();
  if (!title) return null;

  const genres = Array.isArray(details.genres) ? details.genres.filter(Boolean).slice(0, 8) : [];
  const synopsis = sanitizeText(details.synopsis ?? "") || "Sin sinopsis disponible";
  const coverImage = details.cover?.trim() || "";

  return {
    id,
    author: "M",
    attributes: {
      title: { es: title, en: title, pt: title },
      altTitles: [],
      description: { es: synopsis, en: synopsis, pt: synopsis },
      status: details.status?.trim() || undefined,
      contentRating: "safe",
      tags: genres.map((genre, index) => ({
        id: `vf-${index}-${genre.toLowerCase().replace(/\s+/g, "-")}`,
        attributes: { name: { es: genre, en: genre, pt: genre }, group: "genre" },
      })),
    },
    relationships: [
      ...(coverImage ? [{ id: id, type: "cover_art", attributes: { fileName: coverImage } }] : []),
      { id: "vf-author", type: "author", attributes: { name: "M" } },
    ],
  };
}

export async function fetchMangaDetails(id: string, language?: string): Promise<MangaDetails | null> {
  const cacheKey = `manga-details:${id}:${language || "all"}`;
  return getOrSetCached(cacheKey, 7200, async () => {
    const localComic = await fetchLocalComicBySlug(id);
    const localManga = localComic ? mapLocalComicToMangaDetails(localComic) : null;

    if (localManga) {
      return localManga;
    }

    // If the language is NOT Spanish, we bypass LeerCapitulo entirely
    if (language && language !== "es") {
      if (!isMangaDexUuid(id)) return null;
      try {
        const response = await fetchMangaDex(
          `https://api.mangadex.org/manga/${id}?includes[]=cover_art&includes[]=author`
        );
        if (!response.ok) return null;
        const payload = (await response.json()) as MangaDetailsResponse;
        return payload.data ?? null;
      } catch {
        return null;
      }
    }

    const resolution = await resolveBestSource(id);
    if (resolution.source === "leercapitulo" && resolution.leercapituloSlug && resolution.leercapituloDetails) {
      return mapMangaVfToMangaDetails(id, resolution.leercapituloDetails);
    }

    if (resolution.mangadexId) {
      try {
        const response = await fetchMangaDex(
          `https://api.mangadex.org/manga/${resolution.mangadexId}?includes[]=cover_art&includes[]=author`
        );

        if (!response.ok) {
          return null;
        }

        const payload = (await response.json()) as MangaDetailsResponse;
        if (!payload.data) {
          logger.warn(`[MangaStoon] MangaDex devolvio detalles vacios para manga ${resolution.mangadexId}`);
        }

        const mangaDetails = payload.data ?? null;
        if (mangaDetails) {
          mangaDetails.id = id;
        }
        return mangaDetails;
      } catch {
        return null;
      }
    }

    return null;
  });
}

async function searchMangaDexByTitle(title: string): Promise<string | null> {
  try {
    const params = new URLSearchParams();
    params.set("title", title);
    params.set("limit", "5");
    const response = await fetch(`https://api.mangadex.org/manga?${params.toString()}`);
    if (!response.ok) return null;
    const payload = await response.json();
    const results = payload.data ?? [];

    const slugifiedTarget = slugify(title);
    const matched = results.find((manga: any) => {
      const titleMap = manga.attributes?.title ?? {};
      const altTitles = manga.attributes?.altTitles ?? [];
      const allTitles = [
        ...Object.values(titleMap),
        ...altTitles.flatMap((t: any) => Object.values(t))
      ].map((t) => slugify(t as string));

      return allTitles.includes(slugifiedTarget);
    });

    return matched?.id ?? null;
  } catch {
    return null;
  }
}

async function searchLeerCapituloByTitle(title: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${MANGAVF_API_URL}/api/v1/manga/search?q=${encodeURIComponent(title)}`,
      { cache: "no-store" }
    );
    if (!response.ok) return null;
    const payload = await response.json() as MangaVfSearchResponse;
    const results = payload.results ?? [];

    const slugifiedTarget = slugify(title);
    const matched =
      results.find((item) => slugify(item.title || "") === slugifiedTarget) ??
      results.find((item) => item.title?.toLowerCase() === title.toLowerCase()) ??
      null;

    if (matched?.url?.includes("leercapitulo.co")) {
      return (matched.slug || slugify(matched.title || "")).replace(/^manga[-_]?vf[-_]?/i, "");
    }
    return null;
  } catch {
    return null;
  }
}

async function getMangaDexSpanishChapterCount(mangaId: string): Promise<number> {
  try {
    const params = new URLSearchParams();
    params.append("translatedLanguage[]", "es");
    params.append("translatedLanguage[]", "es-la");
    params.set("limit", "1");
    const response = await fetchMangaDex(`https://api.mangadex.org/manga/${mangaId}/feed?${params.toString()}`);
    if (!response.ok) return 0;
    const payload = await response.json();
    return payload.total ?? 0;
  } catch {
    return 0;
  }
}

export type ResolvedSource = {
  source: "mangadex" | "leercapitulo";
  mangadexId?: string;
  leercapituloSlug?: string;
  leercapituloDetails?: MangaVfDetails | null;
};

export async function resolveBestSource(idOrSlug: string): Promise<ResolvedSource> {
  const cacheKey = `source-resolution:${idOrSlug}`;
  const cached = await getCached<ResolvedSource>(cacheKey);
  if (cached) return cached;

  let source: "mangadex" | "leercapitulo" = "mangadex";
  let mangadexId: string | undefined;
  let leercapituloSlug: string | undefined;
  let leercapituloDetails: MangaVfDetails | null = null;

  if (isMangaDexUuid(idOrSlug)) {
    mangadexId = idOrSlug;
    try {
      const response = await fetchMangaDex(
        `https://api.mangadex.org/manga/${idOrSlug}`
      );
      if (response.ok) {
        const payload = await response.json();
        const titleMap = payload.data?.attributes?.title ?? {};
        const title = titleMap.es || titleMap.en || Object.values(titleMap)[0] as string || "";
        if (title) {
          leercapituloSlug = (await searchLeerCapituloByTitle(title)) ?? undefined;
        }
      }
    } catch {}
  } else {
    leercapituloSlug = idOrSlug;
    leercapituloDetails = await fetchMangaVfDetailsBySlug(idOrSlug);
    const title = leercapituloDetails?.manga_title || leercapituloDetails?.title;
    if (title) {
      mangadexId = await searchMangaDexByTitle(title) ?? undefined;
    }
  }

  let mdChaptersCount = 0;
  let lcChaptersCount = 0;

  if (mangadexId) {
    mdChaptersCount = await getMangaDexSpanishChapterCount(mangadexId);
  }

  if (leercapituloSlug) {
    if (!leercapituloDetails) {
      leercapituloDetails = await fetchMangaVfDetailsBySlug(leercapituloSlug);
    }
    lcChaptersCount = leercapituloDetails?.chapters?.length ?? 0;
  }

  if (leercapituloSlug && lcChaptersCount > mdChaptersCount) {
    source = "leercapitulo";
  } else if (mangadexId) {
    source = "mangadex";
  } else if (leercapituloSlug) {
    source = "leercapitulo";
  }

  const result: ResolvedSource = {
    source,
    mangadexId,
    leercapituloSlug,
    leercapituloDetails,
  };

  await setCached(cacheKey, result, 7200); // 2 hours
  return result;
}

export type ChapterFeedItem = {
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

export type ChapterFeedResponse = {
  data?: ChapterFeedItem[];
  limit?: number;
  offset?: number;
  total?: number;
};

export function getMangaVfChapterId(chapter: MangaVfChapter) {
  const number = chapter.number?.trim() || chapter.title?.match(/\d+(?:\.\d+)?/)?.[0] || "1";
  return slugify(`${number}-${chapter.title || "capitulo"}`);
}

export function mapMangaVfChapters(details: MangaVfDetails): ChapterFeedItem[] {
  const chapters = Array.isArray(details.chapters) ? details.chapters : [];
  const now = new Date().toISOString();

  return chapters.flatMap((chapter) => {
    const chapterUrl = chapter.url?.trim();
    if (!chapterUrl) return [];
    const number = chapter.number?.trim() || chapter.title?.match(/\d+(?:\.\d+)?/)?.[0] || "1";

    return [{
      id: getMangaVfChapterId(chapter),
      attributes: {
        chapter: number,
        title: chapter.title?.trim() || `Capítulo ${number}`,
        translatedLanguage: "es",
        readableAt: now,
        publishAt: now,
        createdAt: now,
        updatedAt: now,
      },
    }];
  });
}

function getChapterLanguageVariants(language: string): string[] {
  if (language === "es") return ["es", "es-la"];
  if (language === "pt") return ["pt", "pt-br"];
  return [language];
}

export async function fetchMangaDexChaptersOnly(mangaId: string, language: string): Promise<ChapterFeedItem[]> {
  const limit = 100;
  let offset = 0;
  let total = 0;
  const chapters: ChapterFeedItem[] = [];

  try {
    do {
      const params = new URLSearchParams();
      getChapterLanguageVariants(language).forEach((variant) => {
        params.append("translatedLanguage[]", variant);
      });
      params.set("order[chapter]", "desc");
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      params.append("includes[]", "scanlation_group");

      const response = await fetchMangaDex(`https://api.mangadex.org/manga/${mangaId}/feed?${params.toString()}`);
      if (!response.ok) {
        return chapters;
      }

      const payload = (await response.json()) as ChapterFeedResponse;
      const batch = payload.data ?? [];
      total = payload.total ?? batch.length;
      chapters.push(...batch);
      offset += payload.limit ?? limit;
    } while (offset < total);
  } catch {
    return chapters;
  }

  return chapters;
}

export async function fetchLeerCapituloChaptersOnly(slug: string): Promise<ChapterFeedItem[]> {
  const details = await fetchMangaVfDetailsBySlug(slug);
  return details ? mapMangaVfChapters(details) : [];
}

export async function fetchMangaChapters(id: string, language: string): Promise<ChapterFeedItem[]> {
  const cacheKey = `manga-chapters:${id}:${language}`;
  return getOrSetCached(cacheKey, 900, async () => {
    const resolution = await resolveBestSource(id);

    // If the language is NOT Spanish, we ONLY fetch from MangaDex (no merging)
    if (language !== "es") {
      const mangaId = resolution.mangadexId || id;
      if (!isMangaDexUuid(mangaId)) return [];
      return fetchMangaDexChaptersOnly(mangaId, language);
    }

    // If Spanish, fetch both in parallel and merge them
    const [mdChapters, lcChapters] = await Promise.all([
      resolution.mangadexId ? fetchMangaDexChaptersOnly(resolution.mangadexId, language) : Promise.resolve([]),
      resolution.leercapituloSlug ? fetchLeerCapituloChaptersOnly(resolution.leercapituloSlug) : Promise.resolve([])
    ]);

    let mainChapters: ChapterFeedItem[];
    let secondaryChapters: ChapterFeedItem[];

    if (lcChapters.length > mdChapters.length) {
      mainChapters = lcChapters;
      secondaryChapters = mdChapters;
    } else {
      mainChapters = mdChapters;
      secondaryChapters = lcChapters;
    }

    const mainNumbers = new Set(
      mainChapters
        .map((ch) => ch.attributes?.chapter?.trim())
        .filter(Boolean)
    );

    const missingChapters = secondaryChapters.filter((ch) => {
      const num = ch.attributes?.chapter?.trim();
      return num && !mainNumbers.has(num);
    });

    const mergedChapters = [...mainChapters, ...missingChapters];

    // Sort descending by chapter number
    mergedChapters.sort((a, b) => {
      const aNum = parseFloat(a.attributes?.chapter || "0");
      const bNum = parseFloat(b.attributes?.chapter || "0");
      return bNum - aNum;
    });

    return mergedChapters;
  });
}

export async function fetchMangaVfPages(details: MangaVfDetails, chapterId: string) {
  const chapterUrl = (details.chapters ?? []).find((chapter) => getMangaVfChapterId(chapter) === chapterId)?.url?.trim();
  if (!chapterUrl) return [];

  try {
    const response = await fetch(
      `${MANGAVF_API_URL}/api/v1/manga/extract?url=${encodeURIComponent(chapterUrl)}`,
      { cache: "no-store" }
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as any;
    const pages = Array.isArray(payload.images) ? payload.images : [];
    return pages.filter(Boolean) as string[];
  } catch {
    return [];
  }
}

export type LeerCapituloLatestItem = {
  title: string;
  slug: string;
  url: string;
  cover: string;
  chapters?: Array<{
    number: string;
    title: string;
    url: string;
    time?: string;
  }>;
};

export type LeerCapituloLatestResponse = {
  success: boolean;
  recientes?: LeerCapituloLatestItem[];
  tendencias?: LeerCapituloLatestItem[];
};

export function parseRelativeTimeToDate(timeStr: string): Date {
  const now = new Date();
  const clean = timeStr.toLowerCase().trim();
  const num = parseInt(clean) || 0;
  
  if (clean.includes("year") || clean.includes("año")) {
    now.setFullYear(now.getFullYear() - num);
    return now;
  }
  if (clean.includes("month") || clean.includes("mes")) {
    now.setMonth(now.getMonth() - num);
    return now;
  }
  if (clean.includes("week") || clean.includes("semana")) {
    now.setDate(now.getDate() - (num * 7));
    return now;
  }
  if (clean.includes("day") || clean.includes("dia") || clean.match(/\b\d+d\b/) || clean.endsWith("d")) {
    now.setDate(now.getDate() - num);
    return now;
  }
  if (clean.includes("hour") || clean.includes("hora") || clean.match(/\b\d+h\b/) || clean.endsWith("h")) {
    now.setHours(now.getHours() - num);
    return now;
  }
  if (clean.includes("min") || clean.match(/\b\d+m\b/) || clean.endsWith("m")) {
    now.setMinutes(now.getMinutes() - num);
    return now;
  }
  
  // Si no se reconoce el patrón (o está vacío), devolvemos una fecha muy antigua (Unix epoch)
  // en lugar de 'now' para evitar que se posicione al principio de la lista de novedades.
  return new Date(0);
}

export function mapLeerCapituloLatestToShowcase(
  items: LeerCapituloLatestItem[],
  language: SupportedLanguage
): MangaDexShowcaseItem[] {
  return items.map((item, index): MangaDexShowcaseItem => {
    const title = item.title;
    const slug = `lc-${item.slug}`;
    const rawCover = item.cover;
    const coverImage = rawCover ? `/api/proxy-image?url=${encodeURIComponent(rawCover)}` : "";
    const latestChapters = (item.chapters ?? []).slice(0, 2).map((ch) => {
      const pubDate = ch.time ? parseRelativeTimeToDate(ch.time) : new Date();
      return {
        id: `lc-ch-${ch.number}`,
        chapter: ch.number,
        timeAgo: ch.time || "",
        publishedAt: pubDate.toISOString(),
      };
    });

    return {
      mal_id: index + 1000,
      title,
      synopsis: null,
      score: null,
      url: buildComicPath(title, slug),
      mangaDexId: slug,
      titleMap: { es: title },
      featuredTag: `#${index + 1}`,
      createdAt: new Date().toISOString(),
      genres: [],
      tags: [],
      latestChapters,
      isLocal: true,
      images: {
        webp: { large_image_url: coverImage, image_url: coverImage },
        jpg: { large_image_url: coverImage, image_url: coverImage },
      },
    };
  });
}

export async function fetchLeerCapituloLatest(language: SupportedLanguage = "es"): Promise<MangaDexShowcaseItem[]> {
  try {
    const response = await fetch(`${MANGAVF_API_URL}/api/v1/manga/latest`, {
      next: { revalidate: 600 }
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as LeerCapituloLatestResponse;
    const recientes = payload.recientes ?? [];
    return mapLeerCapituloLatestToShowcase(recientes, language);
  } catch (error) {
    logger.error("Error fetching LeerCapitulo latest", error);
    return [];
  }
}

