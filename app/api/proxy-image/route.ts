import { NextResponse } from "next/server";

// Evitamos que Next.js cachee esta ruta en el servidor
export const dynamic = "force-dynamic";

function fallbackImage(errorCode: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><rect width="100%" height="100%" fill="#141519"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="24" font-weight="600" fill="#9ca3af" font-family="sans-serif">ERROR CARGANDO IMAGEN</text><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="#4b5563">${errorCode}</text></svg>`;
  
  return new NextResponse(svg, {
    status: 502,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "X-Proxy-Version": "manual-fix-final",
    },
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get("url");

    if (!imageUrl) return fallbackImage("NO_URL");

    // Headers para engañar a Olympus y hacernos pasar por navegador
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://olympusbiblioteca.com/",
      "Accept": "image/webp,image/avif,image/png,image/*,*/*;q=0.8",
    };

    // Usamos el fetch nativo, sin inventos raros que rompan Docker
    const res = await fetch(imageUrl, { headers, cache: "no-store" });

    if (!res.ok) {
      return fallbackImage(`HTTP_${res.status}`);
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/webp",
        "Cache-Control": "public, max-age=86400",
        "X-Proxy-Version": "manual-fix-final"
      }
    });

  } catch (error: any) {
    return fallbackImage("FETCH_FAILED");
  }
}