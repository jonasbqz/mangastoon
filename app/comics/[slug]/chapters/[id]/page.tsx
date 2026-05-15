import Script from "next/script";
import { headers } from "next/headers";
import ReaderClient from "./reader-client";
import { SITE_NAME, absoluteUrl } from "../../../../utils/seo";
import { extractComicIdFromSlugId } from "../../../../utils/slugify";

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
}: {
  id: string;
  chapter?: string;
  lang: SupportedLanguage;
}) {
  const headersList = await headers();
  const url = new URL(`/api/read/${encodeURIComponent(id)}`, getRequestBaseUrl(headersList));
  url.searchParams.set("lang", lang);
  if (chapter) url.searchParams.set("chapter", chapter);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        cookie: headersList.get("cookie") ?? "",
      },
    });

    return (await response.json()) as ReaderApiResponse;
  } catch {
    return null;
  }
}

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ chapter?: string; lang?: string }>;
}) {
  const [{ slug, id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const lang = normalizeLanguage(resolvedSearchParams.lang);
  const mangaId = extractComicIdFromSlugId(slug);
  const chapterId = resolvedSearchParams.chapter ?? id;
  const data = await fetchReaderData({ id: mangaId, chapter: chapterId, lang });
  const mangaTitle = data?.mangaTitle || SITE_NAME;
  const currentChapter = data?.currentChapter ?? null;
  const currentLabel = getChapterLabel(currentChapter, "Capítulo no disponible");
  const canonical = absoluteUrl(`/comics/${slug}/chapters/${chapterId}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Chapter",
    name: `${mangaTitle} - ${currentLabel}`,
    isPartOf: {
      "@type": "Book",
      name: mangaTitle,
      url: absoluteUrl(`/comics/${slug}`),
    },
    url: canonical,
    inLanguage: lang,
    isAccessibleForFree: true,
  };

  return (
    <>
      <Script id="reader-chapter-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ReaderClient
        initialData={data}
        initialMangaId={mangaId}
        initialChapterParam={chapterId}
        initialReaderLanguage={lang}
      />
    </>
  );
}
