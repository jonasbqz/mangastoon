"use client";

import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";

const COPY = {
  es: {
    title: "Contenido no disponible",
    body: "Este manga ha sido retirado de nuestra plataforma debido a una reclamación por infracción de derechos de autor (DMCA) presentada por el propietario de la obra.",
    btnBack: "Volver al Inicio",
  },
  en: {
    title: "Content Unavailable",
    body: "This manga has been removed from our platform due to a copyright infringement claim (DMCA) submitted by the copyright owner.",
    btnBack: "Back to Home",
  },
  pt: {
    title: "Conteúdo Indisponível",
    body: "Este mangá foi removido da nossa plataforma devido a uma reivindicação de violação de direitos autorais (DMCA) enviada pelo proprietário dos direitos autorais.",
    btnBack: "Voltar ao Início",
  },
};

type SupportedLanguage = "es" | "en" | "pt";

export default function DMCABlocker({ lang }: { lang: SupportedLanguage }) {
  const router = useRouter();
  const copy = COPY[lang] || COPY.es;

  const handleBack = () => {
    router.push("/");
  };

  return (
    <div className="fixed inset-0 z-[9998] flex h-[100dvh] w-[100dvw] items-center justify-center bg-[#0a0908]/95 p-4 pb-20 md:pb-28 backdrop-blur-md">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-500/20 bg-[#141211]/90 p-8 text-center shadow-[0_0_50px_rgba(245,158,11,0.15)]">
        {/* Glow behind icon */}
        <div className="absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <ShieldAlert size={32} />
          </div>
        </div>

        <h2 className="mb-3 text-xl font-bold tracking-tight text-white md:text-2xl">
          {copy.title}
        </h2>
        <p className="mb-8 text-sm text-neutral-400 leading-relaxed px-2">
          {copy.body}
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            {copy.btnBack}
          </button>
        </div>
      </div>
    </div>
  );
}
