"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Search, SlidersHorizontal } from "lucide-react";
import { MangaCard } from "../components/home-carousel";
import type { MangaShowcaseItem } from "../components/home-carousel";
import SiteHeader from "../components/site-header";
import { useLanguage, type SupportedLanguage } from "../components/language-provider";
import {
  appendStandardMangaDexFilters,
  extractLocalApiComics,
  fetchLocalChapterPreviews,
  fetchMangaDexStatistics,
  getLocalApiTotal,
  mapLocalApiComicsToShowcaseItems,
  mapToShowcaseItems,
  type LocalApiComicsResponse,
  type MangaDexCollectionResponse,
  type MangaDexManga,
} from "../utils/mangadex";
import { translateTagName } from "../utils/tagTranslations";

const MONLINE_API_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8085"
).replace(/\/$/, "");

const TYPE_FILTERS = [
  { value: "all", label: { es: "Todo", en: "All", pt: "Todos" } },
  { value: "ja", label: { es: "Manga", en: "Manga", pt: "Manga" } },
  { value: "ko", label: { es: "Manhwa", en: "Manhwa", pt: "Manhwa" } },
  { value: "zh", label: { es: "Manhua", en: "Manhua", pt: "Manhua" } },
] as const;

const GENRE_TAGS = [
  { id: "391b0423-d847-456f-aff0-8b0cfc03066b", label: { es: "Accion", en: "Action", pt: "Acao" } },
  { id: "87cc87cd-a395-47af-b27a-93258283bbc6", label: { es: "Aventura", en: "Adventure", pt: "Aventura" } },
  { id: "5920b825-4181-4a17-beeb-9918b0ff7a30", label: { es: "Boys' Love", en: "Boys' Love", pt: "Boys' Love" } },
  { id: "4d32cc48-9f00-4cca-9b5a-a839f0764984", label: { es: "Comedia", en: "Comedy", pt: "Comedia" } },
  { id: "5ca48985-9a9d-4bd8-be29-80dc0303db72", label: { es: "Crimen", en: "Crime", pt: "Crime" } },
  { id: "b9af3a63-f058-46de-a9a0-e0c13906197a", label: { es: "Drama", en: "Drama", pt: "Drama" } },
  { id: "cdc58593-87dd-415e-bbc0-2ec27bf404cc", label: { es: "Fantasia", en: "Fantasy", pt: "Fantasia" } },
  { id: "a3c67850-4684-404e-9b7f-c69850ee5da6", label: { es: "Girls' Love", en: "Girls' Love", pt: "Girls' Love" } },
  { id: "33771934-028e-4cb3-8744-691e866a923e", label: { es: "Historico", en: "Historical", pt: "Historico" } },
  { id: "cdad7e68-1419-41dd-bdce-27753074a640", label: { es: "Horror", en: "Horror", pt: "Horror" } },
  { id: "ace04997-f6bd-436e-b261-779182193d3d", label: { es: "Isekai", en: "Isekai", pt: "Isekai" } },
  { id: "81c836c9-914a-4eca-981a-560dad663e73", label: { es: "Mahou Shoujo", en: "Magical Girls", pt: "Mahou Shoujo" } },
  { id: "50880a9d-5440-4732-9afb-8f457127e836", label: { es: "Mecha", en: "Mecha", pt: "Mecha" } },
  { id: "c8cbe35b-1b2b-4a3f-9c37-db84c4514856", label: { es: "Medico", en: "Medical", pt: "Medico" } },
  { id: "ee968100-4191-4968-93d3-f82d72be7e46", label: { es: "Misterio", en: "Mystery", pt: "Misterio" } },
  { id: "b1e97889-25b4-4258-b28b-cd7f4d28ea9b", label: { es: "Filosofico", en: "Philosophical", pt: "Filosofico" } },
  { id: "3b60b75c-a2d7-4860-ab56-05f391bb889c", label: { es: "Psicologico", en: "Psychological", pt: "Psicologico" } },
  { id: "423e2eae-a7a2-4a8b-ac03-a8351462d71d", label: { es: "Romance", en: "Romance", pt: "Romance" } },
  { id: "256c8bd9-4904-4360-bf4f-508a76d67183", label: { es: "Sci-Fi", en: "Sci-Fi", pt: "Sci-Fi" } },
  { id: "e5301a23-ebd9-49dd-a0cb-2add944c7fe9", label: { es: "Slice of Life", en: "Slice of Life", pt: "Slice of Life" } },
  { id: "69964a64-2f90-4d33-beeb-f3ed2875eb4c", label: { es: "Deportes", en: "Sports", pt: "Esportes" } },
  { id: "7064a261-a137-4d3a-8848-2d385de3a99c", label: { es: "Superheroes", en: "Superhero", pt: "Super-heroi" } },
  { id: "07251805-a27e-4d59-b488-f0bfbec15168", label: { es: "Thriller", en: "Thriller", pt: "Thriller" } },
  { id: "f8f62932-27da-4fe4-8ee1-6779a8c5edba", label: { es: "Tragedia", en: "Tragedy", pt: "Tragedia" } },
  { id: "acc803a4-c95a-4c22-86fc-eb6b582d82a2", label: { es: "Wuxia", en: "Wuxia", pt: "Wuxia" } },
] as const;

