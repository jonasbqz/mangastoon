import type { NextRequest } from "next/server";
import {
  MAX_MANGADEX_SITEMAP_PAGES,
  MAX_MONLINE_SITEMAP_PAGES,
  MANGADEX_API_URL,
  MONLINE_API_URL,
  SITEMAP_PAGE_SIZE,
  absoluteUrl,
  buildMangaDexSitemapSearchParams,
  escapeXml,
  extractMonlineSitemapComics,
  fetchSitemapJson,
  getMangaDexSitemapTotal,
  getMonlineSitemapTotal,
  getSitemapPageCountFromTotal,
  sitemapUnavailableResponse,
  xmlResponse,
} from "../../utils/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MonlineComic = Record<string, unknown>;

function getStringValue(source: MonlineComic, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
}

function getMonlineLastmod(comic: MonlineComic) {
  const rawDate = getStringValue(comic, [
    "updated_at",
    "updatedAt",
    "created_at",
    "createdAt",
    "uploaded_at",
  ]);
  const date = rawDate ? new Date(rawDate) : new Date();

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function sitemapUrl(loc: string, lastmod: string, priority = "0.8") {
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

async function getSitemapBoundaries() {
  const [mangaDexTotal, monlineTotal] = await Promise.all([
    getMangaDexSitemapTotal(),
    getMonlineSitemapTotal(),
  ]);

  const mangaDexPages = getSitemapPageCountFromTotal(
    mangaDexTotal,
    MAX_MANGADEX_SITEMAP_PAGES
  );
  const monlinePages = getSitemapPageCountFromTotal(
    monlineTotal,
    MAX_MONLINE_SITEMAP_PAGES
  );

  return { mangaDexPages, totalPages: mangaDexPages + monlinePages };
}

async function getMangaDexUrls(sitemapId: number) {
  const searchParams = buildMangaDexSitemapSearchParams(
    SITEMAP_PAGE_SIZE,
    sitemapId * SITEMAP_PAGE_SIZE
  );

  const payload = await fetchSitemapJson<{
    data?: Array<{ id: string; attributes?: { updatedAt?: string | null } }>;
  }>(`${MANGADEX_API_URL}/manga?${searchParams.toString()}`);

  return (payload.data ?? []).map((manga) => {
    const lastmod = manga.attributes?.updatedAt
      ? new Date(manga.attributes.updatedAt).toISOString()
      : new Date().toISOString();

    return sitemapUrl(absoluteUrl(`/manga/${manga.id}`), lastmod);
  });
}

async function getMonlineUrls(localSitemapId: number) {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", SITEMAP_PAGE_SIZE.toString());
  searchParams.set("page", String(localSitemapId + 1));

  const payload = await fetchSitemapJson<Parameters<typeof extractMonlineSitemapComics>[0]>(
    `${MONLINE_API_URL}/api/comics?${searchParams.toString()}`
  );

  return extractMonlineSitemapComics(payload).flatMap((comic): string[] => {
    if (!comic || typeof comic !== "object") return [];

    const record = comic as MonlineComic;
    const slug = getStringValue(record, ["slug", "manga_slug", "comic_slug", "id"]);
    if (!slug) return [];

    return [sitemapUrl(absoluteUrl(`/manga/${slug}`), getMonlineLastmod(record), "0.85")];
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idRaw = "0" } = await params;
  const sitemapId = Number.parseInt(idRaw.replace(/\.xml$/, ""), 10);

  if (!Number.isInteger(sitemapId) || sitemapId < 0) {
    return new Response("Not Found", { status: 404 });
  }

  let mangaDexPages = 0;
  let totalPages = 0;

  try {
    ({ mangaDexPages, totalPages } = await getSitemapBoundaries());
  } catch (error) {
    console.error("Error fetching sitemap boundaries:", error);
    return sitemapUnavailableResponse();
  }

  if (sitemapId >= totalPages) {
    return new Response("Not Found", { status: 404 });
  }

  let urls: string[] = [];

  try {
    urls = sitemapId < mangaDexPages
      ? await getMangaDexUrls(sitemapId)
      : await getMonlineUrls(sitemapId - mangaDexPages);
  } catch (error) {
    console.error("Error fetching sitemap page:", sitemapId, error);
    return sitemapUnavailableResponse();
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

  return xmlResponse(xml, 0);
}
