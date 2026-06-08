"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Crown, Sparkles, Check, FileText, Shield, 
  Palette, Zap, HelpCircle, ArrowLeft, ArrowRight, CreditCard, 
  User, Calendar, Lock, Loader2, CheckCircle2, AlertCircle, Copy
} from "lucide-react";
import { toast } from "sonner";
import SiteHeader from "../components/site-header";
import { createClient } from "../../utils/supabase/client";
import { upgradeToPremiumAction } from "../actions/profile";
import AuthModal from "../components/AuthModal";
import { C } from "../lib/colors";
import Button from "../components/Button";
import { useLanguage } from "../components/language-provider";
import { AnimatePresence, motion } from "framer-motion";

const PREMIUM_COPY = {
  es: {
    backToHome: "Volver al Inicio",
    premiumTitle: "MangaStoon Premium",
    premiumSubtitle: "Desbloquea todas las funciones exclusivas de lectura, descargas y personalización sin límites.",
    benefits: {
      noAdsTitle: "Lectura Sin Anuncios",
      noAdsDesc: "Navegación y visualización 100% limpia. Filtramos todos los scripts de rastreo y publicidad externa molesta.",
      earlyAccessTitle: "Acceso Anticipado",
      earlyAccessDesc: "Lee los nuevos capítulos de tus cómics y mangas favoritos hasta 3 días antes de su publicación general.",
      extendedPdfTitle: "Descarga PDF Extendida",
      extendedPdfDesc: "Compila tomos enteros de hasta 50 capítulos juntos para tenerlos en tu PC o celular (Límite Free: 10 capítulos).",
      readingModesTitle: "Modos de Lectura Pro",
      readingModesDesc: "Desbloquea temas avanzados en el lector (OLED, Sepia avanzado, Papel Antiguo) y configuraciones adicionales.",
      vipCrownTitle: "Insignia VIP Corona",
      vipCrownDesc: "Destaca en la comunidad con una corona de oro brillante en tu perfil y al comentar en los capítulos.",
      fastServersTitle: "Servidores de Alta Velocidad",
      fastServersDesc: "Visualización instantánea de imágenes en alta definición a través de nuestra red CDN optimizada.",
    },
    pricing: {
      fullAccess: "Acceso Total",
      monthly: "Mensual",
      yearly: "Anual",
      monthlyBillingText: "A tan solo $2.99 USD al mes. Acceso inmediato sin compromisos.",
      yearlyBillingText: "Solo $24.99 USD al año (equivale a $2.08/mes). ¡Ahorra un 30% mensual comparado con el plan semestral!",
      prioritySupport: "Soporte prioritario 24/7",
      noContracts: "Sin contratos ni permanencia",
      refundGuarantee: "Garantía de reembolso de 7 días",
      alreadyPremium: "¡Ya eres Miembro Premium!",
      loginToSubscribe: "Regístrate o inicia sesión para poder activar tu prueba Premium",
      loginButton: "Registrarse / Iniciar Sesión",
      upgradeButton: "Activar Prueba Gratis Ahora",
      claimFreePass: "🎁 Reclamar Pase Gratis",
      semiannual: "Semestral",
      semiannualBillingText: "$17.49 USD cada 6 meses (equivale a $2.92/mes). ¡Plan semestral básico!",
    },
    faqs: {
      title: "Preguntas Frecuentes",
      items: [
        {
          q: "¿Por qué es gratis activar Premium?",
          a: "Actualmente ofrecemos un período de prueba gratuito. Al activar tu cuenta Premium, disfrutarás de todos los beneficios de forma gratuita por este período. Te avisaremos a tu correo electrónico cuando este período esté cerca de finalizar."
        },
        {
          q: "¿Se requiere ingresar datos de tarjeta?",
          a: "No. La activación del período de prueba es completamente gratuita y no se solicita ninguna tarjeta de crédito ni datos de pago."
        },
        {
          q: "¿Tengo descargas ilimitadas de capítulos?",
          a: "Con la cuenta Premium puedes compilar y descargar hasta 50 capítulos juntos en un solo archivo PDF (en la cuenta gratis el límite es de 10 capítulos)."
        },
        {
          q: "¿Cómo se desactivan los anuncios?",
          a: "El lector y las listas filtran automáticamente todas las redes de anuncios externas, dándote una lectura fluida."
        }
      ]
    },
    gateway: {
      title: "Activación de Período de Prueba Premium",
      subtitle: "MangaStoon Trial Activation",
      testMode: "Para reclamar tu prueba gratuita Premium, debes solicitar tu código diario único hablando en privado con nuestro bot de Telegram usando tu nombre de usuario. Luego, pega el código que recibas en el campo de abajo.",
      confirmButton: "Comenzar Prueba Gratis",
      cancelButton: "Cancelar",
      telegramLinkText: "💬 Conseguir Código en Telegram",
      codeLabel: "Código Diario de Telegram",
      codePlaceholder: "Ej: MST-XXXXXX",
      processingTitle: "Activando período de prueba gratis",
      processingMessages: [
        "Verificando cuenta...",
        "Conectando con el servidor de MangaStoon...",
        "Estableciendo período de prueba gratis...",
        "Procesando alta de prueba en MangaStoon..."
      ],
      successTitle: "¡Prueba Premium Activada!",
      successDesc: "Tu cuenta ha sido mejorada a Premium 👑 para tu período de prueba gratuito. Disfruta de todas las ventajas exclusivas.",
      successButton: "Ir a mi perfil"
    }
  },
  en: {
    backToHome: "Back to Home",
    premiumTitle: "MangaStoon Premium",
    premiumSubtitle: "Unlock all exclusive reading, download, and customization features without limits.",
    benefits: {
      noAdsTitle: "Ad-Free Reading",
      noAdsDesc: "100% clean browsing and viewing. We filter out all external tracking scripts and annoying ads.",
      earlyAccessTitle: "Early Access",
      earlyAccessDesc: "Read new chapters of your favorite comics and manga up to 3 days before their general release.",
      extendedPdfTitle: "Extended PDF Download",
      extendedPdfDesc: "Compile entire volumes of up to 50 chapters together to read on your PC or mobile (Free limit: 10 chapters).",
      readingModesTitle: "Pro Reading Modes",
      readingModesDesc: "Unlock advanced themes in the reader (OLED, Advanced Sepia, Ancient Paper) and extra settings.",
      vipCrownTitle: "VIP Crown Badge",
      vipCrownDesc: "Stand out in the community with a shiny gold crown on your profile and when commenting on chapters.",
      fastServersTitle: "High-Speed Servers",
      fastServersDesc: "Instant viewing of high-definition images through our optimized CDN network.",
    },
    pricing: {
      fullAccess: "Full Access",
      monthly: "Monthly",
      yearly: "Yearly",
      monthlyBillingText: "Just $2.99 USD per month. Immediate access, no long-term commitment.",
      yearlyBillingText: "Only $24.99 USD per year (equals $2.08/month). Save 30% monthly compared to the semiannual plan!",
      prioritySupport: "24/7 priority support",
      noContracts: "No contracts or commitment",
      refundGuarantee: "7-day money-back guarantee",
      alreadyPremium: "You are already a Premium Member!",
      loginToSubscribe: "Sign up or log in to activate your Premium trial",
      loginButton: "Sign Up / Log In",
      upgradeButton: "Activate Free Trial Now",
      claimFreePass: "🎁 Claim Free Pass",
      semiannual: "Semiannual",
      semiannualBillingText: "$17.49 USD every 6 months (equals $2.92/month). Basic semiannual plan.",
    },
    faqs: {
      title: "Frequently Asked Questions",
      items: [
        {
          q: "Why is it free to activate Premium?",
          a: "We currently offer a 30-day free trial. By activating your Premium account, you will enjoy all the benefits for free during this trial period. We will notify you by email before the trial period ends."
        },
        {
          q: "Are card details required?",
          a: "No. Activating the trial period is completely free, and no credit card or payment details are required."
        },
        {
          q: "Do I have unlimited chapter downloads?",
          a: "With a Premium account, you can compile and download up to 50 chapters together in a single PDF file (on free accounts, the limit is 10 chapters)."
        },
        {
          q: "How are ads disabled?",
          a: "The reader and listings automatically filter out all external ad networks (such as Yandex, analytics, or other ad platforms) giving you a smooth reading experience."
        }
      ]
    },
    gateway: {
      title: "Premium Trial Activation",
      subtitle: "MangaStoon Trial Activation",
      testMode: "To claim your free Premium trial, enter the daily activation code published on our official Telegram community.",
      confirmButton: "Start Free Trial",
      cancelButton: "Cancel",
      telegramLinkText: "💬 Get Code on Telegram",
      codeLabel: "Daily Telegram Code",
      codePlaceholder: "E.g.: MST-XXXXXX",
      processingTitle: "Activating free trial period",
      processingMessages: [
        "Verifying account...",
        "Connecting to MangaStoon server...",
        "Setting up free trial period...",
        "Processing MangaStoon trial registration..."
      ],
      successTitle: "Free Trial Activated!",
      successDesc: "Your account has been successfully upgraded to Premium 👑 for your free trial period. Enjoy all the exclusive benefits.",
      successButton: "Go to my profile"
    }
  },
  pt: {
    backToHome: "Voltar ao Início",
    premiumTitle: "MangaStoon Premium",
    premiumSubtitle: "Desbloqueie todas as funções exclusivas de leitura, download e personalização sem limites.",
    benefits: {
      noAdsTitle: "Leitura Sem Anúncios",
      noAdsDesc: "Navegação e visualização 100% limpa. Filtramos todos os scripts de rastreamento e anúncios externos irritantes.",
      earlyAccessTitle: "Acesso Antecipado",
      earlyAccessDesc: "Leia novos capítulos de seus quadrinhos e mangás favoritos até 3 dias antes do lançamento geral.",
      extendedPdfTitle: "Download de PDF Estendido",
      extendedPdfDesc: "Compile volumes inteiros de até 50 capítulos juntos para ler no seu PC ou celular (limite grátis: 10 capítulos).",
      readingModesTitle: "Modos de Leitura Pro",
      readingModesDesc: "Desbloqueie temas avançados no leitor (OLED, Sépia Avançado, Papel Antigo) e configurações extras.",
      vipCrownTitle: "Selo de Coroa VIP",
      vipCrownDesc: "Destaque-se na comunidade com uma coroa de ouro brilhante no seu perfil e ao comentar nos capítulos.",
      fastServersTitle: "Servidores de Alta Velocidade",
      fastServersDesc: "Visualização instantânea de imagens em alta definição através da nossa rede CDN otimizada.",
    },
    pricing: {
      fullAccess: "Acesso Total",
      monthly: "Mensal",
      yearly: "Anual",
      monthlyBillingText: "Apenas $2.99 USD por mês. Acesso imediato, sem compromissos de longo prazo.",
      yearlyBillingText: "Apenas $24.99 USD por ano (equivale a $2.08/mês). Economize 30% mensalmente em relação ao plano semestral!",
      prioritySupport: "Suporte prioritário 24/7",
      noContracts: "Sem contratos ou fidelidade",
      refundGuarantee: "Garantia de reembolso de 7 dias",
      alreadyPremium: "Você já é um Membro Premium!",
      loginToSubscribe: "Cadastre-se ou faça login para ativar seu teste Premium",
      loginButton: "Registrar / Entrar",
      upgradeButton: "Ativar Teste Grátis Agora",
      claimFreePass: "🎁 Resgatar Passe Grátis",
      semiannual: "Semestral",
      semiannualBillingText: "$17.49 USD a cada 6 meses (equivale a $2.92/mês). Plano semestral básico.",
    },
    faqs: {
      title: "Perguntas Freqüentes",
      items: [
        {
          q: "Por que a ativação do Premium é gratuita?",
          a: "Atualmente oferecemos um período de teste gratuito de 30 dias. Ao ativar sua conta Premium, você desfrutará de todos os benefícios gratuitamente por este período. Enviaremos um e-mail para você antes que o período de teste termine."
        },
        {
          q: "É necessário inserir dados do cartão?",
          a: "Não. A ativação do período de teste é totalmente gratuita e nenhum cartão de crédito ou dados de pagamento são necessários."
        },
        {
          q: "Tenho downloads ilimitados de capítulos?",
          a: "Com a conta Premium, você pode compilar e baixar até 50 capítulos juntos em um único arquivo PDF (nas contas gratuitas, o limite é de 10 capítulos)."
        },
        {
          q: "Como os anúncios são desativados?",
          a: "O leitor e as listagens filtram automaticamente todas as redes de anúncios externos, proporcionando uma experiência de leitura suave."
        }
      ]
    },
    gateway: {
      title: "Ativação do Período de Teste Premium",
      subtitle: "MangaStoon Trial Activation",
      testMode: "Para resgatar seu teste Premium gratuito, insira o código de ativação diário publicado em nossa comunidade oficial do Telegram.",
      confirmButton: "Iniciar Teste Grátis",
      cancelButton: "Cancelar",
      telegramLinkText: "💬 Obter Código no Telegram",
      codeLabel: "Código Diário do Telegram",
      codePlaceholder: "Ex: MST-XXXXXX",
      processingTitle: "Ativando período de teste gratuito",
      processingMessages: [
        "Verificando conta...",
        "Conectando com o servidor MangaStoon...",
        "Configurando período de teste gratuito...",
        "Processando registro de teste MangaStoon..."
      ],
      successTitle: "Teste Gratuito Ativado!",
      successDesc: "Sua conta foi atualizada para Premium 👑 com sucesso para o seu período de teste gratuito. Aproveite todas as vantagens exclusivas.",
      successButton: "Ir para meu perfil",
      validationCardDigits: "O número do cartão deve ter 16 dígitos.",
      validationCardholder: "Digite um nome de titular válido.",
      validationExpiry: "Digite uma data de vencimento válida (MM/AA).",
      validationCvc: "Digite um código CVC válido de 3 ou 4 dígitos."
    }
  }
};

