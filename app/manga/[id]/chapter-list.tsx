"use client";

import Link from "next/link";
import { ArrowDown, BookOpen, CalendarDays } from "lucide-react";
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
  const orderedRows = descending ? chapterRows : [...chapterRows].reverse();
  const visibleRows = orderedRows.slice(0, visibleCount);
  const hasMore = visibleCount < chapterRows.length;
  const sortLabel = descending
    ? "Mostrar capitulo 1 primero"
    : "Mostrar capitulo mas reciente primero";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between rounded-xl bg-[#141519] px-4 py-3 text-left">
        <p className="text-base leading-relaxed text-gray-400">{totalLabel}</p>
        <button
          type="button"
          onClick={() => {
            setDescending((current) => !current);
            setVisibleCount(INITIAL_CHAPTER_COUNT);
          }}
          aria-label={sortLabel}
          title={sortLabel}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-800 text-gray-500 transition-all hover:border-orange-500/50 hover:text-white"
        >
          <ArrowDown className={`h-5 w-5 transition-transform duration-300 ${!descending ? "rotate-180" : ""}`} />
        </button>
      </div>

      {visibleRows.map(({ chapter, chapterLabel, publishedLabel }) => (
        <Link
          key={chapter.id}
          href={`/read/${mangaId}?chapter=${chapter.id}`}
          className="animate-soft-enter mb-2 flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/5 p-4 transition-colors hover:bg-white/10"
        >
          <div className="flex min-w-0 items-center gap-3">
            <BookOpen className="h-5 w-5 shrink-0 text-[#ff6b00]" />
            <p className="text-base font-semibold text-white">{chapterLabel}</p>
          </div>

          <div className="ml-2 flex shrink-0 items-center gap-2 text-sm text-gray-400">
            <CalendarDays className="h-4 w-4" />
            <span>{publishedLabel}</span>
          </div>
        </Link>
      ))}

      {hasMore ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount(chapterRows.length)}
            className="rounded-full border border-orange-500/40 bg-orange-500/10 px-5 py-2.5 text-sm font-semibold text-orange-300 transition hover:border-orange-400 hover:bg-orange-500 hover:text-white"
          >
            {showMoreLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
