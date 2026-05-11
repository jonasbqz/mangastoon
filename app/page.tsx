import { cookies } from "next/headers";
import HorizontalCarousel from "./components/horizontal-carousel";
import ReadingHistoryList from "./components/ReadingHistoryList";
import type { MangaShowcaseItem } from "./components/MangaCard";
import SiteHeader, { type SupportedLanguage } from "./components/site-header";
import {
  buildMangaDexMangaUrl,
  fetchMangaDexCollection,
  fetchMangaDexStatistics,
  mapToShowcaseItems,
  type MangaDexManga,
} from "./utils/mangadex";

const MONLINE_API_URL = (
  process.env.MONLINE_API_URL ??
  process.env.NEXT_PUBLIC_MONLINE_API_URL ??
  "http://localhost:8085"
).replace(/\/$/, "");
const MONLINE_HOME_TIMEOUT_MS = 2000;

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
    worldTop: "Top Mundial de Monline",
    worldTopSubtitle: "Los comics más vistos de la biblioteca de Monline",
    topManhwas: "Top 10 Manhuas Mundiales",
    topManhwasSubtitle: "Los manhwas con más vistas en Monline",
    latestReleases: "Recién agregados en Monline",
    latestReleasesSubtitle: "Nuevas series incorporadas a la biblioteca",
    homeUnavailable: "Mangastoon",
    homeUnavailableBody: "No pudimos cargar las filas principales en este momento.",
  },
  en: {
    worldTop: "Monline Global Top",
    worldTopSubtitle: "The most viewed comics from the Monline library",
    topManhwas: "Top 10 Global Manhwas",
    topManhwasSubtitle: "The most viewed manhwas on Monline",
    latestReleases: "Recently Added on Monline",
    latestReleasesSubtitle: "New series added to the library",
    homeUnavailable: "Mangastoon",
    homeUnavailableBody: "We could not load the main rows right now.",
  },
  pt: {
    worldTop: "Top Mundial da Monline",
    worldTopSubtitle: "Os comics mais vistos da biblioteca Monline",
    topManhwas: "Top 10 Manhwas Mundiais",
    topManhwasSubtitle: "Os manhwas mais vistos na Monline",
    latestReleases: "Recém adicionados na Monline",
    latestReleasesSubtitle: "Novas séries adicionadas à biblioteca",
    homeUnavailable: "Mangastoon",
    homeUnavailableBody: "Nao foi possivel carregar as principais fileiras agora.",
  },
};

type MonlineComic = Record<string, unknown>;
type MonlineComicsResponse = {
  data?: MonlineComic[] | { comics?: MonlineComic[]; items?: MonlineComic[]; results?: MonlineComic[] };
  comics?: MonlineComic[];
  items?: MonlineComic[];
  results?: MonlineComic[];
};

function normalizeLanguage(value: string | undefined): SupportedLanguage {
  if (value === "en" || value === "pt") return value;
  return "es";
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
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return `${MONLINE_API_URL}/${value.replace(/^\/+/, "")}`;
}

function mapMonlineComicsToShowcase(comics: MonlineComic[]) {
  return comics.slice(0, 15).map((comic, index): MangaShowcaseItem => {
    const title = getStringValue(comic, ["title", "name", "comic_title", "original_title"]) || "MangaStoon";
    const slug = getStringValue(comic, ["slug", "manga_slug", "comic_slug", "id"]);
    const coverImage = normalizeMonlineImageUrl(
      getStringValue(comic, ["coverImage", "cover_image", "cover", "thumbnail", "image", "poster", "url_cover"])
    );
    const genres = getGenres(comic);

    return {
      mal_id: getNumberValue(comic, ["id", "mal_id"]) || index + 1,
      title,
      score: null,
      url: slug ? `/manga/${slug}` : "#",
      mangaDexId: slug || null,
      featuredTag: `#${index + 1}`,
      genres: genres.map((genre, genreIndex) => ({ mal_id: genreIndex + 1, name: genre })),
      tags: genres,
      images: {
        webp: { large_image_url: coverImage, image_url: coverImage },
        jpg: { large_image_url: coverImage, image_url: coverImage },
      },
    };
  });
}

async function fetchMonlineComics(path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MONLINE_HOME_TIMEOUT_MS);

  try {
    const response = await fetch(`${MONLINE_API_URL}${path}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as MonlineComicsResponse;
    return mapMonlineComicsToShowcase(extractMonlineComics(payload));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchMangaDexFallbackRows(isAdult: boolean, language: SupportedLanguage) {
  const worldTopUrl = buildMangaDexMangaUrl({ limit: "15", "order[followedCount]": "desc" }, isAdult, language);
  const manhwasUrl = buildMangaDexMangaUrl(
    { limit: "15", "originalLanguage[]": "ko", "order[followedCount]": "desc" },
    isAdult,
    language
  );
  const latestUrl = buildMangaDexMangaUrl({ limit: "15", "order[createdAt]": "desc" }, isAdult, language);

  const [worldTopResponse, topManhwasResponse, latestResponse] = await Promise.all([
    fetchMangaDexCollection(worldTopUrl),
    fetchMangaDexCollection(manhwasUrl),
    fetchMangaDexCollection(latestUrl),
  ]);
  const allMangaIds = Array.from(
    new Set(
      [worldTopResponse.data, topManhwasResponse.data, latestResponse.data]
        .flat()
        .map((manga: MangaDexManga) => manga.id)
    )
  );
  const statistics = await fetchMangaDexStatistics(allMangaIds);

  return {
    worldTop: mapToShowcaseItems(worldTopResponse.data, statistics, language).map((manga, index) => ({
      ...manga,
      featuredTag: `#${index + 1}`,
    })),
    topManhwas: mapToShowcaseItems(topManhwasResponse.data, statistics, language).map((manga, index) => ({
      ...manga,
      featuredTag: `#${index + 1}`,
    })),
    latest: mapToShowcaseItems(latestResponse.data, statistics, language).map((manga, index) => ({
      ...manga,
      featuredTag: `#${index + 1}`,
    })),
  };
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const currentLanguage = normalizeLanguage(cookieStore.get("lang")?.value);
  const isAdult = cookieStore.get("mangastoon_adult")?.value === "true";
  const copy = UI_COPY[currentLanguage];

  const [monlineWorldTop, monlineTopManhwas, monlineLatest] = await Promise.all([
    fetchMonlineComics("/api/comics?limit=15&order=views"),
    fetchMonlineComics("/api/comics?limit=15&type=manhwa&order=views"),
    fetchMonlineComics("/api/comics?limit=15&order=created_at"),
  ]);

  const shouldUseFallback =
    monlineWorldTop.length === 0 || monlineTopManhwas.length === 0 || monlineLatest.length === 0;
  const fallbackRows = shouldUseFallback ? await fetchMangaDexFallbackRows(isAdult, currentLanguage) : null;

  const worldTop = monlineWorldTop.length > 0 ? monlineWorldTop : fallbackRows?.worldTop ?? [];
  const topManhwas = monlineTopManhwas.length > 0 ? monlineTopManhwas : fallbackRows?.topManhwas ?? [];
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
        <HorizontalCarousel mangas={worldTop} title={copy.worldTop} subtitle={copy.worldTopSubtitle} featuredCards />
        <ReadingHistoryList />
        <HorizontalCarousel
          mangas={topManhwas.slice(0, 10)}
          title={copy.topManhwas}
          subtitle={copy.topManhwasSubtitle}
        />
        <HorizontalCarousel mangas={latest} title={copy.latestReleases} subtitle={copy.latestReleasesSubtitle} />
      </div>
    </main>
  );
}
