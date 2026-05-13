import { cookies } from "next/headers";
import type { Metadata } from "next";
import Image from "next/image";
import Script from "next/script";
import Link from "next/link";
import { ArrowDown, BookOpen, CalendarDays } from "lucide-react";
import BackButton from "../../components/BackButton";
import ContinueReadingButton from "../../components/ContinueReadingButton";
import FavoriteButton from "../../components/FavoriteButton";
import { MangaCard } from "../../components/MangaCard";
import SiteHeader, { type SupportedLanguage } from "../../components/site-header";
import SynopsisBlock from "./synopsis";
import { getLocalizedTitle, getLocalizedTitleAsync } from "../../utils/get-localized-title";
import { getMangaDexRequestHeaders, toMangaDexApiUrl } from "../../utils/mangadex-config";
import { translateTagName } from "../../utils/tagTranslations";
import { forceTranslate } from "../../utils/translation";
import {
  appendStandardMangaDexFilters,
  fetchMangaDexCollection,
  fetchMangaDexStatistics,
  mapToShowcaseItems,
} from "../../utils/mangadex";
import { SITE_IMAGE, SITE_NAME, absoluteUrl } from "../../utils/seo";

export const revalidate = 3600;
export const dynamicParams = true;

const MANGADEX_RETRY_DELAY_MS = 1200;
const LOCAL_API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8085").replace(/\/$/, "");

type MangaDexLocalizedText = Record<string, string>;

type MangaDetailsResponse = {
  data?: {
    id: string;
    attributes?: {
      title?: MangaDexLocalizedText;
      altTitles?: MangaDexLocalizedText[];
      description?: MangaDexLocalizedText;
      contentRating?: string;
      tags?: Array<{
        id: string;
        attributes?: {
          name?: MangaDexLocalizedText;
          group?: string;
        };
      }>;
    };
    author?: string | null;
    relationships?: Array<{
      id: string;
      type: string;
      attributes?: {
        name?: string;
        fileName?: string;
      };
    }>;
  };
};

type MangaRelationship = NonNullable<MangaDetailsResponse["data"]>["relationships"];

type ChapterFeedItem = {
  id: string;
  attributes?: {
    chapter?: string | null;
    title?: string | null;
    readableAt?: string | null;
    publishAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    translatedLanguage?: string | null;
  };
  relationships?: Array<{
    id: string;
    type: string;
    attributes?: {
      name?: string;
    };
  }>;
};

type ChapterFeedResponse = {
  data?: ChapterFeedItem[];
  total?: number;
  limit?: number;
  offset?: number;
};

type MangaStatisticsResponse = {
  statistics?: Record<
    string,
    {
      rating?: {
        average?: number | null;
        bayesian?: number | null;
      };
      follows?: number | null;
    }
  >;
};

type MangaRatingSummary = {
  ratingValue: string;
  ratingCount: string;
};


type ChapterLanguageFallback = {
  language: SupportedLanguage;
  total: number;
  firstChapter: ChapterFeedItem | null;
};

type MangaDetails = NonNullable<MangaDetailsResponse["data"]>;
type OriginalContentDictionary = Pick<(typeof UI_COPY)[SupportedLanguage], "noSynopsis">;
type LocalApiComic = Record<string, unknown>;
type LocalComicScan = Record<string, unknown> & {
  scanGroup?: Record<string, unknown>;
  chapters?: unknown;
};

function isMangaDexUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function getLocalStringValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
}

function extractLocalComics(payload: unknown): LocalApiComic[] {
  if (Array.isArray(payload)) return payload.filter((item): item is LocalApiComic => Boolean(item) && typeof item === "object");
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data.filter((item): item is LocalApiComic => Boolean(item) && typeof item === "object");
  if (record.data && typeof record.data === "object") return extractLocalComics(record.data);
  if (Array.isArray(record.comics)) return record.comics.filter((item): item is LocalApiComic => Boolean(item) && typeof item === "object");
  if (Array.isArray(record.items)) return record.items.filter((item): item is LocalApiComic => Boolean(item) && typeof item === "object");
  if (Array.isArray(record.results)) return record.results.filter((item): item is LocalApiComic => Boolean(item) && typeof item === "object");
  if ("id" in record || "slug" in record || "title" in record) return [record];

  return [];
}

function normalizeLocalImageUrl(value: string) {
  if (!value) return "";
  const imageUrl =
    value.startsWith("http://") || value.startsWith("https://")
      ? value
      : `${LOCAL_API_URL}/${value.replace(/^\/+/, "")}`;

  return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
}

function getLocalGenres(source: LocalApiComic) {
  const rawGenres = source.genres ?? source.genre ?? source.tags ?? source.categories;
  const values = Array.isArray(rawGenres) ? rawGenres : typeof rawGenres === "string" ? rawGenres.split(",") : [];

  return values
    .map((genre) => {
      if (typeof genre === "string") return genre.trim();
      if (genre && typeof genre === "object") return getLocalStringValue(genre as Record<string, unknown>, ["name", "title", "slug"]);
      return "";
    })
    .filter(Boolean)
    .slice(0, 8);
}

