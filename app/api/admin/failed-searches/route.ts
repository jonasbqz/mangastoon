import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server";
import { sql } from "../../../../utils/postgres/client";

export const dynamic = "force-dynamic";

// Helper para validar si el usuario autenticado es administrador
async function checkAdminAuth() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) return null;

    const [profile] = await sql`
      SELECT is_admin FROM public.profiles WHERE id = ${user.id} LIMIT 1
    ` as any[];

    if (!profile || !profile.is_admin) return null;

    return user;
  } catch (err) {
    console.error("[checkAdminAuth] Error:", err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const user = await checkAdminAuth();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const data = await sql`
      SELECT id, query, count, last_searched
      FROM public.failed_searches
      ORDER BY count DESC, last_searched DESC
    ` as any[];

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[failed-searches GET] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await checkAdminAuth();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    await sql`
      DELETE FROM public.failed_searches
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[failed-searches DELETE] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
