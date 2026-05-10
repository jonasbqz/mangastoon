import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const mangaDexApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.mangadex.org").replace(/\/$/, "");

// Usamos 'any' en el context para que Next.js no se queje en el build
export async function GET(_request: NextRequest, context: any) {
  const params = await context.params;
  // Como la carpeta ahora se llama [id], si Google pide /sitemap/0.xml, 
  // el valor de id será "0.xml". Le quitamos la extensión.
  const idRaw = params?.id || "0";
  const cleanId = idRaw.replace(".xml", "");
  const sitemapId = parseInt(cleanId, 10);

  if (isNaN(sitemapId) || sitemapId < 0 || sitemapId >= 200) {
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
  searchParams.append("availableTranslatedLanguage[]", "en");
  searchParams.append("availableTranslatedLanguage[]", "pt");
  searchParams.append("availableTranslatedLanguage[]", "pt-br");

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  if (sitemapId === 0) {
    xml += `  <url>\n    <loc>${siteUrl}</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
  }

  try {
    const response = await fetch(`${mangaDexApiUrl}/manga?${searchParams.toString()}`, {
      headers: { "User-Agent": "Mangastoon/1.0.0" },
      next: { revalidate: 86400 }
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
    console.error("Error sitemap:", e);
  }

  xml += `</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400"
    },
  });
}
