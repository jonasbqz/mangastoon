import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server";
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
    const supabase = await createClient();

    // 2. Obtener la tarea pendiente con mayor prioridad
    const { data: job, error: fetchError } = await supabase
      .from("scraper_queue")
      .select("*")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("requested_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      logger.error("[scraper-worker] Error obteniendo tarea de la cola:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ success: true, message: "No hay tareas pendientes en la cola." });
    }

    logger.info(`[scraper-worker] Procesando tarea: "${job.manga_title}" (ID: ${job.id}, URL: ${job.source_url})`);

    // 3. Cambiar estado a 'processing' de inmediato para evitar colisiones
    const { error: updateError } = await supabase
      .from("scraper_queue")
      .update({
        status: "processing",
        updated_at: new Date().toISOString()
      })
      .eq("id", job.id);

    if (updateError) {
      logger.error("[scraper-worker] Error al actualizar estado a processing:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 4. Extraer información en base a la URL
    const sourceUrl = job.source_url;
    let success = false;
    let errorMsg = "";

    try {
      if (sourceUrl.includes("leercapitulo.co") || sourceUrl.includes("leercapitulo.com")) {
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

    // 5. Guardar el resultado final de la ejecución
    const { error: updateResultError } = await supabase
      .from("scraper_queue")
      .update({
        status: success ? "completed" : "failed",
        error_message: success ? null : errorMsg.substring(0, 1000), // truncar si es un mensaje muy largo
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", job.id);

    if (updateResultError) {
      logger.error("[scraper-worker] Error guardando estado final en la cola:", updateResultError);
    }

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
