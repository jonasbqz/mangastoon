import { logger } from "../../utils/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROXY_VERSION = "node-direct-v5-flaresolverr";
const REQUEST_TIMEOUT_MS = 20000;
const FORCED_REFERER = "https://olympusbiblioteca.com/";
const flaresolverrUrl = process.env.FLARESOLVERR_URL || "http://localhost:8191";

let cachedCookies = "";
let cachedUserAgent = "";

type FlareSolverrCookie = {
  name?: string;
  value?: string;
};

type FlareSolverrResponse = {
  status?: string;
  message?: string;
  solution?: {
    userAgent?: string;
    cookies?: FlareSolverrCookie[];
  };
};

function getBrowserHeaders() {
  return {
    "User-Agent":
      cachedUserAgent ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "identity",
    Referer: FORCED_REFERER,
    Origin: "https://olympusbiblioteca.com",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Ch-Ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "same-origin",
    ...(cachedCookies ? { Cookie: cachedCookies } : {}),
  };
}

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const code = record.code ?? record.statusCode ?? record.status;
    if (typeof code === "string" || typeof code === "number") return String(code);
  }

  if (error instanceof Error) return error.message || "UNKNOWN";

  return "UNKNOWN";
}

function proxyHeaders(contentType: string, errorCode = "NONE", cacheControl = "public, max-age=31536000, immutable") {
  return {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "X-Proxy-Version": PROXY_VERSION,
    "X-Proxy-Error": errorCode.slice(0, 180),
  };
}

async function isCloudflareChallenge(response: Response, contentType: string) {
  if (response.headers.get("cf-mitigated") === "challenge") return true;
  if (response.status !== 403 || !contentType.toLowerCase().includes("text/html")) return false;

  const body = await response.clone().text().catch(() => "");
  return body.includes("Just a moment") || body.includes("challenges.cloudflare.com") || body.includes("cf-chl");
}

function fallbackImage(errorCode: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#141519"/>
        <stop offset="1" stop-color="#050506"/>
      </linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ff6b00"/>
        <stop offset="1" stop-color="#ff9f1c"/>
      </linearGradient>
    </defs>
    <rect width="600" height="900" fill="url(#bg)"/>
    <rect x="34" y="34" width="532" height="832" rx="34" fill="none" stroke="#272a31" stroke-width="4"/>
    <circle cx="300" cy="360" r="76" fill="#ff6b0018" stroke="#ff6b00" stroke-width="5"/>
    <path d="M255 346h90M255 380h70" stroke="#ff6b00" stroke-width="18" stroke-linecap="round"/>
    <text x="300" y="505" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="42" font-weight="800">MangaStoon</text>
    <text x="300" y="554" text-anchor="middle" fill="#9ca3af" font-family="Arial, sans-serif" font-size="22">Imagen temporalmente protegida</text>
    <rect x="150" y="610" width="300" height="54" rx="27" fill="url(#accent)"/>
    <text x="300" y="646" text-anchor="middle" fill="#0b0b0c" font-family="Arial, sans-serif" font-size="20" font-weight="800">Seguimos leyendo</text>
  </svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: proxyHeaders("image/svg+xml; charset=utf-8", errorCode, "public, max-age=300, s-maxage=300"),
  });
}

async function fetchImage(targetUrl: URL, signal?: AbortSignal) {
  return fetch(targetUrl, {
    cache: "no-store",
    redirect: "follow",
    signal,
    headers: getBrowserHeaders(),
  });
}

async function refreshFlareSolverrSession(imageUrl: string) {
  const response = await fetch(`${flaresolverrUrl.replace(/\/$/, "")}/v1`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      cmd: "request.get",
      url: imageUrl,
      maxTimeout: 60000,
    }),
  });

  if (!response.ok) {
    throw new Error(`FLARESOLVERR_${response.status}`);
  }

  const payload = (await response.json()) as FlareSolverrResponse;
  const cookies = payload.solution?.cookies ?? [];
  const userAgent = payload.solution?.userAgent ?? "";

  cachedCookies = cookies
    .filter((cookie) => cookie.name && typeof cookie.value === "string")
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  cachedUserAgent = userAgent;

  if (!cachedCookies || !cachedUserAgent) {
    throw new Error(payload.message || "FLARESOLVERR_EMPTY_SOLUTION");
  }
}

async function imageResponse(response: Response, diagnostic = "NONE") {
  const contentType = response.headers.get("content-type") || "image/webp";
  const buffer = await response.arrayBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: proxyHeaders(contentType, diagnostic),
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return fallbackImage("MISSING_URL");
  }

  let targetUrl: URL;

  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return fallbackImage("INVALID_URL");
  }

  if (targetUrl.protocol !== "https:" && targetUrl.protocol !== "http:") {
    return fallbackImage("UNSUPPORTED_PROTOCOL");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const firstResponse = await fetchImage(targetUrl, controller.signal);
    const firstContentType = firstResponse.headers.get("content-type") || "image/webp";
    const firstIsChallenge = await isCloudflareChallenge(firstResponse, firstContentType);

    if (firstResponse.ok && !firstIsChallenge) {
      return imageResponse(firstResponse);
    }

    if (!firstIsChallenge && firstResponse.status !== 403) {
      logger.warn("IMAGE PROXY FALLBACK", rawUrl, String(firstResponse.status));
      return fallbackImage(String(firstResponse.status));
    }

    await refreshFlareSolverrSession(targetUrl.toString());

    const secondResponse = await fetchImage(targetUrl, controller.signal);
    const secondContentType = secondResponse.headers.get("content-type") || "image/webp";
    const secondIsChallenge = await isCloudflareChallenge(secondResponse, secondContentType);

    if (secondResponse.ok && !secondIsChallenge) {
      return imageResponse(secondResponse, "FLARESOLVERR_OK");
    }

    const errorCode = secondIsChallenge ? `CF_CHALLENGE_${secondResponse.status}` : String(secondResponse.status);
    logger.warn("IMAGE PROXY FALLBACK", rawUrl, errorCode);
    return fallbackImage(errorCode);
  } catch (error) {
    const errorCode = getErrorCode(error);
    logger.error("ERROR PROXY", rawUrl, errorCode, error);

    return fallbackImage(errorCode);
  } finally {
    clearTimeout(timeout);
  }
}
