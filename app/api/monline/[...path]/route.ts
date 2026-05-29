import { NextResponse } from "next/server";
import { getCached, setCached, stableCacheKey } from "../../../utils/server-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONLINE_PROXY_VERSION = "monline-same-origin-v1";
const MONLINE_UPSTREAM_URL = (
  process.env.MONLINE_API_URL ??
  "http://46.224.213.127:8085"
).replace(/\/$/, "");

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

function buildUpstreamUrl(requestUrl: string, path: string[]) {
  const incomingUrl = new URL(requestUrl);
  const cleanPath = path.map((segment) => encodeURIComponent(segment)).join("/");
  const upstreamUrl = new URL(`${MONLINE_UPSTREAM_URL}/${cleanPath}`);
  upstreamUrl.search = incomingUrl.search;
  return upstreamUrl;
}

type CachedProxyResponse = {
  status: number;
  contentType: string;
  body: string;
};

function getProxyTtl(path: string[], upstreamUrl: URL) {
  const cleanPath = path.join("/");

  if (cleanPath.includes("/pages")) return 60 * 60;
  if (/api\/comics\/[^/]+$/.test(cleanPath)) return 60 * 10;
  if (cleanPath === "api/comics") {
    const hasSearch = Boolean(upstreamUrl.searchParams.get("title"));
    return hasSearch ? 60 : 60;
  }

  return 60 * 2;
}

function passthroughHeaders({
  contentType,
  error = "",
  cacheStatus = "MISS",
  ttl = 120,
}: {
  contentType: string;
  error?: string;
  cacheStatus?: "HIT" | "MISS" | "BYPASS";
  ttl?: number;
}) {
  return new Headers({
    "Content-Type": contentType,
    "Cache-Control": `public, max-age=30, s-maxage=${ttl}, stale-while-revalidate=${ttl * 10}`,
    "X-Monline-Proxy": MONLINE_PROXY_VERSION,
    "X-Monline-Proxy-Error": error,
    "X-Monline-Cache": cacheStatus,
  });
}

export async function GET(request: Request, context: RouteContext) {
  const { path = [] } = await context.params;
  const upstreamUrl = buildUpstreamUrl(request.url, path);
  const ttl = getProxyTtl(path, upstreamUrl);
  const cacheKey = stableCacheKey("monline-proxy", [upstreamUrl.pathname, upstreamUrl.search]);
  const cached = await getCached<CachedProxyResponse>(cacheKey);

  if (cached) {
    return new NextResponse(cached.body, {
      status: cached.status,
      headers: passthroughHeaders({
        contentType: cached.contentType,
        cacheStatus: "HIT",
        ttl,
      }),
    });
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      cache: "no-store",
      headers: {
        Accept: request.headers.get("accept") ?? "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
    });

    const body = await upstreamResponse.text();
    const contentType = upstreamResponse.headers.get("content-type") ?? "application/json; charset=utf-8";

    if (upstreamResponse.ok) {
      await setCached(cacheKey, { status: upstreamResponse.status, contentType, body }, ttl);
    }

    return new NextResponse(body, {
      status: upstreamResponse.status,
      headers: passthroughHeaders({
        contentType,
        error: upstreamResponse.ok ? "" : String(upstreamResponse.status),
        cacheStatus: upstreamResponse.ok ? "MISS" : "BYPASS",
        ttl,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return new NextResponse("Monline proxy failed", {
      status: 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Monline-Proxy": MONLINE_PROXY_VERSION,
        "X-Monline-Proxy-Error": message,
        "X-Monline-Cache": "BYPASS",
      },
    });
  }
}
