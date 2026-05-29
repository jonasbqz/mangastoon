"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, ArrowRight, List, Download, Crown } from "lucide-react";
import ShareButton from "../../../../../components/ShareButton";
import type { ChapterFeedItem, ReaderDictionary, ReaderTheme } from "../reader-client";

// Import mapping block colors
const THEME_CLASSES = {
  dark: { border: "border-white/5", headerBg: "bg-[#0a0a0c]/85" },
  amoled: { border: "border-neutral-800", headerBg: "bg-black/85" },
  sepia: { border: "border-[#e4dcc8]", headerBg: "bg-[#f4ecd8]/90" },
  light: { border: "border-neutral-200", headerBg: "bg-white/90" },
  gray: { border: "border-white/5", headerBg: "bg-[#1a1b20]/85" }
};

interface ReaderHeaderProps {
  isAtTop: boolean;
  scrollDirection: "up" | "down";
  readingMode: string;
  loading: boolean;
  error: string;
  readerTheme: ReaderTheme;
  routeSlug: string;
  mangaTitle: string;
  isPremium: boolean;
  currentChapter: ChapterFeedItem | null;
  dictionary: ReaderDictionary;
  previousChapter: ChapterFeedItem | null;
  nextChapter: ChapterFeedItem | null;
  handleChapterNavigation: (chapterId: string) => void;
  openChapterList: () => void;
  setShowPdfModal: (show: boolean) => void;
  downloading: boolean;
  pagesCount: number;
}

export default function ReaderHeader({
  isAtTop,
  scrollDirection,
  readingMode,
  loading,
  error,
  readerTheme,
  routeSlug,
  mangaTitle,
  isPremium,
  currentChapter,
  dictionary,
  previousChapter,
  nextChapter,
  handleChapterNavigation,
  openChapterList,
  setShowPdfModal,
  downloading,
  pagesCount,
}: ReaderHeaderProps) {
  const getChapterLabel = (chapter: ChapterFeedItem | null) => {
    if (!chapter) return `${dictionary.chapter} 1`;
    return chapter.attributes?.chapter
      ? `${dictionary.chapter} ${chapter.attributes.chapter}`
      : `${dictionary.chapter} 1`;
  };

  const themeStyle = THEME_CLASSES[readerTheme] || THEME_CLASSES.dark;

  return (
    <>
      {!isAtTop && scrollDirection === "up" && readingMode !== "horizontal" && !loading && !error && (
        <motion.header
          initial={{ opacity: 0, y: -60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -60 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`fixed left-0 right-0 top-0 z-40 border-b ${themeStyle.border} ${themeStyle.headerBg} px-4 py-3 backdrop-blur-xl shadow-lg shadow-black/20 transition-colors duration-300`}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href={`/comics/${routeSlug}`}
                className="group flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/25 bg-amber-500/10 text-amber-500 backdrop-blur transition-all hover:border-amber-500/50 hover:bg-amber-500 hover:text-black"
                title={dictionary.backToSeries}
              >
                <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
              </Link>
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 truncate text-xs font-bold text-amber-500">
                  {mangaTitle}
                  {isPremium && (
                    <Crown size={12} className="fill-amber-500 text-amber-500 shrink-0" />
                  )}
                </h3>
                <p className="truncate text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  {getChapterLabel(currentChapter)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!previousChapter}
                onClick={() => previousChapter && handleChapterNavigation(previousChapter.id)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-gray-400 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title={dictionary.previousChapter}
              >
                <ArrowLeft size={16} />
              </button>

              <button
                type="button"
                onClick={openChapterList}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-white/5 bg-white/[0.03] px-3 text-xs font-semibold text-gray-300 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400 transition-colors"
              >
                <List size={14} />
                <span className="hidden sm:inline">{dictionary.chapterList}</span>
              </button>

              <button
                type="button"
                disabled={!nextChapter}
                onClick={() => nextChapter && handleChapterNavigation(nextChapter.id)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-gray-400 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title={dictionary.nextChapter}
              >
                <ArrowRight size={16} />
              </button>

              <ShareButton
                title={`${mangaTitle} - ${getChapterLabel(currentChapter)}`}
                variant="icon"
                label="Compartir"
              />

              <div className="w-[1px] h-5 bg-white/10 mx-1" />

              <button
                type="button"
                onClick={() => setShowPdfModal(true)}
                disabled={downloading || pagesCount === 0}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-3 text-xs font-bold text-black shadow-md hover:from-amber-400 hover:to-yellow-400 transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                <Download size={14} />
                <span className="hidden md:inline">PDF</span>
              </button>
            </div>
          </div>
        </motion.header>
      )}
    </>
  );
}
