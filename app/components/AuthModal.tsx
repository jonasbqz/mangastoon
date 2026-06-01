"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X, Mail, Lock, User, ArrowLeft, CheckCircle2, AlertCircle, Sparkles, LogIn, UserPlus } from "lucide-react";
import { createClient } from "../../utils/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "./language-provider";

import { C } from "../lib/colors";



// ─── Traducción de errores de Supabase ────────────────────────────────────
function translateError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
    return "El correo o la contraseña son incorrectos. Inténtalo de nuevo.";
  }
  if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) {
    return "Primero verifica tu correo electrónico para poder acceder.";
  }
  if (msg.includes("user already registered") || msg.includes("already registered")) {
    return "Ya existe una cuenta con este correo electrónico.";
  }
  if (msg.includes("password should be at least")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Error de conexión. Comprueba tu internet e inténtalo de nuevo.";
  }
  return raw;
}

function isAllowedEmailDomain(email: string): boolean {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1];

  if (domain === "gmail.com" || domain === "googlemail.com") return true;
  if (domain === "msn.com" || domain === "icloud.com" || domain === "me.com" || domain === "mac.com") return true;
  if (domain === "proton.me" || domain === "protonmail.com" || domain === "protonmail.ch") return true;

  // matches outlook.com, outlook.es, hotmail.com, hotmail.es, live.com, live.fr, yahoo.com, yahoo.es, etc.
  if (/^(outlook|hotmail|live|yahoo)\.[a-z]{2,3}(\.[a-z]{2})?$/.test(domain)) {
    return true;
  }

  return false;
}

const getAuthCallbackURL = (nextPath?: string) => {
  let url = typeof window !== "undefined"
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mangastoon.com");

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  url = url.endsWith("/") ? url.slice(0, -1) : url;
  const callbackURL = `${url}/auth/callback`;

  return nextPath ? `${callbackURL}?next=${encodeURIComponent(nextPath)}` : callbackURL;
};

const AUTH_COPY = {
  es: {
    signIn: "Iniciar Sesión",
    signInLoading: "Iniciando sesión...",
    signUp: "Crear Cuenta",
    signUpLoading: "Enviando...",
    forgotBtn: "Enviar enlace de recuperación",
    forgotLoading: "Enviando...",
    wait: "Esperá",
    waitSuffix: "s"
  },
  en: {
    signIn: "Sign In",
    signInLoading: "Signing in...",
    signUp: "Create Account",
    signUpLoading: "Sending...",
    forgotBtn: "Send Recovery Link",
    forgotLoading: "Sending...",
    wait: "Wait",
    waitSuffix: "s"
  },
  pt: {
    signIn: "Entrar",
    signInLoading: "Entrando...",
    signUp: "Criar Conta",
    signUpLoading: "Enviando...",
    forgotBtn: "Enviar Link de Recuperação",
    forgotLoading: "Enviando...",
    wait: "Aguarde",
    waitSuffix: "s"
  }
};


const DISCORD_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const GOOGLE_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
    <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.515 0-6.377-2.87-6.377-6.38 0-3.51 2.862-6.38 6.377-6.38 1.62 0 3.09.61 4.22 1.62l3.22-3.22C19.1 2.22 15.93 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.26 0 11.53-4.47 11.53-11.24 0-.64-.06-1.27-.18-1.875H12.24z" />
  </svg>
);

const USERNAME_PREFIXES = [
  "Goku", "Luffy", "Naruto", "Zoro", "Sasuke", "Deku", "Ichigo", "Eren", "Mikasa", 
  "Light", "Saitama", "Kaneki", "Guts", "Tanjiro", "Nezuko", "Gojo", "Sukuna", "Itadori", 
  "Megumi", "Nobara", "Rimuru", "Asta", "Killua", "Gon", "Hisoka", "Kira", "Otaku", 
  "Manga", "Anime", "Manhwa", "Shadow", "Solo", "Hiei", "Kurama", "Yusuke"
];

