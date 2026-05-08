"use client";

import { Loader2, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLanguage } from "./language-provider";
import { getLocalizedTitle } from "../utils/get-localized-title";
import {
  appendStandardMangaDexFilters,
  getAvailableTranslatedLanguageVariants,
  getMangaSynopsis,
  getThemeTags,
  type MangaDexCollectionResponse,
  type MangaDexManga,
} from "../utils/mangadex";

const PRIORITY_THEMES = [
  "Isekai",
  "Spokon",
  "Cyberpunk",
  "Mahou Shoujo",
  "Samurai",
  "Steampunk",
  "Post-Apocalyptic",
] as const;

const UI_COPY = {
  es: {
    placeholder: "Buscar manga",
    empty: "No se encontraron resultados.",
    seeAll: "Ver todos los resultados para",
  },
  en: {
    placeholder: "Search manga",
    empty: "No results found.",
    seeAll: "See all results for",
  },
  pt: {
    placeholder: "Buscar manga",
    empty: "Nenhum resultado encontrado.",
    seeAll: "Ver todos os resultados para",
  },
} as const;

function getPriorityTheme(themes: string[]) {
  const normalizedThemes = themes.map((theme) => ({
    raw: theme,
    normalized: theme.toLowerCase(),
  }));

  for (const priorityTheme of PRIORITY_THEMES) {
    const match = normalizedThemes.find(
      (theme) => theme.normalized === priorityTheme.toLowerCase()
    );

    if (match) {
      return match.raw;
    }
  }

  return null;
}

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

export default function SearchBar() {
  const router = useRouter();
  const { language, isAdult } = useLanguage();
  const copy = UI_COPY[language];
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MangaDexManga[]>([]);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setOpen(true);

      try {
        const params = new URLSearchParams();
        params.set("title", query.trim());
        params.set("limit", "5");
        params.set("order[relevance]", "desc");
        appendStandardMangaDexFilters(params, isAdult, language);

        const response = await fetch(`/api/mangadex/manga?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          setResults([]);
          return;
        }

        const payload = (await response.json()) as MangaDexCollectionResponse;
        const candidates = payload.data ?? [];
        const availability = await Promise.all(
          candidates.map(async (result) => ({
            result,
            hasChapters: await hasReadableChapters(result.id, language),
          }))
        );
        setResults(availability.filter((entry) => entry.hasChapters).map((entry) => entry.result));
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [isAdult, language, query]);

  function getResultImage(result: MangaDexManga) {
    const coverArt = result.relationships?.find((relationship) => relationship.type === "cover_art");
    const fileName = coverArt?.attributes?.fileName;

    if (!fileName) {
      return "";
    }

    return `https://uploads.mangadex.org/covers/${result.id}/${fileName}`;
  }

  function handleSelect(result: MangaDexManga) {
    setOpen(false);
    setQuery(getLocalizedTitle(result, language));
    router.push(`/manga/${result.id}`);
  }

  return (
    <div className="relative w-full">
      <div className="relative flex items-center rounded-full border border-white/10 bg-[#23252b] px-4 py-3 text-gray-300 transition focus-within:border-orange-500">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(Boolean(query.trim() || results.length))}
          placeholder={copy.placeholder}
          className="w-full bg-transparent pr-8 text-sm text-white outline-none placeholder:text-gray-500"
        />

        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
          ) : (
            <Search className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {open ? (
        <div className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-md border border-white/10 bg-[#141519] shadow-2xl">
          {results.map((result) => {
            const imageUrl = getResultImage(result);
            const displayTitle = getLocalizedTitle(result, language);
            const synopsis = getMangaSynopsis(result, language);
            const priorityTheme = getPriorityTheme(getThemeTags(result, language));

            return (
              <button
                key={result.id}
                type="button"
                onClick={() => handleSelect(result)}
                className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-white/5"
              >
                <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-white/5">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={displayTitle}
                      fill
                      sizes="44px"
                      className="object-cover"
                      loading="lazy"
                      unoptimized={true}
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  {priorityTheme ? (
                    <span className="mb-1 inline-flex rounded-sm border border-rose-500/30 bg-black/60 px-2 py-1 text-[9px] font-black uppercase tracking-tighter text-rose-400 backdrop-blur-md">
                      {priorityTheme}
                    </span>
                  ) : null}
                  <p className="line-clamp-2 text-sm font-semibold text-white">{displayTitle}</p>
                  {synopsis ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-400">{synopsis}</p>
                  ) : null}
                </div>
              </button>
            );
          })}

          {!isLoading && results.length === 0 && query.trim() ? (
            <div className="px-3 py-3 text-sm text-gray-500">{copy.empty}</div>
          ) : null}

          <Link
            href={`/search?q=${encodeURIComponent(query)}`}
            className="block w-full border-t border-white/10 p-3 text-center text-sm text-orange-500 transition-colors hover:bg-white/5"
            onClick={() => setOpen(false)}
          >
            {copy.seeAll} &quot;{query}&quot;
          </Link>
        </div>
      ) : null}
    </div>
  );
}
