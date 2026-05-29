import React, { cache } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, User, FolderHeart, Calendar, Layers, Crown } from "lucide-react";
import { getMangaListDetails } from "../../actions/lists";
import SiteHeader, { type SupportedLanguage } from "../../components/site-header";
import { MangaCard, type MangaShowcaseItem } from "../../components/MangaCard";
import ShareButton from "./ShareButton";
import AddMangaSearchModal from "./AddMangaSearchModal";
import { createClient } from "../../../utils/supabase/server";
import { C } from "../../lib/colors";

interface ListDetailsPageProps {
  params: Promise<{ id: string }>;
}

const cachedGetMangaListDetails = cache(getMangaListDetails);

function normalizeLanguage(value: string | undefined): SupportedLanguage {
  if (value === "en" || value === "pt") return value;
  return "es";
}

export async function generateMetadata({
  params,
}: ListDetailsPageProps): Promise<Metadata> {
  const { id } = await params;
  const { list } = await cachedGetMangaListDetails(id);

  if (!list) {
    return {
      title: "Lista no disponible | MangaStoon",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return {
    title: `${list.name} — MangaStoon`,
    description: list.description || `Colección de cómics creada por @${list.profiles?.username || "usuario"}.`,
    robots: {
      index: list.is_public,
      follow: list.is_public,
    },
  };
}

const COPY = {
  es: {
    backToLists: "Volver a la Comunidad",
    createdBy: "Colección de",
    emptyList: "Esta lista no tiene cómics todavía.",
    errorTitle: "Lista no disponible",
    errorDesc: "La lista que estás buscando no existe, o es de acceso privado y solo su creador puede verla.",
    backHome: "Volver al Inicio",
    anonymous: "Lector Anónimo",
  },
  en: {
    backToLists: "Back to Community",
    createdBy: "Collection by",
    emptyList: "This list has no comics yet.",
    errorTitle: "List not available",
    errorDesc: "The list you are looking for does not exist, or it is private and only its creator can view it.",
    backHome: "Back to Home",
    anonymous: "Anonymous Reader",
  },
  pt: {
    backToLists: "Voltar para a Comunidade",
    createdBy: "Coleção de",
    emptyList: "Esta lista ainda não tem quadrinhos.",
    errorTitle: "Lista não disponível",
    errorDesc: "A lista que você está procurando não existe, ou é de acesso privado e apenas seu criador pode ver.",
    backHome: "Voltar ao Início",
    anonymous: "Leitor Anônimo",
  }
};

export default async function ListDetailsPage({ params }: ListDetailsPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const currentLanguage = normalizeLanguage(cookieStore.get("lang")?.value);
  const t = COPY[currentLanguage] || COPY.es;

  const { list, items, error } = await cachedGetMangaListDetails(id);

  let user: any = null;
  try {
    const supabase = await createClient();
    const res = await supabase.auth.getUser();
    user = res.data?.user ?? null;
  } catch (err) {
    console.error("[ListDetailsPage] Auth/Supabase error:", err);
  }
  const isOwner = (user && list) ? user.id === list.user_id : false;

  if (error || !list) {
    notFound();
  }

  const username = list.profiles?.username || t.anonymous;
  const avatarUrl = list.profiles?.avatar_url || null;

  const localeMap = { es: "es-ES", en: "en-US", pt: "pt-BR" };
  const currentLocale = localeMap[currentLanguage] || "es-ES";
  const dateString = new Date(list.created_at).toLocaleDateString(currentLocale, {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return (
    <main className="min-h-screen bg-[#141519] pb-20 text-white">
      <SiteHeader language={currentLanguage} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-5 md:px-6 md:py-10 lg:px-8">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/lists"
            className="group inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white"
          >
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
            <span>{t.backToLists}</span>
          </Link>
        </div>

        {/* List Header Card */}
        <div
          className="mb-10 rounded-3xl border bg-[#1c1d22]/30 p-6 md:p-8"
          style={{ borderColor: C.border }}
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-black font-heading text-white sm:text-3xl md:text-4xl">
                {list.name}
              </h1>
              {list.description && (
                <p className="mt-3 text-sm leading-relaxed text-gray-400 max-w-3xl">
                  {list.description}
                </p>
              )}

              {/* Creator details */}
              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={username}
                      className={`h-6 w-6 rounded-full object-cover border transition-all ${
                        list.profiles?.is_premium ? "border-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.3)]" : "border-white/10"
                      }`}
                    />
                  ) : (
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all ${
                      list.profiles?.is_premium ? "border-amber-500/60 bg-amber-500/5" : "bg-white/5 border-white/5"
                    }`}>
                      <User size={12} className={list.profiles?.is_premium ? "text-amber-400" : "text-gray-400"} />
                    </div>
                  )}
                  <span className={`font-bold ${list.profiles?.is_premium ? "premium-username-shimmer" : "text-white"}`}>
                    @{username}
                  </span>
                  {list.profiles?.is_premium && (
                    <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-600 border border-yellow-300/40 shadow-[0_0_8px_rgba(245,158,11,0.2)] shrink-0" title="Premium">
                      <Crown size={9} className="text-black fill-black stroke-[1.5]" />
                    </span>
                  )}
                </div>
                <span className="text-gray-700">•</span>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-gray-500" />
                  <span>{dateString}</span>
                </div>
                <span className="text-gray-700">•</span>
                <div className="flex items-center gap-1">
                  <Layers size={13} className="text-gray-500" />
                  <span>
                    {items && items.length === 1 ? "1 cómic" : `${items ? items.length : 0} cómics`}
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-wrap items-center gap-3">
              {isOwner && (
                <AddMangaSearchModal listId={list.id} language={currentLanguage} />
              )}
              <ShareButton listId={list.id} language={currentLanguage} />
            </div>
          </div>
        </div>

        {/* List Items Grid */}
        {!items || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 text-gray-500 border border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
            <FolderHeart size={56} className="mb-4 opacity-25 text-orange-500" />
            <p className="text-sm font-bold text-neutral-300">{t.emptyList}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6">
            {items.map((item) => {
              const showcaseItem: MangaShowcaseItem = {
                mal_id: 0,
                title: item.manga_title,
                score: null,
                url: `/comics/${item.manga_id}`,
                mangaDexId: item.manga_id,
                titleMap: { es: item.manga_title },
                images: {
                  webp: { large_image_url: item.cover_image || "", image_url: item.cover_image || "" },
                  jpg: { large_image_url: item.cover_image || "", image_url: item.cover_image || "" }
                }
              };

              return (
                <MangaCard
                  key={item.manga_id}
                  manga={showcaseItem}
                  variant="grid"
                  showChapters={false}
                />
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
