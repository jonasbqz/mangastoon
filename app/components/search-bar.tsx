"use client";

import { Loader2, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MangaShowcaseItem } from "./home-carousel";
import { useLanguage } from "./language-provider";
import { getLocalizedTitle, getLocalizedTitleAsync } from "../utils/get-localized-title";
import { forceTranslate, sanitizeText } from "../utils/translation";
import {
  appendStandardMangaDexFilters,
  fetchMangaDexStatistics,
  isAdultShowcaseItem,
  mapToShowcaseItems,
  type MangaDexCollectionResponse,
  type MangaDexManga,
} from "../utils/mangadex";
import { buildComicPath, slugify } from "../utils/slugify";

const MONLINE_API_URL = "/api/monline";
const MONLINE_SEARCH_LOOKUP_LIMIT = 2000;

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

type MonlineComic = Record<string, unknown>;
type MonlineComicsResponse = {
  data?: MonlineComic[] | { comics?: MonlineComic[]; items?: MonlineComic[]; results?: MonlineComic[] };
  comics?: MonlineComic[];
  items?: MonlineComic[];
  results?: MonlineComic[];
};
type MangaVfComic = { title?: string; slug?: string; url?: string; cover?: string; genres?: string[] };
type MangaVfSearchResponse = { results?: MangaVfComic[] };

type MonlineShowcaseItem = MangaShowcaseItem & { synopsis?: string };

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
    ...(title ? { es: title } : {}),
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

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function localComicMatchesQuery(comic: MonlineComic, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  return ["title", "name", "comic_title", "original_title", "titleAlternative", "slug"]
    .map((key) => comic[key])
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .some((value) => normalizeSearchText(String(value)).includes(normalizedQuery));
}

function normalizeMonlineImageUrl(value: string) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return `/api/proxy-image?url=${encodeURIComponent(value)}`;
  }
  if (value.startsWith("//")) {
    return `/api/proxy-image?url=${encodeURIComponent(`https:${value}`)}`;
  }
  if (MONLINE_API_URL.startsWith("/")) {
    return `${MONLINE_API_URL}/${value.replace(/^\/+/, "")}`;
  }

  const imageUrl = `${MONLINE_API_URL}/${value.replace(/^\/+/, "")}`;
  return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
}

function mapMangaVfComicsToShowcase(comics: MangaVfComic[], language: "es" | "en" | "pt") {
  return comics
    .filter((comic) => comic.title?.trim())
    .map((comic, index): MonlineShowcaseItem => {
      const title = comic.title?.trim() || "MangaStoon";
      const slug = (comic.slug?.trim() || slugify(title)).replace(/^manga[-_]?vf[-_]?/i, "");
      const coverImage = normalizeMonlineImageUrl(comic.cover?.trim() || "");
      const genres = Array.isArray(comic.genres) ? comic.genres.filter(Boolean).slice(0, 4) : [];

      return {
        mal_id: 50_000 + index,
        title,
        score: null,
        url: buildComicPath(title, slug),
        mangaDexId: slug,
        titleMap: { [language]: title, es: title },
        genres: genres.map((genre, genreIndex) => ({ mal_id: genreIndex + 1, name: genre })),
        tags: genres,
        isLocal: true,
        source: "leercapitulo",
        images: {
          webp: { large_image_url: coverImage, image_url: coverImage },
          jpg: { large_image_url: coverImage, image_url: coverImage },
        },
      };
    });
}

async function fetchMangaVfSearch(query: string, language: "es" | "en" | "pt", signal?: AbortSignal) {
  if (language !== "es") return [];

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
    if (!response.ok) return [];
    const payload = (await response.json()) as MangaVfSearchResponse;
    return mapMangaVfComicsToShowcase(payload.results ?? [], language);
  } catch {
    return [];
  }
}

