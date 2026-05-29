"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Compass, Heart, Crown, User } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { createClient } from "../../utils/supabase/client";

export default function BottomNavbar() {
  const pathname = usePathname() || "";
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  // Determinar si ocultar en el lector de capítulos
  const isReaderPage = pathname.includes("/comics/") && pathname.includes("/chapters/");

  if (isReaderPage) return null;

  const navItems = [
    { label: "Inicio", path: "/", icon: Home },
    { label: "Explorar", path: "/explore", icon: Compass },
    { label: "Favoritos", path: "/favoritos", icon: Heart },
    { label: "Premium", path: "/premium", icon: Crown },
    { label: "Perfil", path: "/profile", icon: User },
  ];

  return (
    <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 block w-[92%] max-w-md rounded-2xl border border-white/10 bg-[#0a0908]/92 py-2 px-1 shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all duration-300 md:hidden">
      <div className="mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          // Coincidencia exacta para "/" o coincidencia de prefijo para subrutas
          const isBlocked = item.label === "Perfil" && !user;
          const isActive = !isBlocked && (
            item.path === "/"
              ? pathname === "/"
              : pathname.startsWith(item.path)
          );

          return (
            <Link
              key={item.label}
              href={item.path}
              data-no-transition-loader={item.label === "Perfil" && !user ? "true" : undefined}
              onClick={(e) => {
                if (item.label === "Perfil" && !user) {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent("open-auth-modal"));
                }
              }}
              className="relative flex flex-col items-center justify-center gap-1 py-1 px-3 text-center transition-colors focus:outline-none"
            >
              {/* Icono animado */}
              <motion.div
                whileTap={{ scale: 0.88 }}
                className={`relative flex items-center justify-center transition-colors duration-300 ${
                  isActive ? "text-orange-500" : "text-gray-400"
                }`}
              >
                {isActive && item.label === "Premium" ? (
                  <Icon size={20} className="stroke-[2.25] text-amber-400 fill-amber-400/20 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                ) : isActive ? (
                  <Icon size={20} className="stroke-[2.25] text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
                ) : (
                  <Icon size={20} className="stroke-[1.75]" />
                )}
              </motion.div>

              {/* Etiqueta */}
              <span
                className={`text-[10px] font-medium tracking-wide transition-colors duration-300 ${
                  isActive
                    ? item.label === "Premium"
                      ? "text-amber-400 font-bold"
                      : "text-orange-500 font-bold"
                    : "text-gray-500"
                }`}
              >
                {item.label}
              </span>

              {/* Indicador de pestaña activa en formato de barra inferior brillante */}
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className={`absolute -bottom-1 h-[3px] w-6 rounded-full ${
                    item.label === "Premium" ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" : "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"
                  }`}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
