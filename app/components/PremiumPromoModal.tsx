"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X, Crown, Shield, Sparkles, FileText, Zap } from "lucide-react";
import { createClient } from "../../utils/supabase/client";
import { useLanguage } from "./language-provider";
import { C } from "../lib/colors";

const COPY = {
  es: {
    title: "¡Probá LectorFenix Premium Gratis! 👑",
    subtitle: "Desbloqueá la mejor experiencia de lectura, descargas y personalización sin límites.",
    feature1: "Lectura Sin Anuncios",
    feature1Desc: "Navegación 100% limpia sin scripts de publicidad molesta.",
    feature2: "Acceso Anticipado",
    feature2Desc: "Leé nuevos capítulos hasta 3 días antes de su estreno.",
    feature3: "Descargas PDF de Tomos Completos",
    feature3Desc: "Compilá hasta 50 capítulos juntos para tu PC o celular.",
    feature4: "Servidores VIP de Alta Velocidad",
    feature4Desc: "Visualización instantánea a través de nuestra red optimizada.",
    cta: "Activar Prueba Gratis Ahora",
    dismiss: "Quizás más tarde"
  },
  en: {
    title: "Try LectorFenix Premium for Free! 👑",
    subtitle: "Unlock the ultimate reading, download, and customization experience without limits.",
    feature1: "Ad-Free Reading",
    feature1Desc: "100% clean browsing without annoying external advertisements.",
    feature2: "Early Access",
    feature2Desc: "Read new chapters up to 3 days before their general release.",
    feature3: "Full Volume PDF Downloads",
    feature3Desc: "Compile up to 50 chapters together to read offline.",
    feature4: "High-Speed VIP Servers",
    feature4Desc: "Instant image loading through our optimized CDN network.",
    cta: "Start Free Trial Now",
    dismiss: "Maybe later"
  },
  pt: {
    title: "Experimente o LectorFenix Premium Grátis! 👑",
    subtitle: "Desbloqueie a melhor experiência de leitura, downloads e personalização sem limites.",
    feature1: "Leitura Sem Anúncios",
    feature1Desc: "Navegação 100% limpa sem scripts de anúncios irritantes.",
    feature2: "Acesso Antecipado",
    feature2Desc: "Leia novos capítulos até 3 dias antes do lançamento geral.",
    feature3: "Downloads de PDF de Volumes Completos",
    feature3Desc: "Compile até 50 capítulos juntos para o seu PC ou celular.",
    feature4: "Servidores VIP de Alta Velocidade",
    feature4Desc: "Visualização instantânea através da nossa rede otimizada.",
    cta: "Ativar Teste Grátis Agora",
    dismiss: "Talvez mais tarde"
  }
};

