import { NextResponse } from "next/server";
import { fetchLocalAPI } from "./monline";
import { MONLINE_API_URL as MONLINE_CONFIG_API_URL } from "./monline-config";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lectorfenix.com").replace(/\/$/, "");

export const SITE_NAME = "LectorFenix";

export const SITE_DESCRIPTION =
  "Explora y lee manga, manhwa y comics online en alta calidad. Actualizaciones diarias en español, inglés y portugués.";

export const SITE_IMAGE = "/opengraph-image";

export const MANGADEX_API_URL = "https://api.mangadex.org";
export const SITEMAP_PAGE_SIZE = 100;
// MangaDex rechaza offsets >= 10000; con 100 URLs por sitemap, el limite seguro es 0..99.
export const MAX_MANGADEX_SITEMAP_PAGES = 100;
export const MAX_MONLINE_SITEMAP_PAGES = 100;

export const MONLINE_API_URL = MONLINE_CONFIG_API_URL;

export const MANGADEX_SITEMAP_LANGUAGES = ["es", "en", "pt", "pt-br"] as const;
export const SITEMAP_UPSTREAM_TIMEOUT_MS = 30000;
export const SITEMAP_RETRY_AFTER_SECONDS = 3600;

export class SitemapUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SitemapUnavailableError";
  }
}

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
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}`,
    },
  });
}

export function sitemapUnavailableResponse(message = "Sitemap temporarily unavailable") {
  return new NextResponse(message, {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": String(SITEMAP_RETRY_AFTER_SECONDS),
    },
  });
}

export async function fetchSitemapJson<T>(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SITEMAP_UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new SitemapUnavailableError(`Sitemap upstream failed: ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof SitemapUnavailableError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SitemapUnavailableError("Sitemap upstream timed out");
    }
    throw new SitemapUnavailableError("Sitemap upstream request failed");
  } finally {
    clearTimeout(timeout);
  }
}

export function buildMangaDexSitemapSearchParams(limit: number, offset: number) {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));

  // Intencional: NO usamos hasAvailableChapters=true ni availableTranslatedLanguage[].
  // Esos filtros dependen de capitulos disponibles y dejan fuera fichas indexables.
  // El sitemap debe cubrir fichas es/en/pt cuando existan en titulo/alt/metadata,
  // sin bloquear mangas nuevos que aun no tengan capitulos traducidos.

  return searchParams;
}

export function getSitemapPageCountFromTotal(total: number, maxPages: number) {
  return Math.max(0, Math.min(Math.ceil(Math.max(0, total) / SITEMAP_PAGE_SIZE), maxPages));
}

export async function getMangaDexSitemapTotal() {
  try {
    const searchParams = buildMangaDexSitemapSearchParams(1, 0);

    const payload = await fetchSitemapJson<{ total?: number }>(
      `${MANGADEX_API_URL}/manga?${searchParams.toString()}`
    );
    return Math.max(0, payload.total ?? 0);
  } catch (error) {
    console.error("[Sitemap SEO] Error fetching MangaDex sitemap total, using fallback:", error);
    return 93000; // Fallback resiliente aproximado (930 páginas)
  }
}

type MonlineSitemapPayload = {
  data?: unknown[] | { total?: number; comics?: unknown[]; items?: unknown[]; results?: unknown[] };
  total?: number;
  pagination?: { total?: number };
  comics?: unknown[];
  items?: unknown[];
  results?: unknown[];
};

export function getMonlineSitemapTotalFromPayload(payload: MonlineSitemapPayload, fallback = 0) {
  if (typeof payload.total === "number") return payload.total;
  if (typeof payload.pagination?.total === "number") return payload.pagination.total;
  if (!Array.isArray(payload.data) && typeof payload.data?.total === "number") return payload.data.total;
  return fallback;
}

export function extractMonlineSitemapComics(payload: MonlineSitemapPayload) {
  if (Array.isArray(payload.data)) return payload.data;
  if (!Array.isArray(payload.data) && Array.isArray(payload.data?.comics)) return payload.data.comics;
  if (!Array.isArray(payload.data) && Array.isArray(payload.data?.items)) return payload.data.items;
  if (!Array.isArray(payload.data) && Array.isArray(payload.data?.results)) return payload.data.results;
  if (Array.isArray(payload.comics)) return payload.comics;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

export async function getMonlineSitemapTotal() {
  try {
    const searchParams = new URLSearchParams();
    searchParams.set("limit", "1");
    searchParams.set("page", "1");

    const response = await fetchLocalAPI(`/api/comics?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error(`Response not ok: ${response.status}`);
    }
    const payload = (await response.json()) as MonlineSitemapPayload;
    return Math.max(0, getMonlineSitemapTotalFromPayload(payload, extractMonlineSitemapComics(payload).length));
  } catch (error) {
    console.error("[Sitemap SEO] Error fetching Monline sitemap total, using fallback:", error);
    return 2000; // Fallback resiliente aproximado (20 páginas)
  }
}

export function safeJsonLd(data: unknown): { __html: string } {
  return {
    __html: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
}
