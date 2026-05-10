import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mangastoon.com").replace(/\/$/, "");
const mangaDexApiUrl = "https://api.mangadex.org";

export async function GET(request: NextRequest, context: any) {
  const resolvedParams = await context.params;
  const idRaw = resolvedParams?.id || "0";
  
  // Si Google pide "0.xml", esto lo convierte en "0"
  const cleanId = idRaw.replace(".xml", "");
  const sitemapId = parseInt(cleanId, 10);

  // Seguridad para los 200 sitemaps
  if (isNaN(sitemapId) || sitemapId < 0 || sitemapId >= 200) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const limit = 100;
  const offset = sitemapId * limit;

  const searchParams = new URLSearchParams();
  searchParams.set("limit", limit.toString());
  searchParams.set("offset", offset.toString());
  searchParams.set("hasAvailableChapters", "true");
  searchParams.append("availableTranslatedLanguage[]", "es");
  searchParams.append("availableTranslatedLanguage[]", "en");
  searchParams.append("availableTranslatedLanguage[]", "pt");

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  try {
    const res = await fetch(`${mangaDexApiUrl}/manga?${searchParams.toString()}`);
    if (res.ok) {
      const payload = await res.json();
      const mangas = payload.data ?? [];
      for (const manga of mangas) {
        xml += `  <url>\n    <loc>${siteUrl}/manga/${manga.id}</loc>\n    <changefreq>weekly</changefreq>\n  </url>\n`;
      }
    }
  } catch (e) {
    console.error("Error sitemap id:", sitemapId, e);
  }

  xml += `</urlset>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
