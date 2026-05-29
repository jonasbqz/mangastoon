"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, List } from "lucide-react";
import type { PageSize } from "../../../../../store/useReaderSettingsStore";
import type { ReaderDictionary } from "../reader-client";

const SWIPE_THRESHOLD = 50;
const MAX_IMAGE_RETRIES = 3;

function withImageRetryParam(src: string, retry: number) {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return src;

  const retryValue = `${retry}_${Date.now()}`;

  try {
    const url = new URL(src, window.location.origin);
    url.searchParams.set("retry", retryValue);
    return src.startsWith("/") ? `${url.pathname}${url.search}${url.hash}` : url.toString();
  } catch {
    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}retry=${retryValue}`;
  }
}

interface HorizontalReaderProps {
  pages: string[];
  dictionary: ReaderDictionary;
  chapterLabel: string;
  onNextChapter: () => void;
  onPreviousChapter: () => void;
  hasNextChapter: boolean;
  hasPreviousChapter: boolean;
  onList: () => void;
  mangaId: string;
  chapterId: string;
  pageSize: PageSize;
  isReaderUiVisible: boolean;
  showControlsUI: boolean;
}

const HORIZONTAL_PAGE_SIZE_CLASSES: Record<PageSize, string> = {
  small: "max-w-xl",
  medium: "max-w-2xl",
  large: "max-w-4xl",
  full: "max-w-full",
};

export default function HorizontalReader({
  pages,
  dictionary,
  chapterLabel,
  onNextChapter,
  onPreviousChapter,
  hasNextChapter,
  hasPreviousChapter,
  onList,
  mangaId,
  chapterId,
  pageSize,
  isReaderUiVisible,
  showControlsUI,
}: HorizontalReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTall, setIsTall] = useState(false);

  useEffect(() => {
    setIsTall(false);
  }, [currentPage, pages]);

  // Reset page or load saved progress when chapter changes
  useEffect(() => {
    let initialPage = 0;
    try {
      const saved = localStorage.getItem(`mangastoon_last_page:${mangaId}:${chapterId}`);
      if (saved) {
        const pageIndex = parseInt(saved, 10);
        if (Number.isFinite(pageIndex) && pageIndex >= 0 && pageIndex < pages.length) {
          initialPage = pageIndex;
        }
      }
    } catch {}
    setCurrentPage(initialPage);
    setDirection(0);
  }, [pages, mangaId, chapterId]);

  // Persist current page to localStorage
  useEffect(() => {
    if (!pages || pages.length === 0) return;
    try {
      localStorage.setItem(`mangastoon_last_page:${mangaId}:${chapterId}`, String(currentPage));
    } catch {}
  }, [currentPage, mangaId, chapterId, pages.length]);

  // Scroll to top on page or pages change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [currentPage, pages]);

  // Pre-load adjacent pages to browser cache using Image object
  useEffect(() => {
    if (!pages || pages.length === 0) return;

    // Preload the next 3 pages and the previous page for smooth navigation
    const indicesToPreload = [
      currentPage + 1,
      currentPage + 2,
      currentPage + 3,
      currentPage - 1
    ];

    indicesToPreload.forEach((index) => {
      if (index >= 0 && index < pages.length) {
        const url = pages[index];
        if (url) {
          const img = new Image();
          img.src = url;
        }
      }
    });
  }, [currentPage, pages]);

  // Hide tap hint after first interaction
  useEffect(() => {
    if (!showHint) return;
    const timer = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(timer);
  }, [showHint]);

  const goToPage = useCallback((page: number) => {
    if (page < 0) {
      if (hasPreviousChapter) onPreviousChapter();
      return;
    }
    if (page >= pages.length) {
      if (hasNextChapter) onNextChapter();
      return;
    }
    setDirection(page > currentPage ? 1 : -1);
    setCurrentPage(page);
    setShowHint(false);
  }, [currentPage, pages.length, hasNextChapter, hasPreviousChapter, onNextChapter, onPreviousChapter]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "SELECT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goToPage(currentPage + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPage(currentPage - 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, goToPage]);

  // Touch/swipe handlers
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  // Swipe logic
  function handleTouchEnd(e: React.TouchEvent) {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);

    if (Math.abs(deltaX) > SWIPE_THRESHOLD && deltaY < Math.abs(deltaX) * 0.7) {
      if (deltaX < 0) {
        goToPage(currentPage + 1);
      } else {
        goToPage(currentPage - 1);
      }
    }
  }

  // Tap zone handler
  function handleTapZone(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const zoneWidth = rect.width / 3;

    if (x < zoneWidth) {
      goToPage(currentPage - 1);
    } else if (x > zoneWidth * 2) {
      goToPage(currentPage + 1);
    }
  }

  const pageUrl = pages[currentPage] ?? "";

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? "60%" : "-60%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? "-60%" : "60%", opacity: 0 }),
  };

  return (
    <div className="relative mx-auto w-full max-w-5xl select-none" ref={containerRef}>
      {/* Page container with tap zones and swipe */}
      <div
        className={`relative flex justify-center w-full min-h-[50vh] sm:min-h-[70vh] cursor-pointer rounded-2xl bg-black/5 transition-all duration-300 ${isTall ? "items-start pt-4" : "items-center"}`}
        onClick={handleTapZone}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="img"
        aria-label={`${dictionary.page} ${currentPage + 1} - ${chapterLabel}`}
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img
            key={`${pageUrl}-${currentPage}`}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeOut" }}
            src={pageUrl}
            alt={`${dictionary.page} ${currentPage + 1} - ${chapterLabel}`}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalHeight && img.naturalWidth) {
                setIsTall(img.naturalHeight > img.naturalWidth * 1.25);
              }
            }}
            className={`select-none shadow-2xl rounded-xl mx-auto block transition-all duration-300 ${
              isTall
                ? `w-full ${HORIZONTAL_PAGE_SIZE_CLASSES[pageSize]} h-auto`
                : `max-h-[calc(100vh-200px)] w-auto max-w-full object-contain`
            }`}
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            draggable={false}
          />
        </AnimatePresence>

        {/* Tap zone visual hints */}
        <AnimatePresence>
          {showHint && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-4"
            >
              <div className="flex h-full w-1/4 items-center justify-center">
                <span className="rounded-full bg-black/60 p-3 text-white/70 backdrop-blur-sm">
                  <ArrowLeft size={20} />
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="rounded-lg bg-black/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/60 backdrop-blur-sm">
                  {dictionary.tapHint}
                </span>
              </div>
              <div className="flex h-full w-1/4 items-center justify-center">
                <span className="rounded-full bg-black/60 p-3 text-white/70 backdrop-blur-sm">
                  <ArrowRight size={20} />
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Control Bar Dock de Alta Gama */}
      <div 
        className={`fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-amber-500/10 bg-[#0a0a0c]/95 px-4.5 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl ring-1 ring-white/5 transition-all duration-300
          ${(isReaderUiVisible && showControlsUI) ? "bottom-6 opacity-100 pointer-events-auto" : "-bottom-20 opacity-0 pointer-events-none"}`}
      >
        {/* Previous Page */}
        <button
          type="button"
          disabled={currentPage === 0 && !hasPreviousChapter}
          onClick={() => goToPage(currentPage - 1)}
          className="flex h-9.5 w-9.5 items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-amber-500 disabled:opacity-20 disabled:pointer-events-none transition-all duration-200 active:scale-90"
          title={dictionary.previousPage}
        >
          <ArrowLeft size={16} />
        </button>

        {/* Page indicator Píldora Dorada Premium */}
        <div className="mx-2 text-xs font-black tracking-widest text-amber-500/90 min-w-[3.8rem] text-center select-none bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
          {currentPage + 1} / {pages.length}
        </div>

        {/* Next Page */}
        <button
          type="button"
          disabled={currentPage === pages.length - 1 && !hasNextChapter}
          onClick={() => goToPage(currentPage + 1)}
          className="flex h-9.5 w-9.5 items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-amber-500 disabled:opacity-20 disabled:pointer-events-none transition-all duration-200 active:scale-90"
          title={dictionary.nextPage}
        >
          <ArrowRight size={16} />
        </button>

        <div className="w-[1px] h-5 bg-white/15 mx-1" />

        {/* Previous Chapter */}
        <button
          type="button"
          disabled={!hasPreviousChapter}
          onClick={onPreviousChapter}
          className="flex h-9.5 w-9.5 items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-amber-400 disabled:opacity-20 disabled:pointer-events-none transition-all duration-200 active:scale-90"
          title={dictionary.previousChapter}
        >
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m11 17-5-5 5-5" />
            <path d="m18 17-5-5 5-5" />
          </svg>
        </button>

        {/* Chapter List dropdown/button */}
        <button
          type="button"
          onClick={onList}
          className="flex h-9.5 w-9.5 items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-amber-400 transition-all duration-200 active:scale-90"
          title={dictionary.chapterList}
        >
          <List size={16} />
        </button>

        {/* Next Chapter */}
        <button
          type="button"
          disabled={!hasNextChapter}
          onClick={onNextChapter}
          className="flex h-9.5 w-9.5 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:brightness-110 disabled:bg-white/5 disabled:text-gray-600 transition-all duration-200 active:scale-90 shadow-lg shadow-amber-500/25"
          title={dictionary.nextChapter}
        >
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m13 17 5-5-5-5" />
            <path d="m6 17 5-5-5-5" />
          </svg>
        </button>
      </div>

      {/* Preload adjacent pages */}
      {pages[currentPage + 1] && (
        <link rel="preload" as="image" href={pages[currentPage + 1]} />
      )}
      {pages[currentPage - 1] && currentPage > 0 && (
        <link rel="preload" as="image" href={pages[currentPage - 1]} />
      )}
      {pages[currentPage + 2] && (
        <link rel="preload" as="image" href={pages[currentPage + 2]} />
      )}
      {pages[currentPage + 3] && (
        <link rel="preload" as="image" href={pages[currentPage + 3]} />
      )}
    </div>
  );
}
