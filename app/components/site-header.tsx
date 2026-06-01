"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, Heart, Search, User, LogOut, Crown, FolderHeart, Bell, CheckCheck, Loader2, AlertCircle, Settings, Sparkles } from "lucide-react";
import BrandLogo from "./BrandLogo";
import LanguagePreferencePicker from "./language-preference-picker";
import SearchBar from "./search-bar";
import AdultToggle from "./adult-toggle";
import { createClient } from "../../utils/supabase/client";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import AuthModal from "./AuthModal";
import { useFavoritesStore } from "../store/useFavoritesStore";
import { useHistoryStore } from "../store/useHistoryStore";
import Button from "./Button";

export type SupportedLanguage = "es" | "en" | "pt";

function formatDistanceToNow(dateString: string): string {
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return "hace un momento";
    if (diffMin < 60) return `hace ${diffMin} min`;
    if (diffHr < 24) return `hace ${diffHr} hs`;
    if (diffDay === 1) return "ayer";
    if (diffDay < 7) return `hace ${diffDay} días`;

    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "hace tiempo";
  }
}

const NAV: Record<SupportedLanguage, { explore: string; favorites: string; login: string; logout: string; account: string }> = {
  es: { explore: "Explorar", favorites: "Favoritos", login: "Iniciar Sesión", logout: "Cerrar Sesión", account: "Cuenta" },
  en: { explore: "Explore",  favorites: "Favorites", login: "Log In",         logout: "Log Out",      account: "Account" },
  pt: { explore: "Explorar", favorites: "Favoritos", login: "Entrar",         logout: "Sair",         account: "Conta" },
};

