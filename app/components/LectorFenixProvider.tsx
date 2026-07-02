"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "../../utils/supabase/client";

// Clave y TTL para la caché del estado de premium en sessionStorage
const PREMIUM_CACHE_KEY = "lectorfenix_is_premium";
const PREMIUM_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function getCachedPremiumState(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PREMIUM_CACHE_KEY);
    if (!raw) return null;
    const { value, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) {
      sessionStorage.removeItem(PREMIUM_CACHE_KEY);
      return null;
    }
    return value as boolean;
  } catch {
    return null;
  }
}

function setCachedPremiumState(isPremium: boolean) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      PREMIUM_CACHE_KEY,
      JSON.stringify({ value: isPremium, expiresAt: Date.now() + PREMIUM_CACHE_TTL_MS })
    );
  } catch {}
}

const CLEAN_PATHS = new Set([
  "",
  "/",
  "/explore",
  "/favorites",
  "/favoritos"
]);

function isCleanPath(path: string): boolean {
  const clean = path.replace(/^\/(es|pt|en)(?=\/|$)/, "");
  return CLEAN_PATHS.has(clean || "/");
}

export default function LectorFenixProvider() {
  const pathname = usePathname();
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    // Si la ruta actual debe estar limpia de anuncios, no cargamos nada
    // y removemos cualquier script remanente de navegaciones previas
    if (isCleanPath(pathname)) {
      setShouldLoad(false);
      if (typeof document !== "undefined") {
        document.querySelectorAll(".lectorfenix-ad-injected").forEach((el) => el.remove());
      }
      return;
    }

    async function checkMonetizationState() {
      // Usar caché de sessionStorage para evitar un fetch a Supabase en cada navegación entre capítulos
      const cachedPremium = getCachedPremiumState();
      if (cachedPremium !== null) {
        setShouldLoad(!cachedPremium);
        return;
      }

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Verificar si el usuario es premium
          const { data: profile } = await supabase
            .from("profiles")
            .select("is_premium")
            .eq("id", user.id)
            .maybeSingle();

          const isPremium = !!profile?.is_premium;
          setCachedPremiumState(isPremium);

          if (isPremium) {
            // Usuario Premium: no cargamos nada de publicidad
            setShouldLoad(false);
            return;
          }
        } else {
          // Sin usuario logueado: no es premium, cacheamos false
          setCachedPremiumState(false);
        }

        // Para incentivar la suscripción Premium, removemos el cooldown
        // de 10 minutos para que los anuncios aparezcan en cada navegación.
        setShouldLoad(true);
      } catch (error) {
        console.warn("[LectorFenixProvider] Error checking monetization, falling back to show ads:", error);
        setShouldLoad(true);
      }
    }

    checkMonetizationState();

    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search;
      const fullUrl = currentPath + currentSearch;

      if (
        !currentPath.startsWith("/comics/") &&
        !currentPath.startsWith("/api/")
      ) {
        sessionStorage.setItem("lectorfenix_manga_referrer", fullUrl);
      }
    }
  }, [pathname]);

  // ─── ANUNCIOS ACTIVADOS ──────────────────────────────────────────────────
  useEffect(() => {
    if (!shouldLoad) return;

    let active = true;
    let timeoutId: NodeJS.Timeout;

    function cleanInjectedAdScripts() {
      if (typeof document === "undefined") return;
      document.querySelectorAll(".lectorfenix-ad-injected").forEach((el) => el.remove());
    }

    function runFallback() {
      if (!active) return;
      console.log("[LectorFenixProvider] Loading ads via fallback client-side proxy...");

      const inlineScript = document.createElement("script");
      inlineScript.innerHTML = `
        (function(s,u,z,p){s.src=u,s.setAttribute('data-zone',z),p.appendChild(s);})(document.createElement('script'),'/api/v1/stats/tracker',11014955,document.body||document.documentElement)
      `;
      inlineScript.id = "lectorfenix-ad-inline-fallback";
      inlineScript.className = "lectorfenix-ad-injected";

      document.head.appendChild(inlineScript);
    }

    async function loadDynamicAds() {
      try {
        // 1. Reusar el tag de anuncios pre-cacheado en memoria para no hacer peticiones de red lentas en cada click
        let adTag = (window as any).__lectorfenixCachedAdTag;
        if (!adTag) {
          const res = await fetch("/api/ads/tag");
          if (!res.ok) {
            runFallback();
            return;
          }
          const data = await res.json();
          if (data?.tag) {
            adTag = data.tag;
            (window as any).__lectorfenixCachedAdTag = adTag;
          }
        }

        if (!active || !adTag) {
          runFallback();
          return;
        }

        // 2. Limpiar scripts inyectados previamente para evitar el consumo acumulado de CPU y memoria tras leer varios caps
        cleanInjectedAdScripts();

        // 3. Parsear e inyectar el script de anuncios de forma limpia
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = adTag;

        const originalScripts = Array.from(tempDiv.querySelectorAll("script"));
        if (originalScripts.length === 0) {
          runFallback();
          return;
        }

        originalScripts.forEach((oldScript) => {
          const newScript = document.createElement("script");
          newScript.className = "lectorfenix-ad-injected";
          
          // Copy all attributes
          Array.from(oldScript.attributes).forEach((attr) => {
            newScript.setAttribute(attr.name, attr.value);
          });
          
          // Copy content if inline script
          if (oldScript.innerHTML) {
            newScript.innerHTML = oldScript.innerHTML;
          }
          
          document.head.appendChild(newScript);
        });
      } catch (err) {
        console.warn("[LectorFenixProvider] Error loading dynamic ads, running fallback:", err);
        runFallback();
      }
    }

    // 4. Carga diferida de 1.2 segundos para dejar que la UI cargue las paginas a velocidad luz
    timeoutId = setTimeout(() => {
      loadDynamicAds();
    }, 1200);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [shouldLoad, pathname]);

  return null;
}
