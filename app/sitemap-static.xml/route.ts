import { absoluteUrl, escapeXml, xmlResponse } from "../utils/seo";

export const revalidate = 86400;

const staticPages = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/explore", priority: "0.9", changefreq: "daily" },
  { path: "/search", priority: "0.7", changefreq: "weekly" },
  { path: "/favoritos", priority: "0.3", changefreq: "monthly" },
  { path: "/terminos", priority: "0.2", changefreq: "yearly" },
  { path: "/privacidad", priority: "0.2", changefreq: "yearly" },
  { path: "/dmca", priority: "0.2", changefreq: "yearly" },
];

export async function GET() {
  const now = new Date().toISOString();
  const urls = staticPages.map(
    (page) =>
      `  <url>\n    <loc>${escapeXml(absoluteUrl(page.path))}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

  return xmlResponse(xml, 86400);
}