async function fetchLocalComicBySlug(slug: string) {
  try {
    const listResponse = await fetch(`${LOCAL_API_URL}/api/comics?limit=100`, { cache: "no-store" });
    if (!listResponse.ok) return null;

    const comics = extractLocalComics(await listResponse.json());
    const summary = comics.find((comic) => getLocalStringValue(comic, ["slug", "manga_slug", "comic_slug"]) === slug);
    const numericId = getLocalStringValue(summary ?? {}, ["id"]);

    if (!summary || !numericId) return null;

    const detailResponse = await fetch(`${LOCAL_API_URL}/api/comics/${encodeURIComponent(numericId)}`, { cache: "no-store" });
    if (!detailResponse.ok) return summary;

    return extractLocalComics(await detailResponse.json())[0] ?? summary;
  } catch {
    return null;
  }
}

function mapLocalComicToMangaDetails(comic: LocalApiComic): MangaDetails | null {
  const slug = getLocalStringValue(comic, ["slug", "manga_slug", "comic_slug", "id"]);
  if (!slug) return null;

  const title = getLocalStringValue(comic, ["title", "name", "comic_title", "original_title"]) || slug;
  const description = getLocalStringValue(comic, ["synopsis", "description", "summary"]);
  const coverImage = normalizeLocalImageUrl(getLocalStringValue(comic, ["coverImage", "cover_image", "cover", "thumbnail", "image", "poster", "url_cover"]));
  const genres = getLocalGenres(comic);
  const author = getLocalStringValue(comic, ["author", "artist", "creator"]);

  return {
    id: slug,
    author,
    attributes: {
      title: { es: title, en: title },
      altTitles: [],
      description: description ? { es: description, en: description } : {},
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

function getLocalComicScanChapters(source: LocalApiComic): ChapterFeedItem[] {
  const scans = Array.isArray(source.comicScans)
    ? source.comicScans.filter((scan): scan is LocalComicScan => Boolean(scan) && typeof scan === "object")
    : [];

  return scans.flatMap((scan) => {
    const chapters = Array.isArray(scan.chapters)
      ? scan.chapters.filter((chapter): chapter is Record<string, unknown> => Boolean(chapter) && typeof chapter === "object")
      : [];
    const scanName = getLocalStringValue(scan.scanGroup ?? {}, ["name", "title", "slug"]);

    return chapters
      .sort((a, b) => Number(getLocalStringValue(b, ["chapterNumber", "chapter_number", "chapter", "number"])) - Number(getLocalStringValue(a, ["chapterNumber", "chapter_number", "chapter", "number"])))
      .flatMap((chapter) => {
        const chapterId = getLocalStringValue(chapter, ["id", "chapterId", "chapter_id"]);
        const chapterNumber = getLocalStringValue(chapter, ["chapterNumber", "chapter_number", "chapter", "number"]);
        const releaseDate = getLocalStringValue(chapter, ["releaseDate", "release_date", "publishedAt", "published_at", "createdAt", "created_at"]);

        if (!chapterId || !chapterNumber) return [];

        return [{
          id: chapterId,
          attributes: {
            chapter: chapterNumber,
            title: getLocalStringValue(chapter, ["title", "name"]) || null,
            translatedLanguage: "es",
            readableAt: releaseDate || null,
            publishAt: releaseDate || null,
            createdAt: releaseDate || null,
            updatedAt: releaseDate || null,
          },
          relationships: scanName ? [{ id: "local-scan", type: "scanlation_group", attributes: { name: scanName } }] : [],
        }];
      });
  });
}

function cleanSynopsisText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value
    .replace(/\[(?:\/)?(?:b|i|u|s|hr|center|quote|spoiler|list|\*)\]/gi, " ")
    .replace(/\[(?:url|img|color|size|font)(?:=[^\]]*)?\]/gi, " ")
    .replace(/\[\/\w+\]/g, " ")
    .replace(/\r?\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function translateEnglishSynopsis(text: string, targetLang: SupportedLanguage) {
  const cleanText = cleanSynopsisText(text);

  if (!cleanText) {
    return "";
  }

  return targetLang === "en"
    ? cleanText
    : cleanSynopsisText(await forceTranslate(cleanText, targetLang));
}

async function getOriginalContent(
  manga: MangaDetails | null | undefined,
  lang: SupportedLanguage,
  dict: OriginalContentDictionary
) {
  const descriptionMap = manga?.attributes?.description ?? {};
  const directDescription = cleanSynopsisText(
    lang === "es"
      ? descriptionMap.es ?? descriptionMap["es-la"]
      : lang === "pt"
        ? descriptionMap.pt ?? descriptionMap["pt-br"]
        : descriptionMap.en
  );

  if (directDescription) {
    return directDescription;
  }

  const englishDescription = cleanSynopsisText(descriptionMap.en);

  if (englishDescription) {
    return translateEnglishSynopsis(englishDescription, lang);
  }

  const genres = (manga?.attributes?.tags ?? [])
    .filter((tag) => tag.attributes?.group === "genre")
    .map((tag) => translateTagName(getLocalizedTagName(tag, lang), lang))
    .filter(Boolean)
    .slice(0, 5);

  if (genres.length > 0) {
    return lang === "pt"
      ? `Sinopse não disponível. Gêneros: ${genres.join(", ")}.`
      : lang === "en"
        ? `Synopsis unavailable. Genres: ${genres.join(", ")}.`
        : `Sinopsis no disponible. Géneros: ${genres.join(", ")}.`;
  }

  return dict.noSynopsis;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const response = await fetchMangaDex(`https://api.mangadex.org/manga/${id}?includes[]=cover_art`);

    if (!response.ok) {
      return {
        title: "Manga",
        description: "Lee este manga en MangaStoon.",
        alternates: {
          canonical: absoluteUrl(`/manga/${id}`),
          languages: {
            es: absoluteUrl(`/manga/${id}`),
            en: absoluteUrl(`/manga/${id}`),
            pt: absoluteUrl(`/manga/${id}`),
            "x-default": absoluteUrl(`/manga/${id}`),
          },
        },
      };
    }

    const payload = (await response.json()) as MangaDetailsResponse;
    const manga = payload.data;
    const metadataLanguage: SupportedLanguage = "es";
    const title = manga ? await getLocalizedTitleAsync(manga, metadataLanguage) : "Manga";
    const originalContent = (await getOriginalContent(manga, metadataLanguage, UI_COPY[metadataLanguage]))
      .replace(/\s+/g, " ")
      .trim();
    const description =
      originalContent.length > 155 ? `${originalContent.slice(0, 155)}...` : originalContent;
    const coverArt = manga?.relationships?.find((relationship) => relationship.type === "cover_art");
    const coverFileName = coverArt?.attributes?.fileName;
    const imageUrl = coverFileName
      ? `https://uploads.mangadex.org/covers/${id}/${coverFileName}`
      : SITE_IMAGE;

    const cleanTitle = title;
    const socialTitle = `${cleanTitle} | ${SITE_NAME}`;
    const canonicalUrl = absoluteUrl(`/manga/${id}`);

    return {
      title: `Leer ${cleanTitle} Manga Online Gratis - ${SITE_NAME}`,
      description,
      alternates: {
        canonical: canonicalUrl,
        languages: {
          es: canonicalUrl,
          en: canonicalUrl,
          pt: canonicalUrl,
          "x-default": canonicalUrl,
        },
      },
      openGraph: {
        title: socialTitle,
        description,
        url: canonicalUrl,
        type: "article",
        siteName: SITE_NAME,
        images: [
          {
            url: imageUrl,
            width: 800,
            height: 1200,
            alt: `Portada de ${cleanTitle}`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: socialTitle,
        description,
        images: [imageUrl],
      },
    };
  } catch {
    return {
      title: "Manga",
      description: "Lee este manga en MangaStoon.",
      alternates: {
        canonical: absoluteUrl(`/manga/${id}`),
        languages: {
          es: absoluteUrl(`/manga/${id}`),
          en: absoluteUrl(`/manga/${id}`),
          pt: absoluteUrl(`/manga/${id}`),
          "x-default": absoluteUrl(`/manga/${id}`),
        },
      },
    };
  }
}

const UI_COPY: Record<
  SupportedLanguage,
  {
    addToFavorites: string;
    author: string;
    noAuthor: string;
    activeScan: string;
    synopsis: string;
    readMore: string;
    readLess: string;
    chapters: string;
    totalChapters: string;
    totalSuffix: string;
    noSynopsis: string;
    noChapters: string;
    noChaptersInLanguage: string;
    readInFallbackLanguage: string;
    latestOrder: string;
    noScan: string;
    publishedOn: string;
    chapterFallback: string;
  }
> = {
  es: {
    addToFavorites: "Agregar a Favoritos",
    author: "Autor",
    noAuthor: "No disponible",
    activeScan: "Grupo de Scan Activo",
    synopsis: "Sinopsis",
    readMore: "Leer mas",
    readLess: "Leer menos",
    chapters: "Capitulos",
    totalChapters: "Totales",
    totalSuffix: "capitulos en total",
    noSynopsis: "No hay descripcion disponible para este manga.",
    noChapters: "No encontramos capitulos disponibles todavia.",
    noChaptersInLanguage: "No hay capitulos disponibles en este idioma.",
    readInFallbackLanguage: "Leer en",
    latestOrder: "Mas recientes primero",
    noScan: "Seleccion automatica",
    publishedOn: "Publicado",
    chapterFallback: "Capitulo especial",
  },
  en: {
    addToFavorites: "Add to Favorites",
    author: "Author",
    noAuthor: "Unavailable",
    activeScan: "Active Scan Group",
    synopsis: "Synopsis",
    readMore: "Read more",
    readLess: "Read less",
    chapters: "Chapters",
    totalChapters: "Total",
    totalSuffix: "chapters in total",
    noSynopsis: "No description is available for this manga.",
    noChapters: "We could not find available chapters yet.",
    noChaptersInLanguage: "No chapters are available in this language.",
    readInFallbackLanguage: "Read in",
    latestOrder: "Newest first",
    noScan: "Auto selection",
    publishedOn: "Published",
    chapterFallback: "Special chapter",
  },
  pt: {
    addToFavorites: "Adicionar aos Favoritos",
    author: "Autor",
    noAuthor: "Indisponivel",
    activeScan: "Grupo de Scan Ativo",
    synopsis: "Sinopse",
    readMore: "Ler mais",
    readLess: "Ler menos",
    chapters: "Capitulos",
    totalChapters: "Totais",
    totalSuffix: "capitulos no total",
    noSynopsis: "Nao ha descricao disponivel para este manga.",
    noChapters: "Ainda nao encontramos capitulos disponiveis.",
    noChaptersInLanguage: "Nao ha capitulos disponiveis neste idioma.",
    readInFallbackLanguage: "Ler em",
    latestOrder: "Mais recentes primeiro",
    noScan: "Selecao automatica",
    publishedOn: "Publicado",
    chapterFallback: "Capitulo especial",
  },
};

function normalizeLanguage(value: string | undefined): SupportedLanguage {
  if (value === "en" || value === "pt") {
    return value;
  }

  return "es";
}

const SUPPORTED_CHAPTER_LANGUAGES: SupportedLanguage[] = ["es", "en", "pt"];

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
};


function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMangaDex(url: string, retries = 1) {
  const response = await fetch(toMangaDexApiUrl(url), {
    headers: getMangaDexRequestHeaders(),
    next: { revalidate: 3600 },
  });

  if (response.status === 429 && retries > 0) {
    const retryAfter = Number(response.headers.get("retry-after"));
    await wait(
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : MANGADEX_RETRY_DELAY_MS
    );
    return fetchMangaDex(url, retries - 1);
  }

  return response;
}

function getSeededNumberFromId(id: string) {
  let hash = 0;

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function getDeterministicFallbackRating(id: string) {
  const seed = getSeededNumberFromId(id);
  return 3.8 + (seed % 12) / 10;
}

function getDeterministicFallbackCount(id: string) {
  const seed = getSeededNumberFromId(`${id}-votes`);
  return 35 + (seed % 166);
}

function normalizeMangaDexRating(value: number | null | undefined) {
  if (!Number.isFinite(value ?? Number.NaN) || !value || value <= 0) {
    return null;
  }

  // MangaDex ratings are on a 10-point scale; JSON-LD/UI stars use a 5-point scale.
  return Math.min(5, Math.max(1, value / 2));
}

function formatRating(value: number) {
  return value.toFixed(1);
}

async function fetchMangaRatingSummary(id: string): Promise<MangaRatingSummary> {
  if (!isMangaDexUuid(id)) {
    return {
      ratingValue: formatRating(getDeterministicFallbackRating(id)),
      ratingCount: String(getDeterministicFallbackCount(id)),
    };
  }

  try {
    const response = await fetchMangaDex(`https://api.mangadex.org/statistics/manga/${id}`);

    if (!response.ok) {
      throw new Error(`MangaDex statistics failed: ${response.status}`);
    }

    const payload = (await response.json()) as MangaStatisticsResponse;
    const stats = payload.statistics?.[id];
    const realRating =
      normalizeMangaDexRating(stats?.rating?.bayesian) ??
      normalizeMangaDexRating(stats?.rating?.average);
    const follows = stats?.follows ?? 0;

    return {
      ratingValue: formatRating(realRating ?? getDeterministicFallbackRating(id)),
      ratingCount: String(follows > 0 ? follows : getDeterministicFallbackCount(id)),
    };
  } catch {
    return {
      ratingValue: formatRating(getDeterministicFallbackRating(id)),
      ratingCount: String(getDeterministicFallbackCount(id)),
    };
  }
}


function getChapterLanguageVariants(language: SupportedLanguage) {
  if (language === "es") {
    return ["es", "es-la"];
  }

  if (language === "pt") {
    return ["pt-br", "pt"];
  }

  return ["en"];
}

function getLanguageCandidates(language: SupportedLanguage) {
  if (language === "es") {
    return ["es", "es-la", "en", "ja-ro", "ja"];
  }

  if (language === "pt") {
    return ["pt-br", "pt", "en", "ja-ro", "ja"];
  }

  return ["en", "ja-ro", "ja"];
}

function getLocalizedDescription(
  description: MangaDexLocalizedText | undefined,
  language: SupportedLanguage
) {
  if (!description) {
    return null;
  }

  for (const key of getLanguageCandidates(language)) {
    if (description[key]) {
      return description[key];
    }
  }

  return Object.values(description)[0] ?? null;
}

function getLocalizedTagName(tag: { attributes?: { name?: MangaDexLocalizedText } }, language: SupportedLanguage) {
  const names = tag.attributes?.name;

  if (!names) {
    return "Tag";
  }

  for (const key of getLanguageCandidates(language)) {
    if (names[key]) {
      return names[key];
    }
  }

  return translateTagName(Object.values(names)[0] ?? "Tag", language);
}

type MangaDetailTag = NonNullable<
  NonNullable<NonNullable<MangaDetailsResponse["data"]>["attributes"]>["tags"]
>[number];

function hasSensitiveAdultTag(tags: MangaDetailTag[] | undefined) {
  const sensitiveTags = new Set(["Sexual Violence", "Hentai", "Erotica"]);

  return (tags ?? []).some((tag) => {
    const rawName = tag.attributes?.name?.en ?? Object.values(tag.attributes?.name ?? {})[0] ?? "";
    return sensitiveTags.has(rawName);
  });
}

function getCoverUrl(mangaId: string, relationships: MangaRelationship) {
  const coverArt = relationships?.find((relationship) => relationship.type === "cover_art");
  const fileName = coverArt?.attributes?.fileName;

  if (!fileName) {
    return "";
  }

  if (fileName.startsWith("http://") || fileName.startsWith("https://") || fileName.startsWith("/")) {
    return fileName;
  }

  return `https://uploads.mangadex.org/covers/${mangaId}/${fileName}`;
}

async function fetchAuthorName(mangaTitle: string) {
  const title = mangaTitle.trim();
  if (!title) return null;

  try {
    const response = await fetch(
      `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(title)}&limit=1`,
      { next: { revalidate: 86_400 } }
    );

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      data?: Array<{
        authors?: Array<{ name?: string | null }>;
      }>;
    };

    const authors = payload.data?.[0]?.authors ?? [];
    const author = authors.find((item) => item.name?.trim())?.name?.trim();

    return author || null;
  } catch {
    return null;
  }
}

function getScanGroupName(chapter: ChapterFeedItem | null) {
  const group = chapter?.relationships?.find((relationship) => relationship.type === "scanlation_group");
  return group?.attributes?.name ?? null;
}

function getBestChapterDate(chapter: ChapterFeedItem) {
  return (
    chapter.attributes?.readableAt ??
    chapter.attributes?.publishAt ??
    chapter.attributes?.updatedAt ??
    chapter.attributes?.createdAt ??
    null
  );
}

function getPublishedDate(chapter: ChapterFeedItem, language: SupportedLanguage) {
  const dateString = getBestChapterDate(chapter);

  if (!dateString) {
    return "";
  }

  const locale = language === "pt" ? "pt-BR" : language === "en" ? "en-US" : "es-ES";
  const formatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return formatter.format(new Date(dateString));
}

function buildChapterNumberLabel(
  chapterNumber: string | null | undefined,
  occurrenceIndex: number,
  totalOccurrences: number,
  fallbackLabel: string
) {
  if (!chapterNumber) {
    return fallbackLabel;
  }

  const remainingVariants = totalOccurrences - occurrenceIndex - 1;

  if (remainingVariants <= 0) {
    return `Capitulo ${chapterNumber}`;
  }

  const suffix = 4 + remainingVariants;
  return `Capitulo ${chapterNumber}.${suffix}`;
}

async function fetchMangaDetails(id: string) {
  const localComic = await fetchLocalComicBySlug(id);
  const localManga = localComic ? mapLocalComicToMangaDetails(localComic) : null;

  if (localManga) {
    return localManga;
  }

  try {
    const response = await fetchMangaDex(
      `https://api.mangadex.org/manga/${id}?includes[]=cover_art&includes[]=author`
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as MangaDetailsResponse;
    if (!payload.data) {
      console.warn(`[MangaStoon] MangaDex devolvió detalles vacíos para manga ${id}`);
    }

    return payload.data ?? null;
  } catch {
    return null;
  }
}

async function fetchMangaChapters(id: string, language: SupportedLanguage) {
  const localComic = await fetchLocalComicBySlug(id);

  if (localComic) {
    return getLocalComicScanChapters(localComic);
  }

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

      const response = await fetchMangaDex(`https://api.mangadex.org/manga/${id}/feed?${params.toString()}`);

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

async function fetchChapterLanguageFallback(
  id: string,
  language: SupportedLanguage
): Promise<ChapterLanguageFallback> {
  const params = new URLSearchParams();
  getChapterLanguageVariants(language).forEach((variant) => {
    params.append("translatedLanguage[]", variant);
  });
  // Para recomendar otro idioma debemos mandar al inicio real de lectura,
  // no al cap?tulo m?s reciente. Por eso pedimos el cap?tulo m?s antiguo.
  params.set("order[chapter]", "asc");
  params.set("limit", "1");
  params.set("offset", "0");
  params.append("includes[]", "scanlation_group");

  try {
    const response = await fetchMangaDex(`https://api.mangadex.org/manga/${id}/feed?${params.toString()}`);

    if (!response.ok) {
      return { language, total: 0, firstChapter: null };
    }

    const payload = (await response.json()) as ChapterFeedResponse;

    return {
      language,
      total: payload.total ?? payload.data?.length ?? 0,
      firstChapter: payload.data?.[0] ?? null,
    };
  } catch {
    return { language, total: 0, firstChapter: null };
  }
}

async function findBestChapterLanguageFallback(
  id: string,
  currentLanguage: SupportedLanguage
) {
  const fallbackCandidates = SUPPORTED_CHAPTER_LANGUAGES.filter(
    (language) => language !== currentLanguage
  );
  const fallbacks = await Promise.all(
    fallbackCandidates.map((language) => fetchChapterLanguageFallback(id, language))
  );

  return fallbacks
    .filter((fallback) => fallback.total > 0 && fallback.firstChapter)
    .sort((a, b) => b.total - a.total)[0] ?? null;
}

async function fetchConsumetChaptersFallback(title: string) {
  try {
    const searchRes = await fetch(`https://consumet-api-one.vercel.app/manga/manganato/${encodeURIComponent(title)}`);
    const searchData = await searchRes.json();
    const mangaId = searchData.results?.[0]?.id;
    if (!mangaId) return [];

    const infoRes = await fetch(`https://consumet-api-one.vercel.app/manga/manganato/info?id=${mangaId}`);
    const infoData = await infoRes.json();

    return infoData.chapters?.map((ch: any) => ({
      id: ch.id,
      attributes: {
        chapter: ch.number?.toString() || ch.title?.match(/\d+/)?.[0] || "1",
        title: ch.title,
        translatedLanguage: "es"
      }
    })) || [];
  } catch (e) {
    return [];
  }
}

async function fetchSimilarMangas(
  currentMangaId: string,
  genreTagIds: string[],
  language: SupportedLanguage,
  isAdult: boolean
) {
  const uniqueTagIds = Array.from(new Set(genreTagIds)).filter(Boolean);

  if (uniqueTagIds.length < 2) {
    return [];
  }

  const tagGroups = [uniqueTagIds.slice(0, 3), uniqueTagIds.slice(0, 2)].filter(
    (group) => group.length >= 2
  );

  for (const tagGroup of tagGroups) {
    const params = new URLSearchParams();
    params.set("limit", "18");
    params.set("includedTagsMode", "AND");
    params.set("order[followedCount]", "desc");
    tagGroup.forEach((tagId) => params.append("includedTags[]", tagId));
    appendStandardMangaDexFilters(params, isAdult, language);

    const response = await fetchMangaDexCollection(toMangaDexApiUrl(`/manga?${params.toString()}`));
    const mangas = response.data.filter((similarManga) => similarManga.id !== currentMangaId).slice(0, 12);

    if (mangas.length >= 6 || tagGroup.length === 2) {
      const statistics = await fetchMangaDexStatistics(mangas.map((similarManga) => similarManga.id));
      return mapToShowcaseItems(mangas, statistics, language);
    }
  }

  return [];
}

async function fetchSuggestedLocalMangas(currentMangaId: string) {
  try {
    const response = await fetch(`${LOCAL_API_URL}/api/comics?limit=15`, {
      cache: "no-store",
    });

    if (!response.ok) return [];

    return extractLocalComics(await response.json())
      .filter((comic) => getLocalStringValue(comic, ["slug", "manga_slug", "comic_slug", "id"]) !== currentMangaId)
      .slice(0, 15);
  } catch {
    return [];
  }
}


function MangaMaintenance({ language }: { language: SupportedLanguage }) {
  const copy = {
    es: {
      title: "Manga en mantenimiento",
      body: "No pudimos cargar los datos de este manga ahora mismo. Puede que MangaDex o la fuente externa esté respondiendo vacío temporalmente.",
      action: "Volver a explorar",
    },
    en: {
      title: "Manga under maintenance",
      body: "We could not load this manga data right now. MangaDex or the external source may be returning empty data temporarily.",
      action: "Back to explore",
    },
    pt: {
      title: "Mangá em manutenção",
      body: "Não conseguimos carregar os dados deste mangá agora. MangaDex ou a fonte externa pode estar retornando dados vazios temporariamente.",
      action: "Voltar para explorar",
    },
  }[language];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <SiteHeader language={language} />
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
        <div className="rounded-3xl border border-white/10 bg-[#141519] p-8 shadow-2xl shadow-black/30">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">MangaStoon</p>
          <h1 className="mt-4 text-2xl font-semibold text-white">{copy.title}</h1>
          <p className="mt-3 text-base leading-7 text-gray-400">{copy.body}</p>
          <Link
            href="/explore"
            className="mt-6 inline-flex rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400"
          >
            {copy.action}
          </Link>
        </div>
      </div>
    </main>
  );
}

export default async function MangaDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const currentLanguage = normalizeLanguage(cookieStore.get("lang")?.value);
  const isAdult = cookieStore.get("mangastoon_adult")?.value === "true";
  const copy = UI_COPY[currentLanguage];

  const [manga, initialChapters, ratingSummary] = await Promise.all([
    fetchMangaDetails(id),
    fetchMangaChapters(id, currentLanguage),
    fetchMangaRatingSummary(id),
  ]);

  if (!manga) {
    return <MangaMaintenance language={currentLanguage} />;
  }

  const displayTitle = await getLocalizedTitleAsync(manga, currentLanguage);
  if (displayTitle === "Título Desconocido") {
    console.warn(`[MangaStoon] Manga sin título utilizable: ${manga.id}`);
  }
  let chapters = initialChapters;

  // Si MangaDex no tiene cap?tulos, inyectamos los de Consumet en la UI
  if (chapters.length === 0) {
    const fallbackChapters = await fetchConsumetChaptersFallback(displayTitle);
    if (fallbackChapters.length > 0) {
      chapters = fallbackChapters;
    }
  }

  const bestFallbackLanguage =
    chapters.length === 0 ? await findBestChapterLanguageFallback(id, currentLanguage) : null;

  const tags = (manga.attributes?.tags ?? [])
    .filter((tag) => tag.attributes?.group === "genre")
    .map((tag) => ({
    id: tag.id,
    name: translateTagName(getLocalizedTagName(tag, currentLanguage), currentLanguage),
  }));
  const description = await getOriginalContent(manga, currentLanguage, copy);
  const similarMangas = await fetchSimilarMangas(
    manga.id,
    tags.map((tag) => tag.id),
    currentLanguage,
    isAdult
  );
  const suggestedMangas = await fetchSuggestedLocalMangas(manga.id);
  const isExplicitContent =
    manga.attributes?.contentRating === "erotica" ||
    manga.attributes?.contentRating === "pornographic" ||
    hasSensitiveAdultTag(manga.attributes?.tags);
  const coverUrl = getCoverUrl(manga.id, manga.relationships);
  const favoriteManga = {
    id: manga.id,
    mangaDexId: manga.id,
    title: displayTitle,
    url: `/manga/${manga.id}`,
    titleMap: manga.attributes?.title,
    altTitles: manga.attributes?.altTitles,
    originalLanguage: undefined,
    themes: (manga.attributes?.tags ?? [])
      .filter((tag) => tag.attributes?.group === "theme")
      .map((tag) => translateTagName(getLocalizedTagName(tag, currentLanguage), currentLanguage)),
    tags: tags.map((tag) => tag.name),
    genres: tags.map((tag, index) => ({ mal_id: index, name: tag.name })),
    images: coverUrl ? { webp: { large_image_url: coverUrl } } : {},
  };
  const databaseAuthor =
    manga.author &&
    manga.author.trim() &&
    manga.author !== "MangaStoon" &&
    manga.author.toLowerCase() !== "autor desconocido"
      ? manga.author.trim()
      : null;
  const realAuthor = databaseAuthor ?? (await fetchAuthorName(displayTitle));
  const authorSearchQuery = realAuthor ? `${realAuthor} manga creator` : `${displayTitle} oficial`;
  const activeScanGroup = getScanGroupName(chapters[0] ?? null) ?? copy.noScan;
  const chapterTotals = new Map<string, number>();
  chapters.forEach((chapter) => {
    const chapterNumber = chapter.attributes?.chapter;

    if (chapterNumber) {
      chapterTotals.set(chapterNumber, (chapterTotals.get(chapterNumber) ?? 0) + 1);
    }
  });
  const chapterOccurrences = new Map<string, number>();
  const chapterRows = chapters.map((chapter) => {
    const chapterNumber = chapter.attributes?.chapter ?? null;
    const occurrenceIndex = chapterNumber
      ? (chapterOccurrences.get(chapterNumber) ?? 0)
      : 0;

    if (chapterNumber) {
      chapterOccurrences.set(chapterNumber, occurrenceIndex + 1);
    }

    return {
      chapter,
      chapterLabel: buildChapterNumberLabel(
        chapterNumber,
        occurrenceIndex,
        chapterNumber ? (chapterTotals.get(chapterNumber) ?? 1) : 1,
        copy.chapterFallback
      ),
      publishedLabel: getPublishedDate(chapter, currentLanguage),
    };
  });

  const aggregateRating = {
    "@type": "AggregateRating",
    ratingValue: ratingSummary.ratingValue,
    bestRating: "5",
    worstRating: "1",
    ratingCount: ratingSummary.ratingCount,
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ComicSeries",
    name: displayTitle,
    description,
    genre: tags.map((tag) => tag.name),
    aggregateRating,
    author: {
      "@type": "Person",
      name: realAuthor || "No disponible en DB",
    },
    image: coverUrl || "",
    url: absoluteUrl(`/manga/${manga.id}`),
    inLanguage: currentLanguage,
  };

  const siteUrl = absoluteUrl("/").replace(/\/$/, "");
  const mangaCanonicalUrl = absoluteUrl(`/manga/${manga.id}`);
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `¿Dónde leer ${displayTitle} online gratis?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Podés leer ${displayTitle} online gratis en MangaStoon, con capítulos disponibles desde la página de la serie.`,
        },
      },
      {
        "@type": "Question",
        name: `¿En qué idiomas está disponible ${displayTitle}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${displayTitle} puede estar disponible en Español, Inglés y Portugués según los capítulos publicados para cada idioma.`,
        },
      },
      {
        "@type": "Question",
        name: `¿Dónde continuar leyendo ${displayTitle}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `En MangaStoon podés abrir ${displayTitle}, elegir un capítulo y continuar la lectura desde el historial del navegador.`,
        },
      },
    ],
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Inicio",
        "item": siteUrl
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Explorar",
        "item": `${siteUrl}/explore`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": displayTitle,
        "item": mangaCanonicalUrl
      }
    ]
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Anuncio Vignette de Monetag */}
      <Script id="monetag-vignette" src="https://dd133.com/vignette.min.js" data-zone="10986315" strategy="afterInteractive" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <SiteHeader language={currentLanguage} />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-5 md:px-6 md:py-8 lg:px-8">
        <BackButton />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
          <aside className="md:col-span-4 lg:col-span-3">
            <div className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[150px_minmax(0,1fr)] md:block">
              <div className="max-h-[300px] max-w-[180px] overflow-hidden rounded-xl shadow-2xl shadow-black/50 sm:max-w-[220px] md:max-h-none md:max-w-none">
                {coverUrl ? (
                  <div className="relative aspect-[2/3] w-full">
                    <Image
                      src={coverUrl}
                      alt={displayTitle}
                      fill
                      sizes="(max-width: 640px) 112px, (max-width: 768px) 150px, 320px"
                      className="object-cover object-top"
                      priority
                      unoptimized={true}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="aspect-[2/3] bg-white/5" />
                )}
              </div>

              <div className="rounded-xl border border-white/5 bg-[#141519] p-3 text-center md:mt-4 md:p-4 md:text-left">
                <FavoriteButton manga={favoriteManga} label={copy.addToFavorites} variant="inline" />
                <ContinueReadingButton mangaId={manga.id} />

                <div className="mt-4 md:mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 md:text-[11px]">
                    {copy.author}
                  </p>
                  <p className="mt-2 text-sm text-white">{realAuthor || "No disponible en DB"}</p>
                  <a
                    href={
                      "https://twitter.com/search?q=" +
                      encodeURIComponent(authorSearchQuery)
                    }
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-3 w-3 fill-current"
                    >
                      <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-7.4L6.4 22H3.3l7.3-8.4L2.9 2h6.4l4.4 6.6L18.9 2Zm-1.1 17.9h1.7L8.4 4H6.6l11.2 15.9Z" />
                    </svg>
                    Apoyar en X
                  </a>
                </div>

                <div className="mt-4 md:mt-5">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 md:text-[11px]">
                    {copy.activeScan}
                  </label>
                  <select
                    defaultValue={activeScanGroup}
                    className="mt-2 w-full rounded-md border border-white/10 bg-[#0a0a0a] p-2 text-sm text-white outline-none"
                  >
                    <option value={activeScanGroup}>{activeScanGroup}</option>
                  </select>
                </div>
              </div>
            </div>
          </aside>

          <section className="text-center md:col-span-8 md:text-left lg:col-span-9">
            <h1 className="mb-3 line-clamp-2 hyphens-auto text-center text-2xl font-semibold leading-tight text-white md:text-left md:text-3xl">
              {displayTitle}
            </h1>
            <p className="mb-4 text-center text-sm font-medium text-amber-300 md:text-left">
              {"\u2605"} {aggregateRating.ratingValue}/{aggregateRating.bestRating} {"\u00b7"} {aggregateRating.ratingCount} votos
            </p>

            <div className="flex flex-wrap justify-center gap-2 md:justify-start">
              {isExplicitContent ? (
                <span className="rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.18)]">
                  +18
                </span>
              ) : null}

              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/explore?includedTags=${tag.id}`}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:border-[#ff6b00]/40 hover:bg-[#ff6b00]/10 hover:text-orange-400"
                >
                  {tag.name}
                </Link>
              ))}
            </div>

            <SynopsisBlock
              title={copy.synopsis}
              content={description}
              expandLabel={copy.readMore}
              collapseLabel={copy.readLess}
            />

            <section id="chapters" className="mt-8 scroll-mt-28">
              <div className="mb-4 flex flex-col items-center justify-center gap-2 md:flex-row md:justify-between md:gap-4">
                <div className="border-b-4 border-[#ff6b00] px-3 pb-2 md:border-b-0 md:border-l-4 md:pb-0 md:pl-3">
                  <h2 className="text-2xl font-semibold text-white md:text-2xl">{copy.chapters}</h2>
                </div>
                <p className="text-base leading-relaxed text-gray-400">
                  {chapters.length} {copy.totalChapters}
                </p>
              </div>

              <div className="mb-4 flex items-center justify-between rounded-xl bg-[#141519] px-4 py-3 text-left">
                <p className="text-base leading-relaxed text-gray-400">
                  {chapters.length} {copy.totalSuffix}
                </p>
                <button
                  type="button"
                  className="rounded-md bg-white/5 p-2 text-gray-300 transition-colors hover:bg-white/10"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>

              {chapters.length === 0 ? (
                <div className="rounded-xl bg-[#141519] p-6 text-base leading-relaxed text-gray-400">
                  <p>{bestFallbackLanguage ? copy.noChaptersInLanguage : copy.noChapters}</p>

                  {bestFallbackLanguage?.firstChapter ? (
                    <Link
                      href={`/read/${manga.id}?chapter=${bestFallbackLanguage.firstChapter.id}&lang=${bestFallbackLanguage.language}`}
                      className="mt-5 inline-flex rounded-full bg-[#ff6b00] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400"
                    >
                      {copy.readInFallbackLanguage} {LANGUAGE_LABELS[bestFallbackLanguage.language]} ·{" "}
                      {bestFallbackLanguage.total} {copy.totalSuffix}
                    </Link>
                  ) : null}
                </div>
              ) : (
                <div>
                  {chapterRows.map(({ chapter, chapterLabel, publishedLabel }) => {
                    return (
                      <Link
                        key={chapter.id}
                        href={`/read/${manga.id}?chapter=${chapter.id}`}
                        className="animate-soft-enter mb-2 flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/5 p-4 transition-colors hover:bg-white/10"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <BookOpen className="h-5 w-5 shrink-0 text-[#ff6b00]" />
                          <p className="text-base font-semibold text-white">{chapterLabel}</p>
                        </div>

                        <div className="ml-2 flex shrink-0 items-center gap-2 text-sm text-gray-400">
                          <CalendarDays className="h-4 w-4" />
                          <span>{publishedLabel}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {similarMangas.length > 0 ? (
              <section className="mt-12 border-t border-white/10 pt-8 md:mt-14 md:pt-10">
                <div className="mb-5 border-b-4 border-[#ff6b00] px-3 pb-2 text-center md:border-b-0 md:border-l-4 md:pb-0 md:pl-3 md:text-left">
                  <h2 className="text-2xl font-semibold text-white">{"Mangas similares que te encantar\u00e1n"}</h2>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {similarMangas.map((similarManga) => (
                    <MangaCard key={similarManga.mangaDexId ?? similarManga.url} manga={similarManga} variant="grid" />
                  ))}
                </div>
              </section>
            ) : null}

            {suggestedMangas.length > 0 ? (
              <section className="mt-16 border-t border-gray-800 pt-10">
                <h2 className="mb-6 text-2xl font-bold text-white">Más contenido similar</h2>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                  {suggestedMangas.map((suggested) => {
                    const slug = getLocalStringValue(suggested, ["slug", "manga_slug", "comic_slug", "id"]);
                    const title = getLocalStringValue(suggested, ["title", "name", "comic_title", "original_title"]) || "MangaStoon";
                    const coverImage = normalizeLocalImageUrl(
                      getLocalStringValue(suggested, ["coverImage", "cover_image", "cover", "thumbnail", "image", "poster", "url_cover"])
                    );

                    if (!slug) return null;

                    return (
                      <Link key={slug} href={`/manga/${slug}`} className="group block">
                        <div className="aspect-[2/3] overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
                          {coverImage ? (
                            <img
                              src={coverImage}
                              alt={title}
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm font-semibold text-white group-hover:text-orange-400">
                          {title}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

