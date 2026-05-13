import { NextResponse } from "next/server";

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

function passthroughHeaders(response: Response, error = "") {
  return new Headers({
    "Content-Type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Monline-Proxy": MONLINE_PROXY_VERSION,
    "X-Monline-Proxy-Error": error,
  });
}

export async function GET(request: Request, context: RouteContext) {
  const { path = [] } = await context.params;
  const upstreamUrl = buildUpstreamUrl(request.url, path);

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      cache: "no-store",
      headers: {
        Accept: request.headers.get("accept") ?? "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
    });

    const body = await upstreamResponse.arrayBuffer();
    return new NextResponse(body, {
      status: upstreamResponse.status,
      headers: passthroughHeaders(
        upstreamResponse,
        upstreamResponse.ok ? "" : String(upstreamResponse.status)
      ),
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
      },
    });
  }
}