export default function PremiumPromoModal() {
  const router = useRouter();
  const { language } = useLanguage();
  const t = COPY[language as keyof typeof COPY] || COPY.es;
  const supabase = createClient();

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    async function checkEligibilityAndShow() {
      // 1. Verificar si ya fue descartado en localStorage
      const isDismissed = localStorage.getItem("mangastoon:premium-invite-dismissed");
      if (isDismissed === "true") return;

      // 2. Verificar si el usuario está logueado y si ya es Premium
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_premium")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.is_premium) {
          return; // Ya es premium, no mostrar modal
        }
      }

      // 3. Mostrar el modal tras 1.5 segundos de retraso para mejorar el UX
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500);

      return () => clearTimeout(timer);
    }

    checkEligibilityAndShow();
  }, [mounted, supabase]);

  const handleDismiss = () => {
    setIsOpen(false);
    localStorage.setItem("mangastoon:premium-invite-dismissed", "true");
  };

  const handleCTA = async () => {
    setIsOpen(false);
    localStorage.setItem("mangastoon:premium-invite-dismissed", "true");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/premium?register=true");
    } else {
      router.push("/premium");
    }
  };

  if (!mounted) return null;

  const modalElement = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          {/* Backdrop con desenfoque de fondo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ background: "rgba(5, 4, 3, 0.85)", backdropFilter: "blur(6px)" }}
            onClick={handleDismiss}
          />

          {/* Tarjeta del Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="relative z-10 w-full max-w-[480px] overflow-hidden rounded-3xl"
            style={{
              background: "#121110",
              border: `1px solid rgba(255, 107, 0, 0.22)`,
              boxShadow: "0 50px 100px -20px rgba(0,0,0,0.9), 0 0 40px rgba(255, 107, 0, 0.04)"
            }}
          >
            {/* Botón de cerrar (X) en la esquina */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute right-4 top-4 z-50 flex h-8 w-8 items-center justify-center rounded-full transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer text-gray-400 hover:text-white"
              style={{
                border: `1px solid ${C.border}`,
                background: "rgba(247,242,232,0.04)"
              }}
            >
              <X size={15} />
            </button>

            {/* Cabecera con Arte Visual e Ilustración */}
            <div className="relative h-44 w-full overflow-hidden bg-neutral-950 border-b border-white/[0.04] flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-t from-[#121110] via-transparent to-transparent z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-transparent to-amber-500/10 z-10 pointer-events-none" />
              <img
                src="/premium_welcome_artwork.png"
                alt="Premium Promotion"
                className="h-full w-full object-cover opacity-60 scale-105 select-none"
              />
              {/* Insignia Flotante de Corona */}
              <div className="absolute z-20 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-black shadow-lg shadow-orange-500/30">
                <Crown size={28} className="fill-black stroke-[2.2] animate-bounce-subtle" />
              </div>
            </div>

            {/* Contenido principal */}
            <div className="p-6 md:p-8 pt-5 flex flex-col">
              {/* Título y Subtítulo */}
              <div className="text-center mb-6">
                <h3 className="text-xl md:text-2xl font-heading font-black tracking-tight text-white uppercase leading-tight bg-gradient-to-r from-amber-200 via-orange-400 to-yellow-100 bg-clip-text text-transparent">
                  {t.title}
                </h3>
                <p className="mt-2 text-xs md:text-sm text-neutral-400 leading-relaxed font-medium">
                  {t.subtitle}
                </p>
              </div>

              {/* Lista de Beneficios */}
              <div className="flex flex-col gap-4 mb-8">
                {/* Beneficio 1 */}
                <div className="flex gap-3.5 items-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/15">
                    <Shield size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-200">{t.feature1}</h4>
                    <p className="text-[10px] text-neutral-400 mt-0.5 leading-normal">{t.feature1Desc}</p>
                  </div>
                </div>

                {/* Beneficio 2 */}
                <div className="flex gap-3.5 items-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/15">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-200">{t.feature2}</h4>
                    <p className="text-[10px] text-neutral-400 mt-0.5 leading-normal">{t.feature2Desc}</p>
                  </div>
                </div>

                {/* Beneficio 3 */}
                <div className="flex gap-3.5 items-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/15">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-200">{t.feature3}</h4>
                    <p className="text-[10px] text-neutral-400 mt-0.5 leading-normal">{t.feature3Desc}</p>
                  </div>
                </div>

                {/* Beneficio 4 */}
                <div className="flex gap-3.5 items-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                    <Zap size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-200">{t.feature4}</h4>
                    <p className="text-[10px] text-neutral-400 mt-0.5 leading-normal">{t.feature4Desc}</p>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleCTA}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-heading font-black transition-all hover:brightness-110 active:scale-[0.98] cursor-pointer shadow-lg shadow-orange-500/10"
                  style={{
                    background: `linear-gradient(135deg, ${C.accent}, ${C.accentStrong})`,
                    color: C.accentText
                  }}
                >
                  <Crown size={15} className="fill-black" />
                  <span>{t.cta}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full rounded-xl py-3.5 text-xs font-semibold transition-colors hover:bg-white/[0.04] text-neutral-500 hover:text-gray-300 cursor-pointer"
                >
                  {t.dismiss}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalElement, document.body);
}