const SPECIAL_TAGS = [
  { id: "0a39b5a1-b235-4886-a747-1d05d216532d", label: { es: "Premiado", en: "Award Winning", pt: "Premiado" } },
  { id: "f5ba408b-0e7a-484d-8d49-4e9125ac96de", label: { es: "Full Color", en: "Full Color", pt: "Full Color" } },
  { id: "3e2b8dae-350e-4ab8-a8ce-016e844b9f0d", label: { es: "Long Strip", en: "Long Strip", pt: "Long Strip" } },
  { id: "e197df38-d0e7-43b5-9b09-2842d0c326dd", label: { es: "Web Comic", en: "Web Comic", pt: "Web Comic" } },
  { id: "51d83883-4103-437c-b4b1-731cb73d786c", label: { es: "Historia única", en: "Oneshot", pt: "História única" } },
  { id: "39730448-9a5f-48a2-85b0-a70db87b1233", label: { es: "Demonios", en: "Demons", pt: "Demonios" } },
  { id: "a1f53773-c69a-4ce5-8cab-fffcd90b1565", label: { es: "Magia", en: "Magic", pt: "Magia" } },
  { id: "0bc90acb-ccc1-44ca-a34a-b9f3a73259d0", label: { es: "Reencarnacion", en: "Reincarnation", pt: "Reencarnacao" } },
  { id: "caaa44eb-cd40-4177-b930-79d3ef2afe87", label: { es: "Vida escolar", en: "School Life", pt: "Vida escolar" } },
  { id: "9467335a-1b83-4497-9231-765337a00b96", label: { es: "Post-apocaliptico", en: "Post-Apocalyptic", pt: "Pos-apocaliptico" } },
  { id: "81183756-1453-4c81-aa9e-f6e1b63be016", label: { es: "Samurai", en: "Samurai", pt: "Samurai" } },
  { id: "799c202e-7daa-44eb-9cf7-8a3c0441531e", label: { es: "Artes marciales", en: "Martial Arts", pt: "Artes marciais" } },
  { id: "eabc5b4c-6aff-42f3-b657-3e90cbd00b75", label: { es: "Sobrenatural", en: "Supernatural", pt: "Sobrenatural" } },
  { id: "292e862b-2d17-4062-90a2-0356caa4ae27", label: { es: "Viajes temporales", en: "Time Travel", pt: "Viagem no tempo" } },
  { id: "d14322ac-4d6f-4e9b-afd9-629d5f4d8a41", label: { es: "Villana", en: "Villainess", pt: "Vila" } },
  { id: "9438db5a-7e2a-4ac0-b39e-e0d95a34b8a8", label: { es: "Videojuegos", en: "Video Games", pt: "Video games" } },
  { id: "631ef465-9aba-4afb-b0fc-ea10efe274a8", label: { es: "Zombies", en: "Zombies", pt: "Zumbis" } },
  { id: "b29d6a3d-1569-4e7a-8caf-7557bc92cd5d", label: { es: "Gore", en: "Gore", pt: "Gore" } },
  { id: "97893a4c-12af-4dac-b6be-0dffb353568e", label: { es: "Violencia sexual", en: "Sexual Violence", pt: "Violencia sexual" } },
] as const;

