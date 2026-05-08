"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MangaCard } from "../components/home-carousel";
import { useLanguage } from "../components/language-provider";
import {
  appendStandardMangaDexFilters,
  fetchMangaDexStatistics,
  getAvailableTranslatedLanguageVariants,
  mapToShowcaseItems,
  type MangaDexCollectionResponse,
  type MangaDexManga,
} from "../utils/mangadex";

async function hasReadableChapters(mangaId: string, language: "es" | "en" | "pt") {
  const params = new URLSearchParams();
  params.set("limit", "1");
  params.set("order[readableAt]", "desc");
  getAvailableTranslatedLanguageVariants(language).forEach((translatedLanguage) => {
    params.append("translatedLanguage[]", translatedLanguage);
  });

  const response = await fetch(`/api/mangadex/feed/${mangaId}?${params.toString()}`);

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as { total?: number; data?: unknown[] };
  return (payload.total ?? payload.data?.length ?? 0) > 0;
}

export default function SearchResultsContent() {
  const searchParams = useSearchParams();
  const { language, isAdult } = useLanguage();
  const query = searchParams.get("q")?.trim() ?? "";

  const [results, setResults] = useState<ReturnType<typeof mapToShowcaseItems>>([]);
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
      setError("");

      try {
        const params = new URLSearchParams();
        params.set("title", query);
        params.set("limit", "24");
        params.set("order[relevance]", "desc");
        appendStandardMangaDexFilters(params, isAdult, language);

        const response = await fetch(`/api/mangadex/manga?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("No se pudo completar la busqueda.");
        }

        const payload = (await response.json()) as MangaDexCollectionResponse;
        const candidates = payload.data ?? [];
        const availability = await Promise.all(
          candidates.map(async (manga) => ({
            manga,
            hasChapters: await hasReadableChapters(manga.id, language),
          }))
        );
        const mangas = availability.filter((entry) => entry.hasChapters).map((entry) => entry.manga);

        if (cancelled) return;

        setResults(mapToShowcaseItems(mangas as MangaDexManga[], {}, language));

        const statistics = await fetchMangaDexStatistics(mangas.map((manga) => manga.id));

        if (cancelled) return;

        setResults(mapToShowcaseItems(mangas as MangaDexManga[], statistics, language));
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
        <h1 className="text-3xl font-bold text-white md:text-5xl">
          Resultados para: <span className="text-orange-500">{query || "..."}</span>
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
