import { NextRequest, NextResponse } from "next/server";
import { logger } from "../../utils/logger";
import { createClient } from "../../../utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

async function logFailedSearch(query: string) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xlcsqqwelopzpslxgdni.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let supabase;
    if (serviceRoleKey) {
      supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
      });
    } else {
      supabase = await createClient();
    }

    const { data: existing, error: findError } = await supabase
      .from("failed_searches")
      .select("id, count")
      .eq("query", query)
      .maybeSingle();

    if (!findError) {
      if (existing) {
        await supabase
          .from("failed_searches")
          .update({
            count: existing.count + 1,
            last_searched: new Date().toISOString()
          })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("failed_searches")
          .insert({
            query: query,
            count: 1,
            last_searched: new Date().toISOString()
          });
      }
    } else {
      logger.error("Error checking failed search in database:", findError);
    }
  } catch (dbErr) {
    logger.error("Failed to log empty search to database", dbErr);
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "The ?q= parameter is required." }, { status: 400 });
  }

  const apiBaseUrl = process.env.MANGAVF_API_URL || process.env.NEXT_PUBLIC_MANGAVF_API_URL || "http://localhost:3001";
  const targetUrl = `${apiBaseUrl}/api/v1/manga/search?q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(targetUrl);
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