export default function SiteHeader({ language }: { language: SupportedLanguage }) {
  const router = useRouter();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Estados para la eliminación programada y reactivación
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showScheduledDeleteModal, setShowScheduledDeleteModal] = useState(false);
  const [scheduledDeleteDate, setScheduledDeleteDate] = useState<string | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);

  // Comprobar si hay una fecha de eliminación guardada en localStorage al montar el componente (para anónimos)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedDate = localStorage.getItem("scheduledDeleteDate");
      if (storedDate) {
        setScheduledDeleteDate(storedDate);
        setShowScheduledDeleteModal(true);
        localStorage.removeItem("scheduledDeleteDate");
      }
    }
  }, []);

  // Escuchar evento personalizado para abrir el modal de autenticación
  useEffect(() => {
    const handleOpenAuthModal = () => {
      setIsAuthModalOpen(true);
    };
    window.addEventListener("open-auth-modal", handleOpenAuthModal);
    return () => {
      window.removeEventListener("open-auth-modal", handleOpenAuthModal);
    };
  }, []);

  // Escuchar si el usuario está logueado pero su cuenta está programada para eliminación
  useEffect(() => {
    if (user && user.user_metadata?.scheduled_delete_at) {
      setShowReactivateModal(true);
    } else {
      setShowReactivateModal(false);
    }
  }, [user]);

  const handleReactivateAccount = async () => {
    setIsReactivating(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { scheduled_delete_at: null }
      });
      if (error) {
        toast.error("Error al reactivar la cuenta: " + error.message);
      } else {
        toast.success("¡Tu cuenta ha sido reactivada con éxito! 🎉");
        setShowReactivateModal(false);
        // Refrescar sesión localmente
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Ocurrió un error al reactivar la cuenta.");
    } finally {
      setIsReactivating(false);
    }
  };

  const handleKeepDeletion = async () => {
    await supabase.auth.signOut();
    setShowReactivateModal(false);
    setUser(null);
    router.push("/");
    router.refresh();
  };

  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const copy = NAV[language];
  const supabase = createClient();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("[Notifications Fetch] Error:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    if (!user) return;
    const interval = setInterval(fetchNotifications, 45000); // refresh every 45s
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  // 1. Efecto único para escuchar sesión de auth
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setLoadingUser(false);
        if (!currentUser) {
          useFavoritesStore.getState().reset();
          useHistoryStore.getState().reset();
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setLoadingUser(false);
        if (!currentUser) {
          useFavoritesStore.getState().reset();
          useHistoryStore.getState().reset();
        }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // 2. Efecto para cargar perfil de base de datos y manejar suscripción realtime
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }

    let active = true;
    let channel: any = null;
    setLoadingProfile(true);

    const fetchProfile = async () => {
      let { data, error } = await supabase
        .from("profiles")
        .select("username, avatar_url, is_premium")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.warn("[SiteHeader] Error al buscar perfil completo. Intentando fallback sin is_premium...", error.message || error);
        const { data: fallbackData } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (fallbackData && active) {
          setProfile({ ...fallbackData, is_premium: false });
          useFavoritesStore.getState().syncWithServer();
          useHistoryStore.getState().syncWithServer();
        }
      } else {
        setProfile(data || null);
        if (data && active) {
          useFavoritesStore.getState().syncWithServer();
          useHistoryStore.getState().syncWithServer();
        }
      }
      setLoadingProfile(false);
    };

    fetchProfile();

    // Suscribirse a cambios en tiempo real en la tabla profiles para este usuario con un canal único
    const uniqueChannelName = `header-profile-realtime-${user.id}-${Math.random().toString(36).substring(2, 10)}`;
    channel = supabase
      .channel(uniqueChannelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (active && payload.new) {
            setProfile(payload.new);
          }
        }
      )
      .subscribe();

    // Escuchar evento personalizado de actualización (para cambios locales instantáneos)
    const handleProfileUpdateEvent = () => {
      if (active) fetchProfile();
    };
    window.addEventListener("profile-updated", handleProfileUpdateEvent);

    return () => {
      active = false;
      window.removeEventListener("profile-updated", handleProfileUpdateEvent);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, supabase]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsDropdownOpen(false);
    toast.success("Sesión cerrada.");
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path.startsWith("/profile") || path.startsWith("/favoritos")) {
        router.push("/");
      } else {
        router.refresh();
      }
    }
  };

  const renderAuthBlock = () => {
    if (loadingUser || (user && loadingProfile && !profile)) {
      return <div className="h-10 w-10 sm:w-32 animate-pulse rounded-full bg-white/5 border border-white/[0.05]" />;
    }

    const handleMarkAllRead = async () => {
      try {
        const res = await fetch("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (res.ok) {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
          toast.success("Notificaciones marcadas como leídas.");
        }
      } catch {
        toast.error("Error al marcar notificaciones.");
      }
    };

    const handleNotificationClick = async (notif: any) => {
      try {
        await fetch("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: notif.id }),
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
        );
      } catch (err) {
        console.error(err);
      }
      setIsNotificationsOpen(false);

      let targetUrl = `/comics/${notif.mangaId}`;
      if (notif.chapterId && notif.chapterId !== "general") {
        targetUrl = `/comics/${notif.mangaId}/chapters/${notif.chapterId}`;
      }
      targetUrl += "#comments";
      window.location.href = targetUrl;
    };

    if (user) {
      const displayName = profile?.username || user.user_metadata?.username || user.email?.split("@")[0] || "Usuario";
      const displayAvatar = profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
      const isPremium = !!profile?.is_premium;
      const initials = displayName.charAt(0).toUpperCase();
      const unreadCount = notifications.filter((n) => !n.read).length;

      return (
        <div className="flex items-center gap-2.5">
          {/* Campana de notificaciones con Popover */}
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              onClick={() => {
                setIsNotificationsOpen((p) => !p);
                setIsDropdownOpen(false);
                fetchNotifications();
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-gray-300 hover:text-white transition-all cursor-pointer"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-md animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {isNotificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.95 }}
                  className="absolute right-0 top-12 z-[100] w-[calc(100vw-2rem)] max-w-[320px] sm:w-80 rounded-2xl border border-white/5 bg-[#141519] p-3 shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 mb-2">
                    <span className="text-xs font-bold text-gray-200">Notificaciones</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[10px] font-bold text-orange-500 hover:text-orange-400 cursor-pointer flex items-center gap-1 transition-all"
                      >
                        <CheckCheck size={12} />
                        <span>Marcar leídas</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto pr-0.5">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-gray-500">
                        No tenés notificaciones aún.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => handleNotificationClick(n)}
                          className={`flex gap-2.5 items-start text-left w-full p-2.5 rounded-xl transition-all cursor-pointer ${
                            n.read ? "hover:bg-white/[0.02]" : "bg-orange-500/[0.03] hover:bg-orange-500/[0.06]"
                          }`}
                        >
                          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                            {n.senderAvatar ? (
                              <img src={n.senderAvatar} alt={n.senderName} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-orange-500/10 text-[10px] font-bold text-orange-400">
                                {n.senderName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-300 leading-normal break-words">
                              <span className="font-bold text-white">@{n.senderName}</span>{" "}
                              {n.type === "like" ? "le dio me gusta a tu comentario:" : "respondió a tu comentario:"}
                            </p>
                            <p className="text-[11px] text-gray-500 italic mt-0.5 truncate">
                              "{n.commentContent}"
                            </p>
                            <span className="text-[9px] text-gray-500 block mt-1">
                              {formatDistanceToNow(n.createdAt)}
                            </span>
                          </div>

                          {!n.read && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500 self-center mt-1" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative" ref={dropdownRef}>
            {/* Botón de la Navbar */}
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen((p) => !p);
                setIsNotificationsOpen(false);
              }}
              className={`flex h-10 w-10 sm:w-auto items-center justify-center sm:justify-start gap-2.5 sm:px-4 rounded-full sm:rounded-xl border text-xs font-heading font-semibold select-none cursor-pointer transition-all ${
              isPremium 
                ? "border-amber-500/50 bg-gradient-to-r from-amber-500/5 to-yellow-500/10 hover:border-amber-500/70 hover:from-amber-500/10 hover:to-yellow-500/15 shadow-[0_0_12px_rgba(245,158,11,0.15)] text-amber-500" 
                : "border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-gray-300 hover:text-white"
            }`}
          >
            {displayAvatar ? (
              <img src={displayAvatar} alt={displayName} className="h-7 w-7 rounded-full object-cover shrink-0" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-gray-300 shrink-0">
                {initials}
              </div>
            )}
            <span className="hidden sm:inline max-w-[100px] truncate">{displayName}</span>
            {isPremium && (
              <Crown size={13} className="text-amber-500 fill-amber-500 shrink-0 hidden sm:inline" />
            )}
          </button>

          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-[256px] sm:w-64 rounded-2xl border border-white/[0.08] bg-[#0f0e0d] p-3.5 shadow-2xl"
                style={{ zIndex: 200 }}
              >
                {/* 1. Cabecera: Avatar redondo y Username en grande */}
                <div className="flex flex-col items-center gap-2 border-b border-white/[0.06] pb-3 text-center">
                  <div className="relative">
                    {displayAvatar ? (
                      <img 
                        src={displayAvatar} 
                        alt={displayName} 
                        className={`h-16 w-16 rounded-full object-cover border-2 ${
                          isPremium ? "border-amber-500" : "border-white/[0.08]"
                        }`} 
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.05] text-2xl font-bold text-orange-500 border border-white/[0.08]">
                        {initials}
                      </div>
                    )}
                    {isPremium && (
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 shadow" title="Miembro Premium">
                        <Crown size={10} className="text-black fill-black" />
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col items-center min-w-0 w-full px-1">
                    <p className="truncate text-sm font-bold text-gray-100 max-w-[210px] w-full">
                      {displayName}
                    </p>
                    <p className="truncate text-[10px] text-gray-500 max-w-[210px] w-full">
                      {user.email}
                    </p>
                    {isPremium && (
                      <span className="mt-1.5 text-[8px] font-extrabold uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 leading-none">
                        MIEMBRO PREMIUM
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Enlaces del menú (Configuración y Favoritos) */}
                <div className="flex flex-col gap-0.5 py-2">
                  <Link
                    href="/profile"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-gray-300 hover:bg-white/[0.04] hover:text-white transition-all cursor-pointer"
                  >
                    <Settings size={14} className="text-gray-400 shrink-0" />
                    <span>Configuración de Perfil</span>
                  </Link>

                  <Link
                    href="/favoritos"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-gray-300 hover:bg-white/[0.04] hover:text-white transition-all cursor-pointer"
                  >
                    <Heart size={14} className="text-gray-400 shrink-0" />
                    <span>Mis Favoritos</span>
                  </Link>

                  <Link
                    href="/lists"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-gray-300 hover:bg-white/[0.04] hover:text-white transition-all cursor-pointer"
                  >
                    <FolderHeart size={14} className="text-gray-400 shrink-0" />
                    <span>{language === "es" ? "Listas de la Comunidad" : language === "pt" ? "Listas da Comunidade" : "Community Lists"}</span>
                  </Link>

                  <Link
                    href="/premium"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold hover:bg-white/[0.04] transition-all cursor-pointer"
                  >
                    {isPremium ? (
                      <Crown size={14} className="fill-amber-500 text-amber-500 shrink-0" />
                    ) : (
                      <Sparkles size={14} className="text-orange-500 shrink-0" />
                    )}
                    <span className={isPremium ? "text-yellow-400 font-heading font-bold" : "text-[#ff6b00] font-heading font-bold"}>
                      {isPremium ? "Beneficios Premium" : "Mejorar a Premium"}
                    </span>
                  </Link>

                </div>

                {/* 3. Botón de Cerrar Sesión en Rojo abajo */}
                <div className="border-t border-white/[0.06] pt-2">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <LogOut size={13} />
                    <span>{copy.logout}</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

    return (
      <button
        type="button"
        onClick={() => setIsAuthModalOpen(true)}
        className="relative group overflow-hidden flex h-10 items-center justify-center rounded-xl px-3.5 sm:px-5.5 text-xs font-heading font-extrabold uppercase tracking-wider transition-all duration-300 cursor-pointer bg-gradient-to-r from-orange-500 to-[#ff6b00] hover:from-orange-600 hover:to-[#e66000] text-black shadow-[0_4px_15px_rgba(255,107,0,0.25)] hover:shadow-[0_4px_25px_rgba(255,107,0,0.45)] hover:scale-[1.02] active:scale-[0.97]"
      >
        {/* Shine effect */}
        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        
        <User size={14} className="sm:hidden shrink-0 text-black" />
        <span className="hidden sm:inline whitespace-nowrap text-black">{copy.login}</span>
      </button>
    );
  };

  return (
    <>
      <header
        suppressHydrationWarning
        className="sticky top-0 z-50 border-b border-[rgba(247,242,232,0.06)] bg-[#0a0908]/90 backdrop-blur-xl"
      >
        <div
          suppressHydrationWarning
          className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-5 md:grid md:grid-cols-[auto_minmax(280px,500px)_auto] md:items-center md:gap-6 md:px-8"
        >
          {/* Left: logo + nav */}
          <div className="flex min-w-0 items-center justify-between gap-3 md:justify-start md:gap-8">
            <div className="flex min-w-0 items-center gap-5 md:gap-8">
              <BrandLogo />
              <Link
                href="/explore"
                className="hidden md:inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition-colors hover:text-orange-500"
              >
                <Compass className="h-5 w-5" />
                <span>{copy.explore}</span>
              </Link>
              <Link
                href="/lists"
                className="hidden md:inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition-colors hover:text-orange-500 shrink-0"
              >
                <FolderHeart className="h-5 w-5" />
                <span>{language === "es" ? "Listas" : language === "pt" ? "Listas" : "Lists"}</span>
              </Link>
              <Link
                href="/premium"
                className="hidden md:inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition-colors hover:text-orange-500"
              >
                <Crown className="h-5 w-5 text-amber-500 fill-amber-500/10" />
                <span>Premium</span>
              </Link>

              <AnimatePresence initial={false} mode="popLayout">
                {!user && (
                  <motion.div
                    initial={{ opacity: 0, width: 0, scale: 0.9 }}
                    animate={{ opacity: 1, width: "auto", scale: 1 }}
                    exit={{ opacity: 0, width: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="hidden md:flex items-center overflow-hidden"
                  >
                    <Link
                      href="/favoritos"
                      className="inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition-colors hover:text-orange-500 whitespace-nowrap"
                      aria-label={copy.favorites}
                    >
                      <Heart className="h-5 w-5" />
                      <span className="hidden lg:inline">{copy.favorites}</span>
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
 
            {/* Mobile right */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5 md:hidden">
              <button
                onClick={() => setIsMobileSearchOpen((p) => !p)}
                className={`flex items-center justify-center rounded-full p-2 text-gray-400 transition-all hover:bg-white/5 hover:text-orange-500 ${
                  isMobileSearchOpen ? "bg-orange-500/10 text-orange-500" : ""
                }`}
                aria-label="Buscar"
              >
                <Search className="h-5 w-5" />
              </button>
              <LanguagePreferencePicker />
              <AdultToggle language={language} />
              {renderAuthBlock()}
            </div>
          </div>

          {/* Mobile search */}
          <div
            className={`w-full overflow-hidden transition-all duration-300 ease-in-out md:hidden ${
              isMobileSearchOpen ? "max-h-[80px] opacity-100 py-1" : "max-h-0 opacity-0 pointer-events-none"
            }`}
          >
            <SearchBar />
          </div>

          {/* Desktop search */}
          <div className="hidden w-full justify-center md:flex">
            <div className="w-full max-w-[500px]">
              <SearchBar />
            </div>
          </div>

          {/* Desktop right */}
          <div className="hidden items-center justify-end gap-4 md:flex">
            <LanguagePreferencePicker />
            <AdultToggle language={language} />
            {renderAuthBlock()}
          </div>
        </div>
      </header>

      <AuthModal
        open={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Reactivate Account Modal */}
      <AnimatePresence>
        {showReactivateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-2xl border text-center relative"
              style={{
                background: "#131110",
                borderColor: "rgba(245, 158, 11, 0.25)",
                boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
              }}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 mb-4">
                <Crown size={24} className="animate-pulse" />
              </div>
              <h3 className="text-lg font-heading font-bold text-gray-100 uppercase tracking-wider mb-2">
                {language === "es" ? "Cuenta en proceso de eliminación" : language === "pt" ? "Conta em processo de exclusão" : "Account pending deletion"}
              </h3>
              <p className="text-sm text-neutral-400 leading-relaxed mb-6">
                {language === "es" ? (
                  <>
                    Tu cuenta está programada para ser eliminada permanentemente el{" "}
                    <span className="font-bold text-amber-500">
                      {user?.user_metadata?.scheduled_delete_at
                        ? new Date(user.user_metadata.scheduled_delete_at).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "30 días"}
                    </span>
                    .<br />
                    ¿Deseas reactivar tu cuenta ahora y conservar toda tu información?
                  </>
                ) : language === "pt" ? (
                  <>
                    Sua conta está agendada para exclusão permanente em{" "}
                    <span className="font-bold text-amber-500">
                      {user?.user_metadata?.scheduled_delete_at
                        ? new Date(user.user_metadata.scheduled_delete_at).toLocaleDateString("pt-BR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "30 dias"}
                    </span>
                    .<br />
                    Deseja reativar sua conta agora e manter todas as suas informações?
                  </>
                ) : (
                  <>
                    Your account is scheduled for permanent deletion on{" "}
                    <span className="font-bold text-amber-500">
                      {user?.user_metadata?.scheduled_delete_at
                        ? new Date(user.user_metadata.scheduled_delete_at).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "30 days"}
                    </span>
                    .<br />
                    Do you want to reactivate your account now and keep all your data?
                  </>
                )}
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleReactivateAccount}
                  className="w-full justify-center"
                  disabled={isReactivating}
                >
                  {isReactivating ? (
                    <Loader2 size={16} className="animate-spin text-black" />
                  ) : (
                    language === "es" ? "Reactivar Cuenta" : language === "pt" ? "Reativar Conta" : "Reactivate Account"
                  )}
                </Button>
                <button
                  onClick={handleKeepDeletion}
                  className="w-full py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  {language === "es"
                    ? "Mantener eliminación (Cerrar sesión)"
                    : language === "pt"
                    ? "Manter exclusão (Sair)"
                    : "Keep deletion (Log Out)"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scheduled Delete Modal */}
      <AnimatePresence>
        {showScheduledDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-2xl border text-center relative"
              style={{
                background: "#131110",
                borderColor: "rgba(239, 68, 68, 0.25)",
                boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
              }}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 mb-4">
                <AlertCircle size={24} className="animate-bounce" />
              </div>
              <h3 className="text-lg font-heading font-bold text-gray-100 uppercase tracking-wider mb-2">
                {language === "es" ? "Eliminación Programada" : language === "pt" ? "Exclusão Programada" : "Deletion Scheduled"}
              </h3>
              <p className="text-sm text-neutral-400 leading-relaxed mb-6">
                {language === "es" ? (
                  <>
                    Tu cuenta ha sido programada para ser eliminada permanentemente.
                    <br />
                    Tienes hasta el{" "}
                    <span className="font-bold text-red-400">
                      {scheduledDeleteDate
                        ? new Date(scheduledDeleteDate).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "30 días"}
                    </span>{" "}
                    para volver a iniciar sesión y cancelar la solicitud de eliminación si cambias de opinión.
                  </>
                ) : language === "pt" ? (
                  <>
                    Sua conta foi agendada para exclusão permanente.
                    <br />
                    Você tem até{" "}
                    <span className="font-bold text-red-400">
                      {scheduledDeleteDate
                        ? new Date(scheduledDeleteDate).toLocaleDateString("pt-BR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "30 dias"}
                    </span>{" "}
                    para fazer login novamente e cancelar a solicitação se mudar de ideia.
                  </>
                ) : (
                  <>
                    Your account has been scheduled for permanent deletion.
                    <br />
                    You have until{" "}
                    <span className="font-bold text-red-400">
                      {scheduledDeleteDate
                        ? new Date(scheduledDeleteDate).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "30 days"}
                    </span>{" "}
                    to log back in and cancel the deletion request if you change your mind.
                  </>
                )}
              </p>
              <Button
                onClick={() => setShowScheduledDeleteModal(false)}
                className="w-full justify-center"
              >
                {language === "es" ? "Entendido" : language === "pt" ? "Entendido" : "Understood"}
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
