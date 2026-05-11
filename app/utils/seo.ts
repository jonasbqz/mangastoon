export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mangastoon.com").replace(/\/$/, "");

export const SITE_NAME = "MangaStoon";

export const SITE_DESCRIPTION =
  "Explora y lee manga, manhwa y comics online en alta calidad. Actualizaciones diarias en español, inglés y portugués.";

export const SITE_IMAGE = "/opengraph-image";

export const MANGADEX_API_URL = "https://api.mangadex.org";
export const SITEMAP_PAGE_SIZE = 100;
export const MAX_MANGADEX_SITEMAP_PAGES = 200;

export function absoluteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalizedPath}`;
}

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function xmlResponse(xml: string, maxAge = 3600) {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}`,
    },
  });
}
