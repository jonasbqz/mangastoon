"use client";

import Link from "next/link";
import { ArrowDown, BookOpen, CalendarDays } from "lucide-react";
import { useState, useEffect } from "react";
import { buildChapterPath } from "../../utils/slugify";
import { useHistoryStore } from "../../store/useHistoryStore";

type ChapterRow = {
  chapter: {
    id: string;
  };
  chapterLabel: string;
  publishedLabel: string;
  scanGroupName: string;
};

type ChapterListProps = {
  mangaId: string;
  mangaTitle: string;
  language: "es" | "en" | "pt";
  chapterRows: ChapterRow[];
  showMoreLabel: string;
  totalLabel: string;
  searchPlaceholder: string;
  sortNewestLabel: string;
  sortOldestLabel: string;
  scanGroups: string[];
  activeScanGroup: string;
};

const INITIAL_CHAPTER_COUNT = 10;
const ALL_SCAN_GROUPS = "__all_scan_groups__";

function normalizeScanGroup(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getScanGroupDisplayLabel(value: string) {
  const normalized = normalizeScanGroup(value);

  if (!normalized) return value;
  if (normalized.includes("mangavf")) return "M";
  if (normalized.includes("olympus")) return "O";

  return value.trim().charAt(0).toUpperCase();
}

export default function ChapterList({
  mangaId,
  mangaTitle,
  language,
  chapterRows,
  showMoreLabel,
  totalLabel,
  searchPlaceholder,
  sortNewestLabel,
  sortOldestLabel,
  scanGroups,
  activeScanGroup,
}: ChapterListProps) {
  const history = useHistoryStore((state) => state.history);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cleanId = (id: string) => id.startsWith("lc-") ? id.substring(3) : id;
  const mangaHistory = mounted ? history.find((h) => cleanId(h.mangaId) === cleanId(mangaId)) : null;

  useEffect(() => {
    if (mounted && history.length > 0) {
      console.log("[ChapterList DEBUG] mangaId prop:", mangaId, "| cleanId:", cleanId(mangaId));
      console.log("[ChapterList DEBUG] history items:", history.map(h => ({ mangaId: h.mangaId, cleanId: cleanId(h.mangaId), chapterNumber: h.chapterNumber, title: h.mangaTitle })));
      console.log("[ChapterList DEBUG] mangaHistory found:", mangaHistory ? { mangaId: mangaHistory.mangaId, chapterNumber: mangaHistory.chapterNumber } : null);
    }
  }, [mounted, history, mangaId, mangaHistory]);

  const getIsRead = (chapterId: string, chapterLabel: string) => {
    if (!mangaHistory) return false;
    if (mangaHistory.chapterId === chapterId) return true;

    const readNum = parseFloat(mangaHistory.chapterNumber);
    if (isNaN(readNum)) return false;

    const match = chapterLabel.match(/\d+(?:\.\d+)?/);
    if (match) {
      const currentNum = parseFloat(match[0]);
      return !isNaN(currentNum) && currentNum <= readNum;
    }

    return false;
  };

  const [visibleCount, setVisibleCount] = useState(INITIAL_CHAPTER_COUNT);
  const [descending, setDescending] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScanGroup, setSelectedScanGroup] = useState(ALL_SCAN_GROUPS);
  const orderedScanGroups = [...new Set([activeScanGroup, ...scanGroups].filter(Boolean))]
    .map((scanGroup) => ({
      label: scanGroup,
      key: normalizeScanGroup(scanGroup),
    }))
    .filter((scanGroup) => scanGroup.key.length > 0);
  const scanFilteredRows =
    selectedScanGroup === ALL_SCAN_GROUPS
      ? chapterRows
      : chapterRows.filter((row) => {
          const rowScanGroup = normalizeScanGroup(row.scanGroupName);
          return (
            rowScanGroup === selectedScanGroup ||
            rowScanGroup.includes(selectedScanGroup) ||
            selectedScanGroup.includes(rowScanGroup)
          );
        });
  const orderedRows = descending ? scanFilteredRows : [...scanFilteredRows].reverse();
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredRows = normalizedSearchQuery
    ? orderedRows.filter(({ chapterLabel }) => chapterLabel.toLowerCase().includes(normalizedSearchQuery))
    : orderedRows;
  const visibleRows = filteredRows.slice(0, visibleCount);
  const hasMore = visibleCount < filteredRows.length;
  const sortLabel = descending ? sortOldestLabel : sortNewestLabel;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-[#141519] px-3 py-2.5 text-left md:mb-4 md:gap-3 md:px-4 md:py-3">
        <div className="min-w-0 flex-1">
          {orderedScanGroups.length > 0 ? (
            <select
              value={selectedScanGroup}
              onChange={(event) => {
                setSelectedScanGroup(event.target.value);
                setVisibleCount(INITIAL_CHAPTER_COUNT);
              }}
              className="h-10 max-w-full cursor-pointer appearance-none rounded-2xl border border-white/5 bg-[#1e1f24] px-3 text-sm text-gray-300 outline-none transition-all focus:border-amber-500 focus:ring-1 focus:ring-amber-500 sm:max-w-[240px]"
            >
              <option value={ALL_SCAN_GROUPS}>Todos los fansubs</option>
              {orderedScanGroups.map((scanGroup) => (
                <option key={scanGroup.key} value={scanGroup.key}>
                  {getScanGroupDisplayLabel(scanGroup.label)}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setVisibleCount(INITIAL_CHAPTER_COUNT);
            }}
            placeholder={searchPlaceholder}
            className="h-10 w-28 rounded-2xl border border-white/5 bg-[#1e1f24] px-3 text-sm text-gray-200 transition-all placeholder:text-gray-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 sm:w-36"
          />
          <button
            type="button"
            onClick={() => {
              setDescending((current) => !current);
              setVisibleCount(INITIAL_CHAPTER_COUNT);
            }}
            aria-label={sortLabel}
            title={sortLabel}
            className="group flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-800 text-gray-500 transition-all duration-300 hover:border-amber-500/50 hover:text-white active:scale-95"
          >
            <ArrowDown
              className={`h-5 w-5 transition-transform duration-500 ease-[cubic-bezier(0.87,_0,_0.13,_1)] ${
                descending ? "rotate-0" : "rotate-180"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:block">
        {visibleRows.map(({ chapter, chapterLabel, publishedLabel }) => {
          const isRead = getIsRead(chapter.id, chapterLabel);
          return (
            <Link
              key={chapter.id}
              href={buildChapterPath(mangaTitle, mangaId.startsWith("lc-") ? mangaId.substring(3) : mangaId, chapter.id, language)}
              className="animate-soft-enter flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/5 p-3 transition-colors hover:bg-white/10 sm:mb-2 sm:gap-3 sm:p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <BookOpen className={`h-4 w-4 shrink-0 sm:h-5 sm:w-5 ${isRead ? "text-neutral-500/70" : "text-amber-500"}`} />
                <p className={`text-sm font-semibold sm:text-base ${isRead ? "text-neutral-500" : "text-white"}`}>{chapterLabel}</p>
              </div>

              <div className="ml-2 flex shrink-0 items-center gap-1.5 text-xs text-gray-400 sm:gap-2 sm:text-sm">
                <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>{publishedLabel}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {hasMore ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount(filteredRows.length)}
            className="rounded-full border border-amber-500/40 bg-amber-500/10 px-5 py-2.5 text-sm font-semibold text-amber-300 transition hover:border-amber-400 hover:bg-amber-500 hover:text-black"
          >
            {showMoreLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
