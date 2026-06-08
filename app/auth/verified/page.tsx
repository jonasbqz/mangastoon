"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { CheckCircle2, Sparkles, ArrowRight, BookOpen } from "lucide-react";
import { useLanguage } from "../../components/language-provider";
import SiteHeader from "../../components/site-header";

const VERIFIED_COPY = {
  es: {
    title: "¡Cuenta Verificada!",
    subtitle: "Verification Successful",
    desc: "Tu correo electrónico ha sido confirmado con éxito. Ya tenés acceso completo a MangaStoon, tus listas de lectura e historial sincronizados.",
    cta: "Comenzar a Leer",
    secondaryCta: "Ir a mi Perfil"
  },
  en: {
    title: "Account Verified!",
    subtitle: "Verification Successful",
    desc: "Your email address has been successfully confirmed. You now have full access to MangaStoon, with your reading lists and history synchronized.",
    cta: "Start Reading",
    secondaryCta: "Go to Profile"
  },
  pt: {
    title: "Conta Verificada!",
    subtitle: "Verification Successful",
    desc: "Seu endereço de e-mail foi confirmado com sucesso. Agora você tem acesso completo ao MangaStoon, com suas listas de leitura e histórico sincronizados.",
    cta: "Começar a Ler",
    secondaryCta: "Ir para meu Perfil"
  }
};

export default function VerifiedPage() {
  const { language } = useLanguage();
  const t = VERIFIED_COPY[language] || VERIFIED_COPY.es;

  return (
    <div className="min-h-screen bg-[#0d0c0b] text-white flex flex-col">
      <SiteHeader language={language} />

      <main className="flex-1 w-full flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
        {/* Glow de fondo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[350px] bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md p-8 rounded-3xl border text-center relative overflow-hidden bg-gradient-to-b from-neutral-900/60 to-neutral-950/80 shadow-2xl"
          style={{ borderColor: "rgba(255, 107, 0, 0.15)" }}>
          
          {/* Círculo de glow animado detrás del check */}
          <div className="absolute top-12 left-1/2 -translate-x-1/2 h-20 w-20 rounded-full bg-orange-500/5 blur-xl pointer-events-none" />

          {/* Icono de Check Animado Gigante */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 text-orange-500 border border-orange-500/25 mb-6 shadow-[0_0_25px_rgba(255,107,0,0.15)] relative"
          >
            <CheckCircle2 size={40} className="stroke-[2.2] animate-pulse" />
            <motion.div
              initial={{ rotate: -20, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="absolute -top-1 -right-1 text-amber-400"
            >
              <Sparkles size={16} className="fill-amber-400/20" />
            </motion.div>
          </motion.div>

          {/* Título y subtítulo */}
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <h1 className="text-2xl font-heading font-black text-gray-100 uppercase tracking-tight">
              {t.title}
            </h1>
            <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-orange-500/65 mt-1">
              {t.subtitle}
            </p>
          </motion.div>

          {/* Descripción */}
          <motion.p
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-4 text-xs text-neutral-400 leading-relaxed max-w-xs mx-auto font-medium"
          >
            {t.desc}
          </motion.p>

          {/* Botones de acción */}
          <motion.div
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="mt-8 flex flex-col gap-3"
          >
            <Link
              href="/explore"
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-heading font-bold uppercase tracking-wider text-black bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-orange-500/10"
            >
              <BookOpen size={14} />
              <span>{t.cta}</span>
              <ArrowRight size={14} className="stroke-[2.5]" />
            </Link>

            <Link
              href="/profile"
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-heading font-bold uppercase tracking-wider transition-all border border-white/5 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10"
            >
              <span>{t.secondaryCta}</span>
            </Link>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
