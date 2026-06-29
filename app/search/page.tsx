import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import SiteHeader, { type SupportedLanguage } from "../components/site-header";
import SearchResultsContent from "./search-results-content";


export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buscar manga, manhwa y comics online | LectorFenix",
  description:
    "Busca manga, manhwa, manhua y comics online en LectorFenix. Encuentra series por título y continúa leyendo tus capítulos favoritos.",
  alternates: {
    canonical: "/search",
  },
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: "Buscar manga online | LectorFenix",
    description:
      "Encuentra manga, manhwa, manhua y comics online en LectorFenix.",
    url: "/search",
    type: "website",
    siteName: "LectorFenix",
  },
  twitter: {
    card: "summary_large_image",
    title: "Buscar manga online | LectorFenix",
    description: "Encuentra manga, manhwa, manhua y comics online en LectorFenix.",
  },
};

function normalizeLanguage(value: string | undefined): SupportedLanguage {
  if (value === "pt") {
    return value;
  }

  return "es";
}

function SearchPageFallback() {
  return (
    <div className="mx-auto max-w-[1600px] px-8 pb-16 pt-10">
      <div className="mb-8 h-10 w-96 animate-pulse rounded bg-white/5" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={`fallback-skeleton-${index}`}
            className="aspect-[2/3] animate-pulse rounded-md bg-white/5"
          />
        ))}
      </div>
    </div>
  );
}

export default async function SearchPage() {
  const cookieStore = await cookies();
  const currentLanguage = normalizeLanguage(cookieStore.get("lang")?.value);

  return (
    <main className="min-h-screen bg-transparent text-white">
      <SiteHeader language={currentLanguage} />
      <Suspense fallback={<SearchPageFallback />}>
        <SearchResultsContent />
      </Suspense>
    </main>
  );
}
