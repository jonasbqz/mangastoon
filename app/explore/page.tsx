"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Search, SlidersHorizontal } from "lucide-react";
import { MangaCard } from "../components/home-carousel";
import SiteHeader from "../components/site-header";
import { useLanguage, type SupportedLanguage } from "../components/language-provider";
import {
  appendStandardMangaDexFilters,
  fetchMangaDexStatistics,
  getAvailableTranslatedLanguageVariants,
  mapToShowcaseItems,
  type MangaDexCollectionResponse,
  type MangaDexManga,
} from "../utils/mangadex";

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

  getAvailableTranslatedLanguageVariants(language).forEach((translatedLanguage) => {
    params.append("translatedLanguage[]", translatedLanguage);
  });

  const response = await fetch(`/api/mangadex/feed/${mangaId}?${params.toString()}`);

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

  return (payload.data ?? []).slice(0, 2).map((chapter) => {
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

export default function ExplorePage() {
  const searchParams = useSearchParams();
  const { language, isAdult } = useLanguage();
  const copy = UI_COPY[language];
  const previousFilterKeyRef = useRef<string | null>(null);
  const initializedFromUrlRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [orderBy, setOrderBy] = useState("latestUploadedChapter");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedSpecialTags, setSelectedSpecialTags] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<(typeof TYPE_FILTERS)[number]["value"]>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [mangas, setMangas] = useState<ReturnType<typeof mapToShowcaseItems>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [lastVisiblePage, setLastVisiblePage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initializedFromUrlRef.current) {
      return;
    }

    initializedFromUrlRef.current = true;

    const urlTagIds = searchParams.getAll("includedTags");

    if (urlTagIds.length === 0) {
      return;
    }

    const genreIds = GENRE_TAGS.map((genre) => genre.id as string);
    const specialIds = SPECIAL_TAGS.map((tag) => tag.id as string);

    setSelectedGenres(urlTagIds.filter((tagId) => genreIds.includes(tagId)));
    setSelectedSpecialTags(urlTagIds.filter((tagId) => specialIds.includes(tagId)));
  }, [searchParams]);

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

  async function fetchMangas(targetPage = currentPage) {
    const params = new URLSearchParams();
    params.set("limit", "24");
    params.set("offset", String((targetPage - 1) * 24));
    params.set(`order[${orderBy}]`, sortDir);
    appendStandardMangaDexFilters(params, isAdult, language);

    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery) {
      params.set("title", normalizedQuery);
    }

    if (selectedType !== "all") {
      params.append("originalLanguage[]", selectedType);
    }


    const selectedTags = [...selectedGenres, ...selectedSpecialTags];
    if (selectedTags.length > 0) {
      selectedTags.forEach((tagId) => {
        params.append("includedTags[]", tagId);
      });
    }


    try {
      const response = await fetch(`/api/mangadex/manga?${params.toString()}`);

      if (!response.ok) {
        setMangas([]);
        setTotalItems(0);
        setLastVisiblePage(1);
        setError(response.status === 429 ? copy.rateLimit : copy.genericError);
        return;
      }

      const payload = (await response.json()) as MangaDexCollectionResponse;
      const rawMangas = payload.data ?? [];
      const statistics = await fetchMangaDexStatistics(rawMangas.map((manga) => manga.id));
      const total = payload.total ?? payload.pagination?.total ?? 0;

      const mappedMangas = mapToShowcaseItems(rawMangas as MangaDexManga[], statistics, language);
      const chapterPreviews = await Promise.all(
        mappedMangas.map(async (manga) => ({
          mangaDexId: manga.mangaDexId,
          latestChapters: manga.mangaDexId
            ? await fetchLatestChapterPreviews(manga.mangaDexId, language)
            : [],
        }))
      );

      const visibleMangas = mappedMangas
        .map((manga) => ({
          ...manga,
          latestChapters:
            chapterPreviews.find((preview) => preview.mangaDexId === manga.mangaDexId)
              ?.latestChapters ?? [],
        }))
        .filter((manga) => manga.latestChapters.length > 0)
        .sort((a, b) => {
          const aTime = new Date(a.latestChapters[0]?.publishedAt ?? 0).getTime();
          const bTime = new Date(b.latestChapters[0]?.publishedAt ?? 0).getTime();

          return bTime - aTime;
        });

      setMangas(visibleMangas);
      setTotalItems(total);
      setLastVisiblePage(Math.max(1, Math.ceil(total / 24)));
    } catch {
      setMangas([]);
      setTotalItems(0);
      setLastVisiblePage(1);
      setError(copy.genericError);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const filtersChanged = previousFilterKeyRef.current !== filterKey;
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

    fetchMangas(filtersChanged ? 1 : currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filterKey]);

  function handleSearch() {
    setError("");
    setMangas([]);
    setTotalItems(0);
    setLastVisiblePage(1);
    setIsLoading(true);

    if (currentPage !== 1) {
      setCurrentPage(1);
      return;
    }

    fetchMangas(1);
  }

  function handleClearFilters() {
    setSearchQuery("");
    setOrderBy("latestUploadedChapter");
    setSortDir("desc");
    setSelectedGenres([]);
    setSelectedSpecialTags([]);
    setSelectedType("all");
    setError("");
    setCurrentPage(1);
  }

  function toggleGenre(tagId: string) {
    setSelectedGenres((current) => {
      if (current.includes(tagId)) {
        return current.filter((id) => id !== tagId);
      }

      return [...current, tagId];
    });
  }

  function toggleSpecialTag(tagId: string) {
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

  return (
    <main className="min-h-screen bg-[#141519] text-white">
      <SiteHeader language={language} />

      <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-8 md:px-8">
        <div className="mb-8 rounded-[28px] border border-white/6 bg-[#111316] px-5 py-5 md:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="inline-flex items-center gap-3 text-base font-semibold text-white">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
              <span>
                {copy.showing} <span className="text-orange-500">{mangas.length}</span> {copy.of}{" "}
                <span className="text-orange-500">{totalItems}</span> {copy.titles}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage <= 1}
                className="rounded-full border border-white/10 bg-white/5 p-3 transition-colors hover:border-orange-500/40 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              {paginationPages.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`rounded-full px-5 py-3 font-medium transition-colors ${
                    pageNumber === currentPage
                      ? "bg-orange-500 text-white hover:bg-orange-600"
                      : "border border-white/10 bg-white/5 text-gray-200 hover:border-orange-500/40 hover:text-orange-400"
                  }`}
                >
                  {pageNumber}
                </button>
              ))}

              {lastVisiblePage > paginationPages[paginationPages.length - 1] ? (
                <span className="px-2 text-gray-500">...</span>
              ) : null}

              <span className="text-gray-300">{lastVisiblePage}</span>

              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(lastVisiblePage, page + 1))}
                disabled={currentPage >= lastVisiblePage}
                className="rounded-full border border-white/10 bg-white/5 p-3 transition-colors hover:border-orange-500/40 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="order-2 xl:order-1">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
                {copy.title}
              </p>
              <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">{copy.title}</h1>
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
              <div className="flex min-h-[50vh] items-center justify-center rounded-[28px] border border-white/6 bg-[#111316] p-10 text-center">
                <p className="text-lg text-gray-400">{error || copy.noResults}</p>
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

          <aside className="order-1 xl:order-2">
            <div className="rounded-[28px] border border-white/6 bg-[#111316] p-6 shadow-2xl shadow-black/20 xl:sticky xl:top-24">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-full bg-orange-500/12 p-3 text-orange-500">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold text-white">{copy.filters}</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                    {copy.typeTitle}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TYPE_FILTERS.map((typeOption) => {
                      const active = selectedType === typeOption.value;

                      return (
                        <button
                          key={typeOption.value}
                          type="button"
                          onClick={() => setSelectedType(typeOption.value)}
                          className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                            active
                              ? "border-orange-500 bg-orange-500/20 text-orange-500"
                              : "border-white/10 bg-[#171a1f] text-gray-300 hover:border-orange-500/30 hover:text-orange-400"
                          }`}
                        >
                          {typeOption.label[language]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                    {copy.searchTitle}
                  </label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={copy.searchPlaceholder}
                        className="h-14 w-full rounded-full border border-white/10 bg-[#171a1f] pl-12 pr-4 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-orange-500/40"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSearch}
                      className="rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                    >
                      {copy.searchButton}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                    {copy.orderBy}
                  </label>
                  <select
                    value={orderBy}
                    onChange={(event) => setOrderBy(event.target.value)}
                    className="h-14 w-full rounded-2xl border border-white/10 bg-[#171a1f] px-4 text-sm text-white outline-none transition-colors focus:border-orange-500/40"
                  >
                    {ORDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label[language]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                    {copy.direction}
                  </label>
                  <select
                    value={sortDir}
                    onChange={(event) => setSortDir(event.target.value)}
                    className="h-14 w-full rounded-2xl border border-white/10 bg-[#171a1f] px-4 text-sm text-white outline-none transition-colors focus:border-orange-500/40"
                  >
                    <option value="desc">{copy.descending}</option>
                    <option value="asc">{copy.ascending}</option>
                  </select>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                      {copy.genreTitle}
                    </label>
                    <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-500">
                      {selectedGenres.length}
                    </span>
                  </div>

                  <div className="max-h-[220px] overflow-y-auto pr-1">
                    <div className="flex flex-wrap gap-2">
                      {GENRE_TAGS.map((genre) => {
                        const active = selectedGenres.includes(genre.id);

                        return (
                          <button
                            key={genre.id}
                            type="button"
                            onClick={() => toggleGenre(genre.id)}
                            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                              active
                                ? "border-orange-500 bg-orange-500/20 text-orange-500"
                                : "border-white/10 bg-[#171a1f] text-gray-300 hover:border-orange-500/30 hover:text-orange-400"
                            }`}
                          >
                            {genre.label[language]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                      {copy.specialTagTitle}
                    </label>
                    <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-500">
                      {selectedSpecialTags.length}/3
                    </span>
                  </div>

                  <p className="mb-4 text-xs text-gray-500">{copy.selectedGenres}</p>

                  <div className="flex flex-wrap gap-2">
                    {SPECIAL_TAGS.map((tag) => {
                      const active = selectedSpecialTags.includes(tag.id);

                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleSpecialTag(tag.id)}
                          className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                            active
                              ? "border-orange-500 bg-orange-500/20 text-orange-500"
                              : "border-white/10 bg-[#171a1f] text-gray-300 hover:border-orange-500/30 hover:text-orange-400"
                          }`}
                        >
                          {tag.label[language]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSearch}
                    className="flex-1 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                  >
                    {copy.searchButton}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-orange-500/30 hover:text-orange-400"
                  >
                    {copy.clearFilters}
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
