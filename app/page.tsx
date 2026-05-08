import { cookies } from "next/headers";
import HorizontalCarousel from "./components/horizontal-carousel";
import SiteHeader, { type SupportedLanguage } from "./components/site-header";
import {
  buildMangaDexMangaUrl,
  fetchMangaDexCollection,
  fetchMangaDexStatistics,
  mapToShowcaseItems,
  type MangaDexManga,
} from "./utils/mangadex";
import { getMangaDexRequestHeaders } from "./utils/mangadex-config";

const UI_COPY: Record<
  SupportedLanguage,
  {
    topToday: string;
    topTodaySubtitle: string;
    topManhwas: string;
    topManhwasSubtitle: string;
    worldTop: string;
    worldTopSubtitle: string;
    latestReleases: string;
    latestReleasesSubtitle: string;
    homeUnavailable: string;
    homeUnavailableBody: string;
  }
> = {
  es: {
    topToday: "Lo mas Top del Dia",
    topTodaySubtitle: "Lo que esta dominando hoy en lectura",
    topManhwas: "Top Manhwas",
    topManhwasSubtitle: "Los gigantes coreanos mas seguidos",
    worldTop: "Top Mundial",
    worldTopSubtitle: "Los favoritos de la comunidad global",
    latestReleases: "Nuevos Lanzamientos",
    latestReleasesSubtitle: "Capitulos y series recien actualizados",
    homeUnavailable: "Mangastoon",
    homeUnavailableBody: "No pudimos cargar las filas principales en este momento.",
  },
  en: {
    topToday: "Top of the Day",
    topTodaySubtitle: "What is leading reading right now",
    topManhwas: "Top Manhwas",
    topManhwasSubtitle: "The most followed Korean comics",
    worldTop: "Global Top",
    worldTopSubtitle: "Community favorites around the world",
    latestReleases: "New Releases",
    latestReleasesSubtitle: "Freshly updated chapters and series",
    homeUnavailable: "Mangastoon",
    homeUnavailableBody: "We could not load the main rows right now.",
  },
  pt: {
    topToday: "O Melhor do Dia",
    topTodaySubtitle: "O que esta dominando a leitura hoje",
    topManhwas: "Top Manhwas",
    topManhwasSubtitle: "Os quadrinhos coreanos mais seguidos",
    worldTop: "Top Mundial",
    worldTopSubtitle: "Os favoritos da comunidade global",
    latestReleases: "Novos Lancamentos",
    latestReleasesSubtitle: "Capitulos e series recem atualizados",
    homeUnavailable: "Mangastoon",
    homeUnavailableBody: "Nao foi possivel carregar as principais fileiras agora.",
  },
};

function normalizeLanguage(value: string | undefined): SupportedLanguage {
  if (value === "en" || value === "pt") {
    return value;
  }

  return "es";
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

function formatRelativeTime(dateString: string | null | undefined, language: SupportedLanguage) {
  if (!dateString) {
    return language === "en" ? "Recently" : language === "pt" ? "Recentemente" : "Reciente";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return language === "en" ? "Recently" : language === "pt" ? "Recentemente" : "Reciente";
  }

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years >= 1) {
    if (language === "en") return `${years} ${years === 1 ? "year" : "years"} ago`;
    if (language === "pt") return `Ha ${years} ${years === 1 ? "ano" : "anos"}`;
    return `Hace ${years} ${years === 1 ? "año" : "años"}`;
  }

  if (months >= 1) {
    if (language === "en") return `${months} ${months === 1 ? "month" : "months"} ago`;
    if (language === "pt") return `Ha ${months} ${months === 1 ? "mes" : "meses"}`;
    return `Hace ${months} ${months === 1 ? "mes" : "meses"}`;
  }

  if (days >= 1) {
    if (language === "en") return `${days} ${days === 1 ? "day" : "days"} ago`;
    if (language === "pt") return `Ha ${days} ${days === 1 ? "dia" : "dias"}`;
    return `Hace ${days} ${days === 1 ? "dia" : "dias"}`;
  }

  if (hours >= 1) {
    if (language === "en") return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
    if (language === "pt") return `Ha ${hours}h`;
    return `Hace ${hours}h`;
  }

  if (language === "en") return `${minutes} min ago`;
  if (language === "pt") return `Ha ${minutes} min`;
  return `Hace ${minutes} min`;
}

