import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server";
import { searchLeerCapituloByTitle } from "../../../utils/mangadex";
import { slugify } from "../../../utils/slugify";
import { logger } from "../../../utils/logger";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !profile.is_admin) {
      return NextResponse.json({ error: "Acceso denegado. Se requiere cuenta de administrador." }, { status: 403 });
    }

    const body = await request.json();
    const mangaTitle = body?.title?.trim();
    const priority = body?.priority !== undefined ? Number(body.priority) : 5;

    if (!mangaTitle) {
      return NextResponse.json({ error: "Falta el título del manga" }, { status: 400 });
    }

    // Check DMCA keywords
    const blockedKeywords = ["ruridragon", "ruriragon", "ultimo-saiyuki", "ultimo saiyuki", "saiyuki", "pokemon-adventures", "pokemon adventures", "steel-ball-run", "steel ball run", "jojo"];
    const isBlocked = blockedKeywords.some(kw => mangaTitle.toLowerCase().includes(kw));

    if (isBlocked) {
      return NextResponse.json({ error: "Este manga está bloqueado por reclamos de copyright (DMCA)." }, { status: 400 });
    }

    let leercapituloSlug: string | null = null;
    try {
      leercapituloSlug = await searchLeerCapituloByTitle(mangaTitle);
    } catch (err) {
      logger.error(`[enqueue-by-title] Error searching LeerCapitulo for ${mangaTitle}:`, err);
    }

    if (!leercapituloSlug) {
      // Fallback: guess slug
      leercapituloSlug = slugify(mangaTitle);
    }

    const sourceUrl = `https://www.leercapitulo.co/manga/${leercapituloSlug}/`;

    // Check if already in queue
    const { data: existingJob, error: checkQueueError } = await supabase
      .from("scraper_queue")
      .select("id, status")
      .eq("source_url", sourceUrl)
      .maybeSingle();

    if (checkQueueError) {
      return NextResponse.json({ error: `Error verificando cola: ${checkQueueError.message}` }, { status: 500 });
    }

    if (existingJob) {
      if (existingJob.status === "failed") {
        // Reset failed job
        const { error: updateQueueError } = await supabase
          .from("scraper_queue")
          .update({
            status: "pending",
            priority,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingJob.id);

        if (updateQueueError) {
          return NextResponse.json({ error: `Error reiniciando tarea: ${updateQueueError.message}` }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: `El manga ya estaba en la cola con estado fallido. Se ha reiniciado con éxito. URL: ${sourceUrl}`
        });
      }

      return NextResponse.json({
        success: true,
        message: `El manga ya se encuentra en la cola con estado "${existingJob.status}". URL: ${sourceUrl}`
      });
    }

    // Insert new job
    const { error: insertQueueError } = await supabase
      .from("scraper_queue")
      .insert({
        manga_title: mangaTitle,
        source_url: sourceUrl,
        status: "pending",
        priority,
        requested_by: user.id,
        requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertQueueError) {
      return NextResponse.json({ error: `Error agregando a la cola: ${insertQueueError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Manga agregado a la cola con éxito. URL resuelta: ${sourceUrl}`
    });

  } catch (err: any) {
    logger.error("[enqueue-by-title] Error in API handler:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
