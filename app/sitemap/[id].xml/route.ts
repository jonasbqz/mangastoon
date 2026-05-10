import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const mangaDexApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.mangadex.org").replace(/\/$/, "");

export async function GET(request: Request, context: any) {
  const params = await context.params;
  const id = params.id;
  const sitemapId = parseInt(id, 10);

  if (isNaN(sitemapId) || sitemapId < 0 || sitemapId >= 10) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const limit = 100;
  const offset = sitemapId * limit;

  const searchParams = new URLSearchParams();
  searchParams.set("limit", limit.toString());
  searchParams.set("offset", offset.toString());
  searchParams.set("hasAvailableChapters", "true");
  searchParams.set("order[followedCount]", "desc");
  searchParams.append("availableTranslatedLanguage[]", "es");
  searchParams.append("availableTranslatedLanguage[]", "es-la");

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Las rutas estáticas solo van en el primer sitemap
  if (sitemapId === 0) {
    xml += `  <url>\n    <loc>${siteUrl}</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
    xml += `  <url>\n    <loc>${siteUrl}/explore</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
    xml += `  <url>\n    <loc>${siteUrl}/favoritos</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
  }

  try {
    const response = await fetch(`${mangaDexApiUrl}/manga?${searchParams.toString()}`, {
      headers: { "User-Agent": "Mangastoon/1.0.0" },
      next: { revalidate: 86400 } // Caché de 24 horas para no estresar a MangaDex
    });

    if (response.ok) {
      const payload = await response.json();
      const mangas = payload.data ?? [];

      for (const manga of mangas) {
        if (manga.id) {
          const lastMod = manga.attributes?.updatedAt ? new Date(manga.attributes.updatedAt).toISOString() : new Date().toISOString();
          xml += `  <url>\n    <loc>${siteUrl}/manga/${manga.id}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
        }
      }
    }
  } catch (e) {
    console.error("Error fetching sitemap", e);
  }

  xml += `</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate"
    },
  });
}