async function fetchLatestChapterPreviews(mangaId: string, language: SupportedLanguage) {
  const params = new URLSearchParams();
  params.set("limit", "2");
  params.set("order[readableAt]", "desc");

  getChapterLanguageVariants(language).forEach((variant) => {
    params.append("translatedLanguage[]", variant);
  });

  const response = await fetch(`https://api.mangadex.org/manga/${mangaId}/feed?${params.toString()}`, {
    headers: getMangaDexRequestHeaders(),
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    data?: Array<{
      attributes?: {
        chapter?: string | null;
        readableAt?: string | null;
        publishAt?: string | null;
        updatedAt?: string | null;
        createdAt?: string | null;
      };
    }>;
  };

  return (payload.data ?? [])
    .slice(0, 2)
    .map((chapter) => {
      const publishedAt =
        chapter.attributes?.readableAt ??
        chapter.attributes?.publishAt ??
        chapter.attributes?.updatedAt ??
        chapter.attributes?.createdAt ??
        null;

      return {
        chapter: chapter.attributes?.chapter?.trim() || "?",
        timeAgo: formatRelativeTime(publishedAt, language),
        publishedAt,
      };
    });
}

async function filterMangasWithReadableChapters(
  mangas: MangaDexManga[],
  language: SupportedLanguage
) {
  const checks = await Promise.all(
    mangas.map(async (manga) => ({
      manga,
      chapters: await fetchLatestChapterPreviews(manga.id, language),
    }))
  );

  return checks.filter((entry) => entry.chapters.length > 0).map((entry) => entry.manga);
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const currentLanguage = normalizeLanguage(cookieStore.get("lang")?.value);
  const isAdult = cookieStore.get("mangastoon_adult")?.value === "true";
  const copy = UI_COPY[currentLanguage];

  const topTodayUrl = buildMangaDexMangaUrl(
    {
      limit: "10",
      "order[followedCount]": "desc",
    },
    isAdult,
    currentLanguage
  );

  const topManhwasUrl = buildMangaDexMangaUrl(
    {
      limit: "10",
      "originalLanguage[]": "ko",
      "order[followedCount]": "desc",
    },
    isAdult,
    currentLanguage
  );

  const worldTopUrl = buildMangaDexMangaUrl(
    {
      limit: "15",
      "order[followedCount]": "desc",
    },
    isAdult,
    currentLanguage
  );

  const latestUrl = buildMangaDexMangaUrl(
    {
      limit: "30",
      "order[latestUploadedChapter]": "desc",
    },
    isAdult,
    currentLanguage
  );

  const [topTodayResponse, topManhwasResponse, worldTopResponse, latestResponse] = await Promise.all([
    fetchMangaDexCollection(topTodayUrl),
    fetchMangaDexCollection(topManhwasUrl),
    fetchMangaDexCollection(worldTopUrl),
    fetchMangaDexCollection(latestUrl),
  ]);

  const [topTodayData, topManhwasData, worldTopData, latestData] = await Promise.all([
    filterMangasWithReadableChapters(topTodayResponse.data, currentLanguage),
    filterMangasWithReadableChapters(topManhwasResponse.data, currentLanguage),
    filterMangasWithReadableChapters(worldTopResponse.data, currentLanguage),
    filterMangasWithReadableChapters(latestResponse.data, currentLanguage),
  ]);

  const uniqueIds = Array.from(
    new Set(
      [...topTodayData, ...topManhwasData, ...worldTopData, ...latestData].map((manga) => manga.id)
    )
  );

  const statistics = await fetchMangaDexStatistics(uniqueIds);

  const topToday = mapToShowcaseItems(topTodayData, statistics, currentLanguage);
  const topManhwas = mapToShowcaseItems(topManhwasData, statistics, currentLanguage);
  const worldTop = mapToShowcaseItems(worldTopData, statistics, currentLanguage);
  const latestBase = mapToShowcaseItems(latestData, statistics, currentLanguage);
  const latestChapterPreviews = await Promise.all(
    latestBase.map(async (manga) => ({
      mangaDexId: manga.mangaDexId,
      latestChapters: manga.mangaDexId
        ? await fetchLatestChapterPreviews(manga.mangaDexId, currentLanguage)
        : [],
    }))
  );
  const latest = latestBase
    .map((manga) => ({
      ...manga,
      latestChapters:
        latestChapterPreviews.find((preview) => preview.mangaDexId === manga.mangaDexId)
          ?.latestChapters ?? [],
    }))
    .filter((manga) => manga.latestChapters.length > 0)
    .sort((a, b) => {
      const aTime = new Date(a.latestChapters[0]?.publishedAt ?? 0).getTime();
      const bTime = new Date(b.latestChapters[0]?.publishedAt ?? 0).getTime();

      return bTime - aTime;
    })
    .slice(0, 15);

  if (topToday.length === 0 && topManhwas.length === 0 && worldTop.length === 0 && latest.length === 0) {
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
        <HorizontalCarousel
          mangas={topToday}
          title={copy.topToday}
          subtitle={copy.topTodaySubtitle}
          featuredCards
        />
        <HorizontalCarousel
          mangas={topManhwas}
          title={copy.topManhwas}
          subtitle={copy.topManhwasSubtitle}
        />
        <HorizontalCarousel
          mangas={worldTop}
          title={copy.worldTop}
          subtitle={copy.worldTopSubtitle}
        />
        <HorizontalCarousel
          mangas={latest}
          title={copy.latestReleases}
          subtitle={copy.latestReleasesSubtitle}
          showChapters
        />
      </div>
    </main>
  );
}
