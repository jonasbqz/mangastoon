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
      const referrer = document.referrer;
      if (
        referrer &&
        !referrer.includes("/chapters/") &&
        !referrer.includes("/read/") &&
        !referrer.includes(window.location.pathname)
      ) {
        sessionStorage.setItem("mangastoon_manga_referrer", referrer);
      }
    }
  }, []);

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      const storedReferrer = sessionStorage.getItem("mangastoon_manga_referrer");
      const referrer = document.referrer;
      const isFromReader = referrer && (referrer.includes("/chapters/") || referrer.includes("/read/"));

      let safeReferrer = storedReferrer;
      if (storedReferrer) {
        try {
          const urlObj = new URL(storedReferrer);
          if (urlObj.host !== window.location.host) {
            safeReferrer = null;
          }
        } catch {
          // If it's a relative URL, it's safe.
        }
      }

      if (isFromReader && safeReferrer && !safeReferrer.includes("/chapters/") && !safeReferrer.includes("/read/")) {
        window.location.href = safeReferrer;
      } else if (window.history.length > 1 && !isFromReader) {
        router.back();
      } else {
        router.push(fallbackHref);
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

