"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SupportedLanguage } from "./site-header";
import { useLanguage } from "./language-provider";
import { getLocalizedTitle } from "../utils/get-localized-title";
import { buildComicPath } from "../utils/slugify";

type HeroMangaItem = {
  mal_id: number;
  title: string;
  synopsis: string | null;
  score: number | null;
  url: string;
  mangaDexId: string | null;
  titleMap?: Record<string, string>;
  altTitles?: Record<string, string>[];
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
  genres?: Array<{
    mal_id: number;
    name: string;
  }>;
};

const UI_COPY: Record<
  SupportedLanguage,
  {
    featured: string;
    readNow: string;
    viewDetails: string;
  }
> = {
  es: {
    featured: "Serie destacada",
    readNow: "Leer ahora",
    viewDetails: "Ver ficha",
  },
  en: {
    featured: "Featured series",
    readNow: "Read now",
    viewDetails: "View details",
  },
  pt: {
    featured: "Serie em destaque",
    readNow: "Ler agora",
    viewDetails: "Ver detalhes",
  },
};

const GENRE_TRANSLATIONS: Record<
  string,
  {
    es: string;
    en: string;
    pt: string;
  }
> = {
  Action: { es: "Accion", en: "Action", pt: "Acao" },
  Adventure: { es: "Aventura", en: "Adventure", pt: "Aventura" },
  Comedy: { es: "Comedia", en: "Comedy", pt: "Comedia" },
  Drama: { es: "Drama", en: "Drama", pt: "Drama" },
  Fantasy: { es: "Fantasia", en: "Fantasy", pt: "Fantasia" },
  Horror: { es: "Horror", en: "Horror", pt: "Horror" },
  Romance: { es: "Romance", en: "Romance", pt: "Romance" },
  "Sci-Fi": { es: "Sci-Fi", en: "Sci-Fi", pt: "Sci-Fi" },
  "Slice of Life": { es: "Slice of Life", en: "Slice of Life", pt: "Slice of Life" },
  Sports: { es: "Deportes", en: "Sports", pt: "Esportes" },
};

function getImageUrl(manga: HeroMangaItem) {
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

function RetryableHeroImage({
  src,
  alt,
  active,
  eager,
}: {
  src: string;
  alt: string;
  active: boolean;
  eager: boolean;
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
      sizes="100vw"
      className={`object-cover blur-3xl scale-150 transition-opacity duration-1000 ease-in-out ${
        active ? "z-0 opacity-30" : "z-0 opacity-0"
      }`}
      loading={eager ? "eager" : "lazy"}
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

function getShortSynopsis(text: string | null | undefined, maxLength = 260) {
  const cleaned = text?.replace(/\[Written by MAL Rewrite\]/g, "").trim();

  if (!cleaned) {
    return "A standout manga ready to be discovered on Mangastoon.";
  }

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength).trim()}...`;
}

function translateGenre(name: string, language: SupportedLanguage) {
  return GENRE_TRANSLATIONS[name]?.[language] ?? name;
}

export default function HeroCarousel({
  mangas,
  language,
}: {
  mangas: HeroMangaItem[];
  language: SupportedLanguage;
}) {
  const { language: currentLang } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const copy = UI_COPY[language];

  useEffect(() => {
    if (mangas.length <= 1) return;

    const interval = window.setInterval(() => {
      setCurrentIndex((current) => (current + 1) % mangas.length);
    }, 6000);

    return () => window.clearInterval(interval);
  }, [mangas.length]);

  const currentManga = useMemo(() => mangas[currentIndex], [currentIndex, mangas]);

  if (!currentManga) {
    return null;
  }

  function goToPrevious() {
    setCurrentIndex((current) => (current === 0 ? mangas.length - 1 : current - 1));
  }

  function goToNext() {
    setCurrentIndex((current) => (current + 1) % mangas.length);
  }

  return (
    <section className="relative h-[70vh] min-h-[500px] overflow-hidden bg-[#141519]">
      <div className="absolute inset-0">
        {mangas.map((manga, index) => {
          const imageUrl = getImageUrl(manga);

          if (!imageUrl) {
            return null;
          }

          return (
          <div key={manga.mangaDexId ?? manga.mal_id} className="absolute inset-0">
            <RetryableHeroImage
              src={imageUrl}
              alt={manga.title}
              active={index === currentIndex}
              eager={index === 0}
            />
          </div>
        );
        })}

        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#141519] via-[#141519]/60 to-transparent" />
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-[#141519] via-[#141519]/80 to-transparent" />
      </div>

      <div className="relative mx-auto flex h-[70vh] min-h-[500px] max-w-[1600px] items-end px-4 pb-28 pt-24 md:px-8">
        {mangas.map((manga, index) => (
          <div
            key={manga.mangaDexId ?? manga.mal_id}
            className={`absolute inset-x-4 bottom-28 max-w-3xl transition-all duration-1000 ease-out md:inset-x-8 ${
              index === currentIndex ? "z-20 translate-y-0 opacity-100" : "z-0 translate-y-4 opacity-0"
            }`}
          >
            <div className="mb-4 flex items-center gap-4">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-orange-500">
                {copy.featured}
              </p>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={goToPrevious}
                  className="text-white/70 transition-colors hover:text-white"
                  aria-label="Destacado anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={goToNext}
                  className="text-white/70 transition-colors hover:text-white"
                  aria-label="Destacado siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                <span className="h-4 w-px bg-white/20" />

                <div className="flex items-center gap-2">
                  {mangas.map((dotManga, dotIndex) => (
                    <button
                      key={dotManga.mangaDexId ?? dotManga.mal_id}
                      type="button"
                      onClick={() => setCurrentIndex(dotIndex)}
                      className={`h-2.5 rounded-full transition-all ${
                        dotIndex === currentIndex
                          ? "w-8 bg-orange-500"
                          : "w-2.5 bg-white/40 hover:bg-white/70"
                      }`}
                      aria-label={`Mostrar destacado ${dotIndex + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <h1 className="max-w-2xl text-5xl font-bold leading-none text-white md:text-7xl">
              {getLocalizedTitle(manga, currentLang)}
            </h1>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-gray-200 md:text-base">
              {getShortSynopsis(manga.synopsis)}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {(manga.genres ?? []).slice(0, 4).map((genre) => (
                <Link
                  key={genre.mal_id}
                  href={`/explore?genres=${genre.mal_id}`}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-200 transition-colors hover:bg-white/20"
                >
                  {translateGenre(genre.name, language)}
                </Link>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              {manga.mangaDexId ? (
                <Link
                  href={buildComicPath(getLocalizedTitle(manga, currentLang), manga.mangaDexId)}
                  className="inline-flex items-center rounded-full bg-orange-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black transition hover:bg-orange-400"
                >
                  {copy.viewDetails}
                </Link>
              ) : (
                <a
                  href={manga.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full bg-orange-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black transition hover:bg-orange-400"
                >
                  {copy.viewDetails}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
