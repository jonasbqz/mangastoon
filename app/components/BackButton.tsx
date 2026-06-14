"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useLanguage } from "./language-provider";

const BACK_LABELS = {
  es: "Volver",
  en: "Back",
  pt: "Voltar",
} as const;

export default function BackButton({
  label,
  fixed = false,
  fallbackHref = "/",
  className,
}: {
  label?: string;
  fixed?: boolean;
  fallbackHref?: string;
  className?: string;
}) {
  const { language } = useLanguage();
  const router = useRouter();
  const displayLabel = label ?? BACK_LABELS[language];

  useEffect(() => {
    if (typeof window !== "undefined") {
      const pathParts = window.location.pathname.split("/");
      const lastPart = pathParts[pathParts.length - 1];

      const storedMangaId = sessionStorage.getItem("mangastoon_current_manga_id");
      if (storedMangaId !== lastPart) {
        sessionStorage.setItem("mangastoon_current_manga_id", lastPart);
        sessionStorage.setItem("mangastoon_manga_entry_time", String(Date.now()));
      }
    }
  }, []);

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      const storedReferrer = sessionStorage.getItem("mangastoon_manga_referrer");
      const entryTimeStr = sessionStorage.getItem("mangastoon_manga_entry_time");
      const referrer = document.referrer;
      const isFromReader = referrer && (referrer.includes("/chapters/") || referrer.includes("/read/"));
      const isMangaPage = window.location.pathname.startsWith("/comics/") && 
                          !window.location.pathname.includes("/chapters/") && 
                          !window.location.pathname.includes("/read/");

      let safeReferrer = storedReferrer;
      if (storedReferrer) {
        try {
          const absoluteUrl = storedReferrer.startsWith("/") 
            ? `${window.location.origin}${storedReferrer}`
            : storedReferrer;
          const urlObj = new URL(absoluteUrl);
          if (urlObj.host !== window.location.host || urlObj.pathname.includes("/comics/")) {
            safeReferrer = null;
          }
        } catch {
          if (storedReferrer.includes("/comics/")) {
            safeReferrer = null;
          }
        }
      }

      if (isMangaPage) {
        let isTimedOut = false;
        if (entryTimeStr) {
          const entryTime = parseInt(entryTimeStr, 10);
          if (!isNaN(entryTime) && Date.now() - entryTime > 10 * 60 * 1000) {
            isTimedOut = true;
          }
        }

        if (safeReferrer && !isTimedOut) {
          window.location.href = safeReferrer;
        } else {
          window.location.href = fallbackHref;
        }
      } else if (isFromReader && safeReferrer && !safeReferrer.includes("/chapters/") && !safeReferrer.includes("/read/")) {
        window.location.href = safeReferrer;
      } else if (window.history.length > 1 && !isFromReader) {
        router.back();
      } else {
        window.location.href = fallbackHref;
      }
    } else {
      router.push(fallbackHref);
    }
  };

  const containerClass = className !== undefined ? className : (fixed ? "fixed left-6 top-6 z-50" : "mb-8");

  return (
    <div className={containerClass}>
      <button
        onClick={handleBack}
        className="group inline-flex cursor-pointer items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-heading font-bold text-amber-500 backdrop-blur transition-all hover:border-amber-500/50 hover:bg-amber-500 hover:text-black shadow-md shadow-amber-500/5"
      >
        <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
        {displayLabel}
      </button>
    </div>
  );
}

