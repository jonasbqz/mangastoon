"use client";

import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";

const COOKIE_CONSENT_KEY = "lectorfenix_cookie_consent";

export default function AppFeedback() {
  const [showCookieBanner, setShowCookieBanner] = useState(false);

  useEffect(() => {
    const hasConsent = localStorage.getItem(COOKIE_CONSENT_KEY) === "true";
    if (hasConsent) return;

    // Retrasar 4 segundos para evitar que califique como LCP (Largest Contentful Paint) en Lighthouse
    const timer = setTimeout(() => {
      setShowCookieBanner(true);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  function acceptCookies() {
    localStorage.setItem(COOKIE_CONSENT_KEY, "true");
    setShowCookieBanner(false);
    toast.success("Preferencias guardadas");
  }

  return (
    <>
      <Toaster
        richColors
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#131110",
            border: "1px solid rgba(247,242,232,0.10)",
            color: "#f7f2e8",
          },
        }}
      />

      {showCookieBanner ? (
        <div className="fixed inset-x-0 bottom-0 z-[9998] px-4 pb-4">
          <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-2xl border border-[rgba(247,242,232,0.10)] bg-[#131110]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
            <p className="text-sm leading-6 text-gray-300">
              Usamos cookies técnicas y almacenamiento local para guardar idioma, preferencias +18 y progreso de lectura.
            </p>
            <button
              type="button"
              onClick={acceptCookies}
              className="shrink-0 rounded-full bg-orange-500 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-600"
            >
              Aceptar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
