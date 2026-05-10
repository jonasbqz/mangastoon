import { cookies } from "next/headers";
import type { Metadata } from "next";
import Image from "next/image";
import Script from "next/script";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, BookOpen, CalendarDays } from "lucide-react";
import BackButton from "../../components/BackButton";
import ContinueReadingButton from "../../components/ContinueReadingButton";
import FavoriteButton from "../../components/FavoriteButton";
import SiteHeader, { type SupportedLanguage } from "../../components/site-header";
import SynopsisBlock from "./synopsis";
import { getLocalizedTitle } from "../../utils/get-localized-title";
import { getMangaDexRequestHeaders, toMangaDexApiUrl } from "../../utils/mangadex-config";
import { translateTagName } from "../../utils/tagTranslations";

export const revalidate = 3600;
export const dynamicParams = true;

const MANGADEX_RETRY_DELAY_MS = 1200;

type MangaDexLocalizedText = Record<string, string>;

type MangaDetailsResponse = {
  data?: {
    id: string;
    attributes?: {
      title?: MangaDexLocalizedText;
      altTitles?: MangaDexLocalizedText[];
      description?: MangaDexLocalizedText;
      contentRating?: string;
      tags?: Array<{
        id: string;
        attributes?: {
          name?: MangaDexLocalizedText;
          group?: string;
        };
      }>;
    };
    relationships?: Array<{
      id: string;
      type: string;
      attributes?: {
        name?: string;
        fileName?: string;
      };
    }>;
  };
};

type MangaRelationship = NonNullable<MangaDetailsResponse["data"]>["relationships"];

type ChapterFeedItem = {
  id: string;
  attributes?: {
    chapter?: string | null;
    title?: string | null;
    readableAt?: string | null;
    publishAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    translatedLanguage?: string | null;
  };
  relationships?: Array<{
    id: string;
    type: string;
    attributes?: {
      name?: string;
    };
  }>;
};

type ChapterFeedResponse = {
  data?: ChapterFeedItem[];
  total?: number;
  limit?: number;
  offset?: number;
};

type ChapterLanguageFallback = {
  language: SupportedLanguage;
  total: number;
  firstChapter: ChapterFeedItem | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const response = await fetchMangaDex(`https://api.mangadex.org/manga/${id}?includes[]=cover_art`);

    if (!response.ok) {
      return {
        title: "Manga",
        description: "Lee este manga en MangaStoon.",
        alternates: { canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/manga/${id}` },
      };
    }

    const payload = (await response.json()) as MangaDetailsResponse;
    const manga = payload.data;
    const title =
      manga?.attributes?.title?.en ??
      manga?.attributes?.title?.["es-la"] ??
      manga?.attributes?.title?.es ??
      "Manga";
    const rawDescription =
      manga?.attributes?.description?.es ??
      manga?.attributes?.description?.["es-la"] ??
      manga?.attributes?.description?.en ??
      "Lee este manga en MangaStoon.";
    const description =
      rawDescription.length > 150 ? `${rawDescription.slice(0, 150)}...` : rawDescription;
    const coverArt = manga?.relationships?.find((relationship) => relationship.type === "cover_art");
    const coverFileName = coverArt?.attributes?.fileName;
    const imageUrl = coverFileName
      ? `https://uploads.mangadex.org/covers/${id}/${coverFileName}`
      : "";

    return {
      title,
      description,
      alternates: { canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/manga/${id}` },
      openGraph: {
        title: `${title} | MangaStoon`,
        description,
        images: imageUrl ? [{ url: imageUrl }] : [],
      },
    };
  } catch {
    return {
      title: "Manga",
      description: "Lee este manga en MangaStoon.",
      alternates: { canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/manga/${id}` },
    };
  }
}

const UI_COPY: Record<
  SupportedLanguage,
  {
    addToFavorites: string;
    author: string;
    noAuthor: string;
    activeScan: string;
    synopsis: string;
    readMore: string;
    readLess: string;
    chapters: string;
    totalChapters: string;
    totalSuffix: string;
    noSynopsis: string;
    noChapters: string;
    noChaptersInLanguage: string;
    readInFallbackLanguage: string;
    latestOrder: string;
    noScan: string;
    publishedOn: string;
    chapterFallback: string;
  }
> = {
  es: {
    addToFavorites: "Agregar a Favoritos",
    author: "Autor",
    noAuthor: "No disponible",
    activeScan: "Grupo de Scan Activo",
    synopsis: "Sinopsis",
    readMore: "Leer mas",
    readLess: "Leer menos",
    chapters: "Capitulos",
    totalChapters: "Totales",
    totalSuffix: "capitulos en total",
    noSynopsis: "No hay descripcion disponible para este manga.",
    noChapters: "No encontramos capitulos disponibles todavia.",
    noChaptersInLanguage: "No hay capitulos disponibles en este idioma.",
    readInFallbackLanguage: "Leer en",
    latestOrder: "Mas recientes primero",
    noScan: "Seleccion automatica",
    publishedOn: "Publicado",
    chapterFallback: "Capitulo especial",
  },
  en: {
    addToFavorites: "Add to Favorites",
    author: "Author",
    noAuthor: "Unavailable",
    activeScan: "Active Scan Group",
    synopsis: "Synopsis",
    readMore: "Read more",
    readLess: "Read less",
    chapters: "Chapters",
    totalChapters: "Total",
    totalSuffix: "chapters in total",
    noSynopsis: "No description is available for this manga.",
    noChapters: "We could not find available chapters yet.",
    noChaptersInLanguage: "No chapters are available in this language.",
    readInFallbackLanguage: "Read in",
    latestOrder: "Newest first",
    noScan: "Auto selection",
    publishedOn: "Published",
    chapterFallback: "Special chapter",
  },
  pt: {
    addToFavorites: "Adicionar aos Favoritos",
    author: "Autor",
    noAuthor: "Indisponivel",
    activeScan: "Grupo de Scan Ativo",
    synopsis: "Sinopse",
    readMore: "Ler mais",
    readLess: "Ler menos",
    chapters: "Capitulos",
    totalChapters: "Totais",
    totalSuffix: "capitulos no total",
    noSynopsis: "Nao ha descricao disponivel para este manga.",
    noChapters: "Ainda nao encontramos capitulos disponiveis.",
    noChaptersInLanguage: "Nao ha capitulos disponiveis neste idioma.",
    readInFallbackLanguage: "Ler em",
    latestOrder: "Mais recentes primeiro",
    noScan: "Selecao automatica",
    publishedOn: "Publicado",
    chapterFallback: "Capitulo especial",
  },
};

function normalizeLanguage(value: string | undefined): SupportedLanguage {
  if (value === "en" || value === "pt") {
    return value;
  }

  return "es";
}

const SUPPORTED_CHAPTER_LANGUAGES: SupportedLanguage[] = ["es", "en", "pt"];

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
};


function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMangaDex(url: string, retries = 1) {
  const response = await fetch(toMangaDexApiUrl(url), {
    headers: getMangaDexRequestHeaders(),
    next: { revalidate: 3600 },
  });

  if (response.status === 429 && retries > 0) {
    const retryAfter = Number(response.headers.get("retry-after"));
    await wait(
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : MANGADEX_RETRY_DELAY_MS
    );
    return fetchMangaDex(url, retries - 1);
  }

  return response;
}

function getChapterLanguageVariants(language: SupportedLanguage) {
  if (language === "es") {
    return ["es", "es-la"];
  }

  if (language === "pt") {
    return ["pt-br", "pt"];
  }

  return ["en"];
}

function getLanguageCandidates(language: SupportedLanguage) {
  if (language === "es") {
    return ["es", "es-la", "en", "ja-ro", "ja"];
  }

  if (language === "pt") {
    return ["pt-br", "pt", "en", "ja-ro", "ja"];
  }

  return ["en", "ja-ro", "ja"];
}

function getLocalizedDescription(
  description: MangaDexLocalizedText | undefined,
  language: SupportedLanguage
) {
  if (!description) {
    return null;
  }

  for (const key of getLanguageCandidates(language)) {
    if (description[key]) {
      return description[key];
    }
  }

  return Object.values(description)[0] ?? null;
}

function getLocalizedTagName(tag: { attributes?: { name?: MangaDexLocalizedText } }, language: SupportedLanguage) {
  const names = tag.attributes?.name;

  if (!names) {
    return "Tag";
  }

  for (const key of getLanguageCandidates(language)) {
    if (names[key]) {
      return names[key];
    }
  }

  return translateTagName(Object.values(names)[0] ?? "Tag", language);
}

type MangaDetailTag = NonNullable<
  NonNullable<NonNullable<MangaDetailsResponse["data"]>["attributes"]>["tags"]
>[number];

function hasSensitiveAdultTag(tags: MangaDetailTag[] | undefined) {
  const sensitiveTags = new Set(["Sexual Violence", "Hentai", "Erotica"]);

  return (tags ?? []).some((tag) => {
    const rawName = tag.attributes?.name?.en ?? Object.values(tag.attributes?.name ?? {})[0] ?? "";
    return sensitiveTags.has(rawName);
  });
}

function getCoverUrl(mangaId: string, relationships: MangaRelationship) {
  const coverArt = relationships?.find((relationship) => relationship.type === "cover_art");
  const fileName = coverArt?.attributes?.fileName;

  if (!fileName) {
    return "";
  }

  return `https://uploads.mangadex.org/covers/${mangaId}/${fileName}`;
}

function getAuthorName(relationships: MangaRelationship) {
  const author = relationships?.find((relationship) => relationship.type === "author");
  return author?.attributes?.name ?? null;
}

function getScanGroupName(chapter: ChapterFeedItem | null) {
  const group = chapter?.relationships?.find((relationship) => relationship.type === "scanlation_group");
  return group?.attributes?.name ?? null;
}

function getBestChapterDate(chapter: ChapterFeedItem) {
  return (
    chapter.attributes?.readableAt ??
    chapter.attributes?.publishAt ??
    chapter.attributes?.updatedAt ??
    chapter.attributes?.createdAt ??
    null
  );
}

function getPublishedDate(chapter: ChapterFeedItem, language: SupportedLanguage) {
  const dateString = getBestChapterDate(chapter);

  if (!dateString) {
    return "";
  }

  const locale = language === "pt" ? "pt-BR" : language === "en" ? "en-US" : "es-ES";
  const formatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return formatter.format(new Date(dateString));
}

function buildChapterNumberLabel(
  chapterNumber: string | null | undefined,
  occurrenceIndex: number,
  totalOccurrences: number,
  fallbackLabel: string
) {
  if (!chapterNumber) {
    return fallbackLabel;
  }

  const remainingVariants = totalOccurrences - occurrenceIndex - 1;

  if (remainingVariants <= 0) {
    return `Capitulo ${chapterNumber}`;
  }

  const suffix = 4 + remainingVariants;
  return `Capitulo ${chapterNumber}.${suffix}`;
}

async function fetchMangaDetails(id: string) {
  try {
    const response = await fetchMangaDex(
      `https://api.mangadex.org/manga/${id}?includes[]=cover_art&includes[]=author`
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as MangaDetailsResponse;
    return payload.data ?? null;
  } catch {
    return null;
  }
}

async function fetchMangaChapters(id: string, language: SupportedLanguage) {
  const limit = 100;
  let offset = 0;
  let total = 0;
  const chapters: ChapterFeedItem[] = [];

  try {
    do {
      const params = new URLSearchParams();
      getChapterLanguageVariants(language).forEach((variant) => {
        params.append("translatedLanguage[]", variant);
      });
      params.set("order[chapter]", "desc");
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      params.append("includes[]", "scanlation_group");

      const response = await fetchMangaDex(`https://api.mangadex.org/manga/${id}/feed?${params.toString()}`);

      if (!response.ok) {
        return chapters;
      }

      const payload = (await response.json()) as ChapterFeedResponse;
      const batch = payload.data ?? [];
      total = payload.total ?? batch.length;
      chapters.push(...batch);
      offset += payload.limit ?? limit;
    } while (offset < total);
  } catch {
    return chapters;
  }

  return chapters;
}

async function fetchChapterLanguageFallback(
  id: string,
  language: SupportedLanguage
): Promise<ChapterLanguageFallback> {
  const params = new URLSearchParams();
  getChapterLanguageVariants(language).forEach((variant) => {
    params.append("translatedLanguage[]", variant);
  });
  // Para recomendar otro idioma debemos mandar al inicio real de lectura,
  // no al cap?tulo m?s reciente. Por eso pedimos el cap?tulo m?s antiguo.
  params.set("order[chapter]", "asc");
  params.set("limit", "1");
  params.set("offset", "0");
  params.append("includes[]", "scanlation_group");

  try {
    const response = await fetchMangaDex(`https://api.mangadex.org/manga/${id}/feed?${params.toString()}`);

    if (!response.ok) {
      return { language, total: 0, firstChapter: null };
    }

    const payload = (await response.json()) as ChapterFeedResponse;

    return {
      language,
      total: payload.total ?? payload.data?.length ?? 0,
      firstChapter: payload.data?.[0] ?? null,
    };
  } catch {
    return { language, total: 0, firstChapter: null };
  }
}

async function findBestChapterLanguageFallback(
  id: string,
  currentLanguage: SupportedLanguage
) {
  const fallbackCandidates = SUPPORTED_CHAPTER_LANGUAGES.filter(
    (language) => language !== currentLanguage
  );
  const fallbacks = await Promise.all(
    fallbackCandidates.map((language) => fetchChapterLanguageFallback(id, language))
  );

  return fallbacks
    .filter((fallback) => fallback.total > 0 && fallback.firstChapter)
    .sort((a, b) => b.total - a.total)[0] ?? null;
}

async function fetchConsumetChaptersFallback(title: string) {
  try {
    const searchRes = await fetch(`https://consumet-api-one.vercel.app/manga/manganato/${encodeURIComponent(title)}`);
    const searchData = await searchRes.json();
    const mangaId = searchData.results?.[0]?.id;
    if (!mangaId) return [];

    const infoRes = await fetch(`https://consumet-api-one.vercel.app/manga/manganato/info?id=${mangaId}`);
    const infoData = await infoRes.json();

    return infoData.chapters?.map((ch: any) => ({
      id: ch.id,
      attributes: {
        chapter: ch.number?.toString() || ch.title?.match(/\d+/)?.[0] || "1",
        title: ch.title,
        translatedLanguage: "es"
      }
    })) || [];
  } catch (e) {
    return [];
  }
}

export default async function MangaDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const currentLanguage = normalizeLanguage(cookieStore.get("lang")?.value);
  const copy = UI_COPY[currentLanguage];

  const [manga, initialChapters] = await Promise.all([
    fetchMangaDetails(id),
    fetchMangaChapters(id, currentLanguage),
  ]);

  if (!manga) {
    notFound();
  }

  const displayTitle = getLocalizedTitle(manga, currentLanguage);
  let chapters = initialChapters;

  // Si MangaDex no tiene cap?tulos, inyectamos los de Consumet en la UI
  if (chapters.length === 0) {
    const fallbackChapters = await fetchConsumetChaptersFallback(displayTitle);
    if (fallbackChapters.length > 0) {
      chapters = fallbackChapters;
    }
  }

  const bestFallbackLanguage =
    chapters.length === 0 ? await findBestChapterLanguageFallback(id, currentLanguage) : null;

  const description =
    getLocalizedDescription(manga.attributes?.description, currentLanguage) ?? copy.noSynopsis;
  const tags = (manga.attributes?.tags ?? [])
    .filter((tag) => tag.attributes?.group === "genre")
    .map((tag) => ({
    id: tag.id,
    name: translateTagName(getLocalizedTagName(tag, currentLanguage), currentLanguage),
  }));
  const isExplicitContent =
    manga.attributes?.contentRating === "erotica" ||
    manga.attributes?.contentRating === "pornographic" ||
    hasSensitiveAdultTag(manga.attributes?.tags);
  const coverUrl = getCoverUrl(manga.id, manga.relationships);
  const favoriteManga = {
    id: manga.id,
    mangaDexId: manga.id,
    title: displayTitle,
    url: `/manga/${manga.id}`,
    titleMap: manga.attributes?.title,
    altTitles: manga.attributes?.altTitles,
    originalLanguage: undefined,
    themes: (manga.attributes?.tags ?? [])
      .filter((tag) => tag.attributes?.group === "theme")
      .map((tag) => translateTagName(getLocalizedTagName(tag, currentLanguage), currentLanguage)),
    tags: tags.map((tag) => tag.name),
    genres: tags.map((tag, index) => ({ mal_id: index, name: tag.name })),
    images: coverUrl ? { webp: { large_image_url: coverUrl } } : {},
  };
  const authorName = getAuthorName(manga.relationships) ?? copy.noAuthor;
  const activeScanGroup = getScanGroupName(chapters[0] ?? null) ?? copy.noScan;
  const chapterTotals = new Map<string, number>();
  chapters.forEach((chapter) => {
    const chapterNumber = chapter.attributes?.chapter;

    if (chapterNumber) {
      chapterTotals.set(chapterNumber, (chapterTotals.get(chapterNumber) ?? 0) + 1);
    }
  });
  const chapterOccurrences = new Map<string, number>();
  const chapterRows = chapters.map((chapter) => {
    const chapterNumber = chapter.attributes?.chapter ?? null;
    const occurrenceIndex = chapterNumber
      ? (chapterOccurrences.get(chapterNumber) ?? 0)
      : 0;

    if (chapterNumber) {
      chapterOccurrences.set(chapterNumber, occurrenceIndex + 1);
    }

    return {
      chapter,
      chapterLabel: buildChapterNumberLabel(
        chapterNumber,
        occurrenceIndex,
        chapterNumber ? (chapterTotals.get(chapterNumber) ?? 1) : 1,
        copy.chapterFallback
      ),
      publishedLabel: getPublishedDate(chapter, currentLanguage),
    };
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ComicSeries",
    name: displayTitle,
    description,
    author: {
      "@type": "Person",
      name: authorName !== copy.noAuthor ? authorName : "An?nimo",
    },
    image: coverUrl || "",
    inLanguage: currentLanguage,
  };

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Inicio",
        "item": siteUrl
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Explorar",
        "item": `${siteUrl}/explore`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": displayTitle,
        "item": `${siteUrl}/manga/${manga.id}`
      }
    ]
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Anuncio Vignette de Monetag */}
      <Script id="monetag-vignette" src="https://dd133.com/vignette.min.js" data-zone="10986315" strategy="afterInteractive" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <SiteHeader language={currentLanguage} />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-5 md:px-6 md:py-8 lg:px-8">
        <BackButton />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
          <aside className="md:col-span-4 lg:col-span-3">
            <div className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[150px_minmax(0,1fr)] md:block">
              <div className="max-h-[300px] max-w-[180px] overflow-hidden rounded-xl shadow-2xl shadow-black/50 sm:max-w-[220px] md:max-h-none md:max-w-none">
                {coverUrl ? (
                  <div className="relative aspect-[2/3] w-full">
                    <Image
                      src={coverUrl}
                      alt={displayTitle}
                      fill
                      sizes="(max-width: 640px) 112px, (max-width: 768px) 150px, 320px"
                      className="object-cover object-top"
                      priority
                      unoptimized={true}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="aspect-[2/3] bg-white/5" />
                )}
              </div>

              <div className="rounded-xl border border-white/5 bg-[#141519] p-3 text-center md:mt-4 md:p-4 md:text-left">
                <FavoriteButton manga={favoriteManga} label={copy.addToFavorites} variant="inline" />
                <ContinueReadingButton mangaId={manga.id} />

                <div className="mt-4 md:mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 md:text-[11px]">
                    {copy.author}
                  </p>
                  <p className="mt-2 text-sm text-white">{authorName}</p>
                </div>

                <div className="mt-4 md:mt-5">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 md:text-[11px]">
                    {copy.activeScan}
                  </label>
                  <select
                    defaultValue={activeScanGroup}
                    className="mt-2 w-full rounded-md border border-white/10 bg-[#0a0a0a] p-2 text-sm text-white outline-none"
                  >
                    <option value={activeScanGroup}>{activeScanGroup}</option>
                  </select>
                </div>
              </div>
            </div>
          </aside>

          <section className="text-center md:col-span-8 md:text-left lg:col-span-9">
            <h1 className="mb-4 line-clamp-2 hyphens-auto text-center text-2xl font-semibold leading-tight text-white md:text-left md:text-3xl">
              {displayTitle}
            </h1>

            <div className="flex flex-wrap justify-center gap-2 md:justify-start">
              {isExplicitContent ? (
                <span className="rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.18)]">
                  +18
                </span>
              ) : null}

              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/explore?includedTags=${tag.id}`}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:border-[#ff6b00]/40 hover:bg-[#ff6b00]/10 hover:text-orange-400"
                >
                  {tag.name}
                </Link>
              ))}
            </div>

            <SynopsisBlock
              title={copy.synopsis}
              content={description}
              expandLabel={copy.readMore}
              collapseLabel={copy.readLess}
            />

            <section id="chapters" className="mt-8 scroll-mt-28">
              <div className="mb-4 flex flex-col items-center justify-center gap-2 md:flex-row md:justify-between md:gap-4">
                <div className="border-b-4 border-[#ff6b00] px-3 pb-2 md:border-b-0 md:border-l-4 md:pb-0 md:pl-3">
                  <h2 className="text-2xl font-semibold text-white md:text-2xl">{copy.chapters}</h2>
                </div>
                <p className="text-base leading-relaxed text-gray-400">
                  {chapters.length} {copy.totalChapters}
                </p>
              </div>

              <div className="mb-4 flex items-center justify-between rounded-xl bg-[#141519] px-4 py-3 text-left">
                <p className="text-base leading-relaxed text-gray-400">
                  {chapters.length} {copy.totalSuffix}
                </p>
                <button
                  type="button"
                  className="rounded-md bg-white/5 p-2 text-gray-300 transition-colors hover:bg-white/10"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>

              {chapters.length === 0 ? (
                <div className="rounded-xl bg-[#141519] p-6 text-base leading-relaxed text-gray-400">
                  <p>{bestFallbackLanguage ? copy.noChaptersInLanguage : copy.noChapters}</p>

                  {bestFallbackLanguage?.firstChapter ? (
                    <Link
                      href={`/read/${manga.id}?chapter=${bestFallbackLanguage.firstChapter.id}&lang=${bestFallbackLanguage.language}`}
                      className="mt-5 inline-flex rounded-full bg-[#ff6b00] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400"
                    >
                      {copy.readInFallbackLanguage} {LANGUAGE_LABELS[bestFallbackLanguage.language]} ·{" "}
                      {bestFallbackLanguage.total} {copy.totalSuffix}
                    </Link>
                  ) : null}
                </div>
              ) : (
                <div>
                  {chapterRows.map(({ chapter, chapterLabel, publishedLabel }) => {
                    return (
                      <Link
                        key={chapter.id}
                        href={`/read/${manga.id}?chapter=${chapter.id}`}
                        className="animate-soft-enter mb-2 flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/5 p-4 transition-colors hover:bg-white/10"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <BookOpen className="h-5 w-5 shrink-0 text-[#ff6b00]" />
                          <p className="text-base font-semibold text-white">{chapterLabel}</p>
                        </div>

                        <div className="ml-2 flex shrink-0 items-center gap-2 text-sm text-gray-400">
                          <CalendarDays className="h-4 w-4" />
                          <span>{publishedLabel}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
