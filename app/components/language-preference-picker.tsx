"use client";

import { ChevronDown, Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SupportedLanguage, useLanguage } from "./language-provider";

const LANGUAGE_OPTIONS: Array<{
  code: SupportedLanguage;
  label: string;
}> = [
  { code: "es", label: "Espa\u00f1ol" },
  { code: "en", label: "English" },
  { code: "pt", label: "Portugu\u00eas" },
];

export default function LanguagePreferencePicker() {
  const router = useRouter();
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
    router.refresh();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setShowLangMenu((current) => !current)}
        className="flex cursor-pointer items-center gap-1 text-sm font-medium text-gray-300 transition-colors hover:text-white"
      >
        <Languages className="h-4 w-4" />
        <span>{language.toUpperCase()}</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {showLangMenu ? (
        <div className="absolute right-0 z-50 mt-2 w-40 rounded-md border border-white/10 bg-[#141519] py-1 shadow-xl">
          {LANGUAGE_OPTIONS.map((option) => {
            const active = option.code === language;

            return (
              <button
                key={option.code}
                type="button"
                onClick={() => handleSelect(option.code)}
                className={`block w-full px-4 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-orange-500/10 font-medium text-orange-500"
                    : "text-gray-300 hover:bg-orange-500/10 hover:text-orange-400"
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
