"use client";

import { AnimatePresence, motion } from "framer-motion";
import { EyeOff, Eye, Palette, BookOpen, Scroll, ZoomIn, ZoomOut, Crown, Columns2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { PageSize } from "../../../../../store/useReaderSettingsStore";
import type { ReaderDictionary, ReaderTheme } from "../reader-client";

// Import mapping block colors
const THEME_CLASSES = {
  dark: { border: "border-white/5", sidepanelBg: "bg-[#111215]/60" },
  amoled: { border: "border-neutral-800", sidepanelBg: "bg-neutral-900/60" },
  sepia: { border: "border-[#e4dcc8]", sidepanelBg: "bg-[#ebdcb9]/80" },
  light: { border: "border-neutral-200", sidepanelBg: "bg-neutral-100/80" },
  gray: { border: "border-white/5", sidepanelBg: "bg-[#22232a]/60" }
};

interface ToolButtonProps {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}

function ToolButton({ title, onClick, children, active }: ToolButtonProps) {
  return (
    <motion.button
      type="button"
      title={title}
      onClick={onClick}
      whileHover={{ scale: 1.06, y: -2 }}
      whileTap={{ scale: 0.94 }}
      className={`relative flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg sm:rounded-xl border transition-all duration-300 shrink-0
        ${active 
          ? "border-amber-500/60 bg-amber-500/10 text-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.2)]" 
          : "border-white/10 bg-[#141519]/75 text-gray-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.3)] backdrop-blur-md hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400"
        }`}
    >
      {children}
    </motion.button>
  );
}

interface ReaderSettingsPanelProps {
  isReaderUiVisible: boolean;
  showControlsUI: boolean;
  readerTheme: ReaderTheme;
  dictionary: ReaderDictionary;
  setReaderUiVisibility: (visible: boolean) => void;
  toggleFullscreen: () => void;
  cycleTheme: () => void;
  selectTheme: (theme: ReaderTheme) => void;
  readingMode: string;
  setReadingMode: (mode: any) => void;
  setAutoScroll: (scroll: boolean) => void;
  autoScroll: boolean;
  scrollSpeed: number;
  cycleSpeed: () => void;
  scrollToTop: () => void;
  isPremium: boolean;
  pageSize: PageSize;
  setPageSize: (size: PageSize) => void;
  onOpenPremiumModal?: () => void;
  gaplessMode: boolean;
  setGaplessMode: (enabled: boolean) => void;
  doublePageSpread: boolean;
  setDoublePageSpread: (enabled: boolean) => void;
}

export default function ReaderSettingsPanel({
  isReaderUiVisible,
  showControlsUI,
  readerTheme,
  dictionary,
  setReaderUiVisibility,
  toggleFullscreen,
  cycleTheme,
  selectTheme,
  readingMode,
  setReadingMode,
  setAutoScroll,
  autoScroll,
  scrollSpeed,
  cycleSpeed,
  scrollToTop,
  isPremium,
  pageSize,
  setPageSize,
  onOpenPremiumModal,
  gaplessMode,
  setGaplessMode,
  doublePageSpread,
  setDoublePageSpread,
}: ReaderSettingsPanelProps) {
  const [showThemes, setShowThemes] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const themeStyle = THEME_CLASSES[readerTheme] || THEME_CLASSES.dark;

  const getPageSizeLabel = (size: PageSize) => {
    if (size === "small") return "Ancho de página: Chico (576px) 🔎";
    if (size === "medium") return "Ancho de página: Normal (768px) 🔎";
    if (size === "large") return "Ancho de página: Grande (1024px) 🔎";
    return "Ancho de página: Pantalla Completa (100%) 🔎";
  };

  return (
    <AnimatePresence>
      {isReaderUiVisible ? (
        <motion.div
          key="reader-tools-visible"
          data-is-controls-panel="true"
          initial={{ opacity: 0, x: 18, scale: 0.96 }}
          animate={{ 
            opacity: showControlsUI ? 1 : 0, 
            x: showControlsUI ? 0 : 50, 
            scale: showControlsUI ? 1 : 0.92 
          }}
          exit={{ opacity: 0, x: 18, scale: 0.96 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          style={{ pointerEvents: showControlsUI ? "auto" : "none" }}
          className={`fixed right-3 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-2.5 sm:gap-3 rounded-2xl border ${themeStyle.border} ${themeStyle.sidepanelBg} p-1.5 sm:p-2 shadow-2xl shadow-black/45 backdrop-blur-xl md:right-4 transition-colors duration-300 max-h-[85vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        >
          <ToolButton title={dictionary.hideControls} onClick={() => setReaderUiVisibility(false)}>
            <EyeOff className="h-5 w-5" />
          </ToolButton>

          <ToolButton title={dictionary.fullscreen} onClick={toggleFullscreen}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3" />
              <path d="M16 3h3a2 2 0 0 1 2 2v3" />
              <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
              <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </ToolButton>

          {/* Theme switcher con flyout animado */}
          <div className="relative flex items-center justify-end">
            <AnimatePresence>
              {showThemes && (
                <motion.div
                  initial={{ opacity: 0, x: 20, scale: 0.8 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  className="absolute right-12 sm:right-14 flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0c0d10]/95 p-2 shadow-2xl backdrop-blur-xl z-50"
                >
                  {(["dark", "amoled", "sepia", "light", "gray"] as const).map((theme) => {
                    const themeColors = {
                      dark: "bg-[#0a0a0c] border-white/20",
                      amoled: "bg-black border-neutral-800",
                      sepia: "bg-[#f4ecd8] border-[#e4dcc8]",
                      light: "bg-white border-neutral-300",
                      gray: "bg-[#1a1b20] border-white/20",
                    };
                    const isSelected = readerTheme === theme;
                    return (
                      <motion.button
                        key={theme}
                        type="button"
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => selectTheme(theme)}
                        className={`h-7 w-7 rounded-full border-2 transition-all duration-300 relative ${themeColors[theme]} ${
                          isSelected ? "ring-2 ring-amber-500 scale-110 shadow-lg shadow-amber-500/20" : "hover:scale-105"
                        }`}
                        title={theme.toUpperCase()}
                      >
                        {theme !== "dark" && !isPremium && (
                          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-yellow-500 shadow-sm">
                            <Crown size={8} className="fill-black text-black shrink-0" />
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            <ToolButton
              title="Cambiar tema de lectura"
              onClick={() => setShowThemes(!showThemes)}
              active={readerTheme !== "dark" || showThemes}
            >
              <Palette className="h-5 w-5" />
              {readerTheme !== "dark" && (
                <Crown size={10} className="absolute -right-1 -top-1 fill-amber-500 text-amber-500 shrink-0" />
              )}
            </ToolButton>
          </div>

          {/* Reading mode toggle */}
          <ToolButton
            title={readingMode === "vertical" ? `${dictionary.modeHorizontal} (Premium)` : dictionary.modeVertical}
            onClick={() => {
              if (readingMode === "vertical" && !isPremium) {
                toast.error("El modo de lectura Horizontal es un beneficio Premium.", {
                  description: "¡Activá tu Pase de Regalo gratis en tu perfil para habilitar esta opción!"
                });
                return;
              }
              setReadingMode(readingMode === "vertical" ? "horizontal" : "vertical");
              if (readingMode === "vertical") {
                setAutoScroll(false);
              }
            }}
            active={readingMode === "horizontal"}
          >
            {readingMode === "vertical" ? (
              <BookOpen className="h-5 w-5" />
            ) : (
              <Scroll className="h-5 w-5" />
            )}
            {readingMode === "vertical" && (
              <Crown size={10} className="absolute -right-1 -top-1 fill-amber-500 text-amber-500 shrink-0" />
            )}
          </ToolButton>

          {/* Lectura sin márgenes (vertical only) */}
          {readingMode === "vertical" && (
            <ToolButton
              title={gaplessMode ? "Desactivar lectura sin márgenes" : "Activar lectura sin márgenes"}
              onClick={() => {
                setGaplessMode(!gaplessMode);
                toast.info(gaplessMode ? "Márgenes normales activados" : "Lectura continua sin márgenes activada 🚀");
              }}
              active={gaplessMode}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22V2" />
                <path d="m17 7-5-5-5 5" />
                <path d="m17 17-5 5-5-5" />
              </svg>
            </ToolButton>
          )}

          {/* Doble página (horizontal only) */}
          {readingMode === "horizontal" && (
            <ToolButton
              title={doublePageSpread ? "Desactivar doble página" : "Activar doble página (pantallas grandes)"}
              onClick={() => {
                setDoublePageSpread(!doublePageSpread);
                toast.info(doublePageSpread ? "Páginas individuales" : "Modo doble página activado 📖");
              }}
              active={doublePageSpread}
            >
              <Columns2 className="h-5 w-5" />
            </ToolButton>
          )}

          {/* Zoom / Page width scaling controls */}
          <div className="flex flex-col gap-1.5 sm:gap-2">
            {/* Zoom Out / Achicar */}
            <ToolButton
              title="Achicar ancho de página (hacer más chica) 🔎"
              onClick={() => {
                const sizes: PageSize[] = ["small", "medium", "large", "full"];
                const currentIndex = sizes.indexOf(pageSize);
                if (currentIndex > 0) {
                  const nextSize = sizes[currentIndex - 1];
                  setPageSize(nextSize);
                  toast.info(`Ancho de página: ${
                    nextSize === "small" ? "Chico" : 
                    nextSize === "medium" ? "Normal" : 
                    nextSize === "large" ? "Grande" : "Completo"
                  } 🔎`);
                } else {
                  toast.warning("Ya estás en el tamaño mínimo. Chico (576px) 🔎");
                }
              }}
              active={pageSize === "small"}
            >
              <ZoomOut className="h-5 w-5" />
            </ToolButton>

            {/* Zoom In / Agrandar */}
            <ToolButton
              title="Agrandar ancho de página (hacer más grande) 🔎"
              onClick={() => {
                const sizes: PageSize[] = ["small", "medium", "large", "full"];
                const currentIndex = sizes.indexOf(pageSize);
                if (currentIndex < sizes.length - 1) {
                  const nextSize = sizes[currentIndex + 1];
                  setPageSize(nextSize);
                  toast.info(`Ancho de página: ${
                    nextSize === "small" ? "Chico" : 
                    nextSize === "medium" ? "Normal" : 
                    nextSize === "large" ? "Grande" : "Completo"
                  } 🔎`);
                } else {
                  toast.warning("Ya estás en el tamaño máximo. Pantalla Completa (100%) 🔎");
                }
              }}
              active={pageSize === "full" || pageSize === "large"}
            >
              <ZoomIn className="h-5 w-5" />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-[8px] font-bold text-gray-400 border border-white/10">
                {pageSize === "small" ? "S" : pageSize === "medium" ? "M" : pageSize === "large" ? "L" : "XL"}
              </span>
            </ToolButton>
          </div>

          {/* Auto-scroll controls (vertical mode only) */}
          {readingMode === "vertical" && (
            <>
              <ToolButton
                title={autoScroll ? dictionary.pause : dictionary.play}
                onClick={() => setAutoScroll(!autoScroll)}
                active={autoScroll}
              >
                {autoScroll ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </ToolButton>

              <ToolButton title={`${dictionary.scrollSpeedTooltip}: ${scrollSpeed}x`} onClick={cycleSpeed} active={autoScroll}>
                <span className="text-sm font-semibold">{scrollSpeed}x</span>
              </ToolButton>

              <ToolButton title={dictionary.scrollTop} onClick={scrollToTop}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19V5" />
                  <path d="m5 12 7-7 7 7" />
                </svg>
              </ToolButton>
            </>
          )}

          {!isPremium && onOpenPremiumModal && (
            <motion.button
              type="button"
              title="Activar Premium Gratis 💎"
              onClick={onOpenPremiumModal}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.94 }}
              className="relative flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg sm:rounded-xl border border-amber-500/40 bg-gradient-to-tr from-amber-500/20 to-yellow-500/25 text-amber-400 hover:text-amber-300 hover:border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.25)] backdrop-blur-md shrink-0"
            >
              <Crown className="h-5 w-5 animate-pulse text-amber-400" />
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-black">
                +
              </span>
            </motion.button>
          )}
        </motion.div>
      ) : (
        <motion.div
          key="reader-tools-hidden"
          initial={{ opacity: 0, x: 10, scale: 0.92 }}
          animate={{ 
            opacity: showControlsUI ? 0.6 : 0, 
            x: showControlsUI ? 0 : 50, 
            scale: showControlsUI ? 1 : 0.92 
          }}
          exit={{ opacity: 0, x: 10, scale: 0.92 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          style={{ pointerEvents: showControlsUI ? "auto" : "none" }}
          className="fixed right-3 top-1/2 z-50 -translate-y-1/2 md:right-4"
        >
          <ToolButton title={dictionary.controls} onClick={() => setReaderUiVisibility(true)}>
            <Eye className="h-5 w-5" />
          </ToolButton>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
