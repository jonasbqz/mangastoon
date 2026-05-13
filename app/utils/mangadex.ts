import type { MangaShowcaseItem } from "../components/home-carousel";
import type { SupportedLanguage } from "../components/language-provider";
import { getLocalizedTitle } from "./get-localized-title";
import {
  appendMangaDexAvailableLanguageFilters,
  getMangaDexAvailableLanguages,
  getMangaDexRequestHeaders,
  toMangaDexApiUrl,
} from "./mangadex-config";
import { translateTagName } from "./tagTranslations";

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
  return getLocalizedValue(manga.attributes.description, language, ["en"]);
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

export function hasSensitiveAdultTag(manga: MangaDexManga) {
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

export async function fetchMangaDexCollection(url: string, signal?: AbortSignal) {
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
}

export function mapToShowcaseItems(
  mangas: MangaDexManga[],
  statistics: Record<string, { rating?: { average?: number | null } }>,
  language: SupportedLanguage
): MangaDexShowcaseItem[] {
  return mangas.map((manga) => ({
    mal_id: Number.parseInt(manga.id.replace(/\D/g, "").slice(0, 9) || "0", 10),
    title: getMangaTitle(manga, language),
    synopsis: getMangaSynopsis(manga, language),
    score: statistics[manga.id]?.rating?.average ?? null,
    url: `https://mangadex.org/title/${manga.id}`,
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
  const imageUrl =
    value.startsWith("http://") || value.startsWith("https://")
      ? value
      : value.startsWith("//")
        ? `https:${value}`
        : `${apiBaseUrl.replace(/\/$/, "")}/${value.replace(/^\/+/, "")}`;

  if (imageUrl.includes("dashboard.olympusbiblioteca.com")) return imageUrl;

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

function formatLocalRelativeTime(dateString: string | null | undefined) {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return "hace instantes";
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;

  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months} mes${months === 1 ? "" : "es"}`;

  const years = Math.floor(days / 365);
  return `hace ${years} a\u00f1o${years === 1 ? "" : "s"}`;
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

function getLocalChapterNumber(chapter: Record<string, unknown>) {
  return getLocalStringValue(chapter, [
    "chapterNumber",
    "chapter_number",
    "chapter",
    "number",
    "title",
    "name",
  ]);
}

function mapLocalChapterPreviews(chapters: Record<string, unknown>[]) {
  return [...chapters].sort((a, b) => {
    const aDate = new Date(getLocalChapterDate(a)).getTime();
    const bDate = new Date(getLocalChapterDate(b)).getTime();

    if (Number.isFinite(aDate) && Number.isFinite(bDate) && aDate !== bDate) {
      return bDate - aDate;
    }

    const aNumber = Number(getLocalChapterNumber(a));
    const bNumber = Number(getLocalChapterNumber(b));

    if (Number.isFinite(aNumber) && Number.isFinite(bNumber) && aNumber !== bNumber) {
      return bNumber - aNumber;
    }

    return 0;
  }).flatMap((chapter) => {
    const publishedAt = getLocalChapterDate(chapter);
    const chapterNumber = getLocalChapterNumber(chapter);

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
    ...(title ? { en: title } : {}),
    ...(englishTitle ? { en: englishTitle } : {}),
    ...(spanishTitle ? { es: spanishTitle } : {}),
    ...(portugueseTitle ? { pt: portugueseTitle } : {}),
  };
}

function getLocalLatestChapters(source: LocalApiComic) {
  const rawChapters =
    source.latestChapters ??
    source.latest_chapters ??
    source.recentChapters ??
    source.recent_chapters ??
    source.chapters;
  const chapters = Array.isArray(rawChapters)
    ? rawChapters.filter((chapter): chapter is Record<string, unknown> => Boolean(chapter) && typeof chapter === "object")
    : [];

  return mapLocalChapterPreviews(chapters);
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
      cache: "no-store",
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
    const title = rawTitle || getLocalizedTitle({ titleMap }, language);
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
      url: slug ? `/manga/${slug}` : "#",
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

export async function fetchLocalTop(limit = 10, language: SupportedLanguage = "es") {
  const apiBaseUrl = (
    process.env.MONLINE_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://46.224.213.127:8085"
  ).replace(/\/$/, "");

  try {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("order", "views");

    const response = await fetch(`${apiBaseUrl}/api/comics?${params.toString()}`, {
      next: { revalidate: 86_400 },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as LocalApiComicsResponse;
    return mapLocalApiComicsToShowcaseItems(extractLocalApiComics(payload), language, apiBaseUrl);
  } catch (error) {
    console.error("🔥 Error al conectar con la API local:", error);
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
