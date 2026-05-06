import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface FavoriteManga {
  id?: string;
  mangaDexId?: string | null;
  title?: string;
  score?: number | null;
  url?: string;
  titleMap?: Record<string, string>;
  altTitles?: Record<string, string>[];
  originalLanguage?: string;
  themes?: string[];
  tags?: string[];
  genres?: Array<{ mal_id: number; name: string }>;
  isNsfw?: boolean;
  latestChapters?: { chapter: string; timeAgo: string; publishedAt?: string | null }[];
  images?: {
    webp?: { large_image_url?: string | null; image_url?: string | null };
    jpg?: { large_image_url?: string | null; image_url?: string | null };
  };
}

interface FavoritesState {
  favorites: FavoriteManga[];
  addFavorite: (manga: FavoriteManga) => void;
  removeFavorite: (mangaId: string) => void;
  isFavorite: (mangaId: string) => boolean;
}

function getFavoriteId(manga: FavoriteManga) {
  return manga.id ?? manga.mangaDexId ?? null;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      addFavorite: (manga) =>
        set((state) => {
          const mangaId = getFavoriteId(manga);

          if (!mangaId || state.favorites.some((item) => getFavoriteId(item) === mangaId)) {
            return state;
          }

          return { favorites: [manga, ...state.favorites] };
        }),
      removeFavorite: (mangaId) =>
        set((state) => ({
          favorites: state.favorites.filter((manga) => getFavoriteId(manga) !== mangaId),
        })),
      isFavorite: (mangaId) => get().favorites.some((manga) => getFavoriteId(manga) === mangaId),
    }),
    { name: "mangastoon-favorites" }
  )
);