const ORDER_OPTIONS = [
  { value: "followedCount", label: { es: "Popularidad", en: "Popularity", pt: "Popularidade" } },
  { value: "rating", label: { es: "Puntuacion", en: "Score", pt: "Pontuacao" } },
  {
    value: "latestUploadedChapter",
    label: { es: "Mas recientes", en: "Newest", pt: "Mais recentes" },
  },
  { value: "title", label: { es: "Titulo", en: "Title", pt: "Titulo" } },
] as const;

const DEFAULT_ORDER_BY = "latestUploadedChapter";
const DEFAULT_SORT_DIR = "desc";
const DEFAULT_TYPE = "all";

type OrderByValue = (typeof ORDER_OPTIONS)[number]["value"];
type SortDirValue = "asc" | "desc";
type TypeFilterValue = (typeof TYPE_FILTERS)[number]["value"];
type MonlineComicsResponse = LocalApiComicsResponse;

function isOrderByValue(value: string | null): value is OrderByValue {
  return ORDER_OPTIONS.some((option) => option.value === value);
}

function isSortDirValue(value: string | null): value is SortDirValue {
  return value === "asc" || value === "desc";
}

function isTypeFilterValue(value: string | null): value is TypeFilterValue {
  return TYPE_FILTERS.some((option) => option.value === value);
}

