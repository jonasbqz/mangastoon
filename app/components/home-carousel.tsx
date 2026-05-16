"use client";

import { BookOpen } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "./language-provider";
import { getLocalizedTitle } from "../utils/get-localized-title";
import { buildChapterPath, buildComicPath } from "../utils/slugify";
import FavoriteButton from "./FavoriteButton";

export type MangaShowcaseItem = {
  mal_id: number;
  title: string;
  score: number | null;
  url: string;
  mangaDexId: string | null;
  titleMap?: Record<string, string>;
  altTitles?: Record<string, string>[];
  originalLanguage?: string;
  themes?: string[];
  tags?: string[];
  featuredTag?: string | null;
  createdAt?: string | null;
  genres?: Array<{
    mal_id: number;
    name: string;
  }>;
  isLocal?: boolean;
  isNsfw?: boolean;
  latestChapters?: { id?: string | null; chapter: string; timeAgo: string; publishedAt?: string | null }[];
  images: {
    webp?: {
      large_image_url?: string | null;
      image_url?: string | null;
    };
    jpg?: {
      large_image_url?: string | null;
      image_url?: string | null;
    };
  };
};

type MangaCardProps = {
  manga: MangaShowcaseItem;
  variant?: "carousel" | "grid";
  isFeatured?: boolean;
  showChapters?: boolean;
  latestChapters?: { id?: string | null; chapter: string; timeAgo: string; publishedAt?: string | null }[];
  priorityImage?: boolean;
};

function getImageUrl(manga: MangaShowcaseItem) {
  return (
    manga.images?.webp?.large_image_url ??
    manga.images?.jpg?.large_image_url ??
    manga.images?.webp?.image_url ??
    manga.images?.jpg?.image_url ??
    ""
  );
}

const MAX_IMAGE_RETRIES = 3;

