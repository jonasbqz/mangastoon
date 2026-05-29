"use client";

import { Heart } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { toast } from "sonner";
import { useFavoritesStore, type FavoriteManga } from "../store/useFavoritesStore";
import { buildComicPath } from "../utils/slugify";

type FavoriteButtonProps = {
  manga?: FavoriteManga;
  mangaId?: string;
  title?: string;
  label?: string;
  variant?: "floating" | "inline" | "compact";
};

function buildFavoriteManga({ manga, mangaId, title }: FavoriteButtonProps): FavoriteManga | null {
  if (manga) {
    return manga;
  }

  if (!mangaId) {
    return null;
  }

  return {
    id: mangaId,
    mangaDexId: mangaId,
    title: title ?? "Manga",
    url: buildComicPath(title ?? "Manga", mangaId),
    titleMap: title ? { es: title, en: title, pt: title } : undefined,
    images: {},
  };
}

function getMangaId(manga: FavoriteManga | null) {
  return manga?.id ?? manga?.mangaDexId ?? null;
}

export default function FavoriteButton(props: FavoriteButtonProps) {
  const { isFavorite, addFavorite, removeFavorite } = useFavoritesStore();
  const [mounted, setMounted] = useState(false);
  const manga = useMemo(() => buildFavoriteManga(props), [props]);
  const mangaId = getMangaId(manga);
  const variant = props.variant ?? (props.manga ? "floating" : "inline");

  useEffect(() => setMounted(true), []);

  if (!mounted || !manga || !mangaId) {
    return null;
  }

  const isFav = isFavorite(mangaId);

  const toggleFavorite = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isFav) {
      removeFavorite(mangaId);
      toast.success("Eliminado de favoritos");
      return;
    }

    addFavorite(manga);
    toast.success("Agregado a favoritos");
  };

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={toggleFavorite}
        className={`flex items-center justify-center transition-all duration-300 active:scale-95 w-full
          md:flex-row md:gap-2.5 md:rounded-xl md:border md:py-3 md:text-sm md:font-heading md:font-semibold
          flex-col gap-1 py-2.5 text-[10px] font-bold border-transparent bg-transparent
          ${
            isFav
              ? "md:border-[#ff6b00]/30 md:bg-[#ff6b00]/10 text-[#ff6b00] md:shadow-[0_0_15px_rgba(255,107,0,0.08)] md:hover:bg-[#ff6b00]/15"
              : "md:border-white/10 md:bg-white/5 text-gray-400 hover:text-white md:hover:border-white/20 md:hover:bg-white/10"
          }`}
      >
        <Heart className={`h-5 w-5 md:h-4.5 md:w-4.5 ${isFav ? "fill-current" : ""}`} />
        <span className="md:hidden block truncate w-full text-center">
          Favorito
        </span>
        <span className="hidden md:inline">
          {props.label ?? "Agregar a favoritos"}
        </span>
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
        onClick={toggleFavorite}
        className={`rounded-full p-1.5 backdrop-blur-md transition-all border ${
          isFav 
            ? "bg-[#ff6b00]/15 border-[#ff6b00]/40 text-[#ff6b00]" 
            : "bg-black/60 border-white/10 text-white hover:bg-[#ff6b00]/15 hover:border-[#ff6b00]/30 hover:text-[#ff6b00]"
        }`}
      >
        <Heart className={`h-4 w-4 ${isFav ? "fill-orange-500" : ""}`} />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
      onClick={toggleFavorite}
      className={`absolute right-2 top-2 z-30 rounded-full p-2 backdrop-blur-md transition-all border ${
        isFav 
          ? "bg-[#ff6b00]/15 border-[#ff6b00]/40 text-[#ff6b00]" 
          : "bg-black/50 border-white/10 text-white hover:bg-[#ff6b00]/15 hover:border-[#ff6b00]/30 hover:text-[#ff6b00]"
      }`}
    >
      <Heart
        size={20}
        className={`transition-all duration-300 ${
          isFav ? "scale-110 fill-[#ff6b00] text-[#ff6b00]" : "hover:scale-110"
        }`}
      />
    </button>
  );
}
