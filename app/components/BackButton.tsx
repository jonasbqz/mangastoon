"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "./language-provider";

const BACK_LABELS = {
  es: "Volver",
  en: "Back",
  pt: "Voltar",
} as const;

export default function BackButton({
  label,
  fixed = false,
}: {
  label?: string;
  fixed?: boolean;
}) {
  const router = useRouter();
  const { language } = useLanguage();
  const displayLabel = label ?? BACK_LABELS[language];

  return (
    <div className={fixed ? "fixed left-6 top-6 z-50" : "mb-8"}>
      <button
        type="button"
        onClick={() => router.back()}
        className="group flex cursor-pointer items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-400 backdrop-blur transition-all hover:border-orange-500/50 hover:bg-orange-500 hover:text-black"
      >
        <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
        {displayLabel}
      </button>
    </div>
  );
}
