import { cache } from "react";
import type { Metadata } from "next";
import Script from "next/script";
import { headers, cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { NextRequest } from "next/server";
import ReaderClient from "./reader-client";
import { SITE_NAME, absoluteUrl, safeJsonLd } from "../../../../utils/seo";
import { extractComicIdFromSlugId } from "../../../../utils/slugify";
import { fetchMangaDetails, hasSensitiveAdultTag } from "../../../../utils/mangadex";
import AdultContentBlocker from "../../../../components/AdultContentBlocker";
import DMCABlocker from "../../../../components/DMCABlocker";
import { isDmcaBlocked } from "../../../../utils/dmca";
import { createClient } from "../../../../../utils/supabase/server";
import { GET as getReaderData } from "../../../../../app/api/read/[id]/route";

type SupportedLanguage = "es" | "en" | "pt";

type ChapterFeedItem = {
  id: string;
  attributes?: {
    chapter?: string | null;
    title?: string | null;
    translatedLanguage?: string | null;
  };
};

type ReaderApiResponse = {
  mangaTitle?: string;
  comicSlug?: string;
  coverImage?: string;
  chapters?: ChapterFeedItem[];
  currentChapter?: ChapterFeedItem | null;
  pages?: string[];
  englishFallbackChapter?: ChapterFeedItem | null;
  fallbackReason?: "english" | "unavailable" | null;
  error?: string;
  code?: string;
};

function getRequestBaseUrl(headersList: Headers) {
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

function normalizeLanguage(value: string | undefined): SupportedLanguage {
  if (value === "en" || value === "pt") return value;
  return "es";
}

function getChapterNumber(chapter: ChapterFeedItem | null | undefined) {
  return chapter?.attributes?.chapter?.trim() || chapter?.attributes?.title?.trim() || "";
}

function getChapterLabel(chapter: ChapterFeedItem | null | undefined, fallback = "Capítulo") {
  const number = getChapterNumber(chapter);
  return number ? `Capítulo ${number}` : fallback;
}

async function fetchReaderData({
  id,
  chapter,
  lang,
  slug,
}: {
  id: string;
  chapter?: string;
  lang: SupportedLanguage;
  slug?: string;
}) {
  const headersList = await headers();
  const url = new URL(`http://localhost/api/read/${encodeURIComponent(id)}`);
  url.searchParams.set("lang", lang);
  if (chapter) url.searchParams.set("chapter", chapter);
  if (slug) url.searchParams.set("slug", slug);

  const req = new NextRequest(url.toString(), {
    headers: {
      host: headersList.get("host") ?? "localhost:3000",
      cookie: headersList.get("cookie") ?? "",
    },
  });

  try {
    const response = await getReaderData(req, {
      params: Promise.resolve({ id }),
    });

    if (!response.ok) {
      console.error(`[fetchReaderData] Direct GET call failed with status: ${response.status}`);
      return null;
    }

    return (await response.json()) as ReaderApiResponse;
  } catch (err) {
    console.error("[fetchReaderData] Catch error calling direct GET handler:", err);
    return null;
  }
}

const cachedFetchReaderData = cache(fetchReaderData);

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ chapter?: string; lang?: string }>;
}): Promise<Metadata> {
  const [{ slug, id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get("lang")?.value;
  const lang = normalizeLanguage(resolvedSearchParams.lang || cookieLang);
  const mangaId = extractComicIdFromSlugId(slug);
  const chapterId = resolvedSearchParams.chapter ?? id;

  if (isDmcaBlocked(mangaId)) {
    return {
      title: "Contenido no disponible - MangaStoon",
      description: "Contenido retirado debido a una reclamación por infracción de derechos de autor.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const data = await cachedFetchReaderData({ id: mangaId, chapter: chapterId, lang, slug });

  if (!data || !data.currentChapter || data.code === "LOCAL_PAGES_UNAVAILABLE" || !data.pages || data.pages.length === 0) {
    return {
      title: "Capítulo no disponible - MangaStoon",
      description: "Este capítulo no está disponible o no existe.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const fallbackMangaTitle = slug
    .replace(/-\d{8}-[a-zA-Z0-9]+$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase())
    .trim() || SITE_NAME;

  const mangaTitle = data?.mangaTitle || fallbackMangaTitle;
  const currentChapter = data?.currentChapter ?? ({ attributes: { chapter: chapterId } } as any);
  const currentLabel = getChapterLabel(currentChapter, "Capítulo");

  let title = "";
  let description = "";
  if (lang === "pt") {
    title = `Ler ${mangaTitle} - ${currentLabel} Online Grátis - MangaStoon`;
    description = `Leia o ${currentLabel} de ${mangaTitle} online gratuitamente em português, inglês e espanhol no MangaStoon.`;
  } else if (lang === "en") {
    title = `Read ${mangaTitle} - ${currentLabel} Online Free - MangaStoon`;
    description = `Read ${mangaTitle} - ${currentLabel} online for free in English, Spanish, and Portuguese on MangaStoon.`;
  } else {
    title = `Leer ${mangaTitle} - ${currentLabel} Online Gratis - MangaStoon`;
    description = `Leé el ${currentLabel} de ${mangaTitle} online gratis en español, inglés y portugués en MangaStoon.`;
  }

  const query = lang !== "es" ? `?lang=${encodeURIComponent(lang)}` : "";
  const canonical = absoluteUrl(`/comics/${slug}/chapters/${chapterId}${query}`);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "book",
      images: data?.coverImage ? [{ url: data.coverImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: data?.coverImage ? [data.coverImage] : undefined,
    },
  };
}

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ chapter?: string; lang?: string }>;
}) {
  const [{ slug, id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get("lang")?.value;
  const lang = normalizeLanguage(resolvedSearchParams.lang || cookieLang);
  const mangaId = extractComicIdFromSlugId(slug);
  
  if (isDmcaBlocked(mangaId)) {
    return (
      <main className="min-h-screen bg-[#0a0908] text-white">
        <DMCABlocker lang={lang} />
      </main>
    );
  }

  console.log("[Reader Server] lang resolved:", lang, "| cookieLang:", cookieLang, "| searchParamLang:", resolvedSearchParams.lang, "| slug:", slug);

  const isAdult = cookieStore.get("mangastoon_adult")?.value === "true";

  if (!isAdult) {
    const manga = await fetchMangaDetails(mangaId, lang);
    if (manga && hasSensitiveAdultTag(manga)) {
      return (
        <main className="min-h-screen bg-[#0a0908] text-white">
          <AdultContentBlocker lang={lang} />
        </main>
      );
    }
  }
  const chapterId = resolvedSearchParams.chapter ?? id;
  const data = await cachedFetchReaderData({ id: mangaId, chapter: chapterId, lang, slug });

  if (!data || !data.currentChapter || data.code === "LOCAL_PAGES_UNAVAILABLE") {
    notFound();
  }

  const canonicalSlug = data?.comicSlug;

  if (canonicalSlug && canonicalSlug !== slug) {
    const query = lang !== "es" ? `?lang=${encodeURIComponent(lang)}` : "";
    redirect(`/comics/${canonicalSlug}/chapters/${chapterId}${query}`);
  }

  const mangaTitle = data?.mangaTitle || SITE_NAME;
  const currentChapter = data?.currentChapter ?? null;
  const currentLabel = getChapterLabel(currentChapter, "Capítulo no disponible");
  const canonical = absoluteUrl(`/comics/${slug}/chapters/${chapterId}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ComicIssue",
    name: `${mangaTitle} - ${currentLabel}`,
    issueNumber: getChapterNumber(currentChapter),
    isPartOf: {
      "@type": "ComicSeries",
      name: mangaTitle,
      url: absoluteUrl(`/comics/${slug}`),
    },
    url: canonical,
    inLanguage: lang,
    isAccessibleForFree: true,
  };

  const realMangaId = canonicalSlug ? extractComicIdFromSlugId(canonicalSlug) : mangaId;

  let isPremium = false;
  let serverProfile: {
    id: string;
    username: string | null;
    avatar_url: string | null;
    is_premium: boolean;
    telegram_grace_started: string | null;
    premium_until: string | null;
  } | null = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, is_premium, telegram_grace_started, premium_until")
        .eq("id", user.id)
        .maybeSingle();
      if (profile) {
        isPremium = !!profile.is_premium;
        serverProfile = {
          id: profile.id ?? user.id,
          username: profile.username ?? null,
          avatar_url: profile.avatar_url ?? null,
          is_premium: !!profile.is_premium,
          telegram_grace_started: profile.telegram_grace_started ?? null,
          premium_until: profile.premium_until ?? null,
        };
      }
    }
  } catch (err) {
    console.error("[ReadPage Server] error fetching profile:", err);
  }

  return (
    <>
      <Script id="reader-chapter-jsonld" type="application/ld+json" dangerouslySetInnerHTML={safeJsonLd(jsonLd)} />
      {!isPremium && (
        <Script id="monetag-vignette" src="https://dd133.com/vignette.min.js" data-zone="10986315" strategy="afterInteractive" />
      )}
      <ReaderClient
        initialData={data}
        initialMangaId={realMangaId}
        initialChapterParam={chapterId}
        initialReaderLanguage={lang}
        initialProfile={serverProfile}
      />
    </>
  );
}