function withImageRetryParam(src: string, retry: number) {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return src;

  try {
    const url = new URL(src, window.location.origin);
    url.searchParams.set("retry", String(retry));
    return src.startsWith("/") ? `${url.pathname}${url.search}${url.hash}` : url.toString();
  } catch {
    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}retry=${retry}`;
  }
}

function RetryableCoverImage({
  src,
  alt,
  priorityImage,
}: {
  src: string;
  alt: string;
  priorityImage: boolean;
}) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setCurrentSrc(src);
    setRetryCount(0);
  }, [src]);

  return (
    <Image
      src={currentSrc}
      alt={alt}
      fill
      sizes="(max-width: 768px) 150px, 200px"
      className="object-cover transition-transform duration-300 group-hover:scale-105"
      priority={priorityImage}
      loading={priorityImage ? undefined : "lazy"}
      unoptimized={true}
      referrerPolicy="no-referrer"
      onError={() => {
        if (retryCount >= MAX_IMAGE_RETRIES) return;
        const nextRetry = retryCount + 1;
        setRetryCount(nextRetry);
        setCurrentSrc(withImageRetryParam(src, nextRetry));
      }}
    />
  );
}

export function MangaCard({
  manga,
  variant = "carousel",
  isFeatured = false,
  showChapters = false,
  latestChapters,
  priorityImage = false,
}: MangaCardProps) {
  const { language } = useLanguage();
  const displayTitle = getLocalizedTitle(manga, language) || manga.title;
  const href = manga.mangaDexId ? buildComicPath(displayTitle, manga.mangaDexId) : manga.url;
  const imageUrl = getImageUrl(manga);
  const subtitle = manga.genres?.[0]?.name ?? "";
  const featuredTag = manga.featuredTag ?? null;
  const sizeClass = variant === "grid"
    ? "w-full"
    : isFeatured
      ? "w-[200px] md:w-[260px]"
      : "w-[140px] md:w-[190px]";

  const cardHref = href;
  const isInternal = Boolean(manga.mangaDexId);
  const mangaTitle = displayTitle;
  const mangaGenre = subtitle;
  const formatTag = featuredTag;
  const isAdultContent = manga.isNsfw;
  const visibleLatestChapters = latestChapters?.filter((chapter) => chapter.chapter?.trim());

  return (
    <article className={`${sizeClass} shrink-0 cursor-pointer snap-start transition-transform duration-300 hover:scale-[1.02]`}>
      <div className="group flex w-full flex-col">
        
        {/* CONTENEDOR DE IMAGEN */}
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-zinc-900 ring-1 ring-white/5 transition-all duration-300 group-hover:shadow-[0_0_26px_rgba(255,107,0,0.28)]">
          {isInternal ? (
            <Link href={cardHref} className="absolute inset-0 z-0">
              {imageUrl ? (
                <RetryableCoverImage
                  src={imageUrl}
                  alt={mangaTitle}
                  priorityImage={priorityImage}
                />
              ) : null}
            </Link>
          ) : (
            <a href={cardHref} target="_blank" rel="noreferrer" className="absolute inset-0 z-0">
              {imageUrl ? (
                <RetryableCoverImage
                  src={imageUrl}
                  alt={mangaTitle}
                  priorityImage={priorityImage}
                />
              ) : null}
            </a>
          )}
{/* ETIQUETA FORMATO - FONDO OSCURO TRANSLÚCIDO, TEXTO NARANJA */}
{formatTag && (
            <div className="absolute top-2 left-2 pointer-events-none z-10">
              <span className="bg-black/60 text-[#FF6B00] text-[9px] font-bold px-1.5 py-1.5 rounded-full uppercase tracking-wider">
                {formatTag}
              </span>
            </div>
          )}
          {/* BORDE HOVER - naranja desvanecido */}
          <div className="pointer-events-none absolute inset-0 z-[4] rounded-md opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="absolute inset-0 rounded-md bg-gradient-to-t from-[#FF6B00]/70 via-[#FF6B00]/20 to-transparent p-[1px]">
              <div className="h-full w-full rounded-[5px] bg-transparent" />
            </div>
          </div>

          {/* OVERLAY HOVER - desvanecido negro + icono de lectura */}
          <div className="pointer-events-none absolute inset-0 z-[5] bg-black/0 transition-colors duration-300 group-hover:bg-black/45" />
          <div className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="rounded-full border border-white/10 bg-[#141519]/90 p-3 text-[#FF6B00] shadow-[0_0_20px_rgba(0,0,0,0.8)] backdrop-blur-md transition-transform duration-300 group-hover:scale-100">
              <BookOpen size={24} strokeWidth={1.5} />
            </div>
          </div>

          {/* CONTROLES DERECHOS (CORAZÓN Y +18) */}
          <div className="absolute top-2 right-2 flex flex-col items-center gap-1.5 z-20">
            <FavoriteButton manga={manga} variant="compact" />

            {/* ETIQUETA +18 - FONDO OSCURO TRANSLÚCIDO, TEXTO ROJO */}
            {isAdultContent && (
             <span className="bg-red-600/80 !text-black text-[11px] font-bold px-1.5 py-0.5 rounded-full pointer-events-none">
             +18
           </span>
            )}
          </div>
        </div>

        {/* TEXTOS INFERIORES - JERARQUÍA ARREGLADA */}
        <div className="mt-2 flex flex-col px-0.5">
          {/* Título: Blanco y tamaño moderado */}
          <h3 className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-5 text-gray-100 md:text-sm" title={mangaTitle}>
            {mangaTitle}
          </h3>
          {/* Género: Miniatura y gris oscuro */}
          <p className="text-zinc-500 text-[10px] md:text-[11px] font-medium uppercase tracking-wider line-clamp-1 mt-0.5">
            {mangaGenre}
          </p>
          {showChapters && (visibleLatestChapters?.length ?? 0) > 0 ? (
            <div className="mt-2 space-y-1">
              {visibleLatestChapters?.slice(0, 2).map((chapter) => {
                const chapterHref =
                  manga.mangaDexId && chapter.id ? buildChapterPath(mangaTitle, manga.mangaDexId, chapter.id) : cardHref;

                return (
                  <Link
                    key={`${chapter.id ?? chapter.chapter}-${chapter.publishedAt ?? chapter.timeAgo}`}
                    href={chapterHref}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#ff6b00]/15 bg-black/35 px-2 py-1.5 transition hover:border-[#ff6b00]/45 hover:bg-[#ff6b00]/10"
                  >
                    <span className="line-clamp-1 text-[10px] font-bold text-orange-400 md:text-[11px]">
                      Cap. {chapter.chapter}
                    </span>
                    {chapter.timeAgo ? (
                      <span className="shrink-0 text-[9px] font-medium text-zinc-400 md:text-[10px]">
                        {chapter.timeAgo}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default MangaCard;
