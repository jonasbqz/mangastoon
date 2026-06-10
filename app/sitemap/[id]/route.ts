import { logger } from "../../utils/logger";
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
import { getLocalizedTitle } from "../../utils/get-localized-title";
import { buildComicPath } from "../../utils/slugify";

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

function sitemapMultilingualUrl(
  urlEs: string,
  urlEn: string,
  urlPt: string,
  lastmod: string,
  priority = "0.8"
): string[] {
  if (urlEs === urlEn && urlEn === urlPt) {
    return [
      `  <url>\n    <loc>${escapeXml(urlEs)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`,
    ];
  }

  const links = `\n    <xhtml:link rel="alternate" hreflang="es" href="${escapeXml(urlEs)}" />` +
                `\n    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(urlEn)}" />` +
                `\n    <xhtml:link rel="alternate" hreflang="pt" href="${escapeXml(urlPt)}" />`;

  return [
    `  <url>\n    <loc>${escapeXml(urlEs)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>${links}\n  </url>`,
    `  <url>\n    <loc>${escapeXml(urlEn)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>${links}\n  </url>`,
    `  <url>\n    <loc>${escapeXml(urlPt)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>${links}\n  </url>`,
  ];
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
    data?: Array<{ id: string; attributes?: { updatedAt?: string | null; title?: Record<string, string>; altTitles?: Record<string, string>[] } }>;
  }>(`${MANGADEX_API_URL}/manga?${searchParams.toString()}`);

  return (payload.data ?? []).flatMap((manga) => {
    const lastmod = manga.attributes?.updatedAt
      ? new Date(manga.attributes.updatedAt).toISOString()
      : new Date().toISOString();

    const titleEs = getLocalizedTitle(
      { titleMap: manga.attributes?.title, altTitles: manga.attributes?.altTitles },
      "es"
    );
    const titleEn = getLocalizedTitle(
      { titleMap: manga.attributes?.title, altTitles: manga.attributes?.altTitles },
      "en"
    );
    const titlePt = getLocalizedTitle(
      { titleMap: manga.attributes?.title, altTitles: manga.attributes?.altTitles },
      "pt"
    );

    const urlEs = absoluteUrl(buildComicPath(titleEs, manga.id));
    const urlEn = absoluteUrl(buildComicPath(titleEn, manga.id));
    const urlPt = absoluteUrl(buildComicPath(titlePt, manga.id));

    return sitemapMultilingualUrl(urlEs, urlEn, urlPt, lastmod, "0.8");
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
    const title = getStringValue(record, ["title", "name", "comic_title", "original_title"]) || slug;
    if (!slug) return [];

    const prefixedSlug = slug.startsWith("lc-") ? slug : `lc-${slug}`;
    const url = absoluteUrl(buildComicPath(title, prefixedSlug));

    return sitemapMultilingualUrl(url, url, url, getMonlineLastmod(record), "0.85");
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
    logger.error("Error fetching sitemap boundaries", error);
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
    logger.error("Error fetching sitemap page", sitemapId, error);
    return sitemapUnavailableResponse();
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>`;

  return xmlResponse(xml, 0);
}
