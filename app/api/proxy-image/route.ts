import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  try {
    // Usamos el proxy público wsrv.nl para engañar al firewall de Cloudflare
    // Esto evita que Hetzner reciba el error 403
    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`wsrv proxy failed with status: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    // Devolvemos la imagen limpia al lector y al generador de PDF
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });

  } catch (error: any) {
    console.error("❌ ERROR PROXY:", error.message);
    return new NextResponse("Image proxy failed", { status: 502 });
  }
}
