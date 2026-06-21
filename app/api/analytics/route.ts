import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server";

async function fetchAllPageviews(supabase: any, startDate: string) {
  let allData: any[] = [];
  let from = 0;
  let to = 4999;
  let hasMore = true;
  
  while (hasMore && allData.length < 30000) { // Capped at 30k for safety
    const { data, error } = await supabase
      .from("analytics_pageviews")
      .select("session_id, path, duration, created_at")
      .gte("created_at", startDate)
      .order("created_at", { ascending: false })
      .range(from, to);
      
    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      if (data.length < 5000) {
        hasMore = false;
      } else {
        from += 5000;
        to += 5000;
      }
    }
  }
  return allData;
}

async function fetchAllSessions(supabase: any, startDate: string) {
  let allData: any[] = [];
  let from = 0;
  let to = 4999;
  let hasMore = true;
  
  while (hasMore && allData.length < 20000) { // Capped at 20k for safety
    const { data, error } = await supabase
      .from("analytics_sessions")
      .select("session_id, user_id, country, device, source, created_at")
      .gte("created_at", startDate)
      .order("created_at", { ascending: false })
      .range(from, to);
      
    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      if (data.length < 5000) {
        hasMore = false;
      } else {
        from += 5000;
        to += 5000;
      }
    }
  }
  return allData;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Validar que el usuario que consulta sea Administrador
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

    // 1.5. Obtener rango de días solicitado
    const daysParam = request.nextUrl.searchParams.get("days");
    const days = daysParam ? parseInt(daysParam, 10) : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // 2. Ejecutar consultas en paralelo para máxima optimización (Conteos exactos y muestras de rendimiento)
    const [
      performanceRes,
      exactSessionsCountRes,
      exactPageviewsCountRes,
      exactPerformanceCountRes
    ] = await Promise.all([
      // Performance de carga (muestra de las 5000 más recientes para promedios)
      supabase
        .from("analytics_performance")
        .select("load_time_ms, success, created_at")
        .gte("created_at", startDate)
        .order("created_at", { ascending: false })
        .limit(5000),

      // Conteo exacto de Sesiones (sin límite)
      supabase
        .from("analytics_sessions")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startDate),

      // Conteo exacto de Pageviews (sin límite)
      supabase
        .from("analytics_pageviews")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startDate),

      // Conteo exacto de Mediciones de rendimiento (sin límite)
      supabase
        .from("analytics_performance")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startDate)
    ]);

    // 3. Obtener todo el historial de sesiones y vistas paginado de forma recursiva e indexada
    const sessionsData = await fetchAllSessions(supabase, startDate);
    const pageviewsData = await fetchAllPageviews(supabase, startDate);
    const performanceData = performanceRes.data || [];

    // --- PROCESAR MÉTRICAS GENERALES (KPIs) ---
    const totalSessions = exactSessionsCountRes.count || 0;
    const totalPageViews = exactPageviewsCountRes.count || 0;
    
    // Contar usuarios únicos (si user_id es nulo, sumamos por session_id)
    const uniqueUserIds = new Set<string>();
    const anonSessionIds = new Set<string>();
    sessionsData.forEach(row => {
      if (row.user_id) {
        uniqueUserIds.add(row.user_id);
      } else {
        anonSessionIds.add(row.session_id);
      }
    });
    const totalActiveUsers = uniqueUserIds.size + anonSessionIds.size;

    // Calcular duración promedio de lectura (tiempo acumulado en vistas de página)
    const pageviewsWithDuration = pageviewsData.filter(p => p.duration > 0);
    const totalDuration = pageviewsWithDuration.reduce((acc, p) => acc + p.duration, 0);
    const avgDurationSecs = pageviewsWithDuration.length > 0 ? Math.round(totalDuration / pageviewsWithDuration.length) : 0;
    
    const mins = Math.floor(avgDurationSecs / 60);
    const secs = avgDurationSecs % 60;
    const averageSessionDuration = `${mins}m ${secs}s`;

    // --- PROCESAR GRÁFICO DIARIO DE VISITAS ---
    // Agrupar vistas de página por fecha DD/MM o HH:00 (si days === 1)
    const dailyViewsMap: { [date: string]: number } = {};
    const now = new Date();
    
    if (days === 1) {
      // Para las últimas 24 horas, agrupamos por bloques de hora
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hour = String(d.getHours()).padStart(2, "0") + ":00";
        dailyViewsMap[hour] = 0;
      }
    } else {
      // Inicializar las fechas con 0
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        dailyViewsMap[`${day}/${month}`] = 0;
      }
    }

    pageviewsData.forEach(p => {
      const pDate = new Date(p.created_at);
      let key = "";
      if (days === 1) {
        key = String(pDate.getHours()).padStart(2, "0") + ":00";
      } else {
        const day = String(pDate.getDate()).padStart(2, "0");
        const month = String(pDate.getMonth() + 1).padStart(2, "0");
        key = `${day}/${month}`;
      }
      if (dailyViewsMap[key] !== undefined) {
        dailyViewsMap[key]++;
      }
    });

    const dailyViews = Object.keys(dailyViewsMap).map(date => ({
      date,
      views: dailyViewsMap[date]
    }));

    // --- PROCESAR PAÍSES ---
    const countryMap: { [country: string]: number } = {};
    sessionsData.forEach(s => {
      const country = s.country || "Desconocido";
      countryMap[country] = (countryMap[country] || 0) + 1;
    });
    const countries = Object.keys(countryMap)
      .map(country => ({
        country,
        users: countryMap[country],
        percentage: totalSessions > 0 ? parseFloat(((countryMap[country] / totalSessions) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.users - a.users)
      .slice(0, 6);

    // --- PROCESAR DISPOSITIVOS ---
    const deviceMap: { [device: string]: number } = {};
    sessionsData.forEach(s => {
      const device = s.device || "Desktop";
      deviceMap[device] = (deviceMap[device] || 0) + 1;
    });
    const devices = Object.keys(deviceMap)
      .map(device => ({
        device,
        users: deviceMap[device],
        percentage: totalSessions > 0 ? parseFloat(((deviceMap[device] / totalSessions) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.users - a.users);

    // --- PROCESAR FUENTES DE TRÁFICO ---
    const sourceMap: { [source: string]: number } = {};
    sessionsData.forEach(s => {
      const source = s.source || "Direct";
      sourceMap[source] = (sourceMap[source] || 0) + 1;
    });
    const trafficSources = Object.keys(sourceMap)
      .map(source => ({
        source,
        users: sourceMap[source],
        percentage: totalSessions > 0 ? parseFloat(((sourceMap[source] / totalSessions) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.users - a.users)
      .slice(0, 6);

    // --- PROCESAR PÁGINAS MÁS LEÍDAS (Manga / Comics) ---
    const pagesMap: { [path: string]: { views: number; title: string } } = {};
    pageviewsData.forEach(p => {
      const path = p.path;
      // Filtrar rutas de manga
      if (path.startsWith("/comics/") || path.startsWith("/manga/")) {
        const parts = path.split("/");
        // Queremos el manga_id, que suele ser la tercera parte (ej: /comics/solo-leveling -> solo-leveling)
        const mangaId = parts[2];
        if (mangaId) {
          const key = `/comics/${mangaId}`;
          // Generamos un título legible basado en el ID
          const title = mangaId
            .split("-")
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
          
          if (!pagesMap[key]) {
            pagesMap[key] = { views: 0, title };
          }
          pagesMap[key].views++;
        }
      }
    });
    const topPages = Object.keys(pagesMap)
      .map(path => ({
        path,
        title: pagesMap[path].title,
        views: pagesMap[path].views
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8);

    // --- PROCESAR PERFORMANCE DE CARGA ---
    const loadTimes = performanceData.map(p => p.load_time_ms);
    const avgLoadTime = loadTimes.length > 0 ? Math.round(loadTimes.reduce((acc, t) => acc + t, 0) / loadTimes.length) : null;
    const loadSuccesses = performanceData.filter(p => p.success).length;
    const successRate = performanceData.length > 0 ? parseFloat(((loadSuccesses / performanceData.length) * 100).toFixed(1)) : null;

    return NextResponse.json({
      isDemo: false,
      summary: {
        activeUsers: totalActiveUsers,
        screenPageViews: totalPageViews,
        averageSessionDuration,
        sessions: totalSessions,
      },
      charts: {
        dailyViews,
      },
      countries,
      devices,
      trafficSources,
      topPages,
      performance: {
        avgLoadTimeMs: avgLoadTime,
        successRatePercentage: successRate,
        totalMeasurements: exactPerformanceCountRes.count || 0
      }
    });
  } catch (error: any) {
    console.error("Error global en endpoint /api/analytics:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