// ─── Banner de estado ─────────────────────────────────────────────────────
function StatusBanner({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3.5"
      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)" }}
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
      <p className="text-sm leading-relaxed text-red-300">{error}</p>
    </div>
  );
  if (success) return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3.5 animate-fade-in"
      style={{ background: "rgba(255, 107, 0, 0.08)", border: "1px solid rgba(255, 107, 0, 0.25)" }}
    >
      <Check size={16} className="mt-0.5 shrink-0" style={{ color: C.accent }} />
      <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{success}</p>
    </div>
  );
  return null;
}

export default function PremiumPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const t = PREMIUM_COPY[language as keyof typeof PREMIUM_COPY];
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  // Estados de Auth
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalDefaultTab, setAuthModalDefaultTab] = useState<"signin" | "signup">("signin");

  // Estados de Planes y modal
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "semiannual" | "yearly">("monthly");
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"form" | "processing" | "success">("form");
  const [processingMsg, setProcessingMsg] = useState("");

  // Sincronizar el mensaje inicial de procesamiento con el idioma activo
  useEffect(() => {
    if (isPayModalOpen && t?.gateway?.processingMessages?.length > 0) {
      setProcessingMsg(t.gateway.processingMessages[0]);
    }
  }, [isPayModalOpen, t]);

  // Estados del Formulario de Pago
  const [formError, setFormError] = useState<string | null>(null);
  const [giftCode, setGiftCode] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopyCommand = () => {
    const textToCopy = `/codigo ${profile?.username || "tu_usuario"}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      toast.success("¡Comando copiado al portapapeles!", {
        description: "Pégalo en el chat privado con el bot de Telegram."
      });
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Error al copiar:", err);
      toast.error("No se pudo copiar el comando.");
    });
  };

  // Obtener sesión y escuchar cambios de auth
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: p } = await supabase
          .from("profiles")
          .select("is_premium, username")
          .eq("id", user.id)
          .maybeSingle();
        setProfile(p);
      } else {
        setProfile(null);
      }
      setLoadingAuth(false);
    }
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    const handleProfileUpdate = () => {
      loadUser();
    };
    window.addEventListener("profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdate);
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Detección de registro directo por parámetro ?register=true
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("register") === "true") {
        setAuthModalDefaultTab("signup");
        setIsAuthModalOpen(true);
        // Limpiar el parámetro de la URL
        router.replace("/premium", { scroll: false });
      }
    }
  }, [router]);

  // Enviar el pago simulado
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!giftCode.trim()) {
      setFormError(t.gateway.codeLabel);
      return;
    }

    // Iniciar flujo de procesamiento animado
    setPaymentStep("processing");
    
    // Cambios de mensajes interactivos
    const messages = t.gateway.processingMessages;

    let currentMsgIdx = 0;
    const interval = setInterval(() => {
      if (currentMsgIdx < messages.length - 1) {
        currentMsgIdx++;
        setProcessingMsg(messages[currentMsgIdx]);
      }
    }, 600);

    // Ejecutar acción del servidor después del delay
    setTimeout(() => {
      clearInterval(interval);
      startTransition(async () => {
        const res = await upgradeToPremiumAction("gifted", giftCode);
        if (res.error) {
          setFormError(res.error);
          setPaymentStep("form");
        } else {
          setPaymentStep("success");
          setGiftCode("");
          window.dispatchEvent(new Event("profile-updated"));
        }
      });
    }, 2500);
  };
  const planPrice = billingPeriod === "monthly" ? "$2.99" : billingPeriod === "semiannual" ? "$17.49" : "$24.99";
  const planPeriodText = billingPeriod === "monthly" ? "/ mes" : billingPeriod === "semiannual" ? "/ 6 meses" : "/ año";

  const benefitsGrid = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <motion.div
        whileHover={{ y: -4, borderColor: "rgba(255, 107, 0, 0.35)", boxShadow: "0 10px 25px -5px rgba(255, 107, 0, 0.08)" }}
        transition={{ duration: 0.2 }}
        className="flex gap-4 p-5 rounded-2xl border bg-neutral-900/30 backdrop-blur"
        style={{ borderColor: C.border }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
          <Shield size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-200">{t.benefits.noAdsTitle}</h3>
          <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
            {t.benefits.noAdsDesc}
          </p>
        </div>
      </motion.div>

      <motion.div
        whileHover={{ y: -4, borderColor: "rgba(255, 107, 0, 0.35)", boxShadow: "0 10px 25px -5px rgba(255, 107, 0, 0.08)" }}
        transition={{ duration: 0.2 }}
        className="flex gap-4 p-5 rounded-2xl border bg-neutral-900/30 backdrop-blur"
        style={{ borderColor: C.border }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
          <Sparkles size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-200">{t.benefits.earlyAccessTitle}</h3>
          <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
            {t.benefits.earlyAccessDesc}
          </p>
        </div>
      </motion.div>

      <motion.div
        whileHover={{ y: -4, borderColor: "rgba(255, 107, 0, 0.35)", boxShadow: "0 10px 25px -5px rgba(255, 107, 0, 0.08)" }}
        transition={{ duration: 0.2 }}
        className="flex gap-4 p-5 rounded-2xl border bg-neutral-900/30 backdrop-blur"
        style={{ borderColor: C.border }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
          <FileText size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-200">{t.benefits.extendedPdfTitle}</h3>
          <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
            {t.benefits.extendedPdfDesc}
          </p>
        </div>
      </motion.div>

      <motion.div
        whileHover={{ y: -4, borderColor: "rgba(255, 107, 0, 0.35)", boxShadow: "0 10px 25px -5px rgba(255, 107, 0, 0.08)" }}
        transition={{ duration: 0.2 }}
        className="flex gap-4 p-5 rounded-2xl border bg-neutral-900/30 backdrop-blur"
        style={{ borderColor: C.border }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
          <Palette size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-200">{t.benefits.readingModesTitle}</h3>
          <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
            {t.benefits.readingModesDesc}
          </p>
        </div>
      </motion.div>

      <motion.div
        whileHover={{ y: -4, borderColor: "rgba(255, 107, 0, 0.35)", boxShadow: "0 10px 25px -5px rgba(255, 107, 0, 0.08)" }}
        transition={{ duration: 0.2 }}
        className="flex gap-4 p-5 rounded-2xl border bg-neutral-900/30 backdrop-blur"
        style={{ borderColor: C.border }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
          <Crown size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-200">{t.benefits.vipCrownTitle}</h3>
          <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
            {t.benefits.vipCrownDesc}
          </p>
        </div>
      </motion.div>

      <motion.div
        whileHover={{ y: -4, borderColor: "rgba(255, 107, 0, 0.35)", boxShadow: "0 10px 25px -5px rgba(255, 107, 0, 0.08)" }}
        transition={{ duration: 0.2 }}
        className="flex gap-4 p-5 rounded-2xl border bg-neutral-900/30 backdrop-blur"
        style={{ borderColor: C.border }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
          <Zap size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-200">{t.benefits.fastServersTitle}</h3>
          <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
            {t.benefits.fastServersDesc}
          </p>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d0c0b] text-white flex flex-col">
      <SiteHeader language={language} />

      <main className="flex-1 w-full flex flex-col animate-fade-in">
        {profile?.is_premium ? (
          /* VISTA PREMIUM ACTIVO: Crunchyroll Style Banner & full-width benefits */
          <div className="flex flex-col w-full">
            {/* Crunchyroll-style Premium Header Banner (Full Bleed) */}
            <div 
              className="w-full bg-[#080808] border-b border-neutral-900 py-12 md:py-16 relative overflow-hidden"
              style={{
                backgroundImage: "radial-gradient(rgba(255, 107, 0, 0.04) 1px, transparent 1px)",
                backgroundSize: "24px 24px"
              }}
            >
              <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 h-64 w-64 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="mx-auto max-w-5xl px-4 w-full relative z-10 flex flex-col">
                {/* Botón Volver */}
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors mb-8 w-fit"
                  style={{ color: C.dim }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.fg; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.dim; }}
                >
                  <ArrowLeft size={14} style={{ color: C.accent }} />
                  {t.backToHome}
                </Link>

                <div className="flex flex-col-reverse md:flex-row md:items-center justify-between gap-8">
                  {/* Left side text info */}
                  <div className="flex flex-col items-center text-center md:items-start md:text-left max-w-xl">
                    {/* Pill badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-black/40 text-amber-500 text-[10px] font-heading font-extrabold uppercase tracking-[0.15em] shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                      <Sparkles size={10} className="fill-amber-500/20" />
                      <span>{language === "es" ? "MangaStoon Premium" : language === "pt" ? "MangaStoon Premium" : "MangaStoon Premium"}</span>
                    </div>
                    {/* Headline */}
                    <h1 className="text-3xl md:text-5xl font-heading font-black tracking-tight text-white uppercase mt-4 leading-tight">
                      {language === "es" ? "¡Gracias por tu suscripción!" : language === "pt" ? "Obrigado pela sua assinatura!" : "Thank you for your subscription!"}
                    </h1>
                    {/* Subtitle */}
                    <p className="mt-4 text-sm md:text-base text-neutral-400 leading-relaxed font-semibold">
                      {language === "es" 
                        ? "Todo listo y has iniciado sesión. ¡Disfruta de tus beneficios Premium en MangaStoon!" 
                        : language === "pt" 
                          ? "Tudo pronto e você está conectado. Aproveite seus benefícios Premium no MangaStoon!" 
                          : "All set and you are logged in. Enjoy your Premium benefits on MangaStoon!"}
                    </p>
                    {/* Link button */}
                    <Link
                      href="/explore"
                      className="mt-6 inline-flex items-center gap-2 text-base font-heading font-black text-[#ff6b00] hover:text-[#ff8533] group transition-all"
                    >
                      <span>{language === "es" ? "Comenzar A Ver" : language === "pt" ? "Começar A Ver" : "Start Watching"}</span>
                      <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>

                  {/* Right side circular graphic */}
                  <div className="w-48 h-48 md:w-[280px] md:h-[280px] lg:w-[320px] lg:h-[320px] rounded-full overflow-hidden border-4 border-neutral-900 bg-neutral-950 shrink-0 self-center relative shadow-2xl shadow-orange-500/10">
                    <img src="/premium_welcome_artwork.png" alt="Premium Welcome Artwork" className="w-full h-full object-cover animate-fade-in" />
                  </div>
                </div>
              </div>
            </div>

            {/* Beneficios abajo */}
            <div className="mx-auto max-w-5xl px-4 py-12 md:py-16 w-full flex flex-col">
              <div className="text-center mb-12">
                <h2 className="text-xl md:text-2xl font-heading font-black tracking-tight text-white uppercase">
                  {language === "es" ? "¡Disfrutás del máximo nivel de lectura!" : language === "pt" ? "Aproveite o nível máximo de leitura!" : "Enjoy the ultimate reading experience!"}
                </h2>
                <p className="mt-2 text-xs md:text-sm text-neutral-400 max-w-xl mx-auto leading-relaxed">
                  {language === "es" 
                    ? "Disfruta de cómics y mangas sin anuncios, lee donde quieras con descargas extendidas y accede a configuraciones de lectura exclusivas."
                    : language === "pt"
                      ? "Aproveite quadrinhos e mangás sem anúncios, leia onde quiser com downloads estendidos e acesse configurações de leitura exclusivas."
                      : "Enjoy comics and manga ad-free, read anywhere with extended downloads, and access exclusive reading settings."}
                </p>
              </div>
              
              {benefitsGrid}
            </div>
          </div>
        ) : (
          /* VISTA NO PREMIUM: Hero Section arriba, y abajo dos columnas en desktop: beneficios a la izquierda, precios a la derecha */
          <div className="mx-auto max-w-5xl px-4 py-12 md:py-16 w-full flex flex-col">
            {/* Botón Volver */}
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors mb-8 w-fit"
              style={{ color: C.dim }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.fg; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.dim; }}
            >
              <ArrowLeft size={14} style={{ color: C.accent }} />
              {t.backToHome}
            </Link>

            {/* Hero Section */}
            <div className="flex flex-col items-center text-center mb-12 md:mb-16 relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-12 h-64 w-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-black shadow-lg shadow-orange-500/20 mb-6">
                <Crown size={28} className="fill-black stroke-[2.2]" />
              </div>

              <h1 className="text-3xl md:text-5xl font-heading font-bold tracking-tight max-w-2xl bg-gradient-to-r from-amber-200 via-orange-400 to-yellow-200 bg-clip-text text-transparent">
                {t.premiumTitle}
              </h1>
              <p className="mt-4 text-sm md:text-base text-neutral-400 max-w-lg">
                {t.premiumSubtitle}
              </p>
            </div>

            <div className="w-full">
              {/* Pricing Section Centrada Arriba */}
              <div className="w-full flex justify-center mb-16">
                <div className="flex flex-col items-center w-full max-w-md p-6 md:p-8 rounded-3xl border relative bg-gradient-to-b from-neutral-900/60 to-neutral-950/80 shadow-2xl"
                  style={{ borderColor: "rgba(245, 158, 11, 0.25)" }}>
                  <div className="absolute top-0 right-6 -translate-y-3 rounded-full bg-amber-500 px-3 py-1 text-[9px] font-heading font-bold uppercase tracking-wider text-black">
                    {t.pricing.fullAccess}
                  </div>

                  {/* Billing Switcher */}
                  <div className="flex bg-neutral-950/60 p-1 rounded-xl w-full mb-6 border relative" style={{ borderColor: C.border }}>
                    <button
                      onClick={() => setBillingPeriod("monthly")}
                      className="flex-1 py-2 text-[10px] font-heading font-semibold rounded-xl transition-all cursor-pointer relative z-10"
                      style={{
                        color: billingPeriod === "monthly" ? C.accent : C.dim,
                      }}
                    >
                      {billingPeriod === "monthly" && (
                        <motion.span
                          layoutId="activeBilling"
                          className="absolute inset-0 rounded-lg bg-orange-500/10 border border-orange-500/20"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <span className="relative z-10">{t.pricing.monthly}</span>
                    </button>
                    <button
                      onClick={() => setBillingPeriod("semiannual")}
                      className="flex-1 py-2 text-[10px] font-heading font-semibold rounded-xl transition-all cursor-pointer relative z-10"
                      style={{
                        color: billingPeriod === "semiannual" ? C.accent : C.dim,
                      }}
                    >
                      {billingPeriod === "semiannual" && (
                        <motion.span
                          layoutId="activeBilling"
                          className="absolute inset-0 rounded-lg bg-orange-500/10 border border-orange-500/20"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <span className="relative z-10">{t.pricing.semiannual}</span>
                    </button>
                    <button
                      onClick={() => setBillingPeriod("yearly")}
                      className="flex-1 py-2 text-[10px] font-heading font-semibold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer relative z-10"
                      style={{
                        color: billingPeriod === "yearly" ? C.accent : C.dim,
                      }}
                    >
                      {billingPeriod === "yearly" && (
                        <motion.span
                          layoutId="activeBilling"
                          className="absolute inset-0 rounded-lg bg-orange-500/10 border border-orange-500/20"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center justify-center gap-0.5">
                        <span>{t.pricing.yearly}</span>
                        <span className="text-[7px] bg-emerald-500/20 text-emerald-400 px-0.5 rounded font-heading font-bold">-33%</span>
                      </span>
                    </button>
                  </div>

                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-4xl font-heading font-bold text-gray-100">{planPrice}</span>
                    <span className="text-xs text-neutral-400 font-bold">{planPeriodText}</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 text-center mb-6 leading-relaxed min-h-[32px] flex items-center justify-center">
                    {billingPeriod === "monthly" 
                      ? t.pricing.monthlyBillingText
                      : billingPeriod === "semiannual"
                        ? t.pricing.semiannualBillingText
                        : t.pricing.yearlyBillingText}
                  </p>

                  <div style={{ height: "1px", background: C.border }} className="w-full mb-6" />

                  {/* Plan checklist */}
                  <div className="flex flex-col gap-3.5 w-full mb-8 border-t border-b border-white/[0.05] py-5">
                    <div className="flex items-start gap-2.5 text-xs text-neutral-300">
                      <Check size={14} className="text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">{t.benefits.noAdsTitle}</span>
                        <span className="text-[11px] text-neutral-400 leading-normal block mt-0.5">{t.benefits.noAdsDesc}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-neutral-300">
                      <Check size={14} className="text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">{t.benefits.earlyAccessTitle}</span>
                        <span className="text-[11px] text-neutral-400 leading-normal block mt-0.5">{t.benefits.earlyAccessDesc}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-neutral-300">
                      <Check size={14} className="text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">{t.benefits.extendedPdfTitle}</span>
                        <span className="text-[11px] text-neutral-400 leading-normal block mt-0.5">{t.benefits.extendedPdfDesc}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-neutral-300">
                      <Check size={14} className="text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">{t.benefits.fastServersTitle}</span>
                        <span className="text-[11px] text-neutral-400 leading-normal block mt-0.5">{t.benefits.fastServersDesc}</span>
                      </div>
                    </div>
                    <div className="h-px bg-white/5 my-1 w-full" />
                    <div className="flex items-center gap-2.5 text-xs text-neutral-400">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span>{t.pricing.prioritySupport}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-neutral-400">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span>{t.pricing.noContracts}</span>
                    </div>
                  </div>

                  {/* Botón Acción */}
                  {loadingAuth ? (
                    <div className="flex items-center justify-center py-3.5 w-full bg-neutral-900 rounded-xl">
                      <Loader2 size={16} className="animate-spin text-orange-500" />
                    </div>
                  ) : !user ? (
                    <div className="w-full text-center">
                      <p className="text-[10px] text-neutral-500 mb-2">{t.pricing.loginToSubscribe}</p>
                      <button
                        type="button"
                        onClick={() => setIsAuthModalOpen(true)}
                        className="w-full block text-center rounded-xl bg-[#ff6b00] py-3 text-sm font-heading font-bold text-black hover:brightness-110 active:scale-95 transition-all shadow-md shadow-orange-500/10"
                      >
                        {t.pricing.loginButton}
                      </button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => {
                        setPaymentStep("form");
                        setIsPayModalOpen(true);
                      }}
                      icon={<Sparkles size={14} className="fill-black" />}
                      className="w-full"
                    >
                      {t.pricing.claimFreePass}
                    </Button>
                  )}
                </div>
              </div>

              {/* Beneficios de Premium */}
              <div className="w-full mb-12">
                <h2 className="text-xl font-heading font-bold text-center md:text-left text-[#ff6b00] uppercase tracking-wider mb-8 flex items-center justify-center md:justify-start gap-2">
                  <Crown size={20} className="fill-[#ff6b00]/10 text-[#ff6b00] shrink-0" />
                  <span>{language === "es" ? "Beneficios de Premium" : language === "pt" ? "Benefícios do Premium" : "Premium Benefits"}</span>
                </h2>
                {benefitsGrid}
              </div>
            </div>

          </div>
        )}
      </main>

      {/* ── MODAL INTERACTIVO DE PASARELA DE PAGO SIMULADA ───────────────────── */}
      <AnimatePresence>
        {isPayModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
            style={{ background: "rgba(0, 0, 0, 0.85)" }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="w-full max-w-md rounded-3xl p-6 text-left relative overflow-hidden"
              style={{
                background: "#131110",
                border: "1px solid rgba(255, 107, 0, 0.2)",
                boxShadow: "0 24px 50px rgba(0, 0, 0, 0.9)"
              }}
            >
              <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full bg-orange-500/5 blur-2xl pointer-events-none" />

              <AnimatePresence mode="wait">
                {/* PASO 1: CONFIRMACIÓN SIMPLE DE PRUEBA GRATUITA */}
                {paymentStep === "form" && (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handlePaymentSubmit}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Crown size={24} className="text-[#ff6b00]" />
                      <div>
                        <h3 className="text-base font-bold text-gray-200">{t.gateway.title}</h3>
                        <p className="text-[10px] text-neutral-500">{t.gateway.subtitle}</p>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-900/50 p-4 rounded-xl border border-white/5">
                      {t.gateway.testMode}
                    </p>

                    <div className="flex flex-col gap-4">
                      {/* Explicación de código único y Copia de Usuario */}
                      <div className="bg-neutral-900/40 p-3.5 rounded-xl border border-white/5 text-xs text-neutral-300 leading-relaxed">
                        <p className="mb-2">
                          {language === "es" 
                            ? "Para conseguir tu código diario único, debes iniciar un chat privado con nuestro bot y enviarle el comando exacto de abajo:" 
                            : language === "pt"
                            ? "Para obter o seu código diário exclusivo, inicie uma conversa privada com o nosso bot e envie o comando exato abaixo:"
                            : "To get your unique daily code, start a private chat with our bot and send the exact command below:"}
                        </p>
                        <button
                          type="button"
                          onClick={handleCopyCommand}
                          className="w-full flex items-center justify-between bg-black/40 p-2.5 rounded-lg border border-white/5 font-mono text-[11px] text-yellow-500 hover:border-yellow-500/30 transition-all cursor-pointer mb-2 group text-left"
                        >
                          <span>/codigo {profile?.username || "tu_usuario"}</span>
                          <span className="flex items-center gap-1 text-[9px] text-neutral-400 font-sans font-bold group-hover:text-yellow-500 transition-colors uppercase select-none">
                            {copied ? (
                              <>
                                <Check size={10} className="text-emerald-500" />
                                <span>{language === "es" ? "Copiado" : language === "pt" ? "Copiado" : "Copied"}</span>
                              </>
                            ) : (
                              <>
                                <Copy size={10} />
                                <span>{language === "es" ? "Copiar" : language === "pt" ? "Copiar" : "Copy"}</span>
                              </>
                            )}
                          </span>
                        </button>
                        {!profile?.username && (
                          <p className="text-[10px] text-rose-400 font-semibold mt-1">
                            {language === "es" 
                              ? "⚠️ Primero debes guardar un nombre de usuario en tu panel de perfil." 
                              : language === "pt"
                              ? "⚠️ Primeiro você deve salvar um nome de usuário no seu painel de perfil."
                              : "⚠️ First you must save a username in your profile panel."}
                          </p>
                        )}
                      </div>

                      {/* Botón de Enlace a Telegram */}
                      <a
                        href="https://t.me/RaphaelPremiumBot?start=codigo"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#24A1DE]/30 bg-[#24A1DE]/10 py-3 text-xs font-bold text-[#24A1DE] hover:bg-[#24A1DE]/15 transition-all text-center cursor-pointer shadow-sm"
                      >
                        {t.gateway.telegramLinkText}
                      </a>

                      {/* Input del código */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-zinc-400">
                          {t.gateway.codeLabel}
                        </label>
                        <input
                          type="text"
                          value={giftCode}
                          onChange={(e) => setGiftCode(e.target.value)}
                          placeholder={t.gateway.codePlaceholder}
                          className="w-full px-4 py-2.5 rounded-xl border bg-neutral-900/60 text-sm font-medium focus:outline-none focus:border-yellow-500/50 transition-all uppercase"
                          style={{
                            borderColor: C.border || "rgba(247,242,232,0.15)",
                            color: C.fg || "#F7F2E8",
                          }}
                        />
                      </div>
                    </div>

                    {formError && <StatusBanner error={formError} />}

                    <div className="flex gap-3 mt-4">
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={!giftCode.trim()}
                      >
                        {t.gateway.confirmButton}
                      </Button>
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => {
                          setIsPayModalOpen(false);
                          setGiftCode("");
                          setFormError(null);
                        }}
                        className="flex-1"
                      >
                        {t.gateway.cancelButton}
                      </Button>
                    </div>
                  </motion.form>
                )}

                {/* PASO 2: PROCESANDO */}
                {paymentStep === "processing" && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center justify-center py-10 text-center"
                  >
                    <Loader2 size={40} className="animate-spin mb-6" style={{ color: C.accent }} />
                    <h4 className="text-sm font-bold text-neutral-200">{t.gateway.processingTitle}</h4>
                    <p className="mt-2 text-xs text-neutral-400 max-w-xs">{processingMsg}</p>
                  </motion.div>
                )}

                {/* PASO 3: ÉXITO */}
                {paymentStep === "success" && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center justify-center py-8 text-center"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-6">
                      <CheckCircle2 size={36} />
                    </div>
                    <h4 className="text-base font-heading font-bold text-neutral-100">{t.gateway.successTitle}</h4>
                    <p className="mt-2 text-xs text-neutral-400 leading-relaxed max-w-xs">
                      {t.gateway.successDesc}
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setIsPayModalOpen(false);
                        router.push("/profile");
                        router.refresh();
                      }}
                      className="mt-6 w-full rounded-xl bg-emerald-500 py-3 text-sm font-heading font-bold text-black hover:brightness-110 active:scale-95 transition-all"
                    >
                      {t.gateway.successButton}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal 
        open={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        defaultTab={authModalDefaultTab}
      />
    </div>
  );
}
