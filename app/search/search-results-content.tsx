"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MangaCard, type MangaShowcaseItem } from "../components/home-carousel";
import { useLanguage } from "../components/language-provider";
import { getLocalizedTitle } from "../utils/get-localized-title";
import {
  appendStandardMangaDexFilters,
  fetchMangaDexStatistics,
  mapToShowcaseItems,
  type MangaDexCollectionResponse,
  type MangaDexManga,
} from "../utils/mangadex";

const MONLINE_API_URL = "/api/monline";

type MonlineComic = Record<string, unknown>;
type MonlineComicsResponse = {
  data?: MonlineComic[] | { comics?: MonlineComic[]; items?: MonlineComic[]; results?: MonlineComic[] };
  comics?: MonlineComic[];
  items?: MonlineComic[];
  results?: MonlineComic[];
};

function getStringValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
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
    ...(title ? { en: title } : {}),
    ...(englishTitle ? { en: englishTitle } : {}),
    ...(spanishTitle ? { es: spanishTitle } : {}),
    ...(portugueseTitle ? { pt: portugueseTitle } : {}),
  };
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

  if (imageUrl.includes("dashboard.olympusbiblioteca.com")) return imageUrl;

  return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
}

function mapMonlineComicsToShowcase(comics: MonlineComic[], language: "es" | "en" | "pt") {
  return comics.map((comic, index): MangaShowcaseItem => {
    const titleMap = getMonlineTitleMap(comic);
    const rawTitle = getStringValue(comic, ["title", "name", "comic_title", "original_title"]);
    const title = rawTitle || getLocalizedTitle({ titleMap }, language) || "MangaStoon";
    const slug = getStringValue(comic, ["slug", "manga_slug", "comic_slug", "id"]);
    const coverImage = normalizeMonlineImageUrl(
      getStringValue(comic, ["coverImage", "cover_image", "cover", "thumbnail", "image", "poster", "url_cover"])
    );
    const genres = getGenres(comic);

    return {
      mal_id: index + 1,
      title,
      score: null,
      url: slug ? `/manga/${slug}` : "#",
      mangaDexId: slug || null,
      titleMap,
      genres: genres.map((genre, genreIndex) => ({ mal_id: genreIndex + 1, name: genre })),
      tags: genres,
      isLocal: true,
      images: {
        webp: { large_image_url: coverImage, image_url: coverImage },
        jpg: { large_image_url: coverImage, image_url: coverImage },
      },
    };
  });
}

async function fetchSearchResults(query: string, language: "es" | "en" | "pt", isAdult: boolean, signal?: AbortSignal) {
  let localResults: MangaShowcaseItem[] = [];

  if (language === "es") {
    const params = new URLSearchParams();
    params.set("title", query);
    params.set("limit", "24");

    const response = await fetch(`${MONLINE_API_URL}/api/comics?${params.toString()}`, {
      cache: "no-store",
      signal,
    });

    if (response.ok) {
      const payload = (await response.json()) as MonlineComicsResponse;
      localResults = mapMonlineComicsToShowcase(extractMonlineComics(payload), language);
    }
  }

  const remaining = Math.max(1, 24 - Math.min(localResults.length, 24));
  const mangaDexParams = new URLSearchParams();
  mangaDexParams.set("title", query);
  mangaDexParams.set("limit", String(remaining));
  mangaDexParams.set("order[relevance]", "desc");
  appendStandardMangaDexFilters(mangaDexParams, isAdult, language);

  const mangaDexResponse = await fetch(`/api/mangadex/manga?${mangaDexParams.toString()}`, { signal });
  const mangaDexPayload = mangaDexResponse.ok
    ? ((await mangaDexResponse.json()) as MangaDexCollectionResponse)
    : { data: [] };
  const rawMangaDex = mangaDexPayload.data ?? [];
  const statistics = await fetchMangaDexStatistics(rawMangaDex.map((manga) => manga.id), signal);
  const mangaDexResults = mapToShowcaseItems(rawMangaDex as MangaDexManga[], statistics, language);

  return [...localResults, ...mangaDexResults].slice(0, 24);
}

export default function SearchResultsContent() {
  const searchParams = useSearchParams();
  const { language, isAdult } = useLanguage();
  const query = searchParams.get("q")?.trim() ?? "";

  const [results, setResults] = useState<MangaShowcaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function runSearch() {
      if (!query) {
        setResults([]);
        setError("");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setResults([]);
      setError("");

      try {
        const mangas = await fetchSearchResults(query, language, isAdult, controller.signal);

        if (cancelled) return;

        setResults(mangas);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        if (cancelled) return;
        setResults([]);
        setError(err instanceof Error ? err.message : "Ocurrio un error inesperado.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    runSearch();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isAdult, language, query]);

  return (
    <div className="mx-auto max-w-[1600px] px-8 pb-16 pt-10">
      <header className="mb-8">
        <h1 className="text-xl font-semibold text-white md:text-xl">
          Resultados para: <span className="text-[#ff6b00]">{query || "..."}</span>
        </h1>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="aspect-[2/3] animate-pulse rounded-md bg-white/5"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-gray-300">
          {error}
        </div>
      ) : results.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center text-center">
          <p className="text-lg text-gray-400">No se encontraron mangas para esta busqueda</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
          {results.map((manga, index) => (
            <MangaCard
              key={manga.mangaDexId ? `${manga.mangaDexId}-${index}` : `${manga.mal_id}-${index}`}
              manga={manga}
            />
          ))}
        </div>
      )}
    </div>
  );
}
