import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const mangaDexApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.mangadex.org").replace(/\/$/, "");

type MangaDexSitemapResponse = {
  data?: Array<{
    id?: string;
    attributes?: {
      updatedAt?: string;
    };
  }>;
};

async function getTopMangaRoutes(): Promise<MetadataRoute.Sitemap> {
  const params = new URLSearchParams();
  params.set("limit", "100");
  params.set("hasAvailableChapters", "true");
  params.set("order[followedCount]", "desc");
  params.append("contentRating[]", "safe");
  params.append("contentRating[]", "suggestive");
  params.append("availableTranslatedLanguage[]", "es");
  params.append("availableTranslatedLanguage[]", "es-la");
  params.append("includes[]", "cover_art");

  try {
    const response = await fetch(`${mangaDexApiUrl}/manga?${params.toString()}`, {
      headers: {
        "User-Agent": "Mangastoon/1.0.0",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as MangaDexSitemapResponse;

    return (payload.data ?? [])
      .filter((manga) => Boolean(manga.id))
      .map((manga) => ({
        url: `${siteUrl}/manga/${manga.id}`,
        lastModified: manga.attributes?.updatedAt ? new Date(manga.attributes.updatedAt) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.9,
      }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/explore`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/favoritos`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
    { url: `${siteUrl}/terminos`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/privacidad`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/dmca`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  const mangaRoutes = await getTopMangaRoutes();

  return [...staticRoutes, ...mangaRoutes];
}
