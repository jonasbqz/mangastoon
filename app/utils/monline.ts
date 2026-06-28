import { logger } from "./logger";
import { getCached, setCached, stableCacheKey } from "./server-cache";
import { MONLINE_API_URL as MONLINE_CONFIG_API_URL } from "./monline-config";

const MONLINE_API_URL = MONLINE_CONFIG_API_URL;

const MONLINE_TIMEOUT_MS = 8000; // 👈 LO SUBIMOS A 8 SEGUNDOS (Hetzner lo necesita)

export type MonlineRouteResponse = {
  data?: {
    id?: number | string | null;
  } | null;
};

export type MonlinePagesResponse = {
  data?: {
    url_pages?: unknown;
  } | null;
};

export type MonlineChapterLike = {
  id?: string;
  attributes?: {
    chapter?: string | null;
    title?: string | null;
  };
};

export function toMonlineSegment(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean))) as string[];
}

export function isMonlineChapterPageUrl(value: string) {
  const raw = value.trim();
  if (!raw) return false;

  const normalized = decodeURIComponent(raw).toLowerCase();

  // Las páginas reales vienen bajo /storage/comics/{comicId}/{chapterId}/...
  // Las portadas/recomendados vienen bajo /storage/comics/covers/... y no son páginas del capítulo.
  if (normalized.includes("/storage/comics/covers/")) return false;

  // Algunos capítulos traen assets sueltos de reporte/créditos de la fuente.
  // No tocamos imágenes tipo 1_01.webp porque pueden incluir intro + viñetas reales.
  if (normalized.includes("zonaolympus")) return false;
  if (normalized.includes("z (reporte)") || normalized.includes("z%20(reporte)")) return false;
  if (normalized.includes("reporte).webp")) return false;

  // Filtrar píxeles de rastreo y anuncios de terceros.
  // Usamos una regex para evitar falsos positivos con "uploads", "downloads", "reads", etc.
  const hasAds = /(?:^|[^a-zA-Z])ads(?:[^a-zA-Z]|$)/.test(normalized) || 
                 normalized.includes("googleads") || 
                 normalized.includes("adservice");

  if (
    normalized.includes("yandex") ||
    normalized.includes("analytics") ||
    hasAds
  ) {
    return false;
  }

  return true;
}

export function filterMonlineChapterPageUrls(rawPages: unknown) {
  return Array.isArray(rawPages)
    ? rawPages.filter((url): url is string => typeof url === "string" && isMonlineChapterPageUrl(url))
    : [];
}

export function buildMonlineChapterSegments(chapter: MonlineChapterLike | null | undefined) {
  const chapterNumber = chapter?.attributes?.chapter?.trim();
  const title = chapter?.attributes?.title;

  return uniqueNonEmpty([
    toMonlineSegment(title),
    chapterNumber ? toMonlineSegment(`chapter-${chapterNumber}`) : "",
    chapterNumber ? toMonlineSegment(`capitulo-${chapterNumber}`) : "",
    chapterNumber ? toMonlineSegment(chapterNumber) : "",
    toMonlineSegment(chapter?.id),
  ]);
}

