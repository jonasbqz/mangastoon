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

export default function LectorFenixProvider() {
  const pathname = usePathname();
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
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

    // Si ya cargamos el script de Monetag en esta sesión SPA, no lo volvemos a inyectar
    // para evitar DOM thrashing, re-compilación de JS y el lag por re-evaluación en cada click.
    if (typeof window !== "undefined" && (window as any).__monetagLoaded) {
      return;
    }
    if (typeof window !== "undefined") {
      (window as any).__monetagLoaded = true;
    }

    let active = true;

    function runFallback() {
      if (!active) return;
      console.log("[LectorFenixProvider] Loading ads via fallback client-side proxy...");

      const inlineScript = document.createElement("script");
      inlineScript.innerHTML = `
        (function(s,u,z,p){s.src=u,s.setAttribute('data-zone',z),p.appendChild(s);})(document.createElement('script'),'/api/v1/stats/tracker',11014955,document.body||document.documentElement)
      `;
      inlineScript.id = "lectorfenix-ad-inline-fallback";

      document.head.appendChild(inlineScript);
    }

    async function loadDynamicAds() {
      try {
        const res = await fetch("/api/ads/tag");
        if (!res.ok) {
          runFallback();
          return;
        }
        const data = await res.json();
        if (!active || !data.tag) {
          runFallback();
          return;
        }

        // Parse HTML and extract script tags
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = data.tag;

        const originalScripts = Array.from(tempDiv.querySelectorAll("script"));
        if (originalScripts.length === 0) {
          runFallback();
          return;
        }

        originalScripts.forEach((oldScript) => {
          const newScript = document.createElement("script");
          
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

    loadDynamicAds();

    return () => {
      active = false;
    };
  }, [shouldLoad]);

  return null;
}
