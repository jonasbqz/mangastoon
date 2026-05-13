"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type SupportedLanguage = "es" | "en" | "pt";

type GenreOption = {
  id: string;
  label: Record<SupportedLanguage, string>;
};

type OrderOption = {
  value: string;
  label: Record<SupportedLanguage, string>;
};

type ExploreFiltersProps = {
  language: SupportedLanguage;
  copy: {
    filters: string;
    searchTitle: string;
    searchPlaceholder: string;
    orderBy: string;
    direction: string;
    genreTitle: string;
    searchButton: string;
    ascending: string;
    descending: string;
    clearFilters: string;
    selectedGenres: string;
  };
  genres: readonly GenreOption[];
  orderOptions: readonly OrderOption[];
  initialQuery: string;
  initialGenres: string[];
  initialOrder: string;
  initialSort: string;
};

function buildExploreHref({
  query,
  genres,
  orderBy,
  sort,
}: {
  query: string;
  genres: string[];
  orderBy: string;
  sort: string;
}) {
  const searchParams = new URLSearchParams();

  if (query.trim()) {
    searchParams.set("q", query.trim());
  }

  genres.forEach((genreId) => {
    searchParams.append("includedTags", genreId);
  });

  if (orderBy) {
    searchParams.set("order_by", orderBy);
  }

  if (sort) {
    searchParams.set("sort", sort);
  }

  const queryString = searchParams.toString();
  return queryString ? `/explore?${queryString}` : "/explore";
}

export default function ExploreFilters({
  language,
  copy,
  genres,
  orderOptions,
  initialQuery,
  initialGenres,
  initialOrder,
  initialSort,
}: ExploreFiltersProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(initialGenres);
  const [orderBy, setOrderBy] = useState(initialOrder);
  const [sort, setSort] = useState(initialSort);
  const mountedRef = useRef(false);

  const activeCount = selectedGenres.length;
  const canApply = useMemo(
    () =>
      query !== initialQuery ||
      orderBy !== initialOrder ||
      sort !== initialSort ||
      selectedGenres.join(",") !== initialGenres.join(","),
    [initialGenres, initialOrder, initialQuery, initialSort, orderBy, query, selectedGenres, sort]
  );

  function toggleGenre(genreId: string) {
    setSelectedGenres((current) => {
      if (current.includes(genreId)) {
        return current.filter((id) => id !== genreId);
      }

      if (current.length >= 3) {
        return current;
      }

      return [...current, genreId];
    });
  }

  function handleApply() {
    router.push(
      buildExploreHref({
        query,
        genres: selectedGenres,
        orderBy,
        sort,
      })
    );
  }

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    router.push(
      buildExploreHref({
        query,
        genres: selectedGenres,
        orderBy,
        sort,
      })
    );
  }, [orderBy, query, router, selectedGenres, sort]);

  function handleClear() {
    setQuery("");
    setSelectedGenres([]);
    setOrderBy("latestUploadedChapter");
    setSort("desc");
    router.push("/explore");
  }

  return (
    <div className="rounded-[28px] border border-white/6 bg-[#111316] p-6 shadow-2xl shadow-black/20 xl:sticky xl:top-24">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-orange-500/12 p-3 text-orange-500">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-bold text-white">{copy.filters}</h2>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/30 hover:text-orange-400"
        >
          {copy.clearFilters}
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
            {copy.searchTitle}
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className="h-14 w-full rounded-full border border-white/10 bg-[#171a1f] pl-12 pr-4 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-orange-500/40"
              />
            </div>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
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
            {orderOptions.map((option) => (
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
            value={sort}
            onChange={(event) => setSort(event.target.value)}
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
              {activeCount}/3
            </span>
          </div>

          <p className="mb-4 text-xs text-gray-500">{copy.selectedGenres}</p>

          <div className="max-h-[220px] overflow-y-auto pr-2 custom-scrollbar flex flex-wrap gap-2">
            {genres.map((genre) => {
              const active = selectedGenres.includes(genre.id);
              const blocked = !active && selectedGenres.length >= 3;

              return (
                <button
                  key={genre.id}
                  type="button"
                  onClick={() => toggleGenre(genre.id)}
                  disabled={blocked}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                    active
                      ? "border-orange-500 bg-orange-500 text-white"
                      : blocked
                        ? "cursor-not-allowed border-white/5 bg-white/[0.03] text-gray-600"
                        : "border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-orange-500 hover:text-white"
                  }`}
                >
                  {genre.label[language]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className="w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.searchButton}
          </button>
        </div>
      </div>
    </div>
  );
}
