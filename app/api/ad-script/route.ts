import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const res = await fetch("https://jnbhi.com/tag.min.js", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            },
            // Forzamos ignorar caché para que siempre traiga lo último
            cache: "no-store",
        });

        if (!res.ok) {
            return new NextResponse("// Ad script failed", { status: 200 });
        }

        const scriptContent = await res.text();

        return new NextResponse(scriptContent, {
            status: 200,
            headers: {
                "Content-Type": "application/javascript; charset=utf-8",
                "Cache-Control": "public, max-age=3600",
            },
        });
    } catch (error) {
        // Si falla el proxy, devolvemos un comentario vacío para no romper la web
        return new NextResponse("// Ad proxy error", { status: 200 });
    }
}