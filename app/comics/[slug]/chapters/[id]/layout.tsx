import type { Metadata } from "next";
import { MANGADEX_API_URL, MONLINE_API_URL, SITE_IMAGE, SITE_NAME, absoluteUrl } from "../../../../utils/seo";
import { getLocalizedTitle } from "../../../../utils/get-localized-title";
import { extractComicIdFromSlugId } from "../../../../utils/slugify";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ChapterFeedItem = {
  id?: string;
  attributes?: {
    chapter?: string | null;
    title?: string | null;
  };
};

type MangaDexMetadataPayload = {
  data?: {
    id?: string;
    attributes?: {
      title?: Record<string, string>;
      altTitles?: Record<string, string>[];
      description?: Record<string, string>;
    };
    relationships?: Array<{
      type?: string;
      attributes?: {
        fileName?: string;
      };
    }>;
  };
};

type LocalComic = Record<string, unknown>;

type LocalComicsResponse = {
  data?: LocalComic[] | { comics?: LocalComic[]; items?: LocalComic[]; results?: LocalComic[] };
  comics?: LocalComic[];
  items?: LocalComic[];
  results?: LocalComic[];
};

function isMangaDexUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function getStringValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
}

function extractLocalComics(payload: LocalComicsResponse) {
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.data?.comics)) return payload.data.comics;
  if (Array.isArray(payload.data?.items)) return payload.data.items;
  if (Array.isArray(payload.data?.results)) return payload.data.results;
  if (Array.isArray(payload.comics)) return payload.comics;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function getLocalTitleMap(source: Record<string, unknown>) {
  const title = getStringValue(source, ["title", "name", "comic_title", "original_title"]);
  const englishTitle = getStringValue(source, ["english_title", "title_en", "en_title"]);
  const spanishTitle = getStringValue(source, ["spanish_title", "title_es", "es_title"]);
  const portugueseTitle = getStringValue(source, ["portuguese_title", "title_pt", "pt_title"]);

  return {
    ...(title ? { es: title, en: title, pt: title } : {}),
    ...(englishTitle ? { en: englishTitle } : {}),
    ...(spanishTitle ? { es: spanishTitle } : {}),
    ...(portugueseTitle ? { pt: portugueseTitle } : {}),
  };
}

function normalizeLocalImageUrl(value: string) {
  if (!value) return SITE_IMAGE;

  const imageUrl = /^https?:\/\//i.test(value)
    ? value
    : `${MONLINE_API_URL}/${value.replace(/^\/+/, "")}`;

  if (imageUrl.includes("dashboard.olympusbiblioteca.com")) {
    return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
  }

  return imageUrl;
}

async function getLocalReadMetadata(slug: string) {
  try {
    const response = await fetch(`${MONLINE_API_URL}/api/comics?limit=100`, { cache: "no-store" });
    if (!response.ok) return null;

    const payload = (await response.json()) as LocalComicsResponse;
    const comic = extractLocalComics(payload).find((item) => {
      const comicSlug = getStringValue(item, ["slug", "manga_slug", "comic_slug"]);
      return comicSlug === slug || slug.endsWith(`-${comicSlug}`);
    });

    if (!comic) return null;

    const title = getLocalizedTitle(
      {
        titleMap: getLocalTitleMap(comic),
        title: getStringValue(comic, ["title", "name", "comic_title", "original_title"]),
      },
      "es"
    ) || SITE_NAME;
    const description = getStringValue(comic, ["description", "synopsis", "summary"]);
    const image = normalizeLocalImageUrl(
      getStringValue(comic, ["coverImage", "cover_image", "cover", "thumbnail", "image", "poster", "url_cover"])
    );

    return { title, description, image };
  } catch {
    return null;
  }
}

async function getMangaDexReadMetadata(id: string) {
  try {
    const response = await fetch(`${MANGADEX_API_URL}/manga/${id}?includes[]=cover_art`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as MangaDexMetadataPayload;
    const manga = payload.data;
    if (!manga) return null;

    const title = getLocalizedTitle(manga, "es") || getLocalizedTitle(manga, "en") || SITE_NAME;
    const description =
      manga.attributes?.description?.es ||
      manga.attributes?.description?.["es-la"] ||
      manga.attributes?.description?.en ||
      `Lee ${title} online en ${SITE_NAME}.`;
    const cover = manga.relationships?.find((relationship) => relationship.type === "cover_art")?.attributes?.fileName;
    const image = cover ? `https://uploads.mangadex.org/covers/${id}/${cover}` : SITE_IMAGE;

    return { title, description, image };
  } catch {
    return null;
  }
}

function getChapterLabel(chapterId?: string, chapter?: ChapterFeedItem | null) {
  const chapterNumber = chapter?.attributes?.chapter || chapterId;
  return chapterNumber ? `Capítulo ${chapterNumber}` : "Capítulo online";
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ chapter?: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const resolvedSearchParams = await searchParams;
  const chapterId = resolvedSearchParams?.chapter ?? id;
  const mangaId = extractComicIdFromSlugId(slug);
  const canonical = absoluteUrl(`/comics/${slug}/chapters/${chapterId}`);
  const sourceMetadata = isMangaDexUuid(mangaId)
    ? await getMangaDexReadMetadata(mangaId)
    : await getLocalReadMetadata(mangaId);
  const mangaTitle = sourceMetadata?.title || "MangaStoon";
  const chapterLabel = getChapterLabel(chapterId);
  const title = chapterId
    ? `${mangaTitle} - ${chapterLabel} online | ${SITE_NAME}`
    : `Leer ${mangaTitle} online | ${SITE_NAME}`;
  const rawDescription = chapterId
    ? `Lee ${mangaTitle} ${chapterLabel} online en ${SITE_NAME}. Continúa la lectura de este manga, manhwa o comic desde el lector.`
    : sourceMetadata?.description || `Lee ${mangaTitle} online en ${SITE_NAME}.`;
  const description = rawDescription.replace(/\s+/g, " ").slice(0, 155);
  const image = sourceMetadata?.image || SITE_IMAGE;

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
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
      siteName: SITE_NAME,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function ReadLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
