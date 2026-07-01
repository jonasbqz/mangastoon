import { NextRequest, NextResponse } from "next/server";
import { sql } from "../../../../utils/postgres/client";
import { fetchMangaVfDetailsBySlug } from "../../../utils/mangadex";
import { logger } from "../../../utils/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 1. Validar clave secreta (Bearer Token)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET_KEY || "lectorfenix_default_cron_secret_123_abc";
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // 2. Obtener la tarea pendiente con mayor prioridad de la base de datos local
    const [job] = await sql`
      SELECT id, manga_title, source_url, status, priority, requested_at, updated_at, error_message
      FROM public.scraper_queue 
      WHERE status = 'pending' 
      ORDER BY priority DESC, requested_at ASC 
      LIMIT 1
    ` as any[];

    if (!job) {
      return NextResponse.json({ success: true, message: "No hay tareas pendientes en la cola." });
    }

    logger.info(`[scraper-worker] Procesando tarea: "${job.manga_title}" (ID: ${job.id}, URL: ${job.source_url})`);

    // 3. Cambiar estado a 'processing' de inmediato para evitar colisiones
    await sql`
      UPDATE public.scraper_queue 
      SET status = 'processing',
          updated_at = NOW()
      WHERE id = ${job.id}
    `;

    // 4. Extraer información en base a la URL
    const sourceUrl = job.source_url;
    let success = false;
    let errorMsg = "";

    try {
      if (sourceUrl.includes("leercapitulo.co") || sourceUrl.includes("leercapitulo.com")) {
        // Verificar preliminarmente si la URL redirige a la raíz (manga inexistente o eliminado)
        try {
          const checkRes = await fetch(sourceUrl, {
            method: "HEAD",
            redirect: "manual",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
          });
          const loc = checkRes.headers.get("location");
          if ((checkRes.status === 301 || checkRes.status === 302) && (!loc || loc === "/" || loc.endsWith("leercapitulo.co") || loc.endsWith("leercapitulo.co/"))) {
            throw new Error("El manga no existe en LeerCapitulo (la URL redirige a la página principal del sitio de origen).");
          }
        } catch (fetchErr: any) {
          if (fetchErr.message && fetchErr.message.includes("redirige")) {
            throw fetchErr;
          }
        }

        // Extraer el slug de la URL
        const match = sourceUrl.match(/\/manga\/([^/]+)/);
        const slug = match && match[1] ? match[1] : null;

        if (!slug) {
          throw new Error("No se pudo extraer el slug de la URL de LeerCapitulo.");
        }

        // Forzar extracción/calentamiento de caché del manga
        const details = await fetchMangaVfDetailsBySlug(slug);
        if (!details || !details.chapters || details.chapters.length === 0) {
          throw new Error(`El scraper de LeerCapitulo no pudo obtener capítulos para el slug "${slug}".`);
        }
        success = true;
      } else {
        throw new Error("Origen de URL no soportado para scraping automatizado (solo LeerCapitulo soportado).");
      }
    } catch (scrapingErr: any) {
      errorMsg = scrapingErr.message || "Error desconocido durante el scraping.";
      logger.error(`[scraper-worker] Falló el scraping para ${job.manga_title}:`, scrapingErr);
    }

    // 5. Guardar el resultado final de la ejecución en la base de datos local
    await sql`
      UPDATE public.scraper_queue 
      SET status = ${success ? "completed" : "failed"},
          error_message = ${success ? null : errorMsg.substring(0, 1000)},
          updated_at = NOW()
      WHERE id = ${job.id}
    `;

    return NextResponse.json({
      success,
      jobId: job.id,
      manga: job.manga_title,
      status: success ? "completed" : "failed",
      error: success ? null : errorMsg
    });

  } catch (err: any) {
    logger.error("[scraper-worker] Error crítico en el endpoint del worker:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
