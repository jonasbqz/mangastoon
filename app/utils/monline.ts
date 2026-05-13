const MONLINE_API_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8085"
).replace(/\/$/, "");
const MONLINE_TIMEOUT_MS = 2500;

export type MonlineRouteResponse = {
  data?: {
    id?: number | string | null;
  } | null;
};

export type MonlinePagesResponse = {
  data?: {
    url_pages?: unknown;
  } | null;
};

export type MonlineChapterLike = {
  id?: string;
  attributes?: {
    chapter?: string | null;
    title?: string | null;
  };
};

export function toMonlineSegment(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean))) as string[];
}

export function buildMonlineChapterSegments(chapter: MonlineChapterLike | null | undefined) {
  const chapterNumber = chapter?.attributes?.chapter?.trim();
  const title = chapter?.attributes?.title;

  return uniqueNonEmpty([
    toMonlineSegment(title),
    chapterNumber ? toMonlineSegment(`chapter-${chapterNumber}`) : "",
    chapterNumber ? toMonlineSegment(`capitulo-${chapterNumber}`) : "",
    chapterNumber ? toMonlineSegment(chapterNumber) : "",
    toMonlineSegment(chapter?.id),
  ]);
}

export async function fetchMonlinePagesFromRoute({
  mangaSegments,
  chapterSegments,
}: {
  mangaSegments: string[];
  chapterSegments: string[];
}) {
  const cleanMangaSegments = uniqueNonEmpty(mangaSegments.map(toMonlineSegment));
  const cleanChapterSegments = uniqueNonEmpty(chapterSegments.map(toMonlineSegment));

  if (cleanMangaSegments.length === 0 || cleanChapterSegments.length === 0) {
    return [] as string[];
  }

  for (const comicSegment of cleanMangaSegments) {
    for (const chapterSegment of cleanChapterSegments) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), MONLINE_TIMEOUT_MS);

      try {
        const routeUrl = new URL(`${MONLINE_API_URL}/api/chapters/route`);
        routeUrl.searchParams.set("comicSegment", comicSegment);
        routeUrl.searchParams.set("chapterSegment", chapterSegment);

        const routeResponse = await fetch(routeUrl.toString(), {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!routeResponse.ok) continue;

        const routePayload = (await routeResponse.json()) as MonlineRouteResponse;
        const monlineId = routePayload.data?.id;
        if (monlineId === undefined || monlineId === null || monlineId === "") continue;

        const pagesResponse = await fetch(
          `${MONLINE_API_URL}/api/chapters/${encodeURIComponent(String(monlineId))}/pages`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!pagesResponse.ok) continue;

        const pagesPayload = (await pagesResponse.json()) as MonlinePagesResponse;
        const rawPages = pagesPayload.data?.url_pages;
        const pages = Array.isArray(rawPages)
          ? rawPages.filter((url): url is string => typeof url === "string" && url.length > 0)
          : [];

        if (pages.length > 0) return pages;
      } catch {
        continue;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  return [] as string[];
}
