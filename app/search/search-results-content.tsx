"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MangaCard, type MangaShowcaseItem } from "../components/home-carousel";
import { useLanguage } from "../components/language-provider";
import { getLocalizedTitle, getLocalizedTitleAsync } from "../utils/get-localized-title";
import {
  appendStandardMangaDexFilters,
  fetchMangaDexStatistics,
  isAdultShowcaseItem,
  mapToShowcaseItems,
  type MangaDexCollectionResponse,
  type MangaDexManga,
  deduplicateShowcaseItems,
} from "../utils/mangadex";
import { buildComicPath, slugify } from "../utils/slugify";

const MONLINE_API_URL = "/api/monline";
const MONLINE_SEARCH_LOOKUP_LIMIT = 2000;

type MonlineComic = Record<string, unknown>;
type MonlineComicsResponse = {
  data?: MonlineComic[] | { comics?: MonlineComic[]; items?: MonlineComic[]; results?: MonlineComic[] };
  comics?: MonlineComic[];
  items?: MonlineComic[];
  results?: MonlineComic[];
};
type MangaVfComic = { title?: string; slug?: string; url?: string; cover?: string; genres?: string[] };
type MangaVfSearchResponse = { results?: MangaVfComic[] };

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

function levenshteinDistance(a: string, b: string): number {
  const tmp = [];
  let i, j;
  for (i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1, // deletion
        tmp[i][j - 1] + 1, // insertion
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      );
    }
  }
  return tmp[a.length][b.length];
}

function fuzzySearch(target: string, query: string): boolean {
  const normTarget = normalizeSearchText(target);
  const normQuery = normalizeSearchText(query);
  
  if (!normQuery) return true;
  
  // Direct match or reverse direct match
  if (normTarget.includes(normQuery) || normQuery.includes(normTarget)) {
    return true;
  }
  
  // Word-based matching (handles order differences like "piece one" vs "one piece")
  const queryWords = normQuery.split(/\s+/).filter(Boolean);
  const targetWords = normTarget.split(/\s+/).filter(Boolean);
  
  const allWordsMatched = queryWords.every(qw => 
    targetWords.some(tw => tw.includes(qw) || qw.includes(tw))
  );
  if (allWordsMatched && queryWords.length > 0) {
    return true;
  }

  // Levenshtein distance for typo tolerance (handles spelling mistakes)
  if (normQuery.length >= 4 && normTarget.length >= 4) {
    for (const tw of targetWords) {
      if (Math.abs(tw.length - normQuery.length) <= 2) {
        if (levenshteinDistance(tw, normQuery) <= 1) return true;
      }
    }
  }

  return false;
}

function localComicMatchesQuery(comic: MonlineComic, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  return ["title", "name", "comic_title", "original_title", "titleAlternative", "slug"]
    .map((key) => comic[key])
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .some((value) => fuzzySearch(String(value), query));
}

const POPULAR_MANGAS_KEYWORDS = [
  { keywords: ["naruto", "shippuden", "boruto"], name: "Naruto / Boruto" },
  { keywords: ["one piece", "onepiece", "luffy"], name: "One Piece" },
  { keywords: ["dragon ball", "dragonball", "goku", "dbz"], name: "Dragon Ball" },
  { keywords: ["demon slayer", "kimetsu", "yaiba", "tanjiro"], name: "Demon Slayer (Kimetsu no Yaiba)" },
  { keywords: ["chainsaw man", "chainsawman", "denji"], name: "Chainsaw Man" },
  { keywords: ["jujutsu", "kaisen", "gojo"], name: "Jujutsu Kaisen" },
  { keywords: ["attack on titan", "shingeki", "kyojin", "eren"], name: "Attack on Titan (Shingeki no Kyojin)" },
  { keywords: ["solo leveling", "sololeveling", "sung jin"], name: "Solo Leveling" },
  { keywords: ["my hero academia", "boku no hero", "deku"], name: "My Hero Academia" },
  { keywords: ["bleach", "ichigo"], name: "Bleach" },
  { keywords: ["death note", "deathnote", "kira", "l"], name: "Death Note" },
  { keywords: ["one punch man", "onepunchman", "saitama"], name: "One Punch Man" },
  { keywords: ["tokyo ghoul", "kaneki"], name: "Tokyo Ghoul" },
  { keywords: ["fairy tail", "natsu"], name: "Fairy Tail" },
  { keywords: ["hunter x hunter", "gon", "killua"], name: "Hunter x Hunter" },
];

