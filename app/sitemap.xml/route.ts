import {
  MANGADEX_API_URL,
  MAX_MANGADEX_SITEMAP_PAGES,
  SITEMAP_PAGE_SIZE,
  SITE_URL,
  escapeXml,
  xmlResponse,
} from "../utils/seo";

export const revalidate = 3600;

async function getSitemapPageCount() {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", "1");
  searchParams.set("offset", "0");
  searchParams.set("hasAvailableChapters", "true");
  searchParams.append("availableTranslatedLanguage[]", "es");
  searchParams.append("availableTranslatedLanguage[]", "en");
  searchParams.append("availableTranslatedLanguage[]", "pt");

  try {
    const response = await fetch(`${MANGADEX_API_URL}/manga?${searchParams.toString()}`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`MangaDex sitemap stats failed: ${response.status}`);
    }

    const payload = (await response.json()) as { total?: number };
    const total = Math.max(0, payload.total ?? 0);

    return Math.max(1, Math.min(Math.ceil(total / SITEMAP_PAGE_SIZE), MAX_MANGADEX_SITEMAP_PAGES));
  } catch (error) {
    console.error("Error fetching sitemap stats:", error);
    return MAX_MANGADEX_SITEMAP_PAGES;
  }
}

export async function GET() {
  const now = new Date().toISOString();
  const dynamicPageCount = await getSitemapPageCount();
  const sitemaps = [
    `  <sitemap>\n    <loc>${escapeXml(`${SITE_URL}/sitemap-static.xml`)}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`,
  ];

  for (let page = 0; page < dynamicPageCount; page += 1) {
    sitemaps.push(
      `  <sitemap>\n    <loc>${escapeXml(`${SITE_URL}/sitemap/${page}.xml`)}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps.join("\n")}\n</sitemapindex>`;

  return xmlResponse(xml, 3600);
}
