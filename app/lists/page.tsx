import React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { FolderHeart, User, Globe, ChevronRight, Layers, Crown } from "lucide-react";
import { getPublicMangaLists } from "../actions/lists";
import SiteHeader, { type SupportedLanguage } from "../components/site-header";
import { C } from "../lib/colors";

export const metadata: Metadata = {
  title: "Listas de la Comunidad | LectorFenix",
  description: "Explora las colecciones y listas de mangas, manhwas y cómics creadas y compartidas por la comunidad de LectorFenix.",
};


function normalizeLanguage(value: string | undefined): SupportedLanguage {
  if (value === "pt") return value;
  return "es";
}

const COPY = {
  es: {
    title: "Listas de la Comunidad",
    subtitle: "Colecciones de cómics seleccionadas y compartidas por la comunidad de LectorFenix.",
    createdBy: "Creada por",
    viewList: "Explorar Lista",
    emptyState: "No se encontraron listas públicas en este momento.",
    anonymous: "Lector Anónimo",
  },
  en: {
    title: "Community Lists",
    subtitle: "Comic collections curated and shared by the LectorFenix community.",
    createdBy: "Created by",
    viewList: "Explore List",
    emptyState: "No public lists found at this moment.",
    anonymous: "Anonymous Reader",
  },
  pt: {
    title: "Listas da Comunidade",
    subtitle: "Coleções de quadrinhos selecionadas e compartilhadas pela comunidade do LectorFenix.",
    createdBy: "Criada por",
    viewList: "Explorar Lista",
    emptyState: "Nenhuma lista pública encontrada no momento.",
    anonymous: "Leitor Anônimo",
  }
};

export default async function CommunityListsPage() {
  const cookieStore = await cookies();
  const currentLanguage = normalizeLanguage(cookieStore.get("lang")?.value);
  const t = COPY[currentLanguage] || COPY.es;

  const { lists, error } = await getPublicMangaLists();

  return (
    <main className="min-h-screen bg-[#141519] pb-16 text-white">
      <SiteHeader language={currentLanguage} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-5 md:px-6 md:py-10 lg:px-8">
        <div className="mb-10 text-center md:text-left">
          <div className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500/10 border border-orange-500/25 px-4.5 py-1.5 text-xs font-heading font-bold text-orange-500 mb-4 md:justify-start select-none">
            <FolderHeart size={14} className="text-orange-400" />
            <span>{currentLanguage === "es" ? "Listas de la Comunidad" : currentLanguage === "pt" ? "Listas da Comunidade" : "Community Lists"}</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
            {t.title}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-gray-400 md:mx-0">
            {t.subtitle}
          </p>
        </div>

        {error || !lists || lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 text-gray-500 border border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
            <FolderHeart size={64} className="mb-4 opacity-25 text-orange-500" />
            <p className="text-base font-bold text-neutral-300">{t.emptyState}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => {
              const username = list.profiles?.username || t.anonymous;
              const items = list.items || [];
              const itemsCount = items.length;

              return (
                <div
                  key={list.id}
                  className="flex flex-col rounded-3xl border bg-[#1c1d22]/40 p-6 transition-all hover:bg-neutral-900/40 hover:scale-[1.01] hover:shadow-[0_12px_30px_rgba(0,0,0,0.4)]"
                  style={{ borderColor: C.border }}
                >
                  <div className="flex-1 min-w-0">
                    {/* List Meta */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                      <User size={13} className="text-orange-500 shrink-0" />
                      <span className={`font-semibold truncate ${list.profiles?.is_premium ? "premium-username-shimmer" : "text-gray-400"}`}>
                        @{username}
                      </span>
                      {list.profiles?.is_premium && (
                        <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-600 border border-yellow-300/40 shadow-[0_0_8px_rgba(245,158,11,0.2)] shrink-0" title="Premium">
                          <Crown size={9} className="text-black fill-black stroke-[1.5]" />
                        </span>
                      )}
                    </div>

                    {/* Title & Desc */}
                    <h3 className="text-lg font-bold font-heading text-neutral-100 line-clamp-1">
                      {list.name}
                    </h3>
                    {list.description ? (
                      <p className="mt-2 text-xs text-neutral-400 leading-normal line-clamp-2">
                        {list.description}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs italic text-neutral-600 leading-normal">
                        Sin descripción disponible.
                      </p>
                    )}

                    {/* Cover Stack preview */}
                    <div className="mt-5 mb-3 flex items-center gap-1.5">
                      {itemsCount === 0 ? (
                        <div className="flex h-16 w-full items-center justify-center rounded-xl border border-dashed border-white/5 bg-black/20 text-xs text-neutral-600 font-semibold gap-1.5">
                          <Layers size={14} />
                          <span>Lista vacía</span>
                        </div>
                      ) : (
                        <div className="flex items-center -space-x-4 overflow-hidden">
                          {items.slice(0, 4).map((item: any, idx: number) => (
                            <div
                              key={item.manga_id + idx}
                              className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg border-2 border-[#141519] bg-neutral-800 shadow-md transition-transform hover:translate-y-[-4px]"
                              style={{ zIndex: 10 - idx }}
                            >
                              {item.cover_image ? (
                                <img
                                  src={item.cover_image}
                                  alt="Cover preview"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full bg-neutral-700" />
                              )}
                            </div>
                          ))}
                          {itemsCount > 4 && (
                            <div className="flex h-16 w-11 items-center justify-center rounded-lg border-2 border-[#141519] bg-neutral-900 text-[10px] font-bold text-orange-500 shadow-md">
                              +{itemsCount - 4}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="mt-6 border-t border-white/5 pt-4 flex items-center justify-between text-xs text-gray-500">
                    <span className="font-semibold text-gray-400">
                      {itemsCount === 1 ? "1 cómic" : `${itemsCount} cómics`}
                    </span>
                    <Link
                      href={`/lists/${list.id}`}
                      className="inline-flex items-center gap-1 font-bold text-orange-500 hover:text-orange-400 group"
                    >
                      <span>{t.viewList}</span>
                      <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
