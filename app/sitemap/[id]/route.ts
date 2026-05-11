import type { NextRequest } from "next/server";
import {
  MANGADEX_API_URL,
  MAX_MANGADEX_SITEMAP_PAGES,
  SITEMAP_PAGE_SIZE,
  absoluteUrl,
  escapeXml,
  xmlResponse,
} from "../../utils/seo";

export const revalidate = 3600;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idRaw = "0" } = await params;
  const sitemapId = Number.parseInt(idRaw.replace(/\.xml$/, ""), 10);

  if (!Number.isInteger(sitemapId) || sitemapId < 0 || sitemapId >= MAX_MANGADEX_SITEMAP_PAGES) {
    return new Response("Not Found", { status: 404 });
  }

  const searchParams = new URLSearchParams();
  searchParams.set("limit", SITEMAP_PAGE_SIZE.toString());
  searchParams.set("offset", (sitemapId * SITEMAP_PAGE_SIZE).toString());
  searchParams.set("hasAvailableChapters", "true");
  searchParams.append("availableTranslatedLanguage[]", "es");
  searchParams.append("availableTranslatedLanguage[]", "en");
  searchParams.append("availableTranslatedLanguage[]", "pt");

  const urls: string[] = [];

  try {
    const response = await fetch(`${MANGADEX_API_URL}/manga?${searchParams.toString()}`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`MangaDex sitemap page failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ id: string; attributes?: { updatedAt?: string | null } }>;
    };

    for (const manga of payload.data ?? []) {
      const lastmod = manga.attributes?.updatedAt
        ? new Date(manga.attributes.updatedAt).toISOString()
        : new Date().toISOString();

      urls.push(
        `  <url>\n    <loc>${escapeXml(absoluteUrl(`/manga/${manga.id}`))}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
      );
    }
  } catch (error) {
    console.error("Error fetching sitemap page:", sitemapId, error);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

  return xmlResponse(xml, 3600);
}
