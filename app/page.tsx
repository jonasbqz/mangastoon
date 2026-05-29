import { logger } from "./utils/logger";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "./utils/seo";

export const metadata: Metadata = {
  alternates: {
    canonical: SITE_URL,
  },
};

import HorizontalCarousel from "./components/horizontal-carousel";
import ReadingHistoryList from "./components/ReadingHistoryList";
import MangaCard, { type MangaShowcaseItem } from "./components/MangaCard";
import SiteHeader, { type SupportedLanguage } from "./components/site-header";
import { getLocalizedTitle, getLocalizedTitleAsync } from "./utils/get-localized-title";
import { FolderHeart, Crown, User, Compass, ArrowRight } from "lucide-react";
import PremiumPromoModal from "./components/PremiumPromoModal";
import { getPublicMangaLists } from "./actions/lists";
import {
  buildMangaDexMangaUrl,
  fetchMangaDexCollection,
  fetchMangaDexStatistics,
  fetchLocalTop,
  fetchLocalChapterPreviews,
  fetchLeerCapituloLatest,
  getAvailableTranslatedLanguageVariants,
  extractLocalApiComics,
  mapLocalApiComicsToShowcaseItems,
  mapToShowcaseItems,
  type LocalApiComicsResponse,
  type MangaDexManga,
} from "./utils/mangadex";
import { getMangaDexRequestHeaders, toMangaDexApiUrl } from "./utils/mangadex-config";
import { buildComicPath } from "./utils/slugify";

const MONLINE_API_URL = (
  process.env.MONLINE_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://46.224.213.127:8085"
).replace(/\/$/, "");
const MONLINE_HOME_TIMEOUT_MS = 15000;

const UI_COPY: Record<
  SupportedLanguage,
  {
    worldTop: string;
    worldTopSubtitle: string;
    topManhwas: string;
    topManhwasSubtitle: string;
    latestReleases: string;
    latestReleasesSubtitle: string;
    homeUnavailable: string;
    homeUnavailableBody: string;
  }
> = {
  es: {
    worldTop: "Top Mundial de MangaStoon",
    worldTopSubtitle: "Los comics más vistos de nuestra biblioteca",
    topManhwas: "Top Manhuas Mundiales",
    topManhwasSubtitle: "Los manhuas chinos con más vistas en MangaStoon",
    latestReleases: "Recién agregados en MangaStoon",
    latestReleasesSubtitle: "Nuevas series incorporadas a la biblioteca",
    homeUnavailable: "Mangastoon",
    homeUnavailableBody: "No pudimos cargar las filas principales en este momento.",
  },
  en: {
    worldTop: "MangaStoon Global Top",
    worldTopSubtitle: "The most viewed comics from our library",
    topManhwas: "Global Top Manhuas",
    topManhwasSubtitle: "The most viewed Chinese manhuas on MangaStoon",
    latestReleases: "Recently Added on MangaStoon",
    latestReleasesSubtitle: "New series added to the library",
    homeUnavailable: "Mangastoon",
    homeUnavailableBody: "We could not load the main rows right now.",
  },
  pt: {
    worldTop: "Top Mundial da MangaStoon",
    worldTopSubtitle: "Os comics mais vistos da nossa biblioteca",
    topManhwas: "Top Manhuas Mundiais",
    topManhwasSubtitle: "Os manhuas chineses mais vistos na MangaStoon",
    latestReleases: "Recém adicionados na MangaStoon",
    latestReleasesSubtitle: "Novas séries adicionadas à biblioteca",
    homeUnavailable: "Mangastoon",
    homeUnavailableBody: "Nao foi possivel carregar as principais fileiras agora.",
  },
};

type MonlineComic = Record<string, unknown>;
type MonlineComicsResponse = LocalApiComicsResponse;

