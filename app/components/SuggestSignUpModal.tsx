"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sparkles, Heart } from "lucide-react";
import { C } from "../lib/colors";
import Button from "./Button";

interface SuggestSignUpModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SuggestSignUpModal({ open, onClose }: SuggestSignUpModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cerrar al presionar la tecla Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!mounted) return null;

  const modal = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop con Blur y Fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Tarjeta del Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border p-6 text-center shadow-2xl"
            style={{
              background: "#0f0e0d",
              borderColor: "rgba(255, 107, 0, 0.2)",
              boxShadow: "0 24px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(255, 107, 0, 0.04)",
            }}
          >
            {/* Botón de Cerrar */}
            <button
              onClick={onClose}
              className="absolute right-4.5 top-4.5 text-neutral-500 hover:text-neutral-300 transition-colors rounded-lg p-1 hover:bg-white/5 cursor-pointer"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>

            {/* Decoración Superior: Icono de Favorito Animado y Destellos */}
            <div className="relative mx-auto mt-2 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-[0_0_20px_rgba(255,107,0,0.15)]">
              <Heart size={28} className="fill-orange-500 animate-pulse text-[#ff6b00]" />
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                className="absolute -top-1 -right-1 text-yellow-400"
              >
                <Sparkles size={16} />
              </motion.div>
            </div>

            {/* Texto del Modal */}
            <h3 className="text-lg font-heading font-extrabold text-gray-100 leading-tight uppercase tracking-wide px-2">
              ¡Desbloqueá Beneficios Premium Gratis!
            </h3>
            
            <p className="mt-2.5 text-[11px] leading-relaxed text-neutral-400 px-3">
              Creá tu cuenta gratis en segundos y disfrutá de una lectura superior sin pagar nada:
            </p>

            {/* Lista de Beneficios */}
            <div className="mt-4 mb-4 text-left border-y border-white/5 py-3 px-2 flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5">
                <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-[#ff6b00] mt-0.5">
                  <Sparkles size={11} />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-gray-200">Velocidad Máxima</h4>
                  <p className="text-[10px] text-neutral-400">Lectura fluida con servidores premium dedicados.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-2.5">
                <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-[#ff6b00] mt-0.5">
                  <Sparkles size={11} />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-gray-200">PDFs Ilimitados</h4>
                  <p className="text-[10px] text-neutral-400">Descargá tus capítulos preferidos para ver offline.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-[#ff6b00] mt-0.5">
                  <Sparkles size={11} />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-gray-200">Sincronización en la Nube</h4>
                  <p className="text-[10px] text-neutral-400">Guardá tus favoritos e historial en cualquier dispositivo.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-[#ff6b00] mt-0.5">
                  <Sparkles size={11} />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-gray-200">Notificaciones al Instante</h4>
                  <p className="text-[10px] text-neutral-400">Enterate al segundo cuando sale un nuevo capítulo.</p>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="mt-6 flex flex-col gap-2.5">
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  // Disparar evento global para abrir el modal de autenticación original de la web
                  window.dispatchEvent(new CustomEvent("open-auth-modal", { detail: { tab: "signup" } }));
                }}
                className="w-full justify-center shadow-lg hover:shadow-orange-500/20"
              >
                Crear Cuenta / Iniciar Sesión
              </Button>
              
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl border border-white/5 bg-white/5 text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer active:scale-95"
              >
                Seguir leyendo como invitado
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
