import { NextResponse } from "next/server";
import { MONLINE_API_URL } from "../../utils/monline-config";

export const dynamic = "force-dynamic";

const ALLOWED_SUFFIXES = [
  ".mangadex.org",
  ".weserv.nl",
  ".ikigaimangas.cloud",
  ".olympusbiblioteca.com",
  ".olympusxyz.com",
  ".platformoctopus.workers.dev",
  ".mangavf.fr",
  ".statically.io",
  ".flyimg.io",
  ".yoveo.xyz",
  ".leercapitulo.co",
  ".t34798ndc.com",
];

const ALLOWED_EXACT_HOSTS = new Set([
  "uploads.mangadex.org",
  "images.weserv.nl",
  "media.ikigaimangas.cloud",
  "image.ikigaimangas.cloud",
  "dashboard.olympusbiblioteca.com",
  "dashboard.olympusxyz.com",
  "server-img.platformoctopus.workers.dev",
  "cdn.mangavf.fr",
  "cdn.statically.io",
  "demo.flyimg.io",
  "nobledicion.yoveo.xyz",
  "yoveo.xyz",
  "localhost",
  "127.0.0.1",
  "46.224.213.127",
  "www.leercapitulo.co",
  "leercapitulo.co",
]);

function isAllowedUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();

    // Bloquear loopback y local IPs en producción para prevenir SSRF
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction && (hostname === "localhost" || hostname === "127.0.0.1")) {
      return false;
    }

    if (ALLOWED_EXACT_HOSTS.has(hostname)) {
      return true;
    }

    try {
      const monlineUrl = new URL(MONLINE_API_URL);
      if (hostname === monlineUrl.hostname.toLowerCase()) {
        return true;
      }
    } catch {
      // Ignorar si la URL de Monline configurada no es válida
    }

    for (const suffix of ALLOWED_SUFFIXES) {
      if (hostname.endsWith(suffix)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

function fallbackImage(errorCode: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><rect width="100%" height="100%" fill="#141519"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="24" font-weight="600" fill="#9ca3af" font-family="sans-serif">ERROR CARGANDO IMAGEN</text><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="#4b5563">${errorCode}</text></svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store, no-cache",
      "X-Proxy-Version": "redirect-fallback-v2",
    },
  });
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

export async function GET(req: Request) {
  let imageUrl = "";

  try {
    const { searchParams } = new URL(req.url);
    imageUrl = searchParams.get("url") ?? "";
    const retry = searchParams.get("retry");

    if (!imageUrl) return fallbackImage("NO_URL");

    if (!isAllowedUrl(imageUrl)) {
      return fallbackImage("URL_BLOCKED");
    }

    // Propagar parámetro de reintento para evadir cachés intermedias
    if (retry) {
      try {
        const parsedTarget = new URL(imageUrl);
        parsedTarget.searchParams.set("retry", retry);
        imageUrl = parsedTarget.toString();
      } catch {
        const separator = imageUrl.includes("?") ? "&" : "?";
        imageUrl = `${imageUrl}${separator}retry=${encodeURIComponent(retry)}`;
      }
    }

    const parsedUrl = new URL(imageUrl);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Use exact referrer for Olympus and others to avoid hotlinking blocks
    let referer = parsedUrl.origin;
    if (hostname.endsWith("olympusbiblioteca.com")) {
      referer = "https://olympusbiblioteca.com/";
    } else if (hostname.endsWith("olympusxyz.com")) {
      referer = "https://olympusxyz.com/";
    } else if (hostname.endsWith("yoveo.xyz")) {
      referer = "https://yoveo.xyz/";
    } else if (hostname.endsWith("mangadex.org")) {
      referer = "https://mangadex.org/";
    } else if (hostname.endsWith("t34798ndc.com") || hostname.endsWith("leercapitulo.co")) {
      referer = "https://www.leercapitulo.co/";
    }

    const isHotlinkingBlockedHost = 
      hostname.endsWith("olympusbiblioteca.com") || 
      hostname.endsWith("olympusxyz.com") || 
      hostname.endsWith("yoveo.xyz") ||
      hostname.endsWith("t34798ndc.com") ||
      hostname.endsWith("leercapitulo.co");

    if (isHotlinkingBlockedHost) {
      // IMPORTANT: Next.js Image Optimizer calls this route internally but does NOT
      // send a "Next.js Image Optimizer" User-Agent. Any 307 redirect from here causes
      // a 400 error in /_next/image. We MUST always serve bytes directly for these hosts.

      // 1. Direct server-side fetch with proper Referer
      try {
        const response = await fetchWithTimeout(imageUrl, {
          headers: {
            "Referer": referer,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          },
          next: { revalidate: 31536000 },
        } as any, 5000);

        if (response.ok) {
          const contentType = response.headers.get("Content-Type") || "image/webp";
          const buffer = await response.arrayBuffer();
          return new Response(buffer, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=31536000, immutable",
              "X-Proxy-Method": "direct-server-fetch",
            },
          });
        }
      } catch (error) {
        console.error("[ProxyImage] Direct fetch failed:", error);
      }

      // 2. Fetch via Cloudflare Worker (server-side, never redirect)
      try {
        const workerUrl = `https://server-img.platformoctopus.workers.dev/img?url=${encodeURIComponent(imageUrl)}&origin=${encodeURIComponent(referer)}`;
        const workerRes = await fetchWithTimeout(workerUrl, {
          next: { revalidate: 31536000 },
        } as any, 5000);

        if (workerRes.ok) {
          const contentType = workerRes.headers.get("Content-Type") || "image/webp";
          const buffer = await workerRes.arrayBuffer();
          return new Response(buffer, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=31536000, immutable",
              "X-Proxy-Method": "worker-server-fetch",
            },
          });
        }
      } catch (error) {
        console.error("[ProxyImage] Worker server-side fetch failed:", error);
      }

      // 3. Fallback via weserv (server-side fetch, never redirect)
      try {
        const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&output=webp&q=75`;
        const weservRes = await fetchWithTimeout(weservUrl, {
          next: { revalidate: 31536000 },
        } as any, 5000);

        if (weservRes.ok) {
          const contentType = weservRes.headers.get("Content-Type") || "image/webp";
          const buffer = await weservRes.arrayBuffer();
          return new Response(buffer, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=31536000, immutable",
              "X-Proxy-Method": "weserv-server-fetch",
            },
          });
        }
      } catch (error) {
        console.error("[ProxyImage] Weserv server-side fetch failed:", error);
      }

      // All fetches failed — return SVG fallback (200, never redirect)
      return fallbackImage("ALL_FETCHES_FAILED");
    }

    // For non-hotlinking-blocked hosts, redirect to weserv.nl (browser follows it fine)
    const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&default=${encodeURIComponent(imageUrl)}&output=webp&q=75`;
    return new Response(null, {
      status: 307,
      headers: {
        "Location": weservUrl,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return fallbackImage("FETCH_FAILED");
  }
}