function mapMonlineComicsToShowcase(comics: MonlineComic[], language: "es" | "en" | "pt") {
  return comics.map((comic, index): MonlineShowcaseItem => {
    const titleMap = getMonlineTitleMap(comic);
    const rawTitle = getStringValue(comic, ["title", "name", "comic_title", "original_title"]);
    const title = getLocalizedTitle({ titleMap, title: rawTitle }, language) || "MangaStoon";
    const slug = getStringValue(comic, ["slug", "manga_slug", "comic_slug", "id"]);
    const coverImage = normalizeMonlineImageUrl(
      getStringValue(comic, ["coverImage", "cover_image", "cover", "thumbnail", "image", "poster", "url_cover"])
    );
    const genres = getGenres(comic);

    return {
      mal_id: index + 1,
      title,
      score: null,
      url: slug ? buildComicPath(title, slug) : "#",
      mangaDexId: slug || null,
      titleMap,
      genres: genres.map((genre, genreIndex) => ({ mal_id: genreIndex + 1, name: genre })),
      tags: genres,
      isLocal: true,
      source: "local",
      synopsis: getStringValue(comic, ["synopsis", "description", "summary"]),
      images: {
        webp: { large_image_url: coverImage, image_url: coverImage },
        jpg: { large_image_url: coverImage, image_url: coverImage },
      },
    };
  });
}

