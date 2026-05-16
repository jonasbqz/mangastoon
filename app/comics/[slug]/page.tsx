import { logger } from "../../utils/logger";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import BackButton from "../../components/BackButton";
import ContinueReadingButton from "../../components/ContinueReadingButton";
import FavoriteButton from "../../components/FavoriteButton";
import { MangaCard, type MangaShowcaseItem } from "../../components/MangaCard";
import SiteHeader, { type SupportedLanguage } from "../../components/site-header";
import SeoSynopsis from "./synopsis";
import ChapterList from "./chapter-list";
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
import { buildChapterPath, buildComicPath, extractComicIdFromSlugId } from "../../utils/slugify";

export const revalidate = 3600;
export const dynamicParams = true;

const MANGADEX_RETRY_DELAY_MS = 1200;
const LOCAL_API_URL = (
  process.env.MONLINE_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://46.224.213.127:8085"
).replace(/\/$/, "");

type MangaDexLocalizedText = Record<string, string>;

type MangaDetailsResponse = {
  data?: {
    id: string;
    attributes?: {
      title?: MangaDexLocalizedText;
      altTitles?: MangaDexLocalizedText[];
      description?: MangaDexLocalizedText;
      contentRating?: string;
      originalLanguage?: string;
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

function isMangaShowcaseItem(item: MangaShowcaseItem | LocalApiComic): item is MangaShowcaseItem {
  return "mangaDexId" in item || "mal_id" in item;
}
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

function getLocalTextMap(source: LocalApiComic, baseKeys: string[], prefix: string) {
  const baseText = getLocalStringValue(source, baseKeys);
  const englishText = getLocalStringValue(source, [`english_${prefix}`, `${prefix}_en`, `en_${prefix}`]);
  const spanishText = getLocalStringValue(source, [`spanish_${prefix}`, `${prefix}_es`, `es_${prefix}`]);
  const portugueseText = getLocalStringValue(source, [`portuguese_${prefix}`, `${prefix}_pt`, `pt_${prefix}`]);

  return {
    ...(baseText ? { es: baseText } : {}),
    ...(englishText ? { en: englishText } : {}),
    ...(spanishText ? { es: spanishText } : {}),
    ...(portugueseText ? { pt: portugueseText } : {}),
  };
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
    const summary = comics.find((comic) => {
      const comicSlug = getLocalStringValue(comic, ["slug", "manga_slug", "comic_slug"]);
      return comicSlug === slug || slug.endsWith(`-${comicSlug}`);
    });
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
  const titleMap = getLocalTextMap(comic, ["title", "name", "comic_title", "original_title"], "title");
  const descriptionMap = getLocalTextMap(comic, ["synopsis", "description", "summary"], "description");
  const coverImage = normalizeLocalImageUrl(getLocalStringValue(comic, ["coverImage", "cover_image", "cover", "thumbnail", "image", "poster", "url_cover"]));
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

async function translateSynopsis(text: string, targetLang: SupportedLanguage, sourceLang = "auto") {
  const cleanText = cleanSynopsisText(text);

  if (!cleanText) {
    return "";
  }

  return sourceLang === targetLang
    ? cleanText
    : cleanSynopsisText(await forceTranslate(cleanText, targetLang, sourceLang));
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
    return translateSynopsis(englishDescription, lang, "en");
  }

  const spanishDescription = cleanSynopsisText(descriptionMap.es ?? descriptionMap["es-la"]);

  if (spanishDescription) {
    return translateSynopsis(spanishDescription, lang, "es");
  }

  const portugueseDescription = cleanSynopsisText(descriptionMap.pt ?? descriptionMap["pt-br"]);

  if (portugueseDescription) {
    return translateSynopsis(portugueseDescription, lang, "pt");
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
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const id = extractComicIdFromSlugId(slug);
  const fallbackCanonicalUrl = absoluteUrl(`/comics/${slug}`);

  try {
    const manga = await fetchMangaDetails(id);

    if (!manga) {
      return {
        title: `Manga no encontrado | ${SITE_NAME}`,
        description: "Explora manga, manhwa y comics online en MangaStoon.",
        alternates: {
          canonical: fallbackCanonicalUrl,
        },
        robots: {
          index: false,
          follow: true,
        },
      };
    }

    const titleEs = await getLocalizedTitleAsync(manga, "es");
    const titleEn = await getLocalizedTitleAsync(manga, "en");
    const titlePt = await getLocalizedTitleAsync(manga, "pt");

    const canonicalEs = absoluteUrl(buildComicPath(titleEs, manga.id));
    const canonicalEn = absoluteUrl(buildComicPath(titleEn, manga.id));
    const canonicalPt = absoluteUrl(buildComicPath(titlePt, manga.id));
    const slugEs = buildComicPath(titleEs, manga.id).replace(/^\/comics\//, "");
    const slugEn = buildComicPath(titleEn, manga.id).replace(/^\/comics\//, "");
    const slugPt = buildComicPath(titlePt, manga.id).replace(/^\/comics\//, "");
    const pageSlug = decodeURIComponent(slug);

    let pageLang: SupportedLanguage = "es";
    if (pageSlug === slugEn) pageLang = "en";
    if (pageSlug === slugPt) pageLang = "pt";

    const canonicalUrl = pageLang === "pt" ? canonicalPt : pageLang === "en" ? canonicalEn : canonicalEs;
    const displayTitle = pageLang === "pt" ? titlePt : pageLang === "en" ? titleEn : titleEs;
    const originalContent = (await getOriginalContent(manga, pageLang, UI_COPY[pageLang]))
      .replace(/\s+/g, " ")
      .trim();
    const description = originalContent.length > 155 ? `${originalContent.slice(0, 155)}...` : originalContent;
    const imageUrl = getCoverUrl(manga.id, manga.relationships) || SITE_IMAGE;
    const socialTitle = `${displayTitle} | ${SITE_NAME}`;

    return {
      title: `Leer ${displayTitle} Online Gratis - ${SITE_NAME}`,
      description,
      keywords: [
        displayTitle,
        `${displayTitle} manga`,
        `${displayTitle} manhwa`,
        `${displayTitle} online`,
        `${displayTitle} en español`,
        "leer manga online",
        "MangaStoon",
      ],
      alternates: {
        canonical: canonicalUrl,
        languages: {
          es: canonicalEs,
          en: canonicalEn,
          pt: canonicalPt,
          "x-default": canonicalEs,
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
            alt: `Portada de ${displayTitle}`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: socialTitle,
        description,
        images: [imageUrl],
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return {
      title: `Manga | ${SITE_NAME}`,
      description: "Lee este manga en MangaStoon.",
      alternates: {
        canonical: fallbackCanonicalUrl,
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
    showMoreChapters: string;
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
    showMoreChapters: "Mostrar más capítulos",
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
    showMoreChapters: "Show more chapters",
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
    showMoreChapters: "Mostrar mais capítulos",
  },
};

function normalizeLanguage(value: string | undefined): SupportedLanguage {
  if (value === "en" || value === "pt") {
    return value;
  }

  return "es";
}

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
};


function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMangaDex(url: string, retries = 1) {
  let response: Response;

  try {
    response = await fetch(toMangaDexApiUrl(url), {
      headers: getMangaDexRequestHeaders(),
      next: { revalidate: 3600 },
    });
  } catch (error) {
    logger.error("[manga-page] MangaDex fetch failed", error);
    return new Response(null, { status: 502 });
  }

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
      logger.warn(`[MangaStoon] MangaDex devolvio detalles vacios para manga ${id}`);
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
  const fallbackPriority: Record<SupportedLanguage, SupportedLanguage[]> = {
    es: ["en"],
    en: ["es"],
    pt: ["en", "es"],
  };
  const fallbackCandidates = fallbackPriority[currentLanguage];
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
        translatedLanguage: "en"
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
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const id = extractComicIdFromSlugId(slug);
  const cookieStore = await cookies();
  const cookieLang = normalizeLanguage(cookieStore.get("lang")?.value);
  const isAdult = cookieStore.get("mangastoon_adult")?.value === "true";

  // 1. Obtener detalles primero para poder calcular los slugs de cada idioma
  const manga = await fetchMangaDetails(id);

  if (!manga) {
    return <MangaMaintenance language={cookieLang} />;
  }

  // 2. Sincronizar el idioma real comparando el slug de la URL actual
  const titleEs = await getLocalizedTitleAsync(manga, "es");
  const titleEn = await getLocalizedTitleAsync(manga, "en");
  const titlePt = await getLocalizedTitleAsync(manga, "pt");

  const slugEs = buildComicPath(titleEs, manga.id).replace(/^\/comics\//, "");
  const slugEn = buildComicPath(titleEn, manga.id).replace(/^\/comics\//, "");
  const slugPt = buildComicPath(titlePt, manga.id).replace(/^\/comics\//, "");
  const pageSlug = decodeURIComponent(slug);

  let currentLanguage: SupportedLanguage = cookieLang;
  if (pageSlug === slugEn) currentLanguage = "en";
  else if (pageSlug === slugPt) currentLanguage = "pt";
  else if (pageSlug === slugEs) currentLanguage = "es";

  const copy = UI_COPY[currentLanguage];

  // 3. Traer los cap?tulos correspondientes al idioma real resuelto
  const [initialChapters, ratingSummary] = await Promise.all([
    fetchMangaChapters(id, currentLanguage),
    fetchMangaRatingSummary(id),
  ]);

  let chapters = initialChapters;

  // Fallback de Consumet si MangaDex no devolvi? nada
  if (chapters.length === 0) {
    const fallbackChapters = await fetchConsumetChaptersFallback(titleEn);
    if (fallbackChapters.length > 0) {
      chapters = fallbackChapters;
    }
  }

  // 4. REGLA DE ORO: Si tras los intentos el array sigue en 0, disparar 404 inmediatamente
  if (chapters.length === 0) {
    notFound();
  }

  const displayTitle = currentLanguage === "pt" ? titlePt : currentLanguage === "en" ? titleEn : titleEs;
  const englishTitle = titleEn;
  const bestFallbackLanguage = null as ChapterLanguageFallback | null;

  if (displayTitle === "Título Desconocido") {
    logger.warn(`[MangaStoon] Manga sin titulo utilizable: ${manga.id}`);
  }
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
  const fallbackSuggestedMangas = await fetchSuggestedLocalMangas(manga.id);
  const suggestedMangas = similarMangas.length > 0 ? similarMangas.slice(0, 12) : fallbackSuggestedMangas.slice(0, 12);
  const isExplicitContent =
    manga.attributes?.contentRating === "erotica" ||
    manga.attributes?.contentRating === "pornographic" ||
    hasSensitiveAdultTag(manga.attributes?.tags);
  const coverUrl = getCoverUrl(manga.id, manga.relationships);
  const favoriteManga = {
    id: manga.id,
    mangaDexId: manga.id,
    title: displayTitle,
    url: buildComicPath(displayTitle, manga.id),
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
  const scanGroups = Array.from(
    new Set(chapters.map((chapter) => getScanGroupName(chapter) ?? copy.noScan))
  );
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
      scanGroupName: getScanGroupName(chapter) ?? copy.noScan,
    };
  });

  const aggregateRating = {
    "@type": "AggregateRating",
    ratingValue: ratingSummary.ratingValue,
    reviewCount: ratingSummary.ratingCount,
    ratingCount: ratingSummary.ratingCount,
    bestRating: "5",
    worstRating: "1",
  };

  const mangaCanonicalUrl = absoluteUrl(buildComicPath(displayTitle, manga.id));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: displayTitle,
    alternateName: getLocalizedTitle(manga, currentLanguage),
    description,
    genre: tags.map((tag) => tag.name),
    aggregateRating,
    author: {
      "@type": "Person",
      name: realAuthor || manga.author || "MangaStoon Editor",
    },
    image: coverUrl || "",
    url: mangaCanonicalUrl,
    inLanguage: currentLanguage,
    isAccessibleForFree: true,
    publisher: {
      "@type": "Organization",
      name: "MangaStoon",
    },
    workExample: {
      "@type": "Book",
      bookFormat: "http://schema.org/EBook",
      potentialAction: {
        "@type": "ReadAction",
        target: mangaCanonicalUrl,
      },
    },
  };

  const siteUrl = absoluteUrl("/").replace(/\/$/, "");
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
      {/* Monetag vignette desactivado temporalmente hasta completar la integracion final. */}
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
                      alt={`Portada del manga ${displayTitle}`}
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

            <SeoSynopsis
              title={displayTitle}
              description={description}
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
              {chapters.length === 0 ? (
                <div className="rounded-xl bg-[#141519] p-6 text-base leading-relaxed text-gray-400">
                  <p>{bestFallbackLanguage ? copy.noChaptersInLanguage : copy.noChapters}</p>

                  {bestFallbackLanguage?.firstChapter ? (
                    <Link
                      href={buildChapterPath(displayTitle, manga.id, bestFallbackLanguage.firstChapter.id, bestFallbackLanguage.language)}
                      className="mt-5 inline-flex rounded-full bg-[#ff6b00] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400"
                    >
                      {copy.readInFallbackLanguage} {LANGUAGE_LABELS[bestFallbackLanguage.language]} ·{" "}
                      {bestFallbackLanguage.total} {copy.totalSuffix}
                    </Link>
                  ) : null}
                </div>
              ) : (
                <ChapterList
                  mangaId={manga.id}
                  mangaTitle={displayTitle}
                  chapterRows={chapterRows}
                  showMoreLabel={copy.showMoreChapters}
                  totalLabel={`${chapters.length} ${copy.totalSuffix}`}
                  scanGroups={scanGroups}
                  activeScanGroup={activeScanGroup}
                />
              )}
            </section>

            {suggestedMangas.length > 0 ? (
              <section className="mt-16 border-t border-gray-800 pt-10">
                <div className="mb-6 border-b-4 border-[#ff6b00] px-3 pb-2 text-center md:border-b-0 md:border-l-4 md:pb-0 md:pl-3 md:text-left">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ff6b00]">MangaStoon recomienda</p>
                  <h2 className="mt-1 text-2xl font-bold text-white">Más contenido similar</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                  {suggestedMangas.map((suggested, index) => {
                    if (isMangaShowcaseItem(suggested)) {
                      return (
                        <div key={suggested.mangaDexId ?? suggested.url} className={index >= 6 ? "hidden md:block" : undefined}>
                          <MangaCard manga={suggested} variant="grid" />
                        </div>
                      );
                    }

                    const slug = getLocalStringValue(suggested, ["slug", "manga_slug", "comic_slug", "id"]);
                    const title = getLocalStringValue(suggested, ["title", "name", "comic_title", "original_title"]) || "MangaStoon";
                    const coverImage = normalizeLocalImageUrl(
                      getLocalStringValue(suggested, ["coverImage", "cover_image", "cover", "thumbnail", "image", "poster", "url_cover"])
                    );

                    if (!slug) return null;

                    return (
                      <Link key={slug} href={buildComicPath(title, slug)} className={`group block ${index >= 6 ? "hidden md:block" : ""}`}>
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

