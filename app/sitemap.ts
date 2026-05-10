import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const mangaDexApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.mangadex.org").replace(/\/$/, "");

// Generamos 50 sitemaps, cada uno con 100 mangas = 5,000 mangas indexados
export async function generateSitemaps() {
  return Array.from({ length: 50 }, (_, i) => ({ id: i }));
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const limit = 100;
  const offset = id * limit;

  const params = new URLSearchParams();
  params.set("limit", limit.toString());
  params.set("offset", offset.toString());
  params.set("hasAvailableChapters", "true");
  params.set("order[followedCount]", "desc");
  params.append("contentRating[]", "safe");
  params.append("contentRating[]", "suggestive");
  params.append("availableTranslatedLanguage[]", "es");
  params.append("availableTranslatedLanguage[]", "es-la");
  params.append("includes[]", "cover_art");

  let mangaRoutes: MetadataRoute.Sitemap = [];

  try {
    const response = await fetch(`${mangaDexApiUrl}/manga?${params.toString()}`, {
      headers: { "User-Agent": "Mangastoon/1.0.0" },
      next: { revalidate: 86400 }, // Cach? de 1 d?a para no saturar
    });

    if (response.ok) {
      const payload = await response.json();
      mangaRoutes = (payload.data ?? [])
        .filter((manga: any) => Boolean(manga.id))
        .map((manga: any) => ({
          url: `${siteUrl}/manga/${manga.id}`,
          lastModified: manga.attributes?.updatedAt ? new Date(manga.attributes.updatedAt) : new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.8,
        }));
    }
  } catch (e) {
    console.error("Error generando sitemap parcial", e);
  }

  // Si es el primer sitemap (id 0), inyectamos tambi?n las rutas principales
  if (id === 0) {
    const staticRoutes: MetadataRoute.Sitemap = [
      { url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
      { url: `${siteUrl}/explore`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
      { url: `${siteUrl}/favoritos`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
    ];
    return [...staticRoutes, ...mangaRoutes];
  }

  return mangaRoutes;
}