async function fetchMonlineSearch(query: string, language: "es" | "en" | "pt", isAdult: boolean, signal?: AbortSignal) {
  let localResults: MonlineShowcaseItem[] = [];

  if (language === "es") {
    const params = new URLSearchParams();
    params.set("limit", String(MONLINE_SEARCH_LOOKUP_LIMIT));

    try {
      const response = await fetch(`${MONLINE_API_URL}/api/comics?${params.toString()}`, {
        cache: "no-store",
        signal,
      });

      if (response.ok) {
        const payload = (await response.json()) as MonlineComicsResponse;
        localResults = mapMonlineComicsToShowcase(
          extractMonlineComics(payload).filter((comic) => localComicMatchesQuery(comic, query)).slice(0, 5),
          language
        );
      }
    } catch {}
  }

  const mangaVfResultsPromise = language === "es" ? fetchMangaVfSearch(query, language, signal) : Promise.resolve([]);
  const remaining = Math.max(0, 5 - localResults.length);

  let results: (MangaShowcaseItem & { synopsis?: string | null })[] = [];

  if (remaining > 0) {
    const mangaDexParams = new URLSearchParams();
    mangaDexParams.set("title", query);
    mangaDexParams.set("limit", String(remaining));
    mangaDexParams.set("order[relevance]", "desc");
    appendStandardMangaDexFilters(mangaDexParams, isAdult, language);

    try {
      const mangaDexResponse = await fetch(`/api/mangadex/manga?${mangaDexParams.toString()}`, { signal });
      const mangaDexPayload = mangaDexResponse.ok
        ? ((await mangaDexResponse.json()) as MangaDexCollectionResponse)
        : { data: [] };
      const rawMangaDex = mangaDexPayload.data ?? [];
      const statistics = await fetchMangaDexStatistics(rawMangaDex.map((manga) => manga.id), signal);
      const mangaDexResults = mapToShowcaseItems(rawMangaDex as MangaDexManga[], statistics, language);
      const mangaVfResults = await mangaVfResultsPromise;
      results = [...localResults, ...mangaDexResults, ...mangaVfResults];
    } catch {
      const mangaVfResults = await mangaVfResultsPromise;
      results = [...localResults, ...mangaVfResults];
    }
  } else {
    results = localResults;
  }

  const seen = new Set<string>();
  const filteredResults = results
    .filter((manga) => {
      const key = (manga.mangaDexId ?? manga.url ?? manga.title).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter((manga) => isAdult || !isAdultShowcaseItem(manga))
    .slice(0, 5);

  return Promise.all(
    filteredResults.map(async (manga) => {
      const translatedTitle = await getLocalizedTitleAsync(
        {
          titleMap: manga.titleMap,
          altTitles: manga.altTitles,
          title: manga.title,
        },
        language
      );

      const cleanSynopsis = manga.synopsis ? sanitizeText(manga.synopsis) : "";
      const translatedSynopsis = cleanSynopsis ? await forceTranslate(cleanSynopsis, language) : "";

      return {
        ...manga,
        title: translatedTitle,
        titleMap: {
          ...manga.titleMap,
          [language]: translatedTitle,
        },
        synopsis: translatedSynopsis || null,
      };
    })
  );
}

function getResultImage(result: MangaShowcaseItem) {
  return (
    result.images?.webp?.large_image_url ??
    result.images?.jpg?.large_image_url ??
    result.images?.webp?.image_url ??
    result.images?.jpg?.image_url ??
    ""
  );
}

export default function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { language, isAdult } = useLanguage();
  const copy = UI_COPY[language];
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [results, setResults] = useState<MangaShowcaseItem[]>([]);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (pathname !== "/explore") {
      return;
    }

    setOpen(false);
    setResults([]);
    setIsLoading(false);

    const urlQuery = searchParams.get("q") ?? "";
    if (urlQuery !== query) {
      setQuery(urlQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  useEffect(() => {
    if (pathname !== "/explore") {
      return;
    }

    const trimmedQuery = query.trim();
    const currentUrlQuery = searchParams.get("q") ?? "";

    if (trimmedQuery === currentUrlQuery) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (trimmedQuery) {
        params.set("q", trimmedQuery);
      } else {
        params.delete("q");
      }

      params.delete("page");
      const queryString = params.toString();
      if (queryString === searchParams.toString()) {
        return;
      }

      router.replace(queryString ? `/explore?${queryString}` : "/explore", { scroll: false });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [pathname, query, router, searchParams]);

  useEffect(() => {
    if (pathname === "/explore") {
      setResults([]);
      setOpen(false);
      setIsLoading(false);
      return;
    }

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
        const nextResults = await fetchMonlineSearch(query.trim(), language, isAdult, controller.signal);
        if (controller.signal.aborted) return;
        setResults(nextResults);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [isAdult, language, pathname, query]);

  function handleSelect(result: MangaShowcaseItem) {
    setOpen(false);
    setQuery(getLocalizedTitle(result, language));
    router.push(result.url || (result.mangaDexId ? buildComicPath(result.title, result.mangaDexId) : "/explore"));
  }

  function handleExploreSearch() {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return;
    }

    setOpen(false);
    router.push(`/explore?q=${encodeURIComponent(trimmedQuery)}`);
  }

  return (
    <div className="relative w-full">
      <div className="relative flex items-center rounded-full border border-white/10 bg-[#23252b] px-4 py-3 text-gray-300 transition focus-within:border-orange-500">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleExploreSearch();
            }
          }}
          onFocus={() => {
            if (pathname !== "/explore") {
              setOpen(Boolean(query.trim() || results.length));
            }
          }}
          onBlur={() => {
            if (pathname === "/explore") {
              setOpen(false);
            }
          }}
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
        <div className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-[rgba(247,242,232,0.08)] bg-[#131110]/95 backdrop-blur-xl shadow-2xl shadow-black/80">
          {results.map((result) => {
            const imageUrl = getResultImage(result);
            const displayTitle = getLocalizedTitle(result, language);
            const synopsis = (result as { synopsis?: string | null }).synopsis;
            const priorityTheme = getPriorityTheme(result.tags ?? []);

            return (
              <button
                key={result.url || result.mangaDexId || result.title}
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
                    <span className="mb-1 inline-flex rounded-sm border border-rose-500/30 bg-black/60 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter text-rose-400 backdrop-blur-md">
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
            href={`/explore?q=${encodeURIComponent(query.trim())}`}
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
