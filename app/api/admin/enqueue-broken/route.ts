import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server";
import { searchLeerCapituloByTitle } from "../../../utils/mangadex";
import { slugify } from "../../../utils/slugify";
import { isDmcaBlocked } from "../../../utils/dmca";
import { logger } from "../../../utils/logger";

export const dynamic = "force-dynamic";

function isMangaDexUuidHelper(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

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

    let targetMangaId: string | null = null;
    try {
      const body = await request.json();
      targetMangaId = body?.mangaId || null;
    } catch {}

    // Fetch broken chapters (filter by mangaId if specified)
    let query = supabase
      .from("broken_chapters")
      .select("manga_id, manga_title");

    if (targetMangaId) {
      query = query.eq("manga_id", targetMangaId);
    }

    const { data: brokenChapters, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: `Error fetching broken chapters: ${fetchError.message}` }, { status: 500 });
    }

    if (!brokenChapters || brokenChapters.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: "No broken chapters found." });
    }

    // Group by unique manga_id
    const uniqueMangasMap = new Map<string, string>();
    for (const ch of brokenChapters) {
      if (ch.manga_id && ch.manga_title) {
        uniqueMangasMap.set(ch.manga_id, ch.manga_title);
      }
    }

    logger.info(`[enqueue-broken] Found ${uniqueMangasMap.size} unique broken mangas to process.`);

    let enqueuedCount = 0;
    let skippedCount = 0;

    for (const [mangaId, mangaTitle] of uniqueMangasMap.entries()) {
      try {
        const cleanSlug = mangaId.startsWith("lc-") ? mangaId.substring(3) : mangaId;
        let leercapituloSlug: string | null = null;

        // Try resolving via searchLeerCapituloByTitle first
        try {
          leercapituloSlug = await searchLeerCapituloByTitle(mangaTitle);
        } catch (err) {
          logger.error(`[enqueue-broken] Error searching LeerCapitulo for ${mangaTitle}:`, err);
        }

        if (!leercapituloSlug) {
          // Fallback: build a guess slug
          if (isMangaDexUuidHelper(cleanSlug)) {
            leercapituloSlug = slugify(mangaTitle);
          } else {
            const uuidMatch = cleanSlug.match(/^(.*?)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
            leercapituloSlug = uuidMatch && uuidMatch[1] ? uuidMatch[1] : cleanSlug;
          }
        }

        if (leercapituloSlug) {
          const sourceUrl = `https://www.leercapitulo.co/manga/${leercapituloSlug}/`;

          // Check DMCA blocklist
          const blockedKeywords = ["ruridragon", "ruriragon", "ultimo-saiyuki", "ultimo saiyuki", "saiyuki", "pokemon-adventures", "pokemon adventures", "steel-ball-run", "steel ball run", "jojo"];
          const isBlocked = blockedKeywords.some(kw => mangaTitle.toLowerCase().includes(kw) || leercapituloSlug!.toLowerCase().includes(kw));

          if (!isBlocked && !isDmcaBlocked(mangaId)) {
            // Check if already in queue
            const { data: existingJob, error: checkQueueError } = await supabase
              .from("scraper_queue")
              .select("id, status")
              .eq("source_url", sourceUrl)
              .maybeSingle();

            if (!checkQueueError) {
              if (!existingJob) {
                const { error: insertQueueError } = await supabase
                  .from("scraper_queue")
                  .insert({
                    manga_title: mangaTitle,
                    source_url: sourceUrl,
                    status: "pending",
                    priority: 2, // Slightly lower priority than direct manual enqueue, but higher than 0
                    requested_by: user.id,
                    requested_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });

                if (insertQueueError) {
                  logger.error(`[enqueue-broken] Error auto-enqueueing:`, insertQueueError);
                } else {
                  enqueuedCount++;
                }
              } else if (existingJob.status === "failed") {
                const { error: updateQueueError } = await supabase
                  .from("scraper_queue")
                  .update({
                    status: "pending",
                    priority: 2,
                    error_message: null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", existingJob.id);

                if (updateQueueError) {
                  logger.error(`[enqueue-broken] Error resetting failed job:`, updateQueueError);
                } else {
                  enqueuedCount++;
                }
              } else {
                skippedCount++; // Already pending or completed
              }
            }
          } else {
            skippedCount++;
          }
        }
      } catch (err) {
        logger.error(`[enqueue-broken] Error processing manga ${mangaTitle}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      processed: uniqueMangasMap.size,
      enqueued: enqueuedCount,
      skipped: skippedCount,
      message: `Procesados ${uniqueMangasMap.size} mangas. Encolados/Reiniciados: ${enqueuedCount}. Omitidos: ${skippedCount}.`
    });

  } catch (err: any) {
    logger.error("[enqueue-broken] Error in API handler:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
