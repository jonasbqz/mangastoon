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

export async function GET(req: Request) {
  let imageUrl = "";

  try {
    const { searchParams } = new URL(req.url);
    imageUrl = searchParams.get("url") ?? "";

    if (!imageUrl) return fallbackImage("NO_URL");

    if (!isAllowedUrl(imageUrl)) {
      return fallbackImage("URL_BLOCKED");
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
    }

    const isHotlinkingBlockedHost = hostname.endsWith("olympusbiblioteca.com") || hostname.endsWith("olympusxyz.com") || hostname.endsWith("yoveo.xyz");

    if (isHotlinkingBlockedHost) {
      const workerUrl = `https://server-img.platformoctopus.workers.dev/img?url=${encodeURIComponent(imageUrl)}&origin=${encodeURIComponent(referer)}`;
      return new Response(null, {
        status: 307,
        headers: {
          "Location": workerUrl,
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Proxy-Method": "worker-redirect",
        },
      });
    }

    // Para todos los demás hosts, redireccionar a images.weserv.nl para cache global y conversión a WebP automática con compresión (calidad 75)
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
