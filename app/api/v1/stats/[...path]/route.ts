import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const path = pathSegments.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  const queryString = searchParams ? `?${searchParams}` : "";

  const currentHost = (globalThis as any).currentMonetagHost || "al5sm.com";
  let targetUrl = "";

  if (path === "tracker") {
    targetUrl = `https://${currentHost}/tag.min.js`;
  } else if (path === "apu.php") {
    targetUrl = `https://vayfuzsu.net/apu.php${queryString}`;
  } else {
    // Fallback proxy to propeller/monetag script gateways
    targetUrl = `https://${currentHost}/${path}${queryString}`;
  }

  try {
    const headers = new Headers();
    const userAgent = request.headers.get("user-agent");
    const accept = request.headers.get("accept");
    const acceptLanguage = request.headers.get("accept-language");
    const referer = request.headers.get("referer");

    if (userAgent) headers.set("user-agent", userAgent);
    if (accept) headers.set("accept", accept);
    if (acceptLanguage) headers.set("accept-language", acceptLanguage);
    if (referer) headers.set("referer", referer);

    const fetchOptions: RequestInit = {
      method: "GET",
      headers,
      redirect: "follow",
    };

    if (path === "tracker") {
      fetchOptions.cache = "force-cache";
      (fetchOptions as any).next = { revalidate: 3600 };
    } else {
      fetchOptions.cache = "no-store";
    }

    const response = await fetch(targetUrl, fetchOptions);

    const body = await response.arrayBuffer();

    const responseHeaders = new Headers();
    const contentType = response.headers.get("content-type");
    if (contentType) {
      responseHeaders.set("content-type", contentType);
    } else {
      if (path === "tracker") {
        responseHeaders.set("content-type", "application/javascript");
      }
    }

    const cacheControl = response.headers.get("cache-control");
    if (cacheControl) responseHeaders.set("cache-control", cacheControl);

    return new NextResponse(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[StatsProxy GET] Proxy error for path:", path, error);
    return new NextResponse("Error loading asset", { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const path = pathSegments.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  const queryString = searchParams ? `?${searchParams}` : "";

  const currentHost = (globalThis as any).currentMonetagHost || "al5sm.com";
  let targetUrl = "";

  if (path === "apu.php") {
    targetUrl = `https://vayfuzsu.net/apu.php${queryString}`;
  } else {
    targetUrl = `https://${currentHost}/${path}${queryString}`;
  }

  try {
    const bodyText = await request.text();
    const headers = new Headers();
    const userAgent = request.headers.get("user-agent");
    const contentType = request.headers.get("content-type");
    const referer = request.headers.get("referer");

    if (userAgent) headers.set("user-agent", userAgent);
    if (contentType) headers.set("content-type", contentType);
    if (referer) headers.set("referer", referer);

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: bodyText,
      redirect: "follow",
    });

    const body = await response.arrayBuffer();
    const responseHeaders = new Headers();
    const responseContentType = response.headers.get("content-type");
    if (responseContentType) responseHeaders.set("content-type", responseContentType);

    return new NextResponse(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[StatsProxy POST] Proxy error for path:", path, error);
    return new NextResponse("Error proxying request", { status: 500 });
  }
}
