"use client";

import { ChevronDown, Languages } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SupportedLanguage, useLanguage } from "./language-provider";

const LANGUAGE_OPTIONS: Array<{
  code: SupportedLanguage;
  label: string;
}> = [
  { code: "es", label: "Espa\u00f1ol" },
  { code: "pt", label: "Portugu\u00eas" },
];

export default function LanguagePreferencePicker() {
  const { language, setLanguage } = useLanguage();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(nextLanguage: SupportedLanguage) {
    const selectedLabel = LANGUAGE_OPTIONS.find((option) => option.code === nextLanguage)?.label;
    setLanguage(nextLanguage);
    setShowLangMenu(false);
    toast.success(`Idioma cambiado a ${selectedLabel ?? nextLanguage.toUpperCase()}`);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setShowLangMenu((current) => !current)}
        className="flex cursor-pointer items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-300 transition-colors hover:text-white"
      >
        <Languages className="h-4 w-4 shrink-0" />
        <span className="text-[11px] sm:text-sm">{language.toUpperCase()}</span>
        <ChevronDown className="h-3.5 w-3.5 hidden sm:inline shrink-0" />
      </button>

      {showLangMenu ? (
        <div className="absolute right-0 z-50 mt-2 w-40 rounded-xl border border-[rgba(247,242,232,0.08)] bg-[#131110] py-1 shadow-2xl">
          {LANGUAGE_OPTIONS.map((option) => {
            const active = option.code === language;

            return (
              <button
                key={option.code}
                type="button"
                onClick={() => handleSelect(option.code)}
                className={`block w-full px-4 py-2 text-left text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? "bg-[rgba(255,107,0,0.10)] text-[#ff6b00]"
                    : "text-gray-300 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
