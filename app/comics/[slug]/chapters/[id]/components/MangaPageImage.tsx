"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";

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

interface MangaPageImageProps {
  pageUrl: string;
  alt: string;
  priority: boolean;
  retryVersion?: number;
  onRetrySubsequent?: () => void;
  pageIndex: number;
}

export default function MangaPageImage({
  pageUrl,
  alt,
  priority,
  retryVersion = 0,
  onRetrySubsequent,
  pageIndex,
}: MangaPageImageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(priority);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(pageUrl);
  const [retryCount, setRetryCount] = useState(0);
  const [zoomLevel, setZoomLevel] = useState<1 | 1.5 | 2>(1);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setShouldLoad(priority);
    setCurrentSrc(pageUrl);
    setRetryCount(0);
    setZoomLevel(1);
  }, [pageUrl, priority]);

  useEffect(() => {
    if (retryVersion > 0) {
      setFailed(false);
      setLoaded(false);
      setRetryCount(0);
      setCurrentSrc(withImageRetryParam(pageUrl, 0));
    }
  }, [retryVersion, pageUrl]);

  useEffect(() => {
    if (shouldLoad) return;

    const element = containerRef.current;
    if (!element) return;

    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "1200px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [shouldLoad]);

  const cycleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel((prev) => {
      if (prev === 1) return 1.5;
      if (prev === 1.5) return 2;
      return 1;
    });
  };

  const handleDoubleClick = () => {
    setZoomLevel((prev) => {
      if (prev === 1) return 1.5;
      if (prev === 1.5) return 2;
      return 1;
    });
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-[#0a0a0c] min-h-[50vh] sm:min-h-[70vh] flex justify-center ${
        zoomLevel > 1 ? "overflow-x-auto custom-scrollbar scrollbar-hide" : "overflow-hidden"
      }`}
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 1000px" }}
      data-page-index={pageIndex}
    >
      {/* Premium Skeleton Placeholder (LQIP/Shimmer simulation) */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0a0a0c] transition-opacity duration-500 ease-out pointer-events-none
          ${loaded ? "opacity-0" : "opacity-100"}`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0e0f14] via-[#14151c] to-[#0e0f14] animate-pulse" />
        <div className="absolute inset-0 bg-amber-500/5 blur-2xl animate-pulse" />
        <div className="relative flex flex-col items-center gap-3 z-20">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-500/10 border-t-amber-500" />
          <span className="text-[9px] uppercase tracking-[0.25em] text-gray-600/90 font-black select-none">MangaStoon</span>
        </div>
      </div>

      {failed ? (
        <div className="relative z-20 flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-[#0d0e12] border border-white/5 rounded-2xl m-4 p-6 text-center shadow-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <ImageOff className="h-6 w-6" />
          </div>
          <div className="max-w-xs">
            <h4 className="text-sm font-bold text-white">Error de carga</h4>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              No pudimos cargar esta página. El servidor del catálogo puede estar saturado.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onRetrySubsequent) {
                onRetrySubsequent();
              } else {
                setFailed(false);
                setLoaded(false);
                setRetryCount(0);
                setCurrentSrc(withImageRetryParam(pageUrl, 0));
              }
            }}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2 text-xs font-bold text-black shadow-md hover:from-amber-400 hover:to-yellow-400 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reintentar y siguientes</span>
          </button>
        </div>
      ) : shouldLoad ? (
        <img
          src={currentSrc}
          alt={alt}
          onDoubleClick={handleDoubleClick}
          style={{ width: zoomLevel === 1 ? "100%" : `${zoomLevel * 100}%` }}
          className={`block h-auto transition-all duration-300 ease-out select-none ${
            zoomLevel === 1 ? "w-full cursor-zoom-in" : "max-w-none cursor-zoom-out"
          } ${loaded || priority ? "opacity-100" : "opacity-0"}`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
          referrerPolicy="no-referrer"
          ref={(el) => {
            if (el && el.complete && el.naturalWidth > 0 && !loaded) {
              setLoaded(true);
            }
          }}
          onLoad={() => setLoaded(true)}
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
        />
      ) : null}

      {loaded && !failed && (
        <button
          type="button"
          onClick={cycleZoom}
          className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-heading font-bold text-white border border-white/10 shadow-lg backdrop-blur-md transition-all hover:bg-black/90 active:scale-95 cursor-pointer select-none"
        >
          {zoomLevel === 1 ? <ZoomIn size={12} className="text-[#ff6b00]" /> : <ZoomOut size={12} className="text-amber-500" />}
          <span>{zoomLevel}x</span>
        </button>
      )}
    </div>
  );
}
