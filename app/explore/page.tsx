import type { Metadata } from "next";
import Script from "next/script";
import ExploreClient from "./explore-client";
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "../utils/seo";

export const dynamic = "force-dynamic";

const EXPLORE_TITLE = `Explorar manga, manhwa y manhua online | ${SITE_NAME}`;
const EXPLORE_DESCRIPTION =
  "Explora mangas, manhwas y manhuas online en MangaStoon. Filtra por género, idioma, tipo de cómic, popularidad y últimas actualizaciones.";

type ExploreSearchParams = Promise<{
  q?: string | string[];
  type?: string | string[];
  page?: string | string[];
}>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: ExploreSearchParams;
}): Promise<Metadata> {
  const params = searchParams ? await searchParams : {};
  const query = firstParam(params.q)?.trim();
  const type = firstParam(params.type)?.trim();
  const page = firstParam(params.page)?.trim();
  const canonicalPath = query || type || page ? `/explore?${new URLSearchParams({
    ...(query ? { q: query } : {}),
    ...(type ? { type } : {}),
    ...(page ? { page } : {}),
  }).toString()}` : "/explore";
  const title = query
    ? `Explorar ${query} online | ${SITE_NAME}`
    : EXPLORE_TITLE;
  const description = query
    ? `Busca y explora resultados de ${query} en MangaStoon. Encuentra manga, manhwa y manhua online con capítulos disponibles para leer.`
    : EXPLORE_DESCRIPTION;

  const isSearch = Boolean(query);

  return {
    title,
    description,
    alternates: {
      canonical: absoluteUrl(canonicalPath),
    },
    robots: {
      index: !isSearch,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(canonicalPath),
      type: "website",
      siteName: SITE_NAME,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function ExplorePage() {
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: EXPLORE_TITLE,
    description: EXPLORE_DESCRIPTION,
    url: absoluteUrl("/explore"),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: absoluteUrl("/"),
    },
    about: ["manga online", "manhwa online", "manhua online", "comics online"],
  };

  return (
    <>
      <Script
        id="explore-collection-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <ExploreClient />
    </>
  );
}
