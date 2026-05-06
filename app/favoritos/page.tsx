"use client";

import { HeartCrack } from "lucide-react";
import { useEffect, useState } from "react";
import MangaCard, { type MangaShowcaseItem } from "../components/MangaCard";
import BackButton from "../components/BackButton";
import SiteHeader from "../components/site-header";
import { useLanguage } from "../components/language-provider";
import { useFavoritesStore, type FavoriteManga } from "../store/useFavoritesStore";

function toShowcaseItem(manga: FavoriteManga): MangaShowcaseItem {
  const mangaDexId = manga.mangaDexId ?? manga.id ?? null;
  const title = manga.title ?? manga.titleMap?.es ?? manga.titleMap?.en ?? "Manga";

  return {
    mal_id: 0,
    title,
    score: manga.score ?? null,
    url: manga.url ?? (mangaDexId ? `/manga/${mangaDexId}` : "#"),
    mangaDexId,
    titleMap: manga.titleMap ?? (title ? { es: title, en: title, pt: title } : undefined),
    altTitles: manga.altTitles,
    originalLanguage: manga.originalLanguage,
    themes: manga.themes,
    tags: manga.tags,
    genres: manga.genres,
    isNsfw: manga.isNsfw,
    latestChapters: manga.latestChapters,
    images: manga.images ?? {},
  };
}

export default function FavoritosPage() {
  const { language } = useLanguage();
  const { favorites } = useFavoritesStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <main className="min-h-screen bg-[#141519] text-white">
        <SiteHeader language={language} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#141519] text-white">
      <SiteHeader language={language} />
      <div className="mx-auto min-h-[70vh] max-w-[1600px] px-4 py-12 md:px-8">
        <BackButton />

        <h1 className="mb-8 border-l-4 border-orange-500 pl-4 text-3xl font-black text-white md:text-4xl">
        Mis Guardados
        </h1>

        {favorites.length === 0 ? (
        <div className="mt-20 flex flex-col items-center justify-center text-gray-500">
          <HeartCrack size={64} className="mb-4 opacity-50" />
          <p className="text-xl font-medium">Aún no tienes mangas guardados</p>
          <p className="mt-2 text-sm">Explora el catálogo y dale al corazón para guardarlos aquí.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-6 lg:grid-cols-5 xl:grid-cols-6">
          {favorites.map((manga) => {
            const item = toShowcaseItem(manga);
            return <MangaCard key={item.mangaDexId ?? item.title} manga={item} variant="grid" />;
          })}
        </div>
        )}
      </div>
    </main>
  );
}
