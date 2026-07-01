import { NextRequest, NextResponse } from "next/server";
import { logger } from "../../utils/logger";
import { fetchMangaVfAPI } from "../../utils/monline";
import { sql } from "../../utils/postgres/client";

export const dynamic = "force-dynamic";

function isValidMangaSearchQuery(q: string): boolean {
  const query = q.trim();
  
  // 1. Evitar URLs completas o nombres de dominio
  if (/^https?:\/\//i.test(query) || query.includes("www.") || query.includes(".com") || query.includes(".net") || query.includes(".co") || query.includes("/") || query.includes("\\")) {
    return false;
  }
  
  // 2. Longitud de caracteres razonable para un titulo de manga
  if (query.length < 3 || query.length > 55) {
    return false;
  }
  
  // 3. Descartar que sean solo números, solo espacios, o solo caracteres no alfanuméricos
  if (/^\d+$/.test(query) || /^[^a-zA-Z0-9\sñáéíóúüÑÁÉÍÓÚÜ]+$/.test(query)) {
    return false;
  }

  // 4. Descartar términos genéricos del sistema o de spam comunes
  const exclusions = new Set([
    "manga", "anime", "leer", "capitulo", "inicio", "favoritos", "perfil", 
    "admin", "financiera", "buscar", "search", "null", "undefined", 
    "capitulos", "comics", "comic", "home", "descargar"
  ]);
  if (exclusions.has(query.toLowerCase())) {
    return false;
  }

  return true;
}

async function logFailedSearch(query: string) {
  if (!isValidMangaSearchQuery(query)) {
    return;
  }

  try {
    const queryNormalized = query.trim();
    
    // Buscar si ya existe la búsqueda fallida en la BD local
    const [existing] = await sql`
      SELECT id, count FROM public.failed_searches WHERE query = ${queryNormalized} LIMIT 1
    ` as any[];

    if (existing) {
      await sql`
        UPDATE public.failed_searches
        SET count = ${existing.count + 1}, last_searched = NOW()
        WHERE id = ${existing.id}
      `;
    } else {
      await sql`
        INSERT INTO public.failed_searches (query, count, last_searched)
        VALUES (${queryNormalized}, 1, NOW())
      `;
    }
  } catch (dbErr) {
    logger.error("Failed to log empty search to local database", dbErr);
  }
}


export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "The ?q= parameter is required." }, { status: 400 });
  }

  try {
    const response = await fetchMangaVfAPI(`/api/v1/manga/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      logger.error(`Search proxy request failed: ${response.status} ${response.statusText}`);
      return NextResponse.json({ error: "Search request failed" }, { status: response.status });
    }
    const data = await response.json();

    // Registrar en segundo plano si la búsqueda no devolvió resultados
    if (!data.results || data.results.length === 0) {
      await logFailedSearch(query);
    }

    return NextResponse.json(data);
  } catch (error) {
    logger.error("Error proxying search request", error);
    return NextResponse.json({ error: "An error occurred while proxying search." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    const cleanQuery = query?.trim();

    if (!cleanQuery) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    await logFailedSearch(cleanQuery);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error("Error in POST failed search:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