type MangaDexChapterFeedResponse = {
  data?: Array<{
    id: string;
    attributes?: {
      chapter?: string | null;
      readableAt?: string | null;
      publishAt?: string | null;
      updatedAt?: string | null;
      createdAt?: string | null;
      translatedLanguage?: string | null;
    };
  }>;
  total?: number;
};

function normalizeLanguage(value: string | undefined): SupportedLanguage {
  if (value === "en" || value === "pt") return value;
  return "es";
}

function isMangaDexUuid(value: string | null | undefined): value is string {
  return Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
}

function formatRelativeTime(dateString: string | null | undefined, language: SupportedLanguage) {
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

  if (years >= 1) return language === "en" ? `${years}y ago` : language === "pt" ? `ha ${years}a` : `hace ${years} a\u00f1o${years === 1 ? "" : "s"}`;
  if (months >= 1) return language === "en" ? `${months}mo ago` : language === "pt" ? `ha ${months}m` : `hace ${months} mes${months === 1 ? "" : "es"}`;
  return language === "en" ? `${days}d ago` : language === "pt" ? `ha ${days}d` : `hace ${days} d`;
}

function getStringValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return "";
}

function getNumberValue(source: MonlineComic, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function getRecordArrayValue(source: MonlineComic, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
    if (value && typeof value === "object") return [value as Record<string, unknown>];
  }
  return [];
}

