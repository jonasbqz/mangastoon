import { logger } from "../../utils/logger";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { FolderHeart } from "lucide-react";
import { notFound } from "next/navigation";

import BackButton from "../../components/BackButton";
import ContinueReadingButton from "../../components/ContinueReadingButton";
import FavoriteButton from "../../components/FavoriteButton";
import AddToListButton from "../../components/AddToListButton";
import LikeButton from "../../components/LikeButton";
import { createClient } from "../../../utils/supabase/server";
import { MangaCard, type MangaShowcaseItem } from "../../components/MangaCard";
import SiteHeader, { type SupportedLanguage } from "../../components/site-header";
import SeoSynopsis from "./synopsis";
import ChapterList from "./chapter-list";
import ComicCoverImage from "./cover-image";
import MangaComments from "./manga-comments";
import { getLocalizedTitle, getLocalizedTitleAsync } from "../../utils/get-localized-title";
import { getMangaDexRequestHeaders, toMangaDexApiUrl } from "../../utils/mangadex-config";
import { translateTagName } from "../../utils/tagTranslations";
import { forceTranslate } from "../../utils/translation";
import { filterMonlineChapterPageUrls } from "../../utils/monline";
import {
  appendStandardMangaDexFilters,
  fetchMangaDexCollection,
  fetchMangaDexStatistics,
  mapToShowcaseItems,
  fetchMangaDetails,
  fetchMangaChapters as fetchMangaChaptersExternal,
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
const LOCAL_COMIC_LOOKUP_LIMIT = 2000;

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
  localPages?: string[];
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
    const listResponse = await fetch(`${LOCAL_API_URL}/api/comics?limit=${LOCAL_COMIC_LOOKUP_LIMIT}`, { cache: "no-store" });
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
        const localPages = filterMonlineChapterPageUrls(chapter.urlPages).map(normalizeLocalImageUrl);

        if (!chapterId || !chapterNumber || localPages.length === 0) return [];

        return [{
          id: chapterId,
          localPages,
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
    const cookieStore = await cookies();
    const rawCookieLang = cookieStore.get("lang")?.value;
    const cookieLang = normalizeLanguage(rawCookieLang);

    const manga = await cachedFetchMangaDetails(id, cookieLang);

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

    const [titleEs, titleEn, titlePt] = await Promise.all([
      cachedGetLocalizedTitleAsync(manga, "es"),
      cachedGetLocalizedTitleAsync(manga, "en"),
      cachedGetLocalizedTitleAsync(manga, "pt"),
    ]);

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
    const originalContent = (await cachedGetOriginalContent(manga, pageLang, UI_COPY[pageLang]))
      .replace(/\s+/g, " ")
      .trim();

    const description = originalContent.length > 155 ? `${originalContent.slice(0, 155)}...` : originalContent;
    const imageUrl = getCoverUrl(manga.id, manga.relationships) || SITE_IMAGE;
    const socialTitle = `${displayTitle} | ${SITE_NAME}`;
    const metaTitlePrefix = pageLang === "pt" ? "Ler" : pageLang === "en" ? "Read" : "Leer";
    const metaTitleSuffix = pageLang === "pt" ? "Online Grátis" : pageLang === "en" ? "Online Free" : "Online Gratis";
    const languageKeyword =
      pageLang === "pt" ? `${displayTitle} em português` : pageLang === "en" ? `${displayTitle} in english` : `${displayTitle} en español`;
    const genericKeyword =
      pageLang === "pt" ? "ler manga online" : pageLang === "en" ? "read manga online" : "leer manga online";

    return {
      title: `${metaTitlePrefix} ${displayTitle} ${metaTitleSuffix} - ${SITE_NAME}`,
      description,
      keywords: [
        displayTitle,
        `${displayTitle} manga`,
        `${displayTitle} manhwa`,
        `${displayTitle} online`,
        languageKeyword,
        genericKeyword,
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
    noAuthorDb: string;
    supportOnX: string;
    authorFallbackSearchSuffix: string;
    ratingVotes: string;
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
    chapterPrefix: string;
    chapterFallback: string;
    showMoreChapters: string;
    showingChapters: string;
    chapterSearchPlaceholder: string;
    sortNewestLabel: string;
    sortOldestLabel: string;
    suggestedEyebrow: string;
    suggestedTitle: string;
    faqWhereQuestion: (title: string) => string;
    faqWhereAnswer: (title: string) => string;
    faqLanguagesQuestion: (title: string) => string;
    faqLanguagesAnswer: (title: string) => string;
    faqContinueQuestion: (title: string) => string;
    faqContinueAnswer: (title: string) => string;
  }
> = {
  es: {
    addToFavorites: "Agregar a Favoritos",
    author: "Autor",
    noAuthor: "No disponible",
    noAuthorDb: "No disponible en DB",
    supportOnX: "Apoyar en X",
    authorFallbackSearchSuffix: "oficial",
    ratingVotes: "votos",
    activeScan: "Grupo de Scan Activo",
    synopsis: "Sinopsis",
    readMore: "Leer más",
    readLess: "Leer menos",
    chapters: "Capítulos",
    totalChapters: "Totales",
    totalSuffix: "capítulos en total",
    noSynopsis: "No hay descripción disponible para este manga.",
    noChapters: "No encontramos capítulos disponibles todavía.",
    noChaptersInLanguage: "No hay capítulos disponibles en este idioma.",
    readInFallbackLanguage: "Leer en",
    latestOrder: "Más recientes primero",
    noScan: "Selección automática",
    publishedOn: "Publicado",
    chapterPrefix: "Capítulo",
    chapterFallback: "Capítulo especial",
    showMoreChapters: "Mostrar más capítulos",
    showingChapters: "Mostrando",
    chapterSearchPlaceholder: "Ej: 16",
    sortNewestLabel: "Mostrar capítulo más reciente primero",
    sortOldestLabel: "Mostrar capítulo 1 primero",
    suggestedEyebrow: "MangaStoon recomienda",
    suggestedTitle: "Más contenido similar",
    faqWhereQuestion: (title) => `¿Dónde leer ${title} online gratis?`,
    faqWhereAnswer: (title) => `Podés leer ${title} online gratis en MangaStoon, con capítulos disponibles desde la página de la serie.`,
    faqLanguagesQuestion: (title) => `¿En qué idiomas está disponible ${title}?`,
    faqLanguagesAnswer: (title) => `${title} puede estar disponible en Español, Inglés y Portugués según los capítulos publicados para cada idioma.`,
    faqContinueQuestion: (title) => `¿Dónde continuar leyendo ${title}?`,
    faqContinueAnswer: (title) => `En MangaStoon podés abrir ${title}, elegir un capítulo y continuar la lectura desde el historial del navegador.`,
  },
  en: {
    addToFavorites: "Add to Favorites",
    author: "Author",
    noAuthor: "Unavailable",
    noAuthorDb: "Unavailable in DB",
    supportOnX: "Support on X",
    authorFallbackSearchSuffix: "official",
    ratingVotes: "votes",
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
    chapterPrefix: "Chapter",
    chapterFallback: "Special chapter",
    showMoreChapters: "Show more chapters",
    showingChapters: "Showing",
    chapterSearchPlaceholder: "Ex: 16",
    sortNewestLabel: "Show newest chapter first",
    sortOldestLabel: "Show chapter 1 first",
    suggestedEyebrow: "MangaStoon recommends",
    suggestedTitle: "More similar content",
    faqWhereQuestion: (title) => `Where can I read ${title} online for free?`,
    faqWhereAnswer: (title) => `You can read ${title} online for free on MangaStoon, with available chapters from the series page.`,
    faqLanguagesQuestion: (title) => `Which languages is ${title} available in?`,
    faqLanguagesAnswer: (title) => `${title} may be available in Spanish, English and Portuguese depending on the chapters published for each language.`,
    faqContinueQuestion: (title) => `Where can I continue reading ${title}?`,
    faqContinueAnswer: (title) => `On MangaStoon you can open ${title}, choose a chapter and continue reading from your browser history.`,
  },
  pt: {
    addToFavorites: "Adicionar aos Favoritos",
    author: "Autor",
    noAuthor: "Indisponível",
    noAuthorDb: "Indisponível no DB",
    supportOnX: "Apoiar no X",
    authorFallbackSearchSuffix: "oficial",
    ratingVotes: "votos",
    activeScan: "Grupo de Scan Ativo",
    synopsis: "Sinopse",
    readMore: "Ler mais",
    readLess: "Ler menos",
    chapters: "Capítulos",
    totalChapters: "Totais",
    totalSuffix: "capítulos no total",
    noSynopsis: "Não há descrição disponível para este manga.",
    noChapters: "Ainda não encontramos capítulos disponíveis.",
    noChaptersInLanguage: "Não há capítulos disponíveis neste idioma.",
    readInFallbackLanguage: "Ler em",
    latestOrder: "Mais recentes primeiro",
    noScan: "Seleção automática",
    publishedOn: "Publicado",
    chapterPrefix: "Capítulo",
    chapterFallback: "Capítulo especial",
    showMoreChapters: "Mostrar mais capítulos",
    showingChapters: "Mostrando",
    chapterSearchPlaceholder: "Ex: 16",
    sortNewestLabel: "Mostrar capítulo mais recente primeiro",
    sortOldestLabel: "Mostrar capítulo 1 primeiro",
    suggestedEyebrow: "MangaStoon recomenda",
    suggestedTitle: "Mais conteúdo similar",
    faqWhereQuestion: (title) => `Onde ler ${title} online grátis?`,
    faqWhereAnswer: (title) => `Você pode ler ${title} online grátis no MangaStoon, com capítulos disponíveis na página da série.`,
    faqLanguagesQuestion: (title) => `Em quais idiomas ${title} está disponível?`,
    faqLanguagesAnswer: (title) => `${title} pode estar disponível em Espanhol, Inglês e Português conforme os capítulos publicados para cada idioma.`,
    faqContinueQuestion: (title) => `Onde continuar lendo ${title}?`,
    faqContinueAnswer: (title) => `No MangaStoon você pode abrir ${title}, escolher um capítulo e continuar a leitura pelo histórico do navegador.`,
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

function getManualCoverOverride(mangaId: string, title: string) {
  const normalized = `${mangaId} ${title}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    normalized.includes("un-nigromante-en-la-familia-de-espadachines") ||
    normalized.includes("nigromante en la familia de espadachines")
  ) {
    return "https://cdn.asurascans.com/asura-images/covers/sword-of-the-undying.bbd784.webp";
  }

  return "";
}

async function shouldUseFallbackCover(coverUrl: string) {
  if (!coverUrl.startsWith("/api/proxy-image?")) {
    return false;
  }

  const rawUrl = new URLSearchParams(coverUrl.split("?")[1] ?? "").get("url");

  if (!rawUrl || !rawUrl.includes("dashboard.olympusbiblioteca.com")) {
    return false;
  }

  try {
    const response = await fetch(rawUrl, {
      method: "HEAD",
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: "https://olympusbiblioteca.com/",
      },
    });

    return response.status === 404;
  } catch {
    return false;
  }
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
  chapterPrefix: string,
  fallbackLabel: string
) {
  if (!chapterNumber) {
    return fallbackLabel;
  }

  const remainingVariants = totalOccurrences - occurrenceIndex - 1;

  if (remainingVariants <= 0) {
    return `${chapterPrefix} ${chapterNumber}`;
  }

  const suffix = 4 + remainingVariants;
  return `${chapterPrefix} ${chapterNumber}.${suffix}`;
}

async function fetchMangaChapters(id: string, language: SupportedLanguage) {
  const localComic = await fetchLocalComicBySlug(id);

  if (localComic) {
    return getLocalComicScanChapters(localComic);
  }

  return fetchMangaChaptersExternal(id, language);
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
  // no al capítulo más reciente. Por eso pedimos el capítulo más antiguo.
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

const cachedFetchMangaDetails = cache(fetchMangaDetails);
const cachedGetLocalizedTitleAsync = cache(getLocalizedTitleAsync);
const cachedFetchMangaChapters = cache(fetchMangaChapters);
const cachedFetchMangaRatingSummary = cache(fetchMangaRatingSummary);
const cachedGetOriginalContent = cache(getOriginalContent);
const cachedFetchSimilarMangas = cache(fetchSimilarMangas);
const cachedFetchSuggestedLocalMangas = cache(fetchSuggestedLocalMangas);
const cachedShouldUseFallbackCover = cache(shouldUseFallbackCover);
const cachedFetchAuthorName = cache(fetchAuthorName);

export default async function MangaDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const id = extractComicIdFromSlugId(slug);
  const cookieStore = await cookies();
  const rawCookieLang = cookieStore.get("lang")?.value;
  const cookieLang = normalizeLanguage(rawCookieLang);
  const isAdult = cookieStore.get("mangastoon_adult")?.value === "true";

  // 1. Obtener detalles primero para poder calcular los slugs de cada idioma
  const manga = await cachedFetchMangaDetails(id, cookieLang);

  if (!manga) {
    return <MangaMaintenance language={cookieLang} />;
  }

  // 2. Sincronizar el idioma real comparando el slug de la URL actual
  const [titleEs, titleEn, titlePt] = await Promise.all([
    cachedGetLocalizedTitleAsync(manga, "es"),
    cachedGetLocalizedTitleAsync(manga, "en"),
    cachedGetLocalizedTitleAsync(manga, "pt"),
  ]);

  const slugEs = buildComicPath(titleEs, manga.id).replace(/^\/comics\//, "");
  const slugEn = buildComicPath(titleEn, manga.id).replace(/^\/comics\//, "");
  const slugPt = buildComicPath(titlePt, manga.id).replace(/^\/comics\//, "");
  const pageSlug = decodeURIComponent(slug);

  let slugLanguage: SupportedLanguage = "es";
  if (pageSlug === slugEn) slugLanguage = "en";
  else if (pageSlug === slugPt) slugLanguage = "pt";
  else if (pageSlug === slugEs) slugLanguage = "es";

  const currentLanguage: SupportedLanguage = rawCookieLang ? cookieLang : slugLanguage;

  const copy = UI_COPY[currentLanguage];

  // 3. Traer los capítulos correspondientes al idioma real resuelto
  const [initialChapters, ratingSummary] = await Promise.all([
    cachedFetchMangaChapters(id, currentLanguage),
    cachedFetchMangaRatingSummary(id),
  ]);

  // Obtener cliente Supabase Server y chequear valoración de likes
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  let dbLikesCount = 0;
  let userHasLiked = false;
  try {
    const { count } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("manga_id", manga.id);
    dbLikesCount = count || 0;

    if (userId) {
      const { data: likeRecord } = await supabase
        .from("likes")
        .select("*")
        .eq("user_id", userId)
        .eq("manga_id", manga.id)
        .maybeSingle();
      userHasLiked = !!likeRecord;
    }
  } catch (err) {
    logger.error(`[MangaStoon] Error al cargar likes para ${manga.id}:`, err);
  }

  let chapters = initialChapters;

  // Fallback de Consumet si MangaDex no devolvió nada
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

  const coverUrl = getCoverUrl(manga.id, manga.relationships);
  const fallbackCoverPages = chapters.flatMap((chapter) => chapter.localPages ?? []);
  const fallbackCoverUrl = fallbackCoverPages[1] ?? fallbackCoverPages[0] ?? "";
  const manualCoverUrl = getManualCoverOverride(manga.id, displayTitle);

  const databaseAuthor =
    manga.author &&
    manga.author.trim() &&
    manga.author !== "MangaStoon" &&
    manga.author.toLowerCase() !== "autor desconocido"
      ? manga.author.trim()
      : null;

  // Ejecutar todas las solicitudes asíncronas restantes en paralelo para eliminar waterfalls
  const [
    description,
    similarMangas,
    fallbackSuggestedMangas,
    shouldUseFallback,
    realAuthorResolved
  ] = await Promise.all([
    cachedGetOriginalContent(manga, currentLanguage, copy),
    cachedFetchSimilarMangas(manga.id, tags.map((tag) => tag.id), currentLanguage, isAdult),
    cachedFetchSuggestedLocalMangas(manga.id),
    (manualCoverUrl || !fallbackCoverUrl) ? Promise.resolve(false) : cachedShouldUseFallbackCover(coverUrl),
    databaseAuthor ? Promise.resolve(databaseAuthor) : cachedFetchAuthorName(displayTitle)
  ]);

  const suggestedMangas = similarMangas.length > 0 ? similarMangas.slice(0, 12) : fallbackSuggestedMangas.slice(0, 12);
  const isExplicitContent =
    manga.attributes?.contentRating === "erotica" ||
    manga.attributes?.contentRating === "pornographic" ||
    hasSensitiveAdultTag(manga.attributes?.tags);

  const primaryCoverUrl =
    manualCoverUrl || (fallbackCoverUrl && shouldUseFallback ? fallbackCoverUrl : coverUrl);

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
    images: primaryCoverUrl ? { webp: { large_image_url: primaryCoverUrl } } : {},
  };

  const realAuthor = realAuthorResolved;
  const authorSearchQuery = realAuthor ? `${realAuthor} manga creator` : `${displayTitle} ${copy.authorFallbackSearchSuffix}`;
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
        copy.chapterPrefix,
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
    image: primaryCoverUrl || "",
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
        name: copy.faqWhereQuestion(displayTitle),
        acceptedAnswer: {
          "@type": "Answer",
          text: copy.faqWhereAnswer(displayTitle),
        },
      },
      {
        "@type": "Question",
        name: copy.faqLanguagesQuestion(displayTitle),
        acceptedAnswer: {
          "@type": "Answer",
          text: copy.faqLanguagesAnswer(displayTitle),
        },
      },
      {
        "@type": "Question",
        name: copy.faqContinueQuestion(displayTitle),
        acceptedAnswer: {
          "@type": "Answer",
          text: copy.faqContinueAnswer(displayTitle),
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
      {/* Sistema de anuncios desactivado temporalmente. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <SiteHeader language={currentLanguage} />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-5 md:px-6 md:py-8 lg:px-8">
        <div className="flex items-center justify-between mb-4 w-full">
          <BackButton />
          <a
            href="https://t.me/+dtPKjcBfiDUyOWQx"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-xs font-heading font-bold text-sky-400 hover:bg-sky-500 hover:text-white transition-all active:scale-95 shadow-md shadow-sky-500/5 cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.35-.49.97-.74 3.79-1.65 6.32-2.73 7.57-3.26 3.6-1.52 4.35-1.78 4.84-1.79.11 0 .35.03.5.16.13.1.17.24.19.34.02.09.02.26 0 .38z"/>
            </svg>
            <span>{currentLanguage === "es" ? "Comunidad" : currentLanguage === "pt" ? "Comunidade" : "Community"}</span>
          </a>
        </div>

        {/* Mobile Header Title */}
        <div className="mb-6 md:hidden text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white font-heading leading-tight">
            {displayTitle}
          </h1>
          <p className="mt-2 text-sm font-semibold text-amber-400">
            ★ {ratingSummary.ratingValue}/{aggregateRating.bestRating} · {ratingSummary.ratingCount} {copy.ratingVotes}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
          <aside className="md:col-span-4 lg:col-span-3">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start md:flex-col md:gap-4 w-full">
              <div className="mx-auto sm:mx-0 max-h-[300px] max-w-[180px] overflow-hidden rounded-xl shadow-2xl shadow-black/50 sm:max-w-[220px] md:max-h-none md:max-w-none w-full shrink-0">
                {primaryCoverUrl ? (
                  <div className="relative aspect-[2/3] w-full">
                    <ComicCoverImage
                      src={primaryCoverUrl}
                      fallbackSrc={fallbackCoverUrl}
                      alt={`Portada del manga ${displayTitle}`}
                    />
                  </div>
                ) : (
                  <div className="aspect-[2/3] bg-white/5" />
                )}
              </div>

              <div className="w-full rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#1b1c22]/60 to-[#101115]/80 p-4 text-center md:mt-4 md:p-5 md:text-left flex flex-col gap-2.5 shadow-xl">
                <ContinueReadingButton mangaId={manga.id} />
                <FavoriteButton manga={favoriteManga} label={copy.addToFavorites} variant="inline" />
                <LikeButton
                  mangaId={manga.id}
                  initialLikesCount={dbLikesCount}
                  initialUserHasLiked={userHasLiked}
                  apiLikesCount={parseInt(ratingSummary?.ratingCount || "0", 10) || 0}
                  userId={userId}
                  label={currentLanguage === "es" ? "Me gusta" : currentLanguage === "pt" ? "Curtir" : "Like"}
                  likedLabel={currentLanguage === "es" ? "Te gusta" : currentLanguage === "pt" ? "Curtiu" : "Liked"}
                />
                <AddToListButton
                  mangaId={manga.id}
                  mangaTitle={displayTitle}
                  coverImage={primaryCoverUrl || fallbackCoverUrl || null}
                  language={currentLanguage}
                />

                <div className="mt-4 border-t border-white/[0.06] pt-4 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                    {copy.author}
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-white">{realAuthor || copy.noAuthorDb}</p>
                  <a
                    href={
                      "https://twitter.com/search?q=" +
                      encodeURIComponent(authorSearchQuery)
                    }
                    target="_blank"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-2 transition-colors duration-200"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-3 w-3 fill-current"
                    >
                      <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-7.4L6.4 22H3.3l7.3-8.4L2.9 2h6.4l4.4 6.6L18.9 2Zm-1.1 17.9h1.7L8.4 4H6.6l11.2 15.9Z" />
                    </svg>
                    <span className="font-medium">{copy.supportOnX}</span>
                  </a>
                </div>

              </div>
            </div>
          </aside>

          <section className="text-center md:col-span-8 md:text-left lg:col-span-9">
            <h1 className="hidden md:block mb-3 line-clamp-2 hyphens-auto text-2xl font-bold leading-tight text-white md:text-3xl font-heading">
              {displayTitle}
            </h1>
            <p className="hidden md:block mb-4 text-sm font-medium text-amber-300">
              {"\u2605"} {ratingSummary.ratingValue}/{aggregateRating.bestRating} {"\u00b7"} {ratingSummary.ratingCount} {copy.ratingVotes}
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
              language={currentLanguage}
            />

            <section id="chapters" className="mt-8 scroll-mt-28">
              <div className="mb-4 flex flex-col items-center justify-center gap-3 md:flex-row md:justify-between md:gap-4 w-full flex-wrap">
                <div className="border-b-4 border-[#ff6b00] px-3 pb-2 md:border-b-0 md:border-l-4 md:pb-0 md:pl-3">
                  <h2 className="text-2xl font-semibold text-white md:text-2xl">{copy.chapters}</h2>
                </div>
                <div className="flex items-center gap-3.5 flex-wrap justify-center">
                  <p className="text-base leading-relaxed text-gray-400">
                    {chapters.length} {copy.totalChapters}
                  </p>
                  <Link
                    href="/lists"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-xs font-heading font-bold text-orange-500 hover:bg-orange-500 hover:text-black transition-all active:scale-95 shadow-md"
                  >
                    <FolderHeart size={14} className="text-orange-400" />
                    <span>{currentLanguage === "es" ? "Listas de la Comunidad" : currentLanguage === "pt" ? "Listas da Comunidade" : "Community Lists"}</span>
                  </Link>
                </div>
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
                  language={slugLanguage}
                  chapterRows={chapterRows}
                  showMoreLabel={copy.showMoreChapters}
                  totalLabel={`${chapters.length} ${copy.totalSuffix}`}
                  searchPlaceholder={copy.chapterSearchPlaceholder}
                  sortNewestLabel={copy.sortNewestLabel}
                  sortOldestLabel={copy.sortOldestLabel}
                  scanGroups={scanGroups}
                  activeScanGroup={activeScanGroup}
                />
              )}
            </section>

            <MangaComments mangaId={manga.id} />

            {suggestedMangas.length > 0 ? (
              <section className="mt-16 border-t border-gray-800 pt-10">
                <div className="mb-6 border-b-4 border-[#ff6b00] px-3 pb-2 text-center md:border-b-0 md:border-l-4 md:pb-0 md:pl-3 md:text-left">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ff6b00]">{copy.suggestedEyebrow}</p>
                  <h2 className="mt-1 text-2xl font-bold text-white">{copy.suggestedTitle}</h2>
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

