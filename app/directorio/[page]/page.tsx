import { cookies } from "next/headers";
import { fetchLocalAPI } from "../../utils/monline";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "../../components/site-header";
import { Compass, Book, ArrowLeft, ArrowRight } from "lucide-react";
import { MONLINE_API_URL, getMonlineSitemapTotal, absoluteUrl } from "../../utils/seo";
import { buildComicPath } from "../../utils/slugify";

export const revalidate = 86400; // Cachear por 24 horas

interface DirectoryParams {
  params: Promise<{ page: string }>;
}

function getStringValue(source: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

async function fetchComicsPage(page: number) {
  try {
    const response = await fetchLocalAPI(`/api/comics?limit=120&page=${page}`);

    if (!response.ok) return [];

    const payload = await response.json();
    
    // Extraer comics
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.data?.comics)) return payload.data.comics;
    if (Array.isArray(payload.data?.items)) return payload.data.items;
    if (Array.isArray(payload.data?.results)) return payload.data.results;
    if (Array.isArray(payload.comics)) return payload.comics;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.results)) return payload.results;
    
    return [];
  } catch (error) {
    console.error("[Directory API] Error fetching page:", page, error);
    return [];
  }
}

export async function generateMetadata({ params }: DirectoryParams): Promise<Metadata> {
  const { page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  const totalComics = await getMonlineSitemapTotal().catch(() => 2000);
  const totalPages = Math.ceil(totalComics / 120);

  const title = `Directorio de Mangas y Manhwas - Página ${page} | MangaStoon`;
  const description = `Explora el catálogo alfabético completo de MangaStoon. Todos los capítulos de tus mangas, manhwas y manhuas online gratis. Página ${page} de ${totalPages || 20}.`;
  const canonical = absoluteUrl(`/directorio/${page}`);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function DirectoryPage({ params }: DirectoryParams) {
  const { page: pageStr } = await params;
  const page = parseInt(pageStr, 10);

  if (Number.isNaN(page) || page < 1) {
    notFound();
  }

  const cookieStore = await cookies();
  const rawCookieLang = cookieStore.get("lang")?.value;
  const currentLanguage = rawCookieLang === "en" || rawCookieLang === "pt" ? rawCookieLang : "es";

  const totalComics = await getMonlineSitemapTotal().catch(() => 2000);
  const totalPages = Math.ceil(totalComics / 120);

  if (page > totalPages && totalPages > 0) {
    notFound();
  }

  const comics = await fetchComicsPage(page);

  // Agrupar por letra inicial para la navegación visual
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

  return (
    <main className="min-h-screen bg-[#0a0908] pb-16 text-white">
      <SiteHeader language={currentLanguage} />
      
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        {/* Cabecera del Directorio */}
        <header className="mb-10 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3">
            <div className="h-7 w-1.5 rounded-full bg-[#ff6b00]" />
            <h1 className="text-3xl font-bold tracking-tight text-white font-heading">
              {currentLanguage === "es" ? "Directorio Completo" : currentLanguage === "pt" ? "Diretório Completo" : "Complete Directory"}
            </h1>
          </div>
          <p className="mt-3 text-sm text-gray-400 max-w-2xl leading-relaxed">
            {currentLanguage === "es" 
              ? `Explora toda nuestra biblioteca ordenada alfabéticamente. Mostrando página ${page} de ${totalPages}.` 
              : currentLanguage === "pt"
              ? `Explore toda a nossa biblioteca ordenada alfabeticamente. Mostrando página ${page} de ${totalPages}.`
              : `Explore our entire library sorted alphabetically. Showing page ${page} of ${totalPages}.`}
          </p>
        </header>

        {/* Listado de Enlaces a Cómics */}
        {comics.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#141519]/40 py-16 text-center">
            <Book size={40} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-400 text-sm">
              {currentLanguage === "es" ? "No se encontraron mangas en esta sección." : "Nenhum mangá encontrado nesta seção."}
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/[0.06] bg-[#121110]/40 p-6 md:p-8 backdrop-blur-md shadow-2xl">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
              {comics.map((comic: any) => {
                const slug = getStringValue(comic, ["slug", "manga_slug", "comic_slug", "id"]);
                const title = getStringValue(comic, ["title", "name", "comic_title", "original_title"]) || slug;
                const prefixedSlug = slug.startsWith("lc-") ? slug : `lc-${slug}`;
                const comicUrl = buildComicPath(title, prefixedSlug);

                return (
                  <Link
                    key={slug}
                    href={comicUrl}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.03] bg-neutral-900/20 px-4 py-3 text-sm text-gray-300 transition-all hover:border-orange-500/30 hover:bg-neutral-900/60 hover:text-orange-500 hover:scale-[1.01]"
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-orange-500/10 text-[10px] font-bold text-orange-500">
                      {title.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate font-medium">{title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Paginación Semántica */}
        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-4">
            {page > 1 ? (
              <Link
                href={`/directorio/${page - 1}`}
                className="flex items-center gap-2 rounded-xl border border-white/5 bg-[#141519] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-300 hover:border-orange-500/20 hover:text-orange-500 transition-all"
              >
                <ArrowLeft size={14} />
                <span>{currentLanguage === "es" ? "Anterior" : "Anterior"}</span>
              </Link>
            ) : (
              <button
                disabled
                className="flex items-center gap-2 rounded-xl border border-white/5 bg-[#141519]/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-600 cursor-not-allowed"
              >
                <ArrowLeft size={14} />
                <span>{currentLanguage === "es" ? "Anterior" : "Anterior"}</span>
              </button>
            )}

            <span className="text-xs font-bold text-gray-400">
              {currentLanguage === "es" 
                ? `PÁGINA ${page} DE ${totalPages}` 
                : `PÁGINA ${page} DE ${totalPages}`}
            </span>

            {page < totalPages ? (
              <Link
                href={`/directorio/${page + 1}`}
                className="flex items-center gap-2 rounded-xl border border-[#ff6b00]/30 bg-[#ff6b00]/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#ff6b00] hover:bg-[#ff6b00]/25 transition-all"
              >
                <span>{currentLanguage === "es" ? "Siguiente" : "Seguinte"}</span>
                <ArrowRight size={14} />
              </Link>
            ) : (
              <button
                disabled
                className="flex items-center gap-2 rounded-xl border border-white/5 bg-[#141519]/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-600 cursor-not-allowed"
              >
                <span>{currentLanguage === "es" ? "Siguiente" : "Seguinte"}</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