function getChapterTimestamp(chapter: Record<string, unknown>) {
  const rawDate = getStringValue(chapter, [
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
  const timestamp = rawDate ? new Date(rawDate).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getChapterNumericNumber(chapter: Record<string, unknown>) {
  const rawNumber = getStringValue(chapter, [
    "chapter",
    "number",
    "chapterNumber",
    "chapter_number",
  ]);
  const parsed = Number.parseFloat(rawNumber.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function getLatestChapterPreviewTimestamp(item: MangaShowcaseItem) {
  const timestamps = (item.latestChapters ?? [])
    .map((chapter) => (chapter.publishedAt ? new Date(chapter.publishedAt).getTime() : Number.NaN))
    .filter(Number.isFinite);

  if (timestamps.length > 0) {
    return Math.max(...timestamps);
  }

  return item.createdAt ? new Date(item.createdAt).getTime() : 0;
}

function getGenres(source: MonlineComic) {
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
        return getStringValue(genre as Record<string, unknown>, ["name", "title", "slug"]);
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 4);
}

function getMonlineTitleMap(source: MonlineComic) {
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

function getMonlineLatestChapters(comic: MonlineComic, language: SupportedLanguage) {
  const chapters = getRecordArrayValue(comic, [
    "latestChapters",
    "latest_chapters",
    "recentChapters",
    "recent_chapters",
    "chapters",
  ]);
  const fallbackChapterId = getStringValue(comic, [
    "latestChapterId",
    "latest_chapter_id",
    "chapterId",
    "chapter_id",
    "mangadex_chapter_id",
    "mangaDexChapterId",
  ]);
  const fallbackChapterNumber = getStringValue(comic, [
    "latestChapter",
    "latest_chapter",
    "chapter",
    "chapter_number",
    "chapterNumber",
  ]);
  const fallbackPublishedAt = getStringValue(comic, [
    "latestChapterAt",
    "latest_chapter_at",
    "releaseDate",
    "release_date",
    "published_at",
    "publishAt",
    "updated_at",
    "created_at",
  ]);
  const parsedChapters = [...chapters]
    .sort((a, b) => {
      const aDate = getChapterTimestamp(a);
      const bDate = getChapterTimestamp(b);

      if (aDate > 0 && bDate > 0 && aDate !== bDate) {
        return bDate - aDate;
      }

      const aNumber = getChapterNumericNumber(a);
      const bNumber = getChapterNumericNumber(b);

      if (aNumber !== null && bNumber !== null && aNumber !== bNumber) {
        return bNumber - aNumber;
      }

      return 0;
    })
    .map((chapter) => {
      const id = getStringValue(chapter, [
        "id",
        "chapterId",
        "chapter_id",
        "mangadex_chapter_id",
        "mangaDexChapterId",
        "uuid",
      ]);
      const chapterNumber = getStringValue(chapter, [
        "chapter",
        "number",
        "chapterNumber",
        "chapter_number",
        "name",
        "title",
      ]);
      const publishedAt = getStringValue(chapter, [
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

      return {
        id: id || null,
        chapter: chapterNumber,
        timeAgo: formatRelativeTime(publishedAt, language),
        publishedAt: publishedAt || null,
      };
    })
    .filter((chapter) => chapter.chapter);

  if (parsedChapters.length > 0) {
    return parsedChapters.slice(0, 2);
  }

  if (fallbackChapterNumber) {
    return [
      {
        id: fallbackChapterId || null,
        chapter: fallbackChapterNumber,
        timeAgo: formatRelativeTime(fallbackPublishedAt, language),
        publishedAt: fallbackPublishedAt || null,
      },
    ];
  }

  return [];
}

function extractMonlineComics(payload: MonlineComicsResponse) {
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.data?.comics)) return payload.data.comics;
  if (Array.isArray(payload.data?.items)) return payload.data.items;
  if (Array.isArray(payload.data?.results)) return payload.data.results;
  if (Array.isArray(payload.comics)) return payload.comics;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function normalizeMonlineImageUrl(value: string) {
  if (!value) return "";
  const imageUrl =
    value.startsWith("http://") || value.startsWith("https://")
      ? value
      : value.startsWith("//")
        ? `https:${value}`
        : `${MONLINE_API_URL}/${value.replace(/^\/+/, "")}`;
  return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
}

function mapMonlineComicsToShowcase(comics: MonlineComic[], language: SupportedLanguage) {
  return comics.slice(0, 15).map((comic, index): MangaShowcaseItem => {
    const titleMap = getMonlineTitleMap(comic);
    const title = getLocalizedTitle({ titleMap }, language) || "MangaStoon";
    const slug = getStringValue(comic, ["slug", "manga_slug", "comic_slug", "id"]);
    const mangaDexId = getStringValue(comic, [
      "mangaDexId",
      "mangadexId",
      "mangadex_id",
      "manga_dex_id",
      "mangaId",
      "manga_id",
    ]);
    const coverImage = normalizeMonlineImageUrl(
      getStringValue(comic, ["coverImage", "cover_image", "cover", "thumbnail", "image", "poster", "url_cover"])
    );
    const genres = getGenres(comic);
    const createdAt = getStringValue(comic, ["created_at", "createdAt", "uploaded_at", "updated_at", "updatedAt"]);

    return {
      mal_id: index + 1,
      title,
      score: null,
      url: slug ? buildComicPath(title, slug) : "#",
      mangaDexId: slug || mangaDexId || null,
      titleMap,
      featuredTag: `#${index + 1}`,
      createdAt,
      genres: genres.map((genre, genreIndex) => ({ mal_id: genreIndex + 1, name: genre })),
      tags: genres,
      latestChapters: getMonlineLatestChapters(comic, language),
      isLocal: true,
      images: {
        webp: { large_image_url: coverImage, image_url: coverImage },
        jpg: { large_image_url: coverImage, image_url: coverImage },
      },
    };
  });
}

async function fetchLatestChapterPreviews(mangaId: string, language: SupportedLanguage) {
  const params = new URLSearchParams();
  params.set("limit", "2");
  params.set("order[readableAt]", "desc");

  getAvailableTranslatedLanguageVariants(language).forEach((translatedLanguage) => {
    params.append("translatedLanguage[]", translatedLanguage);
  });

  try {
    const response = await fetch(
      toMangaDexApiUrl(`/manga/${mangaId}/feed?${params.toString()}`),
      {
        headers: getMangaDexRequestHeaders(),
        next: { revalidate: 900 },
      }
    );

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as MangaDexChapterFeedResponse;

    return (payload.data ?? []).slice(0, 2).map((chapter) => {
      const publishedAt =
        chapter.attributes?.readableAt ??
        chapter.attributes?.publishAt ??
        chapter.attributes?.updatedAt ??
        chapter.attributes?.createdAt ??
        null;

      return {
        id: chapter.id,
        chapter: chapter.attributes?.chapter?.trim() || "Especial",
        timeAgo: formatRelativeTime(publishedAt, language),
        publishedAt,
      };
    });
  } catch {
    return [];
  }
}

async function localizeShowcaseTitles(items: MangaShowcaseItem[], language: SupportedLanguage) {
  return Promise.all(
    items.map(async (item) => {
      const title = await getLocalizedTitleAsync(
        {
          titleMap: item.titleMap,
          altTitles: item.altTitles,
          title: item.title,
        },
        language
      );

      return {
        ...item,
        title,
        titleMap: {
          ...item.titleMap,
          [language]: title,
        },
      };
    })
  );
}

async function enrichLatestChapters(items: MangaShowcaseItem[], language: SupportedLanguage) {
  return Promise.all(
    items.map(async (item) => {
      if (item.latestChapters?.some((chapter) => chapter.id)) {
        return item;
      }

      const mangaDexId = item.mangaDexId;

      if (!isMangaDexUuid(mangaDexId)) {
        return item;
      }

      const latestChapters = await fetchLatestChapterPreviews(mangaDexId, language);

      return latestChapters.length > 0 ? { ...item, latestChapters } : item;
    })
  );
}

async function fetchMonlineComics(path: string, language: SupportedLanguage, enrichChapters = false) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MONLINE_HOME_TIMEOUT_MS);
  const isTopRow = path.includes("order=views");

  try {
    const response = await fetch(`${MONLINE_API_URL}${path}`, {
      next: { revalidate: isTopRow ? 86_400 : 60 },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as MonlineComicsResponse;
    logger.debug("Respuesta Monline", payload);

    const comics = extractMonlineComics(payload);
    const items = mapMonlineComicsToShowcase(comics, language);

    if (!enrichChapters) {
      return items;
    }

    const latestChapters = await Promise.all(
      comics.map((comic) => fetchLocalChapterPreviews(comic as any, MONLINE_API_URL, controller.signal).catch(() => []))
    );

    return items
      .map((item, index) =>
        latestChapters[index]?.length ? { ...item, latestChapters: latestChapters[index] } : item
      )
      .sort((a, b) => getLatestChapterPreviewTimestamp(b) - getLatestChapterPreviewTimestamp(a))
      .map((item, index) => ({ ...item, featuredTag: `#${index + 1}` }));
  } catch (error) {
    logger.error("Error al conectar con Monline", error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchMangaDexFallbackRows(isAdult: boolean, language: SupportedLanguage) {
  const manhwasUrl = buildMangaDexMangaUrl(
    { limit: "15", "originalLanguage[]": "zh", "order[followedCount]": "desc" },
    isAdult,
    language
  );
  const latestUrl = buildMangaDexMangaUrl({ limit: "15", "order[createdAt]": "desc" }, isAdult, language);

  const [topManhwasResponse, latestResponse] = await Promise.all([
    fetchMangaDexCollection(manhwasUrl),
    fetchMangaDexCollection(latestUrl),
  ]);
  const allMangaIds = Array.from(
    new Set(
      [topManhwasResponse.data, latestResponse.data]
        .flat()
        .map((manga: MangaDexManga) => manga.id)
    )
  );
  const statistics = await fetchMangaDexStatistics(allMangaIds);

  const topManhwas = await localizeShowcaseTitles(mapToShowcaseItems(topManhwasResponse.data, statistics, language), language).then((items) => items.map((manga, index) => ({
    ...manga,
    featuredTag: `#${index + 1}`,
  })));
  const latest = await localizeShowcaseTitles(mapToShowcaseItems(latestResponse.data, statistics, language), language).then((items) => items.map((manga, index) => ({
    ...manga,
    featuredTag: `#${index + 1}`,
  })));

  return {
    worldTop: [],
    topManhwas,
    latest: await enrichLatestChapters(latest, language),
  };
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const currentLanguage = normalizeLanguage(cookieStore.get("lang")?.value);
  const isAdult = cookieStore.get("mangastoon_adult")?.value === "true";
  const copy = UI_COPY[currentLanguage];
  const { lists: publicLists } = await getPublicMangaLists().catch(() => ({ lists: [] }));

  const useLocalCatalog = currentLanguage === "es";
  let monlineWorldTop: MangaShowcaseItem[] = [];
  let monlineTopManhwas: MangaShowcaseItem[] = [];
  let monlineNewManhwas: MangaShowcaseItem[] = [];
  let monlineLatest: MangaShowcaseItem[] = [];
  let leerCapituloLatest: MangaShowcaseItem[] = [];

  if (useLocalCatalog) {
    [monlineWorldTop, monlineTopManhwas, monlineNewManhwas, monlineLatest, leerCapituloLatest] = await Promise.all([
      fetchLocalTop(10, currentLanguage),
      fetchMonlineComics("/api/comics?limit=10&type=manhua&order=views", currentLanguage),
      fetchMonlineComics("/api/comics?limit=10&type=manhua&order=created_at", currentLanguage),
      fetchMonlineComics("/api/comics?limit=15&order=updated_at&sort=desc", currentLanguage, true),
      fetchLeerCapituloLatest(currentLanguage).catch(() => []),
    ]);
  }

  // Combine all updates and sort them strictly by arrival/publish date
  const combinedLatest = [...leerCapituloLatest, ...monlineLatest];
  combinedLatest.sort((a, b) => getLatestChapterPreviewTimestamp(b) - getLatestChapterPreviewTimestamp(a));

  const localTopManhwaKeys = new Set(monlineTopManhwas.map((manga) => manga.mangaDexId ?? manga.url));
  const localTopManhwas = [
    ...monlineTopManhwas,
    ...monlineNewManhwas.filter((manga) => !localTopManhwaKeys.has(manga.mangaDexId ?? manga.url)),
  ];
  const shouldUseFallback =
    !useLocalCatalog || localTopManhwas.length < 10 || combinedLatest.length === 0;
  const fallbackRows = shouldUseFallback ? await fetchMangaDexFallbackRows(isAdult, currentLanguage) : null;

  const worldTop = useLocalCatalog ? monlineWorldTop : fallbackRows?.topManhwas ?? [];
  const topManhwaKeys = new Set(localTopManhwas.map((manga) => manga.mangaDexId ?? manga.url));
  const topManhwas = [
    ...localTopManhwas,
    ...(fallbackRows?.topManhwas ?? []).filter((manga) => !topManhwaKeys.has(manga.mangaDexId ?? manga.url)),
  ].slice(0, 10);
  const latest = (combinedLatest.length > 0 ? combinedLatest : fallbackRows?.latest ?? []).slice(0, 60);

  if (worldTop.length === 0 && topManhwas.length === 0 && latest.length === 0) {
    return (
      <main className="min-h-screen bg-[#141519] text-white">
        <SiteHeader language={currentLanguage} />
        <div className="flex min-h-[70vh] items-center justify-center px-6">
          <div className="rounded-2xl border border-white/10 bg-[#1c1d22] px-8 py-10 text-center">
            <h1 className="text-3xl font-bold text-white">{copy.homeUnavailable}</h1>
            <p className="mt-4 text-sm text-gray-400">{copy.homeUnavailableBody}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#141519] pb-12 text-white">
      <SiteHeader language={currentLanguage} />
      <div className="mx-auto max-w-[1600px] space-y-12 px-4 py-8 md:px-8 lg:px-12">
        <div>
          <HorizontalCarousel mangas={worldTop} title={copy.worldTop} subtitle={copy.worldTopSubtitle} featuredCards autoAdvance />
          
          {/* Banner de Telegram de la Comunidad */}
          <div className="flex justify-center mt-6">
            <a
              href="https://t.me/+dtPKjcBfiDUyOWQx"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-6 py-3.5 text-sm font-heading font-bold text-sky-400 hover:bg-sky-500 hover:text-white transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-sky-500/5 cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.35-.49.97-.74 3.79-1.65 6.32-2.73 7.57-3.26 3.6-1.52 4.35-1.78 4.84-1.79.11 0 .35.03.5.16.13.1.17.24.19.34.02.09.02.26 0 .38z"/>
              </svg>
              <span>{currentLanguage === "es" ? "Unirse a la comunidad de Telegram" : currentLanguage === "pt" ? "Juntar-se à comunidade do Telegram" : "Join Telegram Community"}</span>
            </a>
          </div>
        </div>

        <ReadingHistoryList />
        <HorizontalCarousel
          mangas={topManhwas.slice(0, 10)}
          title={copy.topManhwas}
          subtitle={copy.topManhwasSubtitle}
        />
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 w-full flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-6 w-1.5 rounded-full bg-[#ff6b00] md:h-8" />
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{copy.latestReleases}</h2>
                <p className="text-xs text-gray-500">{copy.latestReleasesSubtitle}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6">
            {latest.map((manga, index) => (
              <MangaCard
                key={manga.mangaDexId ? `${manga.mangaDexId}-${index}` : `${manga.mal_id}-${index}`}
                manga={manga}
                variant="grid"
                showChapters
                latestChapters={manga.latestChapters}
              />
            ))}
          </div>
          
          {/* Gran botón de Explorar al final */}
          <div className="mt-12 flex justify-center w-full px-1">
            <Link
              href="/explore"
              className="group flex sm:inline-flex items-center justify-center gap-2.5 sm:gap-3 rounded-2xl bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 px-6 py-3.5 sm:px-10 sm:py-4.5 text-xs sm:text-sm font-heading font-extrabold uppercase tracking-wider text-black hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_24px_rgba(249,115,22,0.35)] hover:shadow-[0_4px_35px_rgba(249,115,22,0.55)] cursor-pointer w-full sm:w-auto text-center"
            >
              <Compass size={18} className="animate-spin-slow group-hover:rotate-45 transition-transform duration-500 shrink-0" />
              <span className="whitespace-nowrap">{currentLanguage === "es" ? "Explorar todo el catálogo" : currentLanguage === "pt" ? "Explorar todo o catálogo" : "Explore entire catalog"}</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform shrink-0" />
            </Link>
          </div>
        </div>

        {/* Sección de Listas de la Comunidad al final */}
        {publicLists && publicLists.length > 0 && (
          <div className="space-y-6 pt-10 border-t border-white/5">
            <div className="flex items-center justify-between gap-4 w-full flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-6 w-1.5 rounded-full bg-[#ff6b00] md:h-8" />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                    {currentLanguage === "es" ? "Listas de la Comunidad" : currentLanguage === "pt" ? "Listas da Comunidade" : "Community Lists"}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {currentLanguage === "es" ? "Colecciones de cómics creadas y compartidas por nuestros miembros" : currentLanguage === "pt" ? "Coleções de quadrinhos criadas por nossos membros" : "Comic collections created and shared by our members"}
                  </p>
                </div>
              </div>
              <Link
                href="/lists"
                className="inline-flex items-center gap-1.5 rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-xs font-heading font-bold text-orange-500 hover:bg-orange-500 hover:text-black transition-all active:scale-95 shadow-md"
              >
                <FolderHeart size={14} className="text-orange-400" />
                <span>{currentLanguage === "es" ? "Ver todas las listas" : currentLanguage === "pt" ? "Ver todas as listas" : "View all lists"}</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {publicLists.slice(0, 3).map((list) => {
                const username = list.profiles?.username || (currentLanguage === "es" ? "Lector Anónimo" : currentLanguage === "pt" ? "Leitor Anônimo" : "Anonymous Reader");
                const items = list.items || [];
                const itemsCount = items.length;

                return (
                  <div
                    key={list.id}
                    className="flex flex-col rounded-3xl border bg-[#1c1d22]/40 p-6 transition-all hover:bg-neutral-900/40 hover:scale-[1.01] hover:shadow-[0_12px_30px_rgba(0,0,0,0.4)]"
                    style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                        <User size={13} className="text-orange-500 shrink-0" />
                        <span className={`font-semibold truncate ${list.profiles?.is_premium ? "text-amber-400 font-bold drop-shadow-[0_0_6px_rgba(245,158,11,0.15)]" : "text-gray-400"}`}>
                          @{username}
                        </span>
                        {list.profiles?.is_premium && (
                          <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-600 border border-yellow-300/40 shadow-[0_0_8px_rgba(245,158,11,0.2)] shrink-0" title="Premium">
                            <Crown size={9} className="text-black fill-black stroke-[1.5]" />
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold font-heading text-neutral-100 line-clamp-1">
                        {list.name}
                      </h3>
                      {list.description ? (
                        <p className="mt-2 text-xs text-neutral-400 leading-normal line-clamp-2">
                          {list.description}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs italic text-neutral-600 leading-normal">
                          {currentLanguage === "es" ? "Sin descripción disponible." : currentLanguage === "pt" ? "Sem descrição disponível." : "No description available."}
                        </p>
                      )}

                      {/* Cover Stack preview */}
                      <div className="mt-5 mb-3 flex items-center gap-1.5">
                        {itemsCount === 0 ? (
                          <div className="flex h-16 w-full items-center justify-center rounded-xl border border-dashed border-white/5 bg-black/20 text-xs text-neutral-600 font-semibold gap-1.5">
                            <span>Lista vacía</span>
                          </div>
                        ) : (
                          <div className="flex items-center -space-x-4 overflow-hidden">
                            {items.slice(0, 4).map((item: any, idx: number) => (
                              <div
                                key={item.manga_id + idx}
                                className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg border-2 border-[#141519] bg-neutral-800 shadow-md transition-transform hover:translate-y-[-4px]"
                                style={{ zIndex: 10 - idx }}
                              >
                                {item.cover_image ? (
                                  <img
                                    src={item.cover_image}
                                    alt="Cover preview"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="h-full w-full bg-neutral-700" />
                                )}
                              </div>
                            ))}
                            {itemsCount > 4 && (
                              <div className="flex h-16 w-11 items-center justify-center rounded-lg border-2 border-[#141519] bg-neutral-900 text-[10px] font-bold text-orange-500 shadow-md">
                                +{itemsCount - 4}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 border-t border-white/5 pt-4 flex items-center justify-between text-xs text-gray-500">
                      <span className="font-semibold text-gray-400">
                        {itemsCount === 1 ? (currentLanguage === "es" ? "1 cómic" : currentLanguage === "pt" ? "1 cómic" : "1 comic") : `${itemsCount} ${currentLanguage === "es" ? "cómics" : currentLanguage === "pt" ? "cómics" : "comics"}`}
                      </span>
                      <Link
                        href={`/lists/${list.id}`}
                        className="inline-flex items-center gap-1 font-bold text-orange-500 hover:text-orange-400 group animate-pulse-subtle"
                      >
                        <span>{currentLanguage === "es" ? "Explorar Lista" : currentLanguage === "pt" ? "Explorar Lista" : "Explore List"}</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <PremiumPromoModal />
    </main>
  );
}
