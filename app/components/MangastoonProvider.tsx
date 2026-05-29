"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "../../utils/supabase/client";

const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos
const LAST_SHOW_KEY = "mangastoon_last_ad_time";

export default function MangastoonProvider() {
  const pathname = usePathname();
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    async function checkMonetizationState() {
      // Don't load ads on premium, profile, reset-password, callback, etc.
      const excludedPaths = ["/profile", "/premium", "/reset-password", "/auth"];
      if (excludedPaths.some(p => pathname.startsWith(p))) {
        setShouldLoad(false);
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

          if (profile?.is_premium) {
            // Usuario Premium: no cargamos nada
            setShouldLoad(false);
            return;
          }
        }

        // Si no está registrado o no es premium, verificamos cooldown
        const lastAdTime = localStorage.getItem(LAST_SHOW_KEY);
        const now = Date.now();

        if (!lastAdTime || now - Number(lastAdTime) >= COOLDOWN_MS) {
          localStorage.setItem(LAST_SHOW_KEY, String(now));
          setShouldLoad(true);
        } else {
          setShouldLoad(false);
        }
      } catch (error) {
        console.warn("[MangastoonProvider] Cooldown check bypassed:", error);
        // Fallback: intentar cargar anuncios aplicando el cooldown
        const lastAdTime = localStorage.getItem(LAST_SHOW_KEY);
        const now = Date.now();
        if (!lastAdTime || now - Number(lastAdTime) >= COOLDOWN_MS) {
          localStorage.setItem(LAST_SHOW_KEY, String(now));
          setShouldLoad(true);
        }
      }
    }

    checkMonetizationState();
  }, [pathname]);

  // ─── ANUNCIOS DESACTIVADOS TEMPORALMENTE ──────────────────────────────────
  // Para volver a activar la publicidad dinámica con evasión de AdBlockers:
  // Descomentar todo el bloque de useEffect a continuación.
  /*
  useEffect(() => {
    if (!shouldLoad) return;

    let active = true;
    const scriptsToClean: HTMLScriptElement[] = [];

    async function loadDynamicAds() {
      try {
        const res = await fetch("/api/ads/tag");
        if (!res.ok) return;
        const data = await res.json();
        if (!active || !data.tag) return;

        // Parse HTML and extract script tags
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = data.tag;

        const originalScripts = Array.from(tempDiv.querySelectorAll("script"));
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
          scriptsToClean.push(newScript);
        });
      } catch (err) {
        console.warn("[MangastoonProvider] Error loading dynamic ads:", err);
      }
    }

    loadDynamicAds();

    return () => {
      active = false;
      scriptsToClean.forEach((script) => script.remove());
    };
  }, [shouldLoad]);
  */

  return null;
}