const USERNAME_SUFFIXES = [
  "Sama", "Kun", "Chan", "Senpai", "Hokage", "Saiyan", "Shinigami", "Ghoul", "Hunter", 
  "Alchemist", "Hero", "Titan", "Ninja", "Pirate", "Sorcerer", "King", "God", "Slayer", 
  "Weeb", "Reader", "Lover", "Fan", "Sensei", "Rider", "Buster", "Knight"
];

function generateRandomUsername(): string {
  const pref = USERNAME_PREFIXES[Math.floor(Math.random() * USERNAME_PREFIXES.length)];
  const suff = USERNAME_SUFFIXES[Math.floor(Math.random() * USERNAME_SUFFIXES.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${pref}${suff}${num}`;
}

type Tab = "signin" | "signup";
type View = "main" | "forgot" | "forgot-sent";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "signup";
}

declare global {
  interface Window {
    turnstile: any;
  }
}

export default function AuthModal({ open, onClose, defaultTab }: Props) {
  const { language } = useLanguage();
  const supabase = createClient();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("signin");
  const [view, setView] = useState<View>("main");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<React.ReactNode | null>(null);

  const signinTurnstileContainerRef = useRef<HTMLDivElement>(null);
  const signupTurnstileContainerRef = useRef<HTMLDivElement>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const isCaptchaEnabled = !!siteKey && siteKey !== "undefined" && siteKey !== "null" && siteKey.trim() !== "";

  const [forgotCooldown, setForgotCooldown] = useState(0);
  const [signupCooldown, setSignupCooldown] = useState(0);

  const [showUnconfirmedError, setShowUnconfirmedError] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const getRemainingCooldown = () => {
    if (typeof window === "undefined") return 0;
    const lastResend = localStorage.getItem("mangastoon_last_resend_sent");
    const lastSignup = localStorage.getItem("mangastoon_last_signup_sent");

    const resendTs = lastResend ? parseInt(lastResend, 10) : 0;
    const signupTs = lastSignup ? parseInt(lastSignup, 10) : 0;
    const baseTs = Math.max(resendTs, signupTs);

    if (baseTs <= 0) return 0;

    // Cooldown de 24 horas (24 * 60 * 60 * 1000 ms)
    const cooldownDuration = 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - baseTs;
    const remaining = cooldownDuration - elapsed;

    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  };

  // Cooldown timer en tiempo real de 24 horas para el reenvío de verificación
  useEffect(() => {
    if (!open) return;

    setResendCooldown(getRemainingCooldown());

    const interval = setInterval(() => {
      const remaining = getRemainingCooldown();
      setResendCooldown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [open]);

  const formatCooldownTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const handleResendVerification = async (targetEmail: string) => {
    if (loading) return;
    if (resendCooldown > 0) return;

    setLoading(true);
    const currentPath = typeof window !== "undefined" ? window.location.pathname : "/profile";
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: targetEmail,
      options: {
        emailRedirectTo: getAuthCallbackURL(currentPath),
      },
    });
    setLoading(false);

    if (error) {
      toast.error(translateError(error.message));
      return;
    }

    toast.success("¡Correo de verificación reenviado! Revisa tu bandeja de entrada.");
    localStorage.setItem("mangastoon_last_resend_sent", String(Date.now()));
    setResendCooldown(24 * 60 * 60); // 24 horas
  };

  // Forgot password cooldown timer
  useEffect(() => {
    if (forgotCooldown <= 0) return;
    const t = setTimeout(() => setForgotCooldown(forgotCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [forgotCooldown]);

  // Signup cooldown timer
  useEffect(() => {
    if (signupCooldown <= 0) return;
    const t = setTimeout(() => setSignupCooldown(signupCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [signupCooldown]);

  // Check stored cooldowns on mount/open
  useEffect(() => {
    if (!open) return;
    const lastForgot = localStorage.getItem("mangastoon_last_forgot_sent");
    if (lastForgot) {
      const elapsed = Math.floor((Date.now() - parseInt(lastForgot, 10)) / 1000);
      if (elapsed < 120) {
        setForgotCooldown(120 - elapsed);
      }
    }

    const lastSignup = localStorage.getItem("mangastoon_last_signup_sent");
    if (lastSignup) {
      const elapsed = Math.floor((Date.now() - parseInt(lastSignup, 10)) / 1000);
      if (elapsed < 120) {
        setSignupCooldown(120 - elapsed);
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open || !isCaptchaEnabled) return;
    if (document.getElementById("turnstile-script")) return;

    const script = document.createElement("script");
    script.id = "turnstile-script";
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [open, isCaptchaEnabled]);

  useEffect(() => {
    if (!open || !isCaptchaEnabled) {
      if (window.turnstile && turnstileWidgetId.current !== null) {
        try {
          window.turnstile.remove(turnstileWidgetId.current);
        } catch (e) {
          // Ignore
        }
      }
      setCaptchaToken(null);
      turnstileWidgetId.current = null;
      return;
    }

    setCaptchaToken(null);

    const interval = setInterval(() => {
      const activeContainer = tab === "signin" 
        ? signinTurnstileContainerRef.current 
        : signupTurnstileContainerRef.current;

      if (window.turnstile && activeContainer) {
        clearInterval(interval);
        try {
          if (turnstileWidgetId.current !== null) {
            try {
              window.turnstile.remove(turnstileWidgetId.current);
            } catch (e) {
              // Ignore
            }
            turnstileWidgetId.current = null;
          }

          console.log("[Turnstile] Rendering with siteKey:", siteKey);

          turnstileWidgetId.current = window.turnstile.render(activeContainer, {
            sitekey: siteKey,
            callback: (token: string) => {
              setCaptchaToken(token);
            },
            "error-callback": () => {
              setCaptchaToken(null);
            },
            "expired-callback": () => {
              setCaptchaToken(null);
            },
            theme: "dark",
          });
        } catch (err) {
          console.error("Turnstile render error:", err);
        }
      }
    }, 100);

    return () => {
      clearInterval(interval);
      if (window.turnstile && turnstileWidgetId.current !== null) {
        try {
          window.turnstile.remove(turnstileWidgetId.current);
        } catch (e) {
          // Ignore
        }
        turnstileWidgetId.current = null;
      }
    };
  }, [open, tab, isCaptchaEnabled, siteKey]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open && defaultTab) {
      setTab(defaultTab);
    }
  }, [open, defaultTab]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setTab("signin"); setView("main");
        setEmail(""); setPassword(""); setConfirmPassword(""); setUsername(""); setForgotEmail("");
        setLoading(false); setErrorMsg(null); setShowUnconfirmedError(false); setUnconfirmedEmail("");
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  const clearError = () => {
    setErrorMsg(null);
    setShowUnconfirmedError(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    clearError();

    if (isCaptchaEnabled && !captchaToken) {
      setErrorMsg("Por favor completá la verificación de seguridad (Captcha).");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      ...(isCaptchaEnabled && captchaToken ? {
        options: {
          captchaToken: captchaToken,
        },
      } : {}),
    });
    setLoading(false);

    if (error) {
      setErrorMsg(translateError(error.message));
      if (window.turnstile && turnstileWidgetId.current !== null) {
        try {
          window.turnstile.reset(turnstileWidgetId.current);
        } catch (e) {
          // Ignore
        }
        setCaptchaToken(null);
      }
      return;
    }

    if (!data.user?.email_confirmed_at) {
      await supabase.auth.signOut();
      setUnconfirmedEmail(email);
      setShowUnconfirmedError(true);
      setErrorMsg(null);
      if (window.turnstile && turnstileWidgetId.current !== null) {
        try {
          window.turnstile.reset(turnstileWidgetId.current);
        } catch (e) {
          // Ignore
        }
        setCaptchaToken(null);
      }
      return;
    }

    onClose();
    if (typeof window !== "undefined") {
      if (window.location.pathname === "/premium") {
        router.refresh();
      } else if (window.location.pathname === "/" || window.location.pathname === "/auth") {
        router.push("/profile");
      } else {
        router.refresh();
      }
    } else {
      router.push("/profile");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    clearError();
    if (signupCooldown > 0) {
      const msg = language === "es"
        ? `Espera ${signupCooldown}s antes de enviar otro correo de registro.`
        : language === "pt"
        ? `Aguarde ${signupCooldown}s antes de enviar outro e-mail de registro.`
        : `Wait ${signupCooldown}s before sending another registration email.`;
      setErrorMsg(msg);
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!isAllowedEmailDomain(cleanEmail)) {
      const msg = language === "es"
        ? "Por seguridad, solo permitimos registros con correos de Gmail, Outlook/Hotmail, Yahoo, Proton o iCloud/Mac."
        : language === "pt"
        ? "Por segurança, só permitimos registros com e-mails do Gmail, Outlook/Hotmail, Yahoo, Proton ou iCloud/Mac."
        : "For security, we only allow registration with Gmail, Outlook/Hotmail, Yahoo, Proton, or iCloud/Mac emails.";
      setErrorMsg(msg);
      return;
    }

    const cleanUsername = username.trim();
    if (!cleanUsername) { setErrorMsg("Ingresá un nombre de usuario."); return; }
    if (password !== confirmPassword) { setErrorMsg("Las contraseñas no coinciden. Verificalas e inténtalo de nuevo."); return; }

    if (isCaptchaEnabled && !captchaToken) {
      setErrorMsg("Por favor completá la verificación de seguridad (Captcha).");
      return;
    }

    setLoading(true);

    const { data: existingUser, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (existingUser) {
      setErrorMsg("El nombre de usuario ya está en uso. Elige otro o usa el dado para generar uno nuevo.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: cleanUsername },
        ...(isCaptchaEnabled && captchaToken ? { captchaToken } : {}),
      },
    });
    setLoading(false);

    if (error) {
      const errMsg = error.message.toLowerCase();
      if (errMsg.includes("already registered") || errMsg.includes("user already registered")) {
        setErrorMsg(
          <span className="block text-xs leading-relaxed text-red-300">
            Ya estás registrado con este correo electrónico.{" "}
            <button
              type="button"
              onClick={() => {
                setTab("signin");
                clearError();
              }}
              className="font-bold underline cursor-pointer text-[#ff6b00] hover:text-[#ff8833] ml-1"
            >
              Inicia sesión aquí
            </button>
          </span>
        );
      } else {
        setErrorMsg(translateError(error.message));
      }
      if (window.turnstile && turnstileWidgetId.current !== null) {
        try {
          window.turnstile.reset(turnstileWidgetId.current);
        } catch (e) {
          // Ignore
        }
        setCaptchaToken(null);
      }
      return;
    }

    const successMsg = language === "es"
      ? "¡Cuenta creada! Revisa tu correo para verificarla."
      : language === "pt"
      ? "Conta criada! Verifique seu e-mail para confirmá-la."
      : "Account created! Check your email to verify it.";
    toast.success(successMsg);
    localStorage.setItem("mangastoon_last_signup_sent", String(Date.now()));
    setSignupCooldown(120);
    onClose();
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    clearError();
    if (forgotCooldown > 0) {
      const msg = language === "es"
        ? `Espera ${forgotCooldown}s antes de enviar otro correo de recuperación.`
        : language === "pt"
        ? `Aguarde ${forgotCooldown}s antes de enviar outro e-mail de recuperação.`
        : `Wait ${forgotCooldown}s before sending another recovery email.`;
      setErrorMsg(msg);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=/reset-password`
        : undefined,
    });
    setLoading(false);
    if (error) { setErrorMsg(translateError(error.message)); return; }
    localStorage.setItem("mangastoon_last_forgot_sent", String(Date.now()));
    setForgotCooldown(120);
    setView("forgot-sent");
  };

  const handleDiscord = async () => {
    clearError();
    const currentPath = typeof window !== "undefined" ? window.location.pathname : "/profile";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: getAuthCallbackURL(currentPath),
      },
    });
    if (error) setErrorMsg(translateError(error.message));
  };

  const handleGoogle = async () => {
    clearError();
    const currentPath = typeof window !== "undefined" ? window.location.pathname : "/profile";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthCallbackURL(currentPath),
      },
    });
    if (error) setErrorMsg(translateError(error.message));
  };

  if (!mounted) return null;

  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";

  const modal = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-transparent">
          {/* Backdrop con Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0"
            style={{ background: "rgba(5, 4, 3, 0.82)", backdropFilter: "blur(4px)" }}
            onClick={onClose}
          />

          {/* Glow radial ambiental en el fondo de la tarjeta */}
          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] rounded-full bg-gradient-to-r from-orange-600/15 via-[#ff6b00]/8 to-transparent blur-[70px] sm:blur-[90px]"
            />
          </div>

          {/* Tarjeta de Modal Premium */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="relative z-10 w-full max-w-[390px] overflow-hidden rounded-3xl border border-white/[0.07] bg-[#121110]/98 shadow-[0_30px_70px_rgba(0,0,0,0.85),_0_0_0_1px_rgba(255,107,0,0.06)]"
          >
            {/* Botón de Cerrar Flotante */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-50 flex h-8 w-8 items-center justify-center rounded-full transition-all hover:scale-105 shadow-md border border-white/5 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/10 cursor-pointer"
            >
              <X size={14} />
            </button>

            {/* ── VISTA PRINCIPAL (SIGN IN / SIGN UP) ──────────────────────── */}
            {view === "main" && (
              <div className="flex flex-col">
                {/* Cabecera Estética */}
                <div className="flex flex-col items-center pt-8 pb-3 px-6 text-center select-none">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 text-[#ff6b00] border border-orange-500/15 mb-3 shadow-[0_0_15px_rgba(255,107,0,0.1)]">
                    {tab === "signin" ? <LogIn size={20} className="ml-0.5" /> : <UserPlus size={20} />}
                  </div>
                  <h2 className="text-xl font-heading font-extrabold tracking-tight text-gray-100">
                    {tab === "signin" ? "¡Hola de vuelta!" : "Unirse a MangaStoon"}
                  </h2>
                  <p className="mt-1 text-xs text-neutral-400 leading-normal">
                    {tab === "signin" 
                      ? "Inicia sesión para ver tu lista de lectura e historial." 
                      : "Crea tu cuenta gratis para interactuar y guardar favoritos."}
                  </p>
                </div>

                {/* Switcher de Pestañas Segmentado */}
                <div className="flex bg-neutral-950/60 p-1 rounded-2xl border border-white/[0.04] mb-4 mx-6 relative">
                  {(["signin", "signup"] as Tab[]).map((t) => {
                    const label = t === "signin" ? "Ingresar" : "Registrarse";
                    const active = tab === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { setTab(t); clearError(); }}
                        className="relative flex-1 py-2 text-xs font-heading font-extrabold uppercase tracking-widest rounded-xl transition-all cursor-pointer z-10"
                        style={{ color: active ? C.fg : C.dim }}
                      >
                        {active && (
                          <motion.span
                            layoutId="activeAuthTabSegment"
                            className="absolute inset-0 rounded-lg bg-orange-500/10 border border-orange-500/20 shadow-[0_0_8px_rgba(255,107,0,0.15)]"
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          />
                        )}
                        <span className="relative z-10">{label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Contenedor con Transiciones Animadas de Formulario */}
                <div className="px-6 pb-6 pt-1 overflow-hidden relative">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={tab}
                      initial={{ opacity: 0, x: tab === "signin" ? -15 : 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: tab === "signin" ? 15 : -15 }}
                      transition={{ duration: 0.18, ease: "easeInOut" }}
                      className="flex flex-col gap-4"
                    >
                      {/* Banner de Errores */}
                      {showUnconfirmedError ? (
                        <ErrorBanner message={
                          <div className="flex flex-col gap-1.5 text-left text-xs leading-relaxed">
                            <div className="flex items-center gap-1.5 font-semibold text-red-300">
                              <AlertCircle size={14} className="shrink-0" />
                              <span>Primero verifica tu correo electrónico para poder acceder.</span>
                            </div>
                            {resendCooldown > 0 ? (
                              <span className="text-gray-400 text-[11px]">
                                Te enviamos un correo de verificación. El enlace sigue activo. Por favor, buscalo en tu bandeja de entrada o spam. Podrás solicitar un nuevo correo en <span className="font-bold text-amber-500">{formatCooldownTime(resendCooldown)}</span>.
                              </span>
                            ) : (
                              <div className="text-[11px] text-gray-400 flex flex-col sm:flex-row sm:items-center gap-1 mt-0.5">
                                <span>¿No te llegó el correo o expiró el enlace de 24 horas?</span>
                                <button
                                  type="button"
                                  onClick={() => handleResendVerification(unconfirmedEmail)}
                                  className="font-bold underline text-[#ff6b00] hover:text-[#ff8833] cursor-pointer w-fit"
                                >
                                  Reenviar correo de verificación
                                </button>
                              </div>
                            )}
                          </div>
                        } />
                      ) : (
                        <ErrorBanner message={errorMsg} />
                      )}

                      {tab === "signin" && (
                        <form onSubmit={handleSignIn} className="flex flex-col gap-3">
                          <Field 
                            icon={<Mail size={13} />} 
                            label="Correo electrónico" 
                            type="email"
                            value={email} 
                            onChange={setEmail} 
                            placeholder="nombre@correo.com" 
                          />
                          <div className="flex flex-col gap-1.5">
                            <Field 
                              icon={<Lock size={13} />} 
                              label="Contraseña" 
                              type="password"
                              value={password} 
                              onChange={setPassword} 
                              placeholder="••••••••" 
                            />
                            <button
                              type="button"
                              onClick={() => { setForgotEmail(email); clearError(); setView("forgot"); }}
                              className="self-end text-[11px] font-bold text-gray-500 hover:text-orange-400 transition-colors mt-0.5 cursor-pointer"
                            >
                              ¿Olvidaste tu contraseña?
                            </button>
                          </div>

                          {isCaptchaEnabled && (
                            <div className="flex flex-col items-center justify-center my-1 min-h-[65px] w-full">
                              <div ref={signinTurnstileContainerRef} />
                            </div>
                          )}

                          <PrimaryButton 
                            loading={loading} 
                            loadingText={AUTH_COPY[language as keyof typeof AUTH_COPY]?.signInLoading || AUTH_COPY.es.signInLoading}
                          >
                            {AUTH_COPY[language as keyof typeof AUTH_COPY]?.signIn || AUTH_COPY.es.signIn}
                          </PrimaryButton>
                          <Divider />
                          <div className="grid grid-cols-2 gap-3">
                            <GoogleButton onClick={handleGoogle} />
                            <DiscordButton onClick={handleDiscord} />
                          </div>
                        </form>
                      )}

                      {tab === "signup" && (
                        <form onSubmit={handleSignUp} className="flex flex-col gap-3">
                          <Field
                            icon={<User size={13} />}
                            label="Nombre de usuario"
                            type="text"
                            value={username}
                            onChange={setUsername}
                            placeholder="Tu usuario público"
                            suffixAction={
                              <button
                                type="button"
                                onClick={() => {
                                  const rand = generateRandomUsername();
                                  setUsername(rand);
                                  toast.info(`Sugerencia: ${rand} 🎲`);
                                }}
                                className="text-gray-500 hover:text-orange-500 hover:bg-orange-500/10 p-1.5 rounded-lg transition-all cursor-pointer mr-0.5"
                                title="Generar nombre aleatorio"
                              >
                                🎲
                              </button>
                            }
                          />
                          <Field 
                            icon={<Mail size={13} />} 
                            label="Correo electrónico" 
                            type="email"
                            value={email} 
                            onChange={setEmail} 
                            placeholder="nombre@correo.com" 
                          />
                          <Field 
                            icon={<Lock size={13} />} 
                            label="Contraseña" 
                            type="password"
                            value={password} 
                            onChange={setPassword} 
                            placeholder="Mínimo 8 caracteres" 
                          />
                          <Field 
                            icon={<Lock size={13} />} 
                            label="Confirmar contraseña" 
                            type="password"
                            value={confirmPassword} 
                            onChange={setConfirmPassword} 
                            placeholder="Repite tu contraseña" 
                          />

                          {isCaptchaEnabled && (
                            <div className="flex flex-col items-center justify-center my-1 min-h-[65px] w-full">
                              <div ref={signupTurnstileContainerRef} />
                            </div>
                          )}

                          <PrimaryButton 
                            loading={loading} 
                            disabled={signupCooldown > 0}
                            loadingText={AUTH_COPY[language as keyof typeof AUTH_COPY]?.signUpLoading || AUTH_COPY.es.signUpLoading}
                          >
                            {signupCooldown > 0 
                              ? `${AUTH_COPY[language as keyof typeof AUTH_COPY]?.wait || AUTH_COPY.es.wait} ${signupCooldown}${AUTH_COPY[language as keyof typeof AUTH_COPY]?.waitSuffix || AUTH_COPY.es.waitSuffix}`
                              : (AUTH_COPY[language as keyof typeof AUTH_COPY]?.signUp || AUTH_COPY.es.signUp)}
                          </PrimaryButton>
                          <Divider />
                          <div className="grid grid-cols-2 gap-3">
                            <GoogleButton onClick={handleGoogle} />
                            <DiscordButton onClick={handleDiscord} />
                          </div>
                        </form>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* ── VISTA DE RECUPERAR CONTRASEÑA ────────────────────────────────── */}
            {view === "forgot" && (
              <div className="p-6 flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => { setView("main"); clearError(); }}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-white transition-colors w-fit cursor-pointer"
                >
                  <ArrowLeft size={13} /> Volver
                </button>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-md">
                    <Lock size={16} />
                  </div>
                  <div>
                    <h2 className="text-base font-heading font-extrabold text-gray-100">
                      Recuperar contraseña
                    </h2>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Te enviaremos un enlace seguro para restablecerla.
                    </p>
                  </div>
                </div>
                <ErrorBanner message={errorMsg} />
                <form onSubmit={handleForgot} className="flex flex-col gap-4 mt-2">
                  <Field 
                    icon={<Mail size={13} />} 
                    label="Correo electrónico" 
                    type="email"
                    value={forgotEmail} 
                    onChange={setForgotEmail} 
                    placeholder="nombre@correo.com" 
                  />
                  <PrimaryButton 
                    loading={loading} 
                    disabled={forgotCooldown > 0}
                    loadingText={AUTH_COPY[language as keyof typeof AUTH_COPY]?.forgotLoading || AUTH_COPY.es.forgotLoading}
                  >
                    {forgotCooldown > 0
                      ? `${AUTH_COPY[language as keyof typeof AUTH_COPY]?.wait || AUTH_COPY.es.wait} ${forgotCooldown}${AUTH_COPY[language as keyof typeof AUTH_COPY]?.waitSuffix || AUTH_COPY.es.waitSuffix}`
                      : (AUTH_COPY[language as keyof typeof AUTH_COPY]?.forgotBtn || AUTH_COPY.es.forgotBtn)}
                  </PrimaryButton>
                </form>
              </div>
            )}

            {/* ── VISTA DE ENLACE ENVIADO ───────────────────────────────────── */}
            {view === "forgot-sent" && (
              <div className="p-8 flex flex-col items-center text-center gap-5">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl animate-pulse"
                  style={{ background: "rgba(255, 107, 0, 0.08)", border: "1px solid rgba(255, 107, 0, 0.2)" }}
                >
                  <CheckCircle2 size={28} style={{ color: C.accent }} />
                </div>
                <div>
                  <h2 className="text-lg font-heading font-extrabold text-gray-100">¡Correo enviado!</h2>
                  <p className="text-xs leading-relaxed max-w-[270px] text-neutral-400 mt-1">
                    Revisa tu bandeja en{" "}
                    <span className="font-bold text-gray-200">{forgotEmail}</span>{" "}
                    para continuar con el restablecimiento.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-2 w-full rounded-xl py-3 text-xs font-bold uppercase tracking-wider transition-all border border-white/5 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}

// ─── Subcomponentes Internos Refinados ─────────────────────────────────────

function ErrorBanner({ message }: { message: React.ReactNode | null }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2.5 rounded-xl px-4 py-3.5"
      style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)" }}
    >
      <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
      <div className="text-xs leading-relaxed text-red-300 flex-1">{message}</div>
    </motion.div>
  );
}

function Field({
  icon, label, type, value, onChange, placeholder, suffixAction,
}: {
  icon: React.ReactNode;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suffixAction?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
        {label}
      </label>
      <div
        className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 transition-all duration-200 bg-neutral-900/60"
        style={{
          border: `1px solid ${focused ? "rgba(255, 107, 0, 0.45)" : "rgba(247,242,232,0.10)"}`,
          boxShadow: focused ? "0 0 12px rgba(255, 107, 0, 0.15)" : "none",
        }}
      >
        <span className="shrink-0 transition-colors" style={{ color: focused ? "#ff6b00" : "rgba(194,184,166,0.4)" }}>
          {icon}
        </span>
        <input
          type={type}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none border-none p-0 focus:ring-0 focus:outline-none"
          style={{ color: C.fg }}
        />
        {suffixAction}
      </div>
    </div>
  );
}

function PrimaryButton({ children, loading, disabled, loadingText = "Procesando..." }: { children: React.ReactNode; loading: boolean; disabled?: boolean; loadingText?: string }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="relative w-full overflow-hidden rounded-xl py-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-orange-500/10 cursor-pointer text-black hover:brightness-110 active:scale-[0.98]"
      style={{
        background: `linear-gradient(135deg, ${C.accent}, ${C.accentStrong})`,
      }}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="h-4 w-4 animate-spin text-black" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span>{loadingText}</span>
        </span>
      ) : children}
    </button>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 py-1 select-none">
      <div className="h-px flex-1 bg-white/[0.06]" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">o bien</span>
      <div className="h-px flex-1 bg-white/[0.06]" />
    </div>
  );
}

function DiscordButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex w-full items-center justify-center gap-3 rounded-xl py-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"
      style={{
        background: hovered ? C.discordHover : C.discord,
        color: "#ffffff",
        boxShadow: hovered ? "0 4px 20px rgba(88,101,242,0.3)" : "none",
      }}
    >
      {DISCORD_ICON}
      <span>Discord</span>
    </button>
  );
}

function GoogleButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex w-full items-center justify-center gap-3 rounded-xl py-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer border border-white/10 bg-white/[0.02] hover:bg-white/[0.08]"
      style={{
        color: "#ffffff",
        boxShadow: hovered ? "0 4px 20px rgba(255,255,255,0.05)" : "none",
      }}
    >
      {GOOGLE_ICON}
      <span>Google</span>
    </button>
  );
}