function checkPopularMangaMatch(query: string): string | null {
  const normQuery = normalizeSearchText(query);
  if (!normQuery) return null;
  for (const entry of POPULAR_MANGAS_KEYWORDS) {
    if (entry.keywords.some(kw => normQuery.includes(kw) || kw.includes(normQuery))) {
      return entry.name;
    }
  }
  return null;
}

const SEARCH_COPY = {
  es: {
    noResults: "No se encontraron mangas para esta búsqueda.",
    notAvailablePopular: (name: string) => `El manga <strong>${name}</strong> no está disponible actualmente en LectorFenix.`,
    notAvailableGeneral: "No encontramos resultados para tu búsqueda. Te sugerimos revisar la ortografía o probar con otros términos.",
    tryPopularInstead: "Mientras tanto, te recomendamos leer alguno de nuestros títulos más populares:",
  },
  en: {
    noResults: "No mangas found for this search.",
    notAvailablePopular: (name: string) => `The manga <strong>${name}</strong> is not currently available on LectorFenix.`,
    notAvailableGeneral: "We couldn't find any results for your search. We suggest checking the spelling or trying other terms.",
    tryPopularInstead: "In the meantime, you might like to read some of our most popular titles:",
  },
  pt: {
    noResults: "Nenhum mangá encontrado para esta busca.",
    notAvailablePopular: (name: string) => `O mangá <strong>${name}</strong> não está disponível no momento no LectorFenix.`,
    notAvailableGeneral: "Não encontramos resultados para sua busca. Sugerimos verificar a grafia ou tentar outros termos.",
    tryPopularInstead: "Enquanto isso, recomendamos ler alguns de nossos títulos mais populares:",
  }
};

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
    .map((comic, index): MangaShowcaseItem => {
      const title = comic.title?.trim() || "LectorFenix";
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
  return comics.map((comic, index): MangaShowcaseItem => {
    const titleMap = getMonlineTitleMap(comic);
    const rawTitle = getStringValue(comic, ["title", "name", "comic_title", "original_title"]);
    const title = getLocalizedTitle({ titleMap, title: rawTitle }, language) || "LectorFenix";
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
    params.set("limit", String(MONLINE_SEARCH_LOOKUP_LIMIT));

    const response = await fetch(`${MONLINE_API_URL}/api/comics?${params.toString()}`, {
      cache: "no-store",
      signal,
    });

    if (response.ok) {
      const payload = (await response.json()) as MonlineComicsResponse;
      localResults = mapMonlineComicsToShowcase(
        extractMonlineComics(payload).filter((comic) => localComicMatchesQuery(comic, query)).slice(0, 24),
        language
      );
    }
  }

  const mangaVfResultsPromise = language === "es" ? fetchMangaVfSearch(query, language, signal) : Promise.resolve([]);
  const remaining = Math.max(1, 24 - Math.min(localResults.length, 24));
  const mangaDexParams = new URLSearchParams();
  mangaDexParams.set("title", query);
  mangaDexParams.set("limit", String(remaining));
  mangaDexParams.set("order[relevance]", "desc");
  appendStandardMangaDexFilters(mangaDexParams, isAdult, language);

  let mangaDexResults: MangaShowcaseItem[] = [];
  try {
    const fetchPromise = fetch(`/api/mangadex/manga?${mangaDexParams.toString()}`, { signal });
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Timeout")), 1500)
    );

    const mangaDexResponse = await Promise.race([fetchPromise, timeoutPromise]) as Response;

    if (mangaDexResponse.ok) {
      const mangaDexPayload = (await mangaDexResponse.json()) as MangaDexCollectionResponse;
      const rawMangaDex = mangaDexPayload.data ?? [];
      const statsPromise = fetchMangaDexStatistics(rawMangaDex.map((manga) => manga.id), signal);
      const statistics = await Promise.race([
        statsPromise,
        new Promise<Record<string, any>>((res) => setTimeout(() => res({}), 1000))
      ]) as Record<string, any>;

      mangaDexResults = mapToShowcaseItems(rawMangaDex as MangaDexManga[], statistics, language);
    }
  } catch (err) {
    console.warn("MangaDex search failed or timed out:", err);
  }

  const mangaVfResults = await mangaVfResultsPromise;

  const combined = [...localResults, ...mangaDexResults, ...mangaVfResults];
  const deduplicated = deduplicateShowcaseItems(combined)
    .filter((manga) => isAdult || !isAdultShowcaseItem(manga))
    .slice(0, 24);

  return Promise.all(
    deduplicated.map(async (manga) => {
      const translatedTitle = await getLocalizedTitleAsync(
        {
          id: manga.mangaDexId || undefined,
          isLocal: manga.isLocal,
          titleMap: manga.titleMap,
          altTitles: manga.altTitles,
          title: manga.title,
        } as any,
        language
      );
      return {
        ...manga,
        title: translatedTitle,
        titleMap: {
          ...manga.titleMap,
          [language]: translatedTitle,
        },
        url: manga.mangaDexId ? buildComicPath(translatedTitle, manga.mangaDexId) : manga.url,
      };
    })
  );
}

export default function SearchResultsContent() {
  const searchParams = useSearchParams();
  const { language, isAdult } = useLanguage();
  const query = searchParams.get("q")?.trim() ?? "";

  const [results, setResults] = useState<MangaShowcaseItem[]>([]);
  const [recommendations, setRecommendations] = useState<MangaShowcaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function runSearch() {
      if (!query) {
        setResults([]);
        setRecommendations([]);
        setError("");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setResults([]);
      setRecommendations([]);
      setError("");

      try {
        const mangas = await fetchSearchResults(query, language, isAdult, controller.signal);

        if (cancelled) return;

        setResults(mangas);

        // If no search results found, fetch popular local comics as recommendations
        if (mangas.length === 0) {
          // Log failed search to the database
          fetch("/api/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query }),
          }).catch((err) => console.error("Error logging failed search:", err));

          try {
            const recsRes = await fetch(`${MONLINE_API_URL}/api/comics?limit=6&order=views`, {
              signal: controller.signal,
            });
            if (recsRes.ok) {
              const recsPayload = (await recsRes.json()) as MonlineComicsResponse;
              const recs = mapMonlineComicsToShowcase(
                extractMonlineComics(recsPayload),
                language
              ).filter((manga) => isAdult || !isAdultShowcaseItem(manga));
              if (!cancelled) {
                setRecommendations(recs);
              }
            }
          } catch (e) {
            console.error("Error fetching search recommendations:", e);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        if (cancelled) return;
        setResults([]);
        setRecommendations([]);
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
        <div className="space-y-10">
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 px-6 py-6 text-center shadow-lg shadow-black/25">
            {(() => {
              const matchedName = checkPopularMangaMatch(query);
              const langCopy = SEARCH_COPY[language] || SEARCH_COPY.es;
              if (matchedName) {
                return (
                  <p 
                    className="text-base text-gray-200" 
                    dangerouslySetInnerHTML={{ __html: langCopy.notAvailablePopular(matchedName) }}
                  />
                );
              }
              return <p className="text-base text-gray-300">{langCopy.notAvailableGeneral}</p>;
            })()}
            <p className="mt-2.5 text-sm text-[#ff6b00]">
              {(SEARCH_COPY[language] || SEARCH_COPY.es).tryPopularInstead}
            </p>
          </div>

          {recommendations.length > 0 && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6 animate-soft-enter">
              {recommendations.map((manga, index) => (
                <MangaCard
                  key={`rec-${manga.mangaDexId ? `${manga.mangaDexId}-${index}` : `${manga.mal_id}-${index}`}`}
                  manga={manga}
                />
              ))}
            </div>
          )}
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
