"use client";

import { BookOpen, Clock, Flame, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "./language-provider";
import { getLocalizedTitle } from "../utils/get-localized-title";
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
  genres?: Array<{
    mal_id: number;
    name: string;
  }>;
  isNsfw?: boolean;
  latestChapters?: { chapter: string; timeAgo: string; publishedAt?: string | null }[];
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
  latestChapters?: { chapter: string; timeAgo: string; publishedAt?: string | null }[];
};

const PRIORITY_TAGS = [
  "Isekai",
  "Spokon",
  "Mahou Shoujo",
  "Magic",
  "Cyberpunk",
  "Samurai",
  "Steampunk",
  "Post-Apocalyptic",
] as const;

function getImageUrl(manga: MangaShowcaseItem) {
  return (
    manga.images?.webp?.large_image_url ??
    manga.images?.jpg?.large_image_url ??
    manga.images?.webp?.image_url ??
    manga.images?.jpg?.image_url ??
    ""
  );
}

function getComicTypeBadge(originalLanguage?: string) {
  if (originalLanguage === "ko") {
    return "KR Manhwa";
  }

  if (originalLanguage === "zh") {
    return "CN Manhua";
  }

  if (originalLanguage === "ja") {
    return "JP Manga";
  }

  return "Lectura destacada";
}

function getPriorityTag(tags?: string[]) {
  if (!tags || tags.length === 0) {
    return null;
  }

  const normalizedTags = tags.map((tag) => ({
    raw: tag,
    normalized: tag.toLowerCase(),
  }));

  for (const priorityTag of PRIORITY_TAGS) {
    const match = normalizedTags.find(
      (tag) => tag.normalized === priorityTag.toLowerCase()
    );

    if (match) {
      return match.raw;
    }
  }

  return null;
}

export function MangaCard({
  manga,
  variant = "carousel",
  isFeatured = false,
  showChapters = false,
  latestChapters,
}: MangaCardProps) {
  const { language } = useLanguage();
  const displayTitle = getLocalizedTitle(manga, language);
  const href = manga.mangaDexId ? `/manga/${manga.mangaDexId}` : manga.url;
  const imageUrl = getImageUrl(manga);
  const subtitle = manga.genres?.[0]?.name ?? getComicTypeBadge(manga.originalLanguage);
  const themeTag = getPriorityTag(manga.themes);
  const sizeClass = variant === "grid"
    ? "w-full"
    : isFeatured
      ? "w-[200px] md:w-[260px]"
      : "w-[140px] md:w-[190px]";

  const cardLinkClass = "block";
  const cardHref = href;
  const isInternal = Boolean(manga.mangaDexId);

  const imageContent = (
    <>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={displayTitle}
          fill
          sizes="(max-width: 768px) 150px, 200px"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          loading="lazy"
          unoptimized={true}
        />
      ) : null}

      {themeTag ? (
        <span className="absolute left-2 top-2 z-10 rounded bg-black/80 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-400">
          {themeTag}
        </span>
      ) : null}

      {manga.isNsfw ? (
        <span className="absolute right-12 top-2 z-10 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white shadow-[0_0_10px_rgba(244,63,94,0.5)]">
          +18
        </span>
      ) : null}

      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="absolute inset-0 z-20 flex items-center justify-center">
        <div className="translate-y-4 scale-95 rounded-full bg-[#141519]/90 p-4 text-orange-500 opacity-0 shadow-2xl backdrop-blur-md transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100">
          <BookOpen size={24} strokeWidth={2} />
        </div>
      </div>
    </>
  );

  return (
    <article className={`group flex flex-col ${sizeClass} shrink-0 cursor-pointer snap-start`}>
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-[#141519] shadow-lg ring-1 ring-white/5 transition-all duration-300 group-hover:ring-orange-500/50 group-hover:shadow-[0_0_20px_rgba(249,115,22,0.25)]">
        {isInternal ? (
          <Link href={cardHref} className={cardLinkClass}>
            {imageContent}
          </Link>
        ) : (
          <a href={cardHref} target="_blank" rel="noreferrer" className={cardLinkClass}>
            {imageContent}
          </a>
        )}

        <FavoriteButton manga={manga} />
      </div>

      <div className="mt-3 flex flex-col px-1">
        {isInternal ? (
          <Link href={cardHref} className="min-w-0">
            <h3 className="truncate text-sm font-bold text-white transition-colors duration-300 group-hover:text-orange-500 md:text-base">
              {displayTitle}
            </h3>
          </Link>
        ) : (
          <a href={cardHref} target="_blank" rel="noreferrer" className="min-w-0">
            <h3 className="truncate text-sm font-bold text-white transition-colors duration-300 group-hover:text-orange-500 md:text-base">
              {displayTitle}
            </h3>
          </a>
        )}
        <span className="mt-0.5 truncate text-[11px] text-gray-400 md:text-xs">{subtitle}</span>

        {/* SECCION DE CAPITULOS (Solo se muestra si showChapters es true y hay datos) */}
        {showChapters && latestChapters && latestChapters.length > 0 && (
          <div className="mt-2.5 flex flex-col gap-1.5 px-1">

            {/* RECORD 1: Capitulo mas reciente */}
            {latestChapters[0] && (
              <div className="flex items-center justify-between rounded-md border border-orange-500/30 bg-orange-500/10 p-1.5 text-[10px] font-medium text-orange-400 md:text-xs">
                <div className="flex items-center gap-1.5">
                  <Zap size={12} strokeWidth={2.5} />
                  <span>Cap. {latestChapters[0].chapter}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Flame size={12} />
                  <span>{latestChapters[0].timeAgo}</span>
                </div>
              </div>
            )}

            {/* RECORD 2: Capitulo anterior (Estilo Oscuro Neutro) */}
            {latestChapters[1] && (
              <div className="flex items-center justify-between rounded-md border border-orange-500/25 bg-orange-500/[0.04] p-1.5 text-[10px] font-medium text-orange-200/80 md:text-xs">
                <span className="ml-1">Cap. {latestChapters[1].chapter}</span>
                <div className="flex items-center gap-1 text-orange-300/60">
                  <Clock size={12} />
                  <span>{latestChapters[1].timeAgo}</span>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </article>
  );
}

export default MangaCard;
