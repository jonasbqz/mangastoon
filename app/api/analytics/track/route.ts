import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Parser de origen/fuente de tráfico basado en referrer
function parseSource(referrer: string | null): string {
  if (!referrer) return "Direct";
  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();
    if (host.includes("google")) return "Google / Organic";
    if (host.includes("t.me") || host.includes("telegram")) return "Telegram / Community";
    if (host.includes("twitter") || host.includes("x.com")) return "Twitter / Social";
    if (host.includes("facebook")) return "Facebook";
    if (host.includes("discord")) return "Discord";
    return url.hostname;
  } catch (e) {
    return "Direct";
  }
}

// Parser de User-Agent para dispositivo y navegador
function parseUserAgent(ua: string | null) {
  if (!ua) return { device: "Desktop", browser: "Otros" };
  const lower = ua.toLowerCase();
  
  // Categoría de dispositivo
  let device = "Desktop";
  if (lower.includes("ipad") || lower.includes("tablet") || (lower.includes("android") && !lower.includes("mobile"))) {
    device = "Tablet";
  } else if (lower.includes("mobile") || lower.includes("iphone") || lower.includes("android")) {
    device = "Mobile";
  }

  // Navegador principal
  let browser = "Otros";
  if (lower.includes("chrome") || lower.includes("criod")) browser = "Chrome";
  else if (lower.includes("firefox")) browser = "Firefox";
  else if (lower.includes("safari") && !lower.includes("chrome")) browser = "Safari";
  else if (lower.includes("edge") || lower.includes("edg/")) browser = "Edge";
  else if (lower.includes("opera") || lower.includes("opr/")) browser = "Opera";

  return { device, browser };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, session_id } = body;

    if (!session_id) {
      return NextResponse.json({ error: "Falta session_id" }, { status: 400 });
    }

    const supabase = await createClient();
    
    // Obtener el cliente de base de datos apropiado. Si contamos con la clave de servicio
    // (SUPABASE_SERVICE_ROLE_KEY) la usamos para evadir problemas de RLS en analíticas.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xlcsqqwelopzpslxgdni.supabase.co";
    
    const supabaseDb = serviceRoleKey
      ? createSupabaseClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false }
        })
      : supabase;

    // Obtener país basado en los headers geográficos estándar
    const country = 
      request.headers.get("x-vercel-ip-country") || 
      request.headers.get("cf-ipcountry") || 
      request.headers.get("x-real-ip-country") ||
      "Desconocido";

    // 1. REGISTRO DE INICIO DE SESIÓN
    if (type === "session_start") {
      const userAgent = request.headers.get("user-agent");
      const { device, browser } = parseUserAgent(userAgent);
      
      const referrer = body.referrer || null;
      const source = parseSource(referrer);
      const hasAdblocker = body.has_adblocker || false;

      // Obtener el ID del usuario si está logueado en la sesión
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;

      const { error } = await supabaseDb
        .from("analytics_sessions")
        .upsert({
          session_id,
          user_id: userId,
          referrer,
          source,
          device,
          browser,
          country,
          has_adblocker: hasAdblocker,
          created_at: new Date().toISOString()
        }, { onConflict: "session_id" });

      if (error) {
        console.error("[StoonAnalytics] Error al insertar sesión:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, tracking: "session_start" });
    }

    // 2. REGISTRO DE VISTA DE PÁGINA
    if (type === "pageview") {
      const { path, manga_id, chapter_id } = body;

      if (!path) {
        return NextResponse.json({ error: "Falta path para pageview" }, { status: 400 });
      }

      const { error } = await supabaseDb
        .from("analytics_pageviews")
        .insert({
          session_id,
          path,
          manga_id: manga_id || null,
          chapter_id: chapter_id || null,
          duration: 0
        });

      if (error) {
        console.error("[StoonAnalytics] Error al insertar pageview:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, tracking: "pageview" });
    }

    // 3. ACTUALIZACIÓN DE TIEMPO DE PERMANENCIA (HEARTBEAT)
    if (type === "heartbeat") {
      const { path } = body;

      if (!path) {
        return NextResponse.json({ error: "Falta path para heartbeat" }, { status: 400 });
      }

      // Buscar la última vista de página de esta sesión en este path para acumular duración
      const { data: lastPageview, error: fetchError } = await supabaseDb
        .from("analytics_pageviews")
        .select("id, duration")
        .eq("session_id", session_id)
        .eq("path", path)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.warn("[StoonAnalytics] Error al buscar página para heartbeat:", fetchError.message);
      }

      if (lastPageview) {
        // Sumamos 30 segundos (el intervalo que configuraremos en el cliente)
        const { error: updateError } = await supabaseDb
          .from("analytics_pageviews")
          .update({ duration: lastPageview.duration + 30 })
          .eq("id", lastPageview.id);

        if (updateError) {
          console.error("[StoonAnalytics] Error al actualizar duración en heartbeat:", updateError.message);
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true, tracking: "heartbeat" });
    }

    // 4. REGISTRO DE EVENTO PERSONALIZADO
    if (type === "event") {
      const { event_name, event_data } = body;

      if (!event_name) {
        return NextResponse.json({ error: "Falta event_name para event" }, { status: 400 });
      }

      const { error } = await supabaseDb
        .from("analytics_events")
        .insert({
          session_id,
          event_name,
          event_data: event_data || null
        });

      if (error) {
        console.error("[StoonAnalytics] Error al insertar evento:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, tracking: "event" });
    }

    // 5. REGISTRO DE RENDIMIENTO DE CARGA DE HOJAS
    if (type === "performance") {
      const { manga_id, chapter_id, image_url, load_time_ms, success } = body;

      if (load_time_ms === undefined) {
        return NextResponse.json({ error: "Falta load_time_ms para performance" }, { status: 400 });
      }

      const { error } = await supabaseDb
        .from("analytics_performance")
        .insert({
          session_id,
          manga_id: manga_id || null,
          chapter_id: chapter_id || null,
          image_url: image_url || null,
          load_time_ms,
          success: success !== undefined ? success : true
        });

      if (error) {
        console.error("[StoonAnalytics] Error al insertar performance:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, tracking: "performance" });
    }

    return NextResponse.json({ error: "Tipo de tracking no soportado" }, { status: 400 });
  } catch (error: any) {
    console.error("[StoonAnalytics] Error en endpoint track:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
