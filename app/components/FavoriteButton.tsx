"use client";

import { Heart } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { toast } from "sonner";
import { useFavoritesStore, type FavoriteManga } from "../store/useFavoritesStore";

type FavoriteButtonProps = {
  manga?: FavoriteManga;
  mangaId?: string;
  title?: string;
  label?: string;
  variant?: "floating" | "inline";
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
    url: `/manga/${mangaId}`,
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
        className={`flex items-center gap-3 text-sm transition-colors ${
          isFav ? "text-orange-500" : "text-gray-400 hover:text-orange-500"
        }`}
      >
        <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
        <span>{props.label ?? "Agregar a favoritos"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
      onClick={toggleFavorite}
      className="absolute right-2 top-2 z-30 rounded-full bg-black/50 p-2 text-white backdrop-blur-md transition-all hover:bg-black/80 hover:text-orange-500"
    >
      <Heart
        size={20}
        className={`transition-all duration-300 ${
          isFav ? "scale-110 fill-orange-500 text-orange-500" : "hover:scale-110"
        }`}
      />
    </button>
  );
}
