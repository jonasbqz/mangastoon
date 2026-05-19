import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROXY_VERSION = "web-fetch-v7-flaresolverr";
const REQUEST_TIMEOUT_MS = 40000;
const FORCED_REFERER = "https://olympusbiblioteca.com/";
const FLARESOLVERR_URL = (
  process.env.FLARESOLVERR_URL ||
  process.env.NEXT_PUBLIC_FLARESOLVERR_URL ||
  "http://127.0.0.1:8191"
).replace(/\/$/, "");

let cachedCookies = "";
let cachedUserAgent = "";
let flareSolverrPromise: Promise<void> | null = null;

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

type ImageFetchResult = {
  ok: boolean;
  status: number;
  contentType: string;
  cfMitigated: string | null;
  buffer: ArrayBuffer;
};

function getBrowserHeaders(): HeadersInit {
  return {
    "User-Agent":
      cachedUserAgent ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    Accept: "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
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

function isCloudflareChallenge(response: ImageFetchResult) {
  if (response.cfMitigated === "challenge") return true;
  if (!response.contentType.toLowerCase().includes("text/html")) return false;

  const body = new TextDecoder().decode(response.buffer);
  return body.includes("Just a moment") || body.includes("challenges.cloudflare.com") || body.includes("cf-chl");
}

function shouldUseFlareSolverr(response: ImageFetchResult) {
  return response.status === 403 || response.status === 503 || isCloudflareChallenge(response);
}

function fallbackImage(errorCode: string, debugError?: string) {
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
    status: 502,
    headers: {
      ...proxyHeaders(
        "image/svg+xml; charset=utf-8",
        errorCode,
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      ),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      ...(debugError ? { "X-Debug-Error": debugError.slice(0, 180) } : {}),
    },
  });
}

async function fetchImage(targetUrl: URL, signal?: AbortSignal): Promise<ImageFetchResult> {
  const response = await fetch(targetUrl.toString(), {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
    signal,
    headers: getBrowserHeaders(),
  });

  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type") || "image/webp",
    cfMitigated: response.headers.get("cf-mitigated"),
    buffer: await response.arrayBuffer(),
  };
}

async function refreshFlareSolverrSession(imageUrl: string) {
  const response = await fetch(`${FLARESOLVERR_URL}/v1`, {
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

function imageResponse(response: ImageFetchResult, diagnostic = "NONE") {
  return new NextResponse(response.buffer, {
    status: 200,
    headers: proxyHeaders(response.contentType, diagnostic),
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

    if (firstResponse.ok && !isCloudflareChallenge(firstResponse)) {
      return imageResponse(firstResponse);
    }

    if (!shouldUseFlareSolverr(firstResponse)) {
      console.warn("IMAGE PROXY FALLBACK", rawUrl, String(firstResponse.status));
      return fallbackImage(String(firstResponse.status));
    }

    if (!flareSolverrPromise) {
      flareSolverrPromise = refreshFlareSolverrSession(targetUrl.toString()).finally(() => {
        flareSolverrPromise = null;
      });
    }

    await flareSolverrPromise;

    const secondResponse = await fetchImage(targetUrl, controller.signal);

    if (secondResponse.ok && !isCloudflareChallenge(secondResponse)) {
      return imageResponse(secondResponse, "FLARESOLVERR_OK");
    }

    const errorCode = isCloudflareChallenge(secondResponse)
      ? `CF_CHALLENGE_${secondResponse.status}`
      : String(secondResponse.status);
    console.warn("IMAGE PROXY FALLBACK", rawUrl, errorCode);
    return fallbackImage(errorCode);
  } catch (error) {
    const errorCode = getErrorCode(error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("ERROR PROXY", rawUrl, errorCode, error);

    return fallbackImage(errorCode, errorMessage);
  } finally {
    clearTimeout(timeout);
  }
}
