import { logger } from "./utils/logger";
import { cookies } from "next/headers";
import HorizontalCarousel from "./components/horizontal-carousel";
import ReadingHistoryList from "./components/ReadingHistoryList";
import type { MangaShowcaseItem } from "./components/MangaCard";
import SiteHeader, { type SupportedLanguage } from "./components/site-header";
import { getLocalizedTitle, getLocalizedTitleAsync } from "./utils/get-localized-title";
import {
  buildMangaDexMangaUrl,
  fetchMangaDexCollection,
  fetchMangaDexStatistics,
  fetchLocalTop,
  fetchLocalChapterPreviews,
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
    items.map(async (item) => ({
      ...item,
      title: await getLocalizedTitleAsync(
        {
          titleMap: item.titleMap,
          altTitles: item.altTitles,
          title: item.title,
        },
        language
      ),
    }))
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
    const comics = extractLocalApiComics(payload);
    const items = mapLocalApiComicsToShowcaseItems(comics, language, MONLINE_API_URL);

    if (!enrichChapters) {
      return items;
    }

    const latestChapters = await Promise.all(
      comics.map((comic) => fetchLocalChapterPreviews(comic, MONLINE_API_URL, controller.signal).catch(() => []))
    );

    return items.map((item, index) =>
      latestChapters[index]?.length ? { ...item, latestChapters: latestChapters[index] } : item
    );
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

  const useLocalCatalog = currentLanguage === "es";
  let monlineWorldTop: MangaShowcaseItem[] = [];
  let monlineTopManhwas: MangaShowcaseItem[] = [];
  let monlineNewManhwas: MangaShowcaseItem[] = [];
  let monlineLatest: MangaShowcaseItem[] = [];

  if (useLocalCatalog) {
    [monlineWorldTop, monlineTopManhwas, monlineNewManhwas, monlineLatest] = await Promise.all([
      fetchLocalTop(10, currentLanguage),
      fetchMonlineComics("/api/comics?limit=10&type=manhua&order=views", currentLanguage),
      fetchMonlineComics("/api/comics?limit=10&type=manhua&order=created_at", currentLanguage),
      fetchMonlineComics("/api/comics?limit=15&order=created_at", currentLanguage, true),
    ]);
  }

  const localTopManhwaKeys = new Set(monlineTopManhwas.map((manga) => manga.mangaDexId ?? manga.url));
  const localTopManhwas = [
    ...monlineTopManhwas,
    ...monlineNewManhwas.filter((manga) => !localTopManhwaKeys.has(manga.mangaDexId ?? manga.url)),
  ];
  const shouldUseFallback =
    !useLocalCatalog || localTopManhwas.length < 10 || monlineLatest.length === 0;
  const fallbackRows = shouldUseFallback ? await fetchMangaDexFallbackRows(isAdult, currentLanguage) : null;

  const worldTop = useLocalCatalog ? monlineWorldTop : fallbackRows?.topManhwas ?? [];
  const topManhwaKeys = new Set(localTopManhwas.map((manga) => manga.mangaDexId ?? manga.url));
  const topManhwas = [
    ...localTopManhwas,
    ...(fallbackRows?.topManhwas ?? []).filter((manga) => !topManhwaKeys.has(manga.mangaDexId ?? manga.url)),
  ].slice(0, 10);
  const latest = monlineLatest.length > 0 ? monlineLatest : fallbackRows?.latest ?? [];

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
        <HorizontalCarousel mangas={worldTop} title={copy.worldTop} subtitle={copy.worldTopSubtitle} featuredCards autoAdvance />
        <ReadingHistoryList />
        <HorizontalCarousel
          mangas={topManhwas.slice(0, 10)}
          title={copy.topManhwas}
          subtitle={copy.topManhwasSubtitle}
        />
        <HorizontalCarousel mangas={latest} title={copy.latestReleases} subtitle={copy.latestReleasesSubtitle} showChapters />
      </div>
    </main>
  );
}