function parsePageParam(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function localComicMatchesQuery(comic: Record<string, unknown>, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const candidates = ["title", "name", "comic_title", "original_title", "titleAlternative", "slug"]
    .map((key) => comic[key])
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .map((value) => normalizeSearchText(String(value)));

  return candidates.some((candidate) => candidate.includes(normalizedQuery));
}

const UI_COPY: Record<
  SupportedLanguage,
  {
    title: string;
    subtitle: string;
    filters: string;
    searchTitle: string;
    searchPlaceholder: string;
    orderBy: string;
    direction: string;
    genreTitle: string;
    specialTagTitle: string;
    typeTitle: string;
    searchButton: string;
    showing: string;
    of: string;
    titles: string;
    noResults: string;
    ascending: string;
    descending: string;
    clearFilters: string;
    selectedGenres: string;
    rateLimit: string;
    genericError: string;
  }
> = {
  es: {
    title: "Explorar mangas",
    subtitle: "Descubre series seguras, filtra por tipo y encuentra algo nuevo para leer.",
    filters: "Filtros",
    searchTitle: "Buscar titulo",
    searchPlaceholder: "Ej: Solo Leveling",
    orderBy: "Ordenar por",
    direction: "Direccion",
    genreTitle: "Generos",
    specialTagTitle: "Tags especiales",
    typeTitle: "Tipo de comic",
    searchButton: "Buscar",
    showing: "Mostrando",
    of: "de",
    titles: "titulos",
    noResults: "No se encontraron mangas con estos filtros",
    ascending: "Ascendente",
    descending: "Descendente",
    clearFilters: "Limpiar",
    selectedGenres: "Selecciona hasta 3 tematicas.",
    rateLimit: "La API de mangas esta recibiendo demasiadas solicitudes. Intenta de nuevo en unos segundos.",
    genericError: "No se pudo cargar la exploracion de mangas.",
  },
  en: {
    title: "Explore manga",
    subtitle: "Discover safe series, filter by comic type, and find something new to read.",
    filters: "Filters",
    searchTitle: "Search title",
    searchPlaceholder: "Ex: Solo Leveling",
    orderBy: "Order by",
    direction: "Direction",
    genreTitle: "Genres",
    specialTagTitle: "Special tags",
    typeTitle: "Comic type",
    searchButton: "Search",
    showing: "Showing",
    of: "of",
    titles: "titles",
    noResults: "No manga matched these filters",
    ascending: "Ascending",
    descending: "Descending",
    clearFilters: "Clear",
    selectedGenres: "Select up to 3 themes.",
    rateLimit: "The manga API is receiving too many requests. Please try again in a few seconds.",
    genericError: "We could not load the manga catalog.",
  },
  pt: {
    title: "Explorar mangas",
    subtitle: "Descubra series seguras, filtre por tipo e encontre algo novo para ler.",
    filters: "Filtros",
    searchTitle: "Buscar titulo",
    searchPlaceholder: "Ex: Solo Leveling",
    orderBy: "Ordenar por",
    direction: "Direcao",
    genreTitle: "Generos",
    specialTagTitle: "Tags especiais",
    typeTitle: "Tipo de comic",
    searchButton: "Buscar",
    showing: "Mostrando",
    of: "de",
    titles: "titulos",
    noResults: "Nenhum manga encontrado com esses filtros",
    ascending: "Ascendente",
    descending: "Descendente",
    clearFilters: "Limpar",
    selectedGenres: "Selecione ate 3 tematicas.",
    rateLimit: "A API de mangas esta recebendo muitas solicitacoes. Tente novamente em alguns segundos.",
    genericError: "Nao foi possivel carregar o catalogo de mangas.",
  },
};

function getTranslatedFilterLabel(
  label: Record<SupportedLanguage, string>,
  language: SupportedLanguage
) {
  return translateTagName(label.en, language);
}

function getSpecialTagGroups(language: SupportedLanguage) {
  const groups = new Map<string, { label: string; ids: string[] }>();

  SPECIAL_TAGS.forEach((tag) => {
    const label = getTranslatedFilterLabel(tag.label, language);
    const current = groups.get(label);

    if (current) {
      current.ids.push(tag.id);
      return;
    }

    groups.set(label, { label, ids: [tag.id] });
  });

  return Array.from(groups.values());
}

export default function ExplorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, isAdult } = useLanguage();
  const copy = UI_COPY[language];
  const previousFilterKeyRef = useRef<string | null>(null);
  const initializedFromUrlRef = useRef(false);
  const isApplyingUrlStateRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [orderBy, setOrderBy] = useState<OrderByValue>(DEFAULT_ORDER_BY);
  const [sortDir, setSortDir] = useState<SortDirValue>(DEFAULT_SORT_DIR);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedSpecialTags, setSelectedSpecialTags] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<TypeFilterValue>(DEFAULT_TYPE);
  const [currentPage, setCurrentPage] = useState(1);
  const [mangas, setMangas] = useState<MangaShowcaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [lastVisiblePage, setLastVisiblePage] = useState(1);
  const [error, setError] = useState("");
  const [urlHydrated, setUrlHydrated] = useState(false);

  useEffect(() => {
    isApplyingUrlStateRef.current = true;
    const urlTagIds = searchParams.getAll("includedTags");
    const genreIds = GENRE_TAGS.map((genre) => genre.id as string);
    const specialIds = SPECIAL_TAGS.map((tag) => tag.id as string);
    const nextOrderBy = searchParams.get("order_by");
    const nextSortDir = searchParams.get("sort");
    const nextType = searchParams.get("type");

    const nextQuery = searchParams.get("q") ?? "";
    setSearchQuery(nextQuery);
    setSearchDraft(nextQuery);
    setOrderBy(isOrderByValue(nextOrderBy) ? nextOrderBy : DEFAULT_ORDER_BY);
    setSortDir(isSortDirValue(nextSortDir) ? nextSortDir : DEFAULT_SORT_DIR);
    setSelectedType(isTypeFilterValue(nextType) ? nextType : DEFAULT_TYPE);
    setCurrentPage(parsePageParam(searchParams.get("page")));
    setSelectedGenres(urlTagIds.filter((tagId) => genreIds.includes(tagId)));
    setSelectedSpecialTags(urlTagIds.filter((tagId) => specialIds.includes(tagId)));
    initializedFromUrlRef.current = true;
    setUrlHydrated(true);
  }, [searchParams]);

  const exploreQueryString = useMemo(() => {
    const params = new URLSearchParams();
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery) {
      params.set("q", trimmedQuery);
    }

    if (orderBy !== DEFAULT_ORDER_BY) {
      params.set("order_by", orderBy);
    }

    if (sortDir !== DEFAULT_SORT_DIR) {
      params.set("sort", sortDir);
    }

    if (selectedType !== DEFAULT_TYPE) {
      params.set("type", selectedType);
    }

    [...selectedGenres, ...selectedSpecialTags].forEach((tagId) => {
      params.append("includedTags", tagId);
    });

    if (currentPage > 1) {
      params.set("page", String(currentPage));
    }

    return params.toString();
  }, [currentPage, orderBy, searchQuery, selectedGenres, selectedSpecialTags, selectedType, sortDir]);

  useEffect(() => {
    if (!urlHydrated) {
      return;
    }

    if (isApplyingUrlStateRef.current) {
      isApplyingUrlStateRef.current = false;
      return;
    }

    const currentQueryString = searchParams.toString();

    if (currentQueryString === exploreQueryString) {
      return;
    }

    router.push(exploreQueryString ? `/explore?${exploreQueryString}` : "/explore", {
      scroll: false,
    });
  }, [exploreQueryString, router, searchParams, urlHydrated]);

  const paginationPages = useMemo(
    () =>
      Array.from(
        new Set(
          [currentPage - 1, currentPage, currentPage + 1, currentPage + 2].filter(
            (pageNumber) => pageNumber > 0 && pageNumber <= lastVisiblePage
          )
        )
      ),
    [currentPage, lastVisiblePage]
  );

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        isAdult,
        language,
        orderBy,
    searchQuery: searchQuery.trim(),
        selectedGenres,
        selectedSpecialTags,
        selectedType,
        sortDir,
      }),
    [isAdult, language, orderBy, searchQuery, selectedGenres, selectedSpecialTags, selectedType, sortDir]
  );

  async function fetchMangas(targetPage = currentPage, signal?: AbortSignal) {
    const params = new URLSearchParams();
    params.set("limit", "24");
    params.set("page", String(targetPage));
    params.set("offset", String((targetPage - 1) * 24));

    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery) {
      params.set("title", normalizedQuery);
    }

    if (selectedType !== "all") {
      const typeMap: Record<Exclude<TypeFilterValue, "all">, string> = {
        ja: "manga",
        ko: "manhwa",
        zh: "manhua",
      };
      params.set("type", typeMap[selectedType]);
    }

    const orderMap: Record<OrderByValue, string> = {
      followedCount: "views",
      rating: "rating",
      latestUploadedChapter: "updated_at",
      title: "title",
    };
    params.set("order", orderMap[orderBy]);
    params.set("sort", sortDir);

    selectedGenres.forEach((tagId) => {
      const genre = GENRE_TAGS.find((item) => item.id === tagId);
      if (genre) params.append("genres[]", getTranslatedFilterLabel(genre.label, language));
    });

    selectedSpecialTags.forEach((tagId) => {
      const tag = SPECIAL_TAGS.find((item) => item.id === tagId);
      if (tag) params.append("tags[]", getTranslatedFilterLabel(tag.label, language));
    });

    try {
      let localTotal = 0;
      let localMangas: MangaShowcaseItem[] = [];

      if (language === "es") {
        try {
        if (normalizedQuery) {
          params.set("limit", "100");
          params.set("page", "1");
          params.delete("offset");
        }

        const response = await fetch(`${MONLINE_API_URL}/api/comics?${params.toString()}`, {
          cache: "no-store",
          signal,
        });

        if (response.ok) {
          const payload = (await response.json()) as MonlineComicsResponse;
          const comics = extractLocalApiComics(payload);
          const filteredComics = normalizedQuery
            ? comics.filter((comic) => localComicMatchesQuery(comic, normalizedQuery))
            : comics;
          localTotal = normalizedQuery ? filteredComics.length : getLocalApiTotal(payload, comics.length);
          const pageComics = normalizedQuery
            ? filteredComics.slice((targetPage - 1) * 24, targetPage * 24)
            : filteredComics;
          const mappedLocalMangas = mapLocalApiComicsToShowcaseItems(pageComics, language, MONLINE_API_URL);
          localMangas = await Promise.all(
            mappedLocalMangas.map(async (manga, index) => ({
              ...manga,
              latestChapters: await fetchLocalChapterPreviews(pageComics[index], MONLINE_API_URL, signal),
            }))
          );
        } else if (response.status === 429) {
          setError(copy.rateLimit);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
      }
      }

      const mangaDexParams = new URLSearchParams();
      const pageStart = (targetPage - 1) * 24;
      const mangaDexOffset = Math.max(0, pageStart - localTotal);
      mangaDexParams.set("limit", String(Math.max(1, 24 - Math.min(localMangas.length, 24))));
      mangaDexParams.set("offset", String(mangaDexOffset));
      mangaDexParams.set(
        `order[${
          orderBy === "followedCount"
            ? "followedCount"
            : orderBy === "rating"
              ? "rating"
              : orderBy === "title"
                ? "title"
                : "latestUploadedChapter"
        }]`,
        sortDir
      );
      appendStandardMangaDexFilters(mangaDexParams, isAdult, language);

      if (normalizedQuery) {
        mangaDexParams.set("title", normalizedQuery);
      }

      if (selectedType !== "all") {
        mangaDexParams.append("originalLanguage[]", selectedType);
      }

      [...selectedGenres, ...selectedSpecialTags].forEach((tagId) => {
        mangaDexParams.append("includedTags[]", tagId);
      });

      const canFetchMangaDex = mangaDexOffset <= 10_000;
      const mangaDexResponse = canFetchMangaDex
        ? await fetch(`/api/mangadex/manga?${mangaDexParams.toString()}`, { signal })
        : null;
      const mangaDexPayload = mangaDexResponse?.ok
        ? ((await mangaDexResponse.json()) as MangaDexCollectionResponse)
        : { data: [], total: 0 };
      const rawMangaDex = mangaDexPayload.data ?? [];
      const statistics = rawMangaDex.length
        ? await fetchMangaDexStatistics(rawMangaDex.map((manga) => manga.id), signal)
        : {};
      const mangaDexMangas = mapToShowcaseItems(rawMangaDex as MangaDexManga[], statistics, language);
      const localSlugs = new Set(localMangas.map((manga) => manga.mangaDexId ?? manga.url));
      const mixedMangas = [
        ...localMangas,
        ...mangaDexMangas.filter((manga) => !localSlugs.has(manga.mangaDexId ?? manga.url)),
      ].slice(0, 24);
      const total = localTotal + (mangaDexPayload.total ?? mangaDexPayload.pagination?.total ?? 0);

      if (signal?.aborted) return;

      const nextLastVisiblePage = Math.max(1, Math.ceil(total / 24));

      setTotalItems(total);
      setLastVisiblePage(nextLastVisiblePage);

      if (targetPage > nextLastVisiblePage) {
        setMangas([]);
        setCurrentPage(nextLastVisiblePage);
        setError("");
        return;
      }

      setMangas(mixedMangas);
      setError("");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setMangas([]);
      setTotalItems(0);
      setLastVisiblePage(1);
      setError(copy.genericError);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!urlHydrated) {
      return;
    }

    const controller = new AbortController();
    const filtersChanged =
      previousFilterKeyRef.current !== null && previousFilterKeyRef.current !== filterKey;
    previousFilterKeyRef.current = filterKey;

    setMangas([]);
    setTotalItems(0);
    setLastVisiblePage(1);
    setError("");
    setIsLoading(true);

    if (filtersChanged && currentPage !== 1) {
      setCurrentPage(1);
      return;
    }

    fetchMangas(filtersChanged ? 1 : currentPage, controller.signal);

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filterKey, urlHydrated]);

  function handleSearch() {
    const nextQuery = searchDraft.trim();
    setError("");
    setMangas([]);
    setTotalItems(0);
    setLastVisiblePage(1);
    setIsLoading(true);
    setSearchQuery(nextQuery);

    if (currentPage !== 1) {
      setCurrentPage(1);
      return;
    }

    setCurrentPage(1);
  }

  function handleClearFilters() {
    setSearchQuery("");
    setSearchDraft("");
    setOrderBy(DEFAULT_ORDER_BY);
    setSortDir(DEFAULT_SORT_DIR);
    setSelectedGenres([]);
    setSelectedSpecialTags([]);
    setSelectedType(DEFAULT_TYPE);
    setError("");
    setCurrentPage(1);
  }

  function handlePrev() {
    setCurrentPage((page) => Math.max(1, page - 1));
  }

  function handleNext() {
    setCurrentPage((page) => Math.min(lastVisiblePage, page + 1));
  }

  function toggleGenre(tagId: string) {
    setCurrentPage(1);
    setSelectedGenres((current) => {
      if (current.includes(tagId)) {
        return current.filter((id) => id !== tagId);
      }

      return [...current, tagId];
    });
  }

  function toggleSpecialTag(tagId: string) {
    setCurrentPage(1);
    setSelectedSpecialTags((current) => {
      if (current.includes(tagId)) {
        return current.filter((id) => id !== tagId);
      }

      if (current.length >= 3) {
        return current;
      }

      return [...current, tagId];
    });
  }

  function toggleSpecialTagGroup(tagIds: string[]) {
    setCurrentPage(1);
    setSelectedSpecialTags((current) => {
      const isActive = tagIds.some((tagId) => current.includes(tagId));

      if (isActive) {
        return current.filter((tagId) => !tagIds.includes(tagId));
      }

      const next = [...current];

      for (const tagId of tagIds) {
        if (!next.includes(tagId)) {
          next.push(tagId);
        }
      }

      return next.slice(0, 3);
    });
  }

  const selectedSpecialTagGroupCount = getSpecialTagGroups(language).filter((group) =>
    group.ids.some((tagId) => selectedSpecialTags.includes(tagId))
  ).length;

  return (
    <main className="min-h-screen bg-[#141519] text-white">
      <SiteHeader language={language} />

      <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-8 md:px-8">
        <div className="mb-8 rounded-[28px] border border-white/6 bg-[#111316] px-5 py-5 md:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="inline-flex items-center gap-3 text-base font-semibold text-white">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b00]" />
              <span>
                {copy.showing} <span className="text-[#ff6b00]">{mangas.length}</span> {copy.of}{" "}
                <span className="text-[#ff6b00]">{totalItems}</span> {copy.titles}
              </span>
            </div>

            {/* Contenedor Principal Centrado */}
            <div className="flex w-full flex-col items-center my-12 xl:my-0 xl:w-auto">
              {/* La P?ldora Glassmorphism */}
              <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-800 bg-[#141519]/80 p-1.5 shadow-lg backdrop-blur-md">
                {/* Bot?n Anterior (Flecha) */}
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={currentPage === 1}
                  className="rounded-full p-2 text-gray-400 transition-all hover:bg-gray-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>

                {paginationPages.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setCurrentPage(pageNumber)}
                    className={
                      pageNumber === currentPage
                        ? "flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-orange-600 to-orange-400 text-sm font-bold text-white shadow-[0_0_12px_rgba(249,115,22,0.4)]"
                        : "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-gray-400 transition-all hover:bg-gray-800 hover:text-white"
                    }
                  >
                    {pageNumber}
                  </button>
                ))}

                {lastVisiblePage > paginationPages[paginationPages.length - 1] ? (
                  <>
                    <span className="px-2 text-sm text-gray-500">...</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(lastVisiblePage)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-gray-400 transition-all hover:bg-gray-800 hover:text-white"
                    >
                      {lastVisiblePage}
                    </button>
                  </>
                ) : null}

                {/* Bot?n Siguiente (Flecha) */}
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentPage === lastVisiblePage}
                  className="rounded-full p-2 text-gray-400 transition-all hover:bg-gray-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              </div>

              {/* Texto de informaci?n minimalista */}
              <div className="mt-4 text-center text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                P?gina {currentPage} de {lastVisiblePage}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="order-1 xl:order-1">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#ff6b00]">
                {copy.title}
              </p>
              <h1 className="mt-3 text-xl font-semibold text-white md:text-xl">{copy.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-400 md:text-base">
                {copy.subtitle}
              </p>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6">
                {Array.from({ length: 12 }).map((_, index) => (
                  <div
                    key={`explore-skeleton-${index}`}
                    className="aspect-[2/3] animate-pulse rounded-md bg-white/5"
                  />
                ))}
              </div>
            ) : mangas.length === 0 ? (
              <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-[28px] border border-white/6 bg-[#111316] p-10 text-center">
                <p className="text-lg text-gray-400">{error || copy.noResults}</p>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-6 rounded-full bg-[#ff6b00] px-6 py-3 text-sm font-bold text-black shadow-[0_14px_40px_rgba(255,107,0,0.22)] transition hover:bg-orange-400"
                >
                  {copy.clearFilters}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6">
                {mangas.map((manga, index) => (
                  <MangaCard
                    key={manga.mangaDexId ? `${manga.mangaDexId}-${index}` : `${manga.mal_id}-${index}`}
                    manga={manga}
                    variant="grid"
                    showChapters
                    latestChapters={manga.latestChapters}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="order-2 xl:order-2">
            <div className="rounded-2xl border border-white/6 bg-[#111316] p-4 shadow-2xl shadow-black/20 xl:sticky xl:top-24">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-[#ff6b00]/12 p-2 text-[#ff6b00]">
                    <SlidersHorizontal className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">{copy.filters}</h2>
                </div>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-gray-300 transition-colors hover:border-[#ff6b00]/30 hover:text-orange-400"
                >
                  {copy.clearFilters}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                    {copy.typeTitle}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TYPE_FILTERS.map((typeOption) => {
                      const active = selectedType === typeOption.value;

                      return (
                        <button
                          key={typeOption.value}
                          type="button"
                          onClick={() => {
                            setSelectedType(typeOption.value);
                            setCurrentPage(1);
                          }}
                          className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                            active
                              ? "border-orange-500 bg-orange-500 text-white"
                              : "border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-orange-500 hover:text-white"
                          }`}
                        >
                          {typeOption.label[language]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                    {copy.searchTitle}
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        value={searchDraft}
                        onChange={(event) => {
                          setSearchDraft(event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            handleSearch();
                          }
                        }}
                        placeholder={copy.searchPlaceholder}
                        className="h-10 w-full rounded-full border border-white/10 bg-[#171a1f] pl-9 pr-3 text-xs text-white outline-none transition-colors placeholder:text-gray-500 focus:border-[#ff6b00]/40"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSearch}
                      className="rounded-full bg-[#ff6b00] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-600"
                    >
                      {copy.searchButton}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                    {copy.orderBy}
                  </label>
                  <select
                    value={orderBy}
                    onChange={(event) => {
                      if (isOrderByValue(event.target.value)) {
                        setOrderBy(event.target.value);
                        setCurrentPage(1);
                      }
                    }}
                    className="h-10 w-full rounded-xl border border-white/10 bg-[#171a1f] px-3 text-xs text-white outline-none transition-colors focus:border-[#ff6b00]/40"
                  >
                    {ORDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label[language]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                    {copy.direction}
                  </label>
                  <select
                    value={sortDir}
                    onChange={(event) => {
                      if (isSortDirValue(event.target.value)) {
                        setSortDir(event.target.value);
                        setCurrentPage(1);
                      }
                    }}
                    className="h-10 w-full rounded-xl border border-white/10 bg-[#171a1f] px-3 text-xs text-white outline-none transition-colors focus:border-[#ff6b00]/40"
                  >
                    <option value="desc">{copy.descending}</option>
                    <option value="asc">{copy.ascending}</option>
                  </select>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                      {copy.genreTitle}
                    </label>
                    <span className="rounded-full border border-[#ff6b00]/20 bg-[#ff6b00]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#ff6b00]">
                      {selectedGenres.length}
                    </span>
                  </div>

                  <div className="max-h-[220px] overflow-y-auto pr-2 custom-scrollbar flex flex-wrap gap-2">
                    {GENRE_TAGS.map((genre) => {
                      const active = selectedGenres.includes(genre.id);
                      const label = getTranslatedFilterLabel(genre.label, language);
                      const selectedIndex = selectedGenres.indexOf(genre.id);

                      return (
                        <button
                          key={genre.id}
                          type="button"
                          onClick={() => toggleGenre(genre.id)}
                          className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                            active
                              ? "border-orange-500 bg-orange-500 text-white"
                              : "border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-orange-500 hover:text-white"
                          }`}
                        >
                          {active ? `${label} +${selectedIndex + 1}` : label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                      {copy.specialTagTitle}
                    </label>
                    <span className="rounded-full border border-[#ff6b00]/20 bg-[#ff6b00]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#ff6b00]">
                      {selectedSpecialTagGroupCount}/3
                    </span>
                  </div>

                  <p className="mb-2 text-[11px] text-gray-500">{copy.selectedGenres}</p>

                  <div className="max-h-[220px] overflow-y-auto pr-2 custom-scrollbar flex flex-wrap gap-2">
                    {getSpecialTagGroups(language).map((tag) => {
                      const active = tag.ids.some((tagId) => selectedSpecialTags.includes(tagId));
                      const selectedIndex = getSpecialTagGroups(language)
                        .filter((group) => group.ids.some((tagId) => selectedSpecialTags.includes(tagId)))
                        .findIndex((group) => group.label === tag.label);

                      return (
                        <button
                          key={tag.label}
                          type="button"
                          onClick={() => toggleSpecialTagGroup(tag.ids)}
                          className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                            active
                              ? "border-orange-500 bg-orange-500 text-white"
                              : "border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-orange-500 hover:text-white"
                          }`}
                        >
                          {active ? `${tag.label} +${selectedIndex + 1}` : tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleSearch}
                    className="w-full rounded-full bg-[#ff6b00] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-orange-600"
                  >
                    {copy.searchButton}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