async function resolveMonlinePagesFromRoute(cleanMangaSegments: string[], cleanChapterSegments: string[]) {
  for (const comicSegment of cleanMangaSegments) {
    for (const chapterSegment of cleanChapterSegments) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), MONLINE_TIMEOUT_MS);

      try {
        logger.debug(`Buscando en API: ${comicSegment} / ${chapterSegment}`);

        const routeUrl = new URL(`${MONLINE_API_URL}/api/chapters/route`);
        routeUrl.searchParams.set("comicSegment", comicSegment);
        routeUrl.searchParams.set("chapterSegment", chapterSegment);

        const routeResponse = await fetch(routeUrl.toString(), {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!routeResponse.ok) continue;

        const routePayload = (await routeResponse.json()) as MonlineRouteResponse;
        const monlineId = routePayload.data?.id;

        if (monlineId === undefined || monlineId === null || monlineId === "") continue;

        const pagesResponse = await fetch(
          `${MONLINE_API_URL}/api/chapters/${encodeURIComponent(String(monlineId))}/pages`,
          { cache: "no-store", signal: controller.signal }
        );

        if (!pagesResponse.ok) continue;

        const pagesPayload = (await pagesResponse.json()) as MonlinePagesResponse;
        const rawPages = pagesPayload.data?.url_pages;
        const pages = filterMonlineChapterPageUrls(rawPages);

        if (pages.length > 0) {
          logger.debug(`Encontrado: ${pages.length} paginas.`);
          return pages;
        }
      } catch (err) {
        logger.error(`Fallo en intento: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  return [] as string[];
}

export async function fetchMonlinePagesFromRoute({
  mangaSegments,
  chapterSegments,
}: {
  mangaSegments: string[];
  chapterSegments: string[];
}) {
  const cleanMangaSegments = uniqueNonEmpty(mangaSegments.map(toMonlineSegment));
  const cleanChapterSegments = uniqueNonEmpty(chapterSegments.map(toMonlineSegment));

  if (cleanMangaSegments.length === 0 || cleanChapterSegments.length === 0) {
    return [] as string[];
  }

  const cacheKey = stableCacheKey("monline-pages-route", [
    cleanMangaSegments.join("|"),
    cleanChapterSegments.join("|"),
  ]);

  const cachedPages = await getCached<string[]>(cacheKey);
  if (cachedPages) return cachedPages;

  const pages = await resolveMonlinePagesFromRoute(cleanMangaSegments, cleanChapterSegments);

  // Cache successful route matches for a long time, but also cache misses briefly
  // so the same MangaDex chapter does not trigger dozens of repeated Monline probes.
  await setCached(cacheKey, pages, pages.length > 0 ? 60 * 60 * 24 * 7 : 60 * 10);

  return pages;
}

const lastSuccessfulBaseUrl: Record<number, string> = {};

export async function fetchHostAPI(port: number, path: string, init?: RequestInit): Promise<Response> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const defaultBaseUrl =
    port === 8085
      ? MONLINE_API_URL
      : (process.env.NEXT_PUBLIC_MANGAVF_API_URL || process.env.MANGAVF_API_URL || "http://localhost:3001").replace(/\/$/, "");

  // Si tenemos una URL exitosa guardada para este puerto, intentamos esa primero directamente
  const cachedBase = lastSuccessfulBaseUrl[port];
  if (cachedBase) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const url = `${cachedBase}${cleanPath}`;
      const res = await fetch(url, {
        ...init,
        signal: init?.signal ?? controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        return res;
      }
    } catch (e) {
      logger.warn(`[fetchHostAPI] Cached base URL ${cachedBase} failed for port ${port}, re-probing...`, e);
      delete lastSuccessfulBaseUrl[port];
    }
  }

  const targetPorts = port === 8085 ? [8085, 8887, 3000] : [port];
  const targetHosts = ["monline-api", "api", "localhost", "127.0.0.1", "172.17.0.1", "host.docker.internal"];

  const urls: string[] = [
    `${defaultBaseUrl}${cleanPath}`,
  ];

  for (const h of targetHosts) {
    for (const p of targetPorts) {
      urls.push(`http://${h}:${p}${cleanPath}`);
    }
  }

  // Detect and guess gateway IPs dynamically based on container subnets (e.g. 10.0.1.x)
  try {
    const os = require("os");
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const netInfos = interfaces[name] || [];
      for (const info of netInfos) {
        if (info.family === "IPv4" && !info.internal) {
          const ip = info.address;
          const parts = ip.split(".");
          if (parts.length === 4) {
            for (const p of targetPorts) {
              urls.push(`http://${parts[0]}.${parts[1]}.${parts[2]}.1:${p}${cleanPath}`);
              urls.push(`http://${parts[0]}.${parts[1]}.0.1:${p}${cleanPath}`);
            }
          }
        }
      }
    }
  } catch (err) {
    logger.error(`[fetchHostAPI] Error detecting gateways for port ${port}:`, err);
  }

  // Prepend other common 172.x subnets just in case
  for (let i = 18; i <= 31; i++) {
    for (const p of targetPorts) {
      urls.push(`http://172.${i}.0.1:${p}${cleanPath}`);
    }
  }

  const uniqueUrls = Array.from(new Set(urls));

  const fetchPromises = uniqueUrls.map(async (url) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, {
        ...init,
        signal: init?.signal ?? controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Response not ok: ${res.status} from ${url}`);
      }
      return { response: res, url };
    } finally {
      clearTimeout(timeout);
    }
  });

  try {
    const { response, url } = await Promise.any(fetchPromises);
    try {
      const parsedUrl = new URL(url);
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
      lastSuccessfulBaseUrl[port] = baseUrl;
      logger.info(`[fetchHostAPI] Probing succeeded. Cached successful base URL for port ${port}: ${baseUrl}`);
    } catch (e) {
      logger.warn(`[fetchHostAPI] Failed to parse successful URL: ${url}`, e);
    }
    return response;
  } catch (error) {
    logger.warn(`[fetchHostAPI] All parallel attempts failed for port ${port} ${cleanPath}, falling back to default URL:`, error);
    return fetch(`${defaultBaseUrl}${cleanPath}`, init);
  }
}

export async function fetchLocalAPI(path: string, init?: RequestInit): Promise<Response> {
  return fetchHostAPI(8085, path, init);
}

let scraperFailureCount = 0;
let scraperOfflineUntil = 0;
const CIRCUIT_BREAKER_COOLDOWN_MS = 1000 * 60 * 3; // 3 minutos
const FAILURE_THRESHOLD = 5;

function recordScraperFailure() {
  scraperFailureCount++;
  if (scraperFailureCount >= FAILURE_THRESHOLD) {
    scraperOfflineUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    logger.error(`[fetchMangaVfAPI] Scraper failed ${scraperFailureCount} times. Opening circuit breaker for 3 minutes.`);
  }
}

export async function fetchMangaVfAPI(path: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  if (now < scraperOfflineUntil) {
    logger.warn(`[fetchMangaVfAPI] Circuit breaker is OPEN. Scraper is offline. Skipping request to ${path}`);
    throw new Error("Scraper is offline (circuit breaker open)");
  }

  try {
    const res = await fetchHostAPI(3005, path, init);
    if (res.ok) {
      scraperFailureCount = 0;
    } else if (res.status >= 500) {
      recordScraperFailure();
    }
    return res;
  } catch (error) {
    recordScraperFailure();
    throw error;
  }
}

