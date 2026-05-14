"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, BookOpen, CalendarDays } from "lucide-react";
import { useState } from "react";

type ChapterRow = {
  chapter: {
    id: string;
  };
  chapterLabel: string;
  publishedLabel: string;
};

type ChapterListProps = {
  mangaId: string;
  chapterRows: ChapterRow[];
  showMoreLabel: string;
  totalLabel: string;
};

const INITIAL_CHAPTER_COUNT = 10;

export default function ChapterList({ mangaId, chapterRows, showMoreLabel, totalLabel }: ChapterListProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_CHAPTER_COUNT);
  const [descending, setDescending] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const orderedRows = descending ? chapterRows : [...chapterRows].reverse();
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredRows = normalizedSearchQuery
    ? orderedRows.filter(({ chapterLabel }) => chapterLabel.toLowerCase().includes(normalizedSearchQuery))
    : orderedRows;
  const visibleRows = filteredRows.slice(0, visibleCount);
  const hasMore = visibleCount < filteredRows.length;
  const sortLabel = descending
    ? "Mostrar capitulo 1 primero"
    : "Mostrar capitulo mas reciente primero";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-[#141519] px-4 py-3 text-left">
        <p className="min-w-0 flex-1 text-base leading-relaxed text-gray-400">{totalLabel}</p>

        <div className="flex shrink-0 items-center gap-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setVisibleCount(INITIAL_CHAPTER_COUNT);
            }}
            placeholder="Ej: 16"
            className="h-10 w-28 rounded-2xl border border-white/5 bg-[#1e1f24] px-3 text-sm text-gray-200 transition-all placeholder:text-gray-600 focus:border-[#ff6b00] focus:outline-none focus:ring-1 focus:ring-[#ff6b00] sm:w-36"
          />
          <button
            type="button"
            onClick={() => {
              setDescending((current) => !current);
              setVisibleCount(INITIAL_CHAPTER_COUNT);
            }}
            aria-label={sortLabel}
            title={sortLabel}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-800 text-gray-500 transition-all hover:border-orange-500/50 hover:text-white"
          >
            {descending ? (
              <ArrowDown className="h-5 w-5 transition-transform duration-300" />
            ) : (
              <ArrowUp className="h-5 w-5 transition-transform duration-300" />
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:block">
        {visibleRows.map(({ chapter, chapterLabel, publishedLabel }) => (
          <Link
            key={chapter.id}
            href={`/read/${mangaId}?chapter=${chapter.id}`}
            className="animate-soft-enter flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/5 p-3 transition-colors hover:bg-white/10 sm:mb-2 sm:gap-3 sm:p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <BookOpen className="h-4 w-4 shrink-0 text-[#ff6b00] sm:h-5 sm:w-5" />
              <p className="text-sm font-semibold text-white sm:text-base">{chapterLabel}</p>
            </div>

            <div className="ml-2 flex shrink-0 items-center gap-1.5 text-xs text-gray-400 sm:gap-2 sm:text-sm">
              <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{publishedLabel}</span>
            </div>
          </Link>
        ))}
      </div>

      {hasMore ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount(filteredRows.length)}
            className="rounded-full border border-orange-500/40 bg-orange-500/10 px-5 py-2.5 text-sm font-semibold text-orange-300 transition hover:border-orange-400 hover:bg-orange-500 hover:text-white"
          >
            {showMoreLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
