"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, List, ImageOff, RefreshCw } from "lucide-react";
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

interface HorizontalReaderImageProps {
  pageUrl: string;
  alt: string;
  dictionary: ReaderDictionary;
  pageSize: PageSize;
}

function HorizontalReaderImage({
  pageUrl,
  alt,
  dictionary,
  pageSize,
}: HorizontalReaderImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(pageUrl);
  const [isTall, setIsTall] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);

  // Sync state immediately in render phase when pageUrl changes to avoid showing the previous page's image
  const [prevPageUrl, setPrevPageUrl] = useState(pageUrl);
  if (pageUrl !== prevPageUrl) {
    setPrevPageUrl(pageUrl);
    setLoaded(false);
    setFailed(false);
    setRetryCount(0);
    setCurrentSrc(pageUrl);
    setShowSkeleton(false);
  }

  useEffect(() => {
    if (loaded || failed) return;

    // Show skeleton only if the image takes longer than 120ms to load (prevents flickering for cached images)
    const timer = setTimeout(() => {
      setShowSkeleton(true);
    }, 120);

    return () => clearTimeout(timer);
  }, [currentSrc, loaded, failed]);

  return (
    <div className="relative w-full h-full min-h-[50vh] sm:min-h-[70vh] flex justify-center items-center">
      {/* Premium Skeleton Placeholder */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0a0a0c] transition-opacity duration-200 ease-out pointer-events-none rounded-2xl
          ${loaded && !failed ? "opacity-0" : showSkeleton ? "opacity-100" : "opacity-0"}`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0e0f14] via-[#14151c] to-[#0e0f14] animate-pulse rounded-2xl" />
        <div className="absolute inset-0 bg-amber-500/5 blur-2xl animate-pulse" />
        <div className="relative flex flex-col items-center gap-3 z-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/10 border-t-amber-500" />
          <span className="text-[9px] uppercase tracking-[0.25em] text-gray-600/90 font-black select-none">MangaStoon</span>
        </div>
      </div>

      {failed ? (
        <div className="relative z-20 flex min-h-[40vh] flex-col items-center justify-center gap-4 bg-[#0d0e12] border border-white/5 rounded-2xl p-6 text-center shadow-lg">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <ImageOff className="h-5 w-5" />
          </div>
          <div className="max-w-xs">
            <h4 className="text-xs font-bold text-white">Error de carga</h4>
            <p className="mt-1 text-[10px] leading-relaxed text-gray-400">
              No pudimos cargar esta página. El servidor puede estar saturado.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setLoaded(false);
              setRetryCount(0);
              setCurrentSrc(withImageRetryParam(pageUrl, 0));
              setShowSkeleton(false);
            }}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2 text-[10px] font-bold text-black shadow-md hover:from-amber-400 hover:to-yellow-400 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Reintentar</span>
          </button>
        </div>
      ) : (
        <img
          src={currentSrc}
          alt={alt}
          onLoad={(e) => {
            setLoaded(true);
            const img = e.currentTarget;
            if (img.naturalHeight && img.naturalWidth) {
              setIsTall(img.naturalHeight > img.naturalWidth * 1.25);
            }
          }}
          onError={() => {
            if (retryCount < MAX_IMAGE_RETRIES) {
              const nextRetry = retryCount + 1;
              setRetryCount(nextRetry);
              setLoaded(false);
              setFailed(false);
              setCurrentSrc(withImageRetryParam(pageUrl, nextRetry));
              return;
            }
            setLoaded(true);
            setFailed(true);
          }}
          className={`select-none shadow-2xl rounded-xl mx-auto block transition-all duration-150 ${
            isTall
              ? `w-full ${HORIZONTAL_PAGE_SIZE_CLASSES[pageSize]} h-auto`
              : `max-h-[calc(100vh-200px)] w-auto max-w-full object-contain`
          } ${loaded ? "opacity-100" : "opacity-0"}`}
          loading="eager"
          decoding="sync"
          referrerPolicy="no-referrer"
          draggable={false}
        />
      )}
    </div>
  );
}

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

  return (
    <div className="relative mx-auto w-full max-w-5xl select-none overflow-hidden" ref={containerRef}>
      {/* Page container with tap zones (swipe disabled for zoom capability) */}
      <div
        className="relative w-full min-h-[50vh] sm:min-h-[70vh] cursor-pointer rounded-2xl bg-black/5"
        onClick={handleTapZone}
        role="img"
        aria-label={`${dictionary.page} ${currentPage + 1} - ${chapterLabel}`}
      >
        <motion.div
          className="flex w-full"
          animate={{ x: `-${currentPage * 100}%` }}
          transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
        >
          {pages.map((pageUrl, index) => {
            const isNear = Math.abs(index - currentPage) <= 1;
            return (
              <div
                key={index}
                className="w-full flex-shrink-0 flex justify-center items-center min-h-[50vh] sm:min-h-[70vh] relative"
              >
                {isNear ? (
                  <HorizontalReaderImage
                    pageUrl={pageUrl}
                    alt={`${dictionary.page} ${index + 1} - ${chapterLabel}`}
                    dictionary={dictionary}
                    pageSize={pageSize}
                  />
                ) : (
                  <div className="w-full h-full min-h-[50vh] flex justify-center items-center bg-[#0a0a0c] rounded-2xl">
                    <div className="relative flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/10 border-t-amber-500" />
                      <span className="text-[9px] uppercase tracking-[0.25em] text-gray-600/90 font-black select-none">MangaStoon</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </motion.div>
      </div>

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

      {/* Floating Control Bar Dock de Alta Gama */}
      <div 
        className="fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-amber-500/10 bg-[#0a0a0c]/95 px-4.5 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl ring-1 ring-white/5 bottom-6 opacity-100 pointer-events-auto"
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
