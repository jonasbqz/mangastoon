"use client";
import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, Check, AlertCircle, Clock, Edit3, Bug,
  Camera, Loader2, ArrowLeft, LogOut, Trash2, 
  Mail, ShieldAlert, BookOpen, Settings, Crown, History, Heart, HeartCrack, Book, Key, Scroll,
  Globe, Lock, Plus, Link as LinkIcon, Share2, FolderHeart, Sparkles, X, Eye, EyeOff
} from "lucide-react";
import { updateUsername, uploadAvatar, updateReadingDirection, deleteAccountAction, upgradeToPremiumAction } from "../actions/profile";
import { getUserMangaLists, createMangaListAction, deleteMangaListAction } from "../actions/lists";
import { createClient } from "../../utils/supabase/client";
import { useReaderSettingsStore } from "../store/useReaderSettingsStore";
import { useFavoritesStore } from "../store/useFavoritesStore";
import { useHistoryStore } from "../store/useHistoryStore";
import { buildComicPath } from "../utils/slugify";
import MangaCard, { type MangaShowcaseItem } from "../components/MangaCard";
import { C } from "../lib/colors";
import Button from "../components/Button";
import { toast } from "sonner";
import { SupportedLanguage, useLanguage } from "../components/language-provider";


const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 1_048_576; // 1 MB

interface ProfileData {
  username: string | null;
  avatar_url: string | null;
  username_updated_at: string | null;
  reading_direction: string | null;
  is_premium?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
}

interface UserData {
  id?: string;
  email: string | undefined;
  app_metadata: { provider?: string };
  user_metadata?: { scheduled_delete_at?: string | null; premium_since?: string | null };
  created_at?: string;
}

interface Props {
  profile: ProfileData | null;
  user: UserData;
}

const PROFILE_FORM_COPY = {
  es: {
    backToHome: "Volver al Inicio",
    userPanel: "Panel de Usuario",
    myAccount: "Mi Cuenta",
    library: "Biblioteca",
    settings: "Ajustes",
    noUsername: "Sin nombre de usuario",
    discordAuth: "Conectado con Discord",
    verifiedEmail: "Correo Verificado",
    premium: "Premium",
    readingPreference: "Preferencia de Lectura",
    readingDesc: "Configurá cómo preferís leer los capítulos de tus cómics por defecto.",
    cascadeWebtoon: "Cascada / Manhwas",
    cascadeDesc: "Lectura vertical continua",
    traditionalManga: "Manga Tradicional",
    traditionalDesc: "Página por página horizontal",
    premiumReadingNoticeTitle: "El modo de lectura en Cascada es un beneficio Premium.",
    premiumReadingNoticeDesc: "¡Activá tu Pase Premium gratis para habilitar esta opción!",
    publicUsername: "Nombre de usuario público",
    availableIn: "Disponible en {days} día{plural}",
    usernamePlaceholder: "Tu usuario público",
    saveUsername: "Guardar nombre de usuario",
    upgradeToPremium: "Mejora tu cuenta a Premium",
    upgradeDesc: "Accede a lecturas sin anuncios publicitarios, descargas extendidas de capítulos en PDF, temas visuales Pro y soporte prioritario.",
    viewBenefits: "Ver beneficios & planes",
    claimFreePass: "🎁 Reclamar Pase Gratis",
    favorites: "Favoritos",
    history: "Historial",
    myLists: "Mis Listas",
    noFavoritesTitle: "No tienes mangas favoritos",
    noListsTitle: "No tienes listas creadas",
    noListsDesc: "Crea listas para agrupar tus mangas favoritos y compartirlas con la comunidad de MangaStoon.",
    noFavoritesDesc: "Navega por el catálogo y pulsa el botón de corazón para que aparezcan en tu biblioteca personal.",
    goToCatalog: "Ir al catálogo →",
    emptyHistoryTitle: "Tu historial está vacío",
    emptyHistoryDesc: "Los cómics y capítulos que leas se irán guardando automáticamente aquí para que continúes donde lo dejaste.",
    readOn: "Leído el",
    read: "Leer",
    noCover: "Sin portada",
    security: "Seguridad",
    securityDesc: "Tu información de acceso y opciones de seguridad.",
    email: "Correo Electrónico",
    password: "Contraseña de Cuenta",
    changePassword: "Cambiar Contraseña",
    accountManagement: "Gestión de Cuenta",
    accountManagementDesc: "Cerrar sesión o eliminar tu cuenta de forma definitiva.",
    logout: "Cerrar sesión",
    deleteAccountPerm: "Eliminar cuenta permanentemente",
    deleteModalTitle: "¿Quieres programar la eliminación de tu cuenta?",
    deleteModalDesc: "Esta acción programará la eliminación definitiva de tu cuenta en 30 días. Durante este período, podrás iniciar sesión nuevamente para cancelar la solicitud y recuperar todos tus datos intactos.",
    deleteModalConfirm: "Programar eliminación",
    deleteModalCancel: "Cancelar",
    giftModalTitle: "¡Reclama tu Pase Premium Gratis!",
    giftModalDesc: "¡Queremos que pruebes la experiencia completa de MangaStoon! Te regalamos un Pase Premium Temporal totalmente gratis.\n\nDisfruta de lectura 100% libre de anuncios, descargas extendidas de capítulos en PDF y opciones Pro mientras terminamos de integrar Paddle/LemonSqueezy.",
    giftModalActivating: "Activando...",
    giftModalActivate: "🎁 Activar Regalo",
    giftModalClose: "Cerrar",
    giftTelegramLinkText: "💬 Ir a la Comunidad de Telegram",
    giftCodeLabel: "Tu Código Único de Telegram",
    giftCodePlaceholder: "Ej: MST-XXXXX",
    avatarTypeErr: "Solo se permiten imágenes .jpg, .jpeg, .png o .webp.",
    avatarSizeErr: "La imagen es demasiado pesada. El tamaño máximo permitido es de 1 MB.",
    avatarSuccess: "¡Avatar actualizado correctamente!",
    usernameMinErr: "El nombre de usuario debe tener al menos 3 caracteres.",
    usernameMaxErr: "El nombre de usuario no puede superar los 30 caracteres.",
    usernamePatternErr: "Solo se permiten letras, números, puntos, guiones y guiones bajos.",
    usernameSuccessMsg: "¡Nombre de usuario actualizado correctamente!",
    giftSuccessMsg: "¡Tu Pase Premium de Regalo ha sido activado con éxito! 👑",
    giftErrorFallback: "Ocurrió un error al procesar tu solicitud.",
    resetPasswordErr: "Error al enviar el correo de restablecimiento: ",
    resetPasswordSuccess: "Correo de restablecimiento enviado. ¡Revisa tu casilla!",
    resetPasswordErrFallback: "Ocurrió un error inesperado al intentar cambiar la contraseña.",
    deleteAccountErrFallback: "Ocurrió un error inesperado al intentar borrar la cuenta.",
    support: "Soporte de la Plataforma",
    supportDesc: "Si encontrás algún problema técnico, bug o tenés dudas, repórtalo directamente para que podamos ayudarte.",
    reportBug: "Reportar un Error",
    editEmail: "Editar Correo",
    changeEmailTitle: "Cambiar Correo Electrónico",
    newEmailLabel: "Nuevo Correo Electrónico",
    changeEmailConfirm: "Cambiar Correo",
    changeEmailCancel: "Cancelar",
    currentPasswordLabel: "Contraseña Actual",
    newPasswordLabel: "Nueva Contraseña",
    confirmPasswordLabel: "Confirmar Nueva Contraseña",
    changePasswordConfirm: "Cambiar Contraseña",
    deleteListModalTitle: "¿Eliminar esta lista?",
    deleteListModalDesc: 'Se eliminará la lista "{name}". Esta acción no se puede deshacer y perderás los cómics guardados en ella.',
    deleteListConfirm: "Eliminar lista",
    deleteListCancel: "Cancelar",
    confirmUsernameTitle: "Confirmar cambio de usuario",
    confirmUsernameDesc: "Se cambiará tu nombre de usuario a {username}. Una vez confirmado, no podrás volver a modificarlo por 7 días.",
    confirmUsernameBtn: "Confirmar Cambio",
    confirmUsernameCancel: "Cancelar",
  },
  en: {
    backToHome: "Back to Home",
    userPanel: "User Panel",
    myAccount: "My Account",
    library: "Library",
    settings: "Settings",
    noUsername: "No username set",
    discordAuth: "Connected with Discord",
    verifiedEmail: "Verified Email",
    premium: "Premium",
    readingPreference: "Reading Preference",
    readingDesc: "Configure how you prefer to read your comic chapters by default.",
    cascadeWebtoon: "Cascade / Manhwas",
    cascadeDesc: "Continuous vertical reading",
    traditionalManga: "Traditional Manga",
    traditionalDesc: "Horizontal page-by-page reading",
    premiumReadingNoticeTitle: "Cascade reading mode is a Premium benefit.",
    premiumReadingNoticeDesc: "Activate your free Premium Pass to enable this option!",
    publicUsername: "Public Username",
    availableIn: "Available in {days} day{plural}",
    usernamePlaceholder: "Your public username",
    saveUsername: "Save Username",
    upgradeToPremium: "Upgrade to Premium",
    upgradeDesc: "Get ad-free reading, extended chapter PDF downloads, Pro visual themes, and priority support.",
    viewBenefits: "View benefits & plans",
    claimFreePass: "🎁 Claim Free Pass",
    favorites: "Favorites",
    history: "History",
    myLists: "My Lists",
    noFavoritesTitle: "You have no favorite manga",
    noListsTitle: "You have no lists created",
    noListsDesc: "Create lists to group your favorite manga and share them with the MangaStoon community.",
    noFavoritesDesc: "Browse the catalog and tap the heart button to add them to your personal library.",
    goToCatalog: "Go to catalog →",
    emptyHistoryTitle: "Your history is empty",
    emptyHistoryDesc: "The comics and chapters you read will be automatically saved here so you can continue where you left off.",
    readOn: "Read on",
    read: "Read",
    noCover: "No cover",
    security: "Security",
    securityDesc: "Your access information and security options.",
    email: "Email Address",
    password: "Account Password",
    changePassword: "Change Password",
    accountManagement: "Account Management",
    accountManagementDesc: "Log out or delete your account permanently.",
    logout: "Log out",
    deleteAccountPerm: "Permanently delete account",
    deleteModalTitle: "Schedule account deletion?",
    deleteModalDesc: "This action will schedule your account for permanent deletion in 30 days. During this period, you can log back in at any time to cancel this request and restore all your data intact.",
    deleteModalConfirm: "Schedule deletion",
    deleteModalCancel: "Cancel",
    giftModalTitle: "Claim Your Free Premium Pass!",
    giftModalDesc: "We want you to try the full MangaStoon experience! We're gifting you a free temporary Premium Pass.\n\nEnjoy 100% ad-free reading, extended chapter PDF downloads, and Pro options while we finish integrating Paddle/LemonSqueezy.",
    giftModalActivating: "Activating...",
    giftModalActivate: "🎁 Activate Gift",
    giftModalClose: "Close",
    giftTelegramLinkText: "💬 Go to Telegram Community",
    giftCodeLabel: "Your Unique Telegram Code",
    giftCodePlaceholder: "E.g.: MST-XXXXX",
    avatarTypeErr: "Only .jpg, .jpeg, .png or .webp images are allowed.",
    avatarSizeErr: "The image is too heavy. Maximum size allowed is 1 MB.",
    avatarSuccess: "Avatar updated successfully!",
    usernameMinErr: "Username must be at least 3 characters long.",
    usernameMaxErr: "Username cannot exceed 30 characters.",
    usernamePatternErr: "Only letters, numbers, dots, hyphens, and underscores are allowed.",
    usernameSuccessMsg: "Username updated successfully!",
    giftSuccessMsg: "Your Gift Premium Pass has been activated successfully! 👑",
    giftErrorFallback: "An error occurred while processing your request.",
    resetPasswordErr: "Error sending reset email: ",
    resetPasswordSuccess: "Reset email sent. Check your inbox!",
    resetPasswordErrFallback: "An unexpected error occurred while trying to change your password.",
    deleteAccountErrFallback: "An unexpected error occurred while trying to delete your account.",
    support: "Platform Support",
    supportDesc: "If you encounter any technical issues, bugs, or have questions, report them directly so we can help you.",
    reportBug: "Report a Bug",
    editEmail: "Edit Email",
    changeEmailTitle: "Change Email Address",
    newEmailLabel: "New Email Address",
    changeEmailConfirm: "Change Email",
    changeEmailCancel: "Cancel",
    currentPasswordLabel: "Current Password",
    newPasswordLabel: "New Password",
    confirmPasswordLabel: "Confirm New Password",
    changePasswordConfirm: "Change Password",
    deleteListModalTitle: "Delete this list?",
    deleteListModalDesc: 'The list "{name}" will be deleted. This action cannot be undone and you will lose the saved comics in it.',
    deleteListConfirm: "Delete list",
    deleteListCancel: "Cancel",
    confirmUsernameTitle: "Confirm Username Change",
    confirmUsernameDesc: "Your username will be changed to {username}. Once confirmed, you won't be able to change it again for 7 days.",
    confirmUsernameBtn: "Confirm Change",
    confirmUsernameCancel: "Cancel",
  },
  pt: {
    backToHome: "Voltar ao Início",
    userPanel: "Painel do Usuário",
    myAccount: "Minha Conta",
    library: "Biblioteca",
    settings: "Configurações",
    noUsername: "Sem nome de usuário",
    discordAuth: "Conectado com Discord",
    verifiedEmail: "E-mail Verificado",
    premium: "Premium",
    readingPreference: "Preferência de Leitura",
    readingDesc: "Configure como você prefere ler os capítulos dos seus quadrinhos por padrão.",
    cascadeWebtoon: "Cascata / Manhwas",
    cascadeDesc: "Leitura vertical contínua",
    traditionalManga: "Mangá Tradicional",
    traditionalDesc: "Leitura horizontal página por página",
    premiumReadingNoticeTitle: "O modo de leitura em Cascata é um benefício Premium.",
    premiumReadingNoticeDesc: "Ative seu Passe Premium gratuito para habilitar esta opção!",
    publicUsername: "Nome de usuário público",
    availableIn: "Disponível em {days} dia{plural}",
    usernamePlaceholder: "Seu usuário público",
    saveUsername: "Salvar nome de usuário",
    upgradeToPremium: "Melhore sua conta para Premium",
    upgradeDesc: "Tenha leitura sem anúncios, downloads de capítulos em PDF estendidos, temas visuais Pro e suporte prioritário.",
    viewBenefits: "Ver benefícios & planos",
    claimFreePass: "🎁 Resgatar Pase Grátis",
    favorites: "Favoritos",
    history: "Histórico",
    myLists: "Minhas Listas",
    noFavoritesTitle: "Você não tem mangás favoritos",
    noListsTitle: "Você não tem listas criadas",
    noListsDesc: "Crie listas para agrupar seus mangás favoritos e compartilhá-las com a comunidade do MangaStoon.",
    noFavoritesDesc: "Navegue pelo catálogo e clique no botão de coração para adicioná-los à sua biblioteca pessoal.",
    goToCatalog: "Ir para o catálogo →",
    emptyHistoryTitle: "Seu histórico está vazio",
    emptyHistoryDesc: "Os quadrinhos e capítulos que você ler serão salvos automaticamente aqui para você continuar de onde parou.",
    readOn: "Lido em",
    read: "Ler",
    noCover: "Sem capa",
    security: "Segurança",
    securityDesc: "Suas informações de acesso e opções de segurança.",
    email: "Endereço de E-mail",
    password: "Senha da Conta",
    changePassword: "Alterar Senha",
    accountManagement: "Gerenciamento de Conta",
    accountManagementDesc: "Sair ou excluir sua conta permanentemente.",
    logout: "Sair",
    deleteAccountPerm: "Excluir conta permanentemente",
    deleteModalTitle: "Agendar exclusão da conta?",
    deleteModalDesc: "Esta ação agendará a exclusão permanente de sua conta em 30 dias. Durante este período, você poderá fazer login novamente para cancelar a solicitação e recuperar todos os seus dados intactos.",
    deleteModalConfirm: "Agendar exclusão",
    deleteModalCancel: "Cancelar",
    giftModalTitle: "Resgate seu Passe Premium Grátis!",
    giftModalDesc: "Queremos que você experimente a experiência completa do MangaStoon! Estamos lhe dando um Passe Premium temporário totalmente grátis.\n\nAproveite leitura 100% livre de anúncios, downloads estendidos de capítulos em PDF e opções Pro enquanto terminamos a integração do Paddle/LemonSqueezy.",
    giftModalActivating: "Ativando...",
    giftModalActivate: "🎁 Ativar Presente",
    giftModalClose: "Fechar",
    giftTelegramLinkText: "💬 Ir para a Comunidade do Telegram",
    giftCodeLabel: "Seu Código Exclusivo do Telegram",
    giftCodePlaceholder: "Ex: MST-XXXXX",
    avatarTypeErr: "Apenas imagens .jpg, .jpeg, .png ou .webp são permitidas.",
    avatarSizeErr: "A imagem é muito pesada. O tamanho máximo permitido é de 1 MB.",
    avatarSuccess: "Avatar atualizado com sucesso!",
    usernameMinErr: "O nome de usuário deve ter pelo menos 3 caracteres.",
    usernameMaxErr: "O nome de usuário não pode exceder 30 caracteres.",
    usernamePatternErr: "Apenas letras, números, pontos, hífens e sublinhados são permitidos.",
    usernameSuccessMsg: "Nome de usuário atualizado com sucesso!",
    giftSuccessMsg: "Seu Passe Premium de Presente foi ativado com sucesso! 👑",
    giftErrorFallback: "Ocorreu um erro ao processar sua solicitação.",
    resetPasswordErr: "Erro ao enviar e-mail de redefinição: ",
    resetPasswordSuccess: "E-mail de redefinição enviado. Verifique sua caixa de entrada!",
    resetPasswordErrFallback: "Ocorreu um erro inesperado ao tentar alterar sua senha.",
    deleteAccountErrFallback: "Ocorreu um erro inesperado ao tentar excluir sua conta.",
    support: "Suporte da Plataforma",
    supportDesc: "Se você encontrar problemas técnicos, bugs ou tiver dúvidas, relate-os diretamente para que possamos ajudá-lo.",
    reportBug: "Relatar um Bug",
    editEmail: "Editar E-mail",
    changeEmailTitle: "Alterar Endereço de E-mail",
    newEmailLabel: "Novo Endereço de E-mail",
    changeEmailConfirm: "Alterar E-mail",
    changeEmailCancel: "Cancelar",
    currentPasswordLabel: "Senha Atual",
    newPasswordLabel: "Nova Senha",
    confirmPasswordLabel: "Confirmar Nova Senha",
    changePasswordConfirm: "Alterar Senha",
    deleteListModalTitle: "Excluir esta lista?",
    deleteListModalDesc: 'A lista "{name}" será excluída. Esta ação não pode ser desfeita e você perderá os quadrinhos salvos nela.',
    deleteListConfirm: "Excluir lista",
    deleteListCancel: "Cancelar",
    confirmUsernameTitle: "Confirmar alteração de usuário",
    confirmUsernameDesc: "Seu nome de usuário será alterado para {username}. Uma vez confirmado, você não poderá alterá-lo novamente por 7 dias.",
    confirmUsernameBtn: "Confirmar Alteração",
    confirmUsernameCancel: "Cancelar",
  }
};

function getDaysLeft(updatedAt: string | null): number | null {
  if (!updatedAt) return null;
  const daysSince = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= 7 ? null : Math.ceil(7 - daysSince);
}

function toShowcaseItem(manga: any): MangaShowcaseItem {
  const mangaDexId = manga.mangaDexId ?? manga.id ?? null;
  const title = manga.title ?? manga.titleMap?.es ?? manga.titleMap?.en ?? "Manga";

  return {
    mal_id: 0,
    title,
    score: manga.score ?? null,
    url: manga.url ?? (mangaDexId ? buildComicPath(title, mangaDexId) : "#"),
    mangaDexId,
    titleMap: manga.titleMap ?? (title ? { es: title, en: title, pt: title } : undefined),
    altTitles: manga.altTitles,
    originalLanguage: manga.originalLanguage,
    themes: manga.themes,
    tags: manga.tags,
    genres: manga.genres,
    isNsfw: manga.isNsfw,
    latestChapters: manga.latestChapters,
    images: manga.images ?? {},
  };
}

function formatTimeSince(dateString: string | null | undefined, language: string): string {
  if (!dateString) return "...";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "...";

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (language === "en") {
    if (diffYear >= 1) return `${diffYear} year${diffYear === 1 ? "" : "s"}`;
    if (diffMonth >= 1) return `${diffMonth} month${diffMonth === 1 ? "" : "s"}`;
    if (diffDay >= 1) return `${diffDay} day${diffDay === 1 ? "" : "s"}`;
    if (diffHr >= 1) return `${diffHr} hour${diffHr === 1 ? "" : "s"}`;
    if (diffMin >= 1) return `${diffMin} minute${diffMin === 1 ? "" : "s"}`;
    return "a few seconds";
  } else if (language === "pt") {
    if (diffYear >= 1) return `${diffYear} ano${diffYear === 1 ? "" : "s"}`;
    if (diffMonth >= 1) return `${diffMonth} me${diffMonth === 1 ? "s" : "ses"}`;
    if (diffDay >= 1) return `${diffDay} dia${diffDay === 1 ? "" : "s"}`;
    if (diffHr >= 1) return `${diffHr} hora${diffHr === 1 ? "" : "s"}`;
    if (diffMin >= 1) return `${diffMin} minuto${diffMin === 1 ? "" : "s"}`;
    return "alguns segundos";
  } else { // Neutral Spanish
    if (diffYear >= 1) return `${diffYear} año${diffYear === 1 ? "" : "s"}`;
    if (diffMonth >= 1) return `${diffMonth} me${diffMonth === 1 ? "s" : "ses"}`;
    if (diffDay >= 1) return `${diffDay} día${diffDay === 1 ? "" : "s"}`;
    if (diffHr >= 1) return `${diffHr} hora${diffHr === 1 ? "" : "s"}`;
    if (diffMin >= 1) return `${diffMin} minuto${diffMin === 1 ? "" : "s"}`;
    return "unos segundos";
  }
}

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

export default function ProfileForm({ profile, user }: Props) {
  const { language } = useLanguage();
  const copy = PROFILE_FORM_COPY[language];
  const router = useRouter();
  const supabase = createClient();

  // ── Tabs State ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"account" | "library" | "settings">("account");

  // ── Username state ───────────────────────────────────────────────────────
  const [username, setUsername] = useState(profile?.username ?? "");
  const [fieldFocused, setFieldFocused] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null);
  const [isUsernamePending, startUsernameTransition] = useTransition();

  // ── Avatar state ─────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isAvatarPending, startAvatarTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Preferencias de lectura ──────────────────────────────────────────────
  const [readingDirection, setReadingDirection] = useState<"vertical" | "horizontal">(
    profile?.is_premium
      ? ((profile?.reading_direction as "vertical" | "horizontal") ?? "horizontal")
      : "horizontal"
  );
  const [isPrefPending, startPrefTransition] = useTransition();
  const [prefSuccess, setPrefSuccess] = useState(false);
  const [prefError, setPrefError] = useState<string | null>(null);
  const setStoreReadingMode = useReaderSettingsStore((s) => s.setReadingMode);

  // Zustand stores para biblioteca
  const { favorites } = useFavoritesStore();
  const { history } = useHistoryStore();
  const [librarySubTab, setLibrarySubTab] = useState<"favorites" | "history" | "lists">("favorites");

  // Listas de manga
  const [userLists, setUserLists] = useState<any[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [newListPublic, setNewListPublic] = useState(true);
  const [creatingList, setCreatingList] = useState(false);

  const loadLists = useCallback(() => {
    setLoadingLists(true);
    getUserMangaLists()
      .then((res) => {
        if (res.lists) {
          setUserLists(res.lists);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingLists(false));
  }, []);

  useEffect(() => {
    if (activeTab === "library" && librarySubTab === "lists") {
      loadLists();
    }
  }, [activeTab, librarySubTab, loadLists]);

  // Restablecimiento de contraseña
  const [sendingReset, setSendingReset] = useState(false);

  // Sync Supabase reading_direction → local Zustand store on mount, with self-healing check
  useEffect(() => {
    const isUserPremium = !!profile?.is_premium;
    const direction = (profile?.reading_direction as "vertical" | "horizontal") ?? "horizontal";
    if (!isUserPremium && direction === "vertical") {
      setStoreReadingMode("horizontal");
      setReadingDirection("horizontal");
      updateReadingDirection("horizontal");
    } else {
      setStoreReadingMode(direction);
    }
  }, [profile?.reading_direction, profile?.is_premium, setStoreReadingMode]);

  // ── Acciones de Cuenta (Logout & Delete) ─────────────────────────────────
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmUsername, setConfirmUsername] = useState("");

  // ── Gifting Premium ──────────────────────────────────────────────────────
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [isClaimingGift, setIsClaimingGift] = useState(false);
  const [giftSuccess, setGiftSuccess] = useState<string | null>(null);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [giftCode, setGiftCode] = useState("");

  const handleClaimGift = async () => {
    setIsClaimingGift(true);
    setGiftError(null);
    setGiftSuccess(null);
    try {
      const res = await upgradeToPremiumAction("gifted", giftCode);
      if (res.error) {
        setGiftError(res.error);
      } else {
        setGiftSuccess(copy.giftSuccessMsg);
        window.dispatchEvent(new Event("profile-updated"));
        setTimeout(() => {
          setIsGiftModalOpen(false);
        }, 2500);
      }
    } catch {
      setGiftError(copy.giftErrorFallback);
    } finally {
      setIsClaimingGift(false);
    }
  };

  // ── Change Email & Password States & Handlers ────────────────────────────
  const [isChangeEmailModalOpen, setIsChangeEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isEmailPending, setIsEmailPending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [showUsernameConfirm, setShowUsernameConfirm] = useState(false);

  // Email change cooldown timer
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const t = setTimeout(() => setEmailCooldown(emailCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [emailCooldown]);

  // Check stored email cooldown on mount
  useEffect(() => {
    const lastEmailChange = localStorage.getItem("mangastoon_last_email_change_sent");
    if (lastEmailChange) {
      const elapsed = Math.floor((Date.now() - parseInt(lastEmailChange, 10)) / 1000);
      if (elapsed < 120) {
        setEmailCooldown(120 - elapsed);
      }
    }
  }, []);

  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordPending, setIsPasswordPending] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  // ── Delete List States & Handlers ────────────────────────────────────────
  const [listToDelete, setListToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingList, setIsDeletingList] = useState(false);

  const handleConfirmDeleteList = async () => {
    if (!listToDelete) return;
    setIsDeletingList(true);
    try {
      const res = await deleteMangaListAction(listToDelete.id);
      if (res.success) {
        toast.success(
          language === "es"
            ? "Lista eliminada"
            : language === "pt"
            ? "Lista excluída"
            : "List deleted"
        );
        loadLists();
        setListToDelete(null);
      } else {
        toast.error(res.error || "Error");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error");
    } finally {
      setIsDeletingList(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEmailPending) return;
    setEmailError(null);

    if (emailCooldown > 0) {
      setEmailError(
        language === "es"
          ? `Espera ${emailCooldown}s antes de intentar otro cambio.`
          : language === "pt"
          ? `Aguarde ${emailCooldown}s antes de tentar outra alteração.`
          : `Wait ${emailCooldown}s before trying another change.`
      );
      return;
    }

    if (!newEmail.includes("@")) {
      setEmailError(language === "es" ? "Ingresá un correo válido." : language === "pt" ? "Insira um e-mail válido." : "Please enter a valid email address.");
      return;
    }

    setIsEmailPending(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setIsEmailPending(false);

    if (error) {
      setEmailError(error.message);
      return;
    }

    toast.success(
      language === "es"
        ? "¡Solicitud enviada! Confirmá el cambio desde tu bandeja de entrada."
        : language === "pt"
        ? "Solicitação enviada! Confirme a alteração na sua caixa de entrada."
        : "Request sent! Please confirm the change in your inbox."
    );
    localStorage.setItem("mangastoon_last_email_change_sent", String(Date.now()));
    setEmailCooldown(120);
    setIsChangeEmailModalOpen(false);
    setNewEmail("");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPasswordPending) return;
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError(language === "es" ? "La nueva contraseña debe tener al menos 8 caracteres." : language === "pt" ? "A nova senha deve ter pelo menos 8 caracteres." : "New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(language === "es" ? "Las nuevas contraseñas no coinciden." : language === "pt" ? "As novas senhas não coincidem." : "New passwords do not match.");
      return;
    }
    if (newPassword === oldPassword) {
      setPasswordError(language === "es" ? "La nueva contraseña debe ser diferente a la anterior." : language === "pt" ? "A nova senha deve ser diferente da antiga." : "New password should be different from the old password.");
      return;
    }

    setIsPasswordPending(true);

    // Verify old password by signing in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email || "",
      password: oldPassword
    });

    if (signInError) {
      setIsPasswordPending(false);
      setPasswordError(
        language === "es"
          ? "La contraseña actual es incorrecta."
          : language === "pt"
          ? "A senha atual está incorreta."
          : "The current password is incorrect."
      );
      return;
    }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setIsPasswordPending(false);

    if (updateError) {
      setPasswordError(updateError.message);
      return;
    }

    toast.success(
      language === "es"
        ? "Contraseña actualizada correctamente."
        : language === "pt"
        ? "Senha atualizada com sucesso."
        : "Password updated successfully."
    );
    setIsChangePasswordModalOpen(false);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const daysLeft = getDaysLeft(profile?.username_updated_at ?? null);
  const isLocked = daysLeft !== null;
  const isDiscord = (user.app_metadata?.provider ?? "email") === "discord";
  const isOAuth = (user.app_metadata?.provider ?? "email") !== "email";
  const initials = (profile?.username ?? user.email ?? "?").charAt(0).toUpperCase();
  const displayAvatar = avatarPreview ?? avatarUrl;
  const isPremium = !!profile?.is_premium;
  const premiumSince = user.user_metadata?.premium_since || profile?.created_at || user.created_at;

  // ── Avatar: validación cliente + envío ───────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);

    // Validación de tipo
    if (!ALLOWED_TYPES.includes(file.type)) {
      setAvatarError(copy.avatarTypeErr);
      e.target.value = "";
      return;
    }

    // Validación de tamaño
    if (file.size > MAX_BYTES) {
      setAvatarError(copy.avatarSizeErr);
      e.target.value = "";
      return;
    }

    // Preview inmediato
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);

    // Subida al servidor
    const formData = new FormData();
    formData.append("avatar", file);

    startAvatarTransition(async () => {
      const result = await uploadAvatar(formData);
      if (result.error) {
        console.error('[ProfileForm] avatar upload error:', result.error);
        setAvatarError(result.error);
        setAvatarPreview(null);
      } else if (result.url) {
        setAvatarUrl(result.url);
        window.dispatchEvent(new Event("profile-updated"));
        router.refresh();
      }
      e.target.value = "";
    });
  };

  // ── Username: guardar ─────────────────────────────────────────────────────
  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isUsernamePending) return;
    setUsernameError(null);
    setUsernameSuccess(null);

    const cleanUsername = username.trim();
    if (cleanUsername.length < 3) {
      setUsernameError(copy.usernameMinErr);
      return;
    }
    if (cleanUsername.length > 30) {
      setUsernameError(copy.usernameMaxErr);
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(cleanUsername)) {
      setUsernameError(copy.usernamePatternErr);
      return;
    }

    if (isLocked) {
      setUsernameError(
        copy.availableIn
          .replace("{days}", String(daysLeft))
          .replace("{plural}", daysLeft === 1 ? "" : "s")
      );
      return;
    }

    setShowUsernameConfirm(true);
  };

  const handleConfirmUsernameSubmit = () => {
    if (isUsernamePending) return;
    setShowUsernameConfirm(false);

    startUsernameTransition(async () => {
      const result = await updateUsername(username);
      if (result.error) {
        console.error('[ProfileForm] username update error:', result.error);
        setUsernameError(result.error);
      } else {
        setUsernameSuccess(copy.usernameSuccessMsg);
        window.dispatchEvent(new Event("profile-updated"));
        router.refresh();
        setTimeout(() => {
          setUsernameSuccess(null);
        }, 4000);
      }
    });
  };

  // ── Preferencias de lectura: guardar al cambiar ──────────────────────────
  const handlePrefChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as "vertical" | "horizontal";
    setReadingDirection(val);
    setStoreReadingMode(val);
    setPrefError(null);
    setPrefSuccess(false);

    startPrefTransition(async () => {
      const result = await updateReadingDirection(val);
      if (result.error) {
        setPrefError(result.error);
      } else {
        setPrefSuccess(true);
        window.dispatchEvent(new Event("profile-updated"));
        router.refresh();
        setTimeout(() => {
          setPrefSuccess(false);
        }, 3000);
      }
    });
  };

  // ── Restablecimiento de contraseña ───────────────────────────────────────
  const handleResetPassword = async () => {
    if (!user.email) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(copy.resetPasswordErr + error.message);
      } else {
        toast.success(copy.resetPasswordSuccess);
      }
    } catch (err) {
      console.error("[ProfileForm] reset password error:", err);
      toast.error(copy.resetPasswordErrFallback);
    } finally {
      setSendingReset(false);
    }
  };

  // ── Reportar Error (Soporte) ─────────────────────────────────────────────
  const handleReportBug = () => {
    const userId = user.id;
    const userEmail = user.email || "No especificado";
    const userLang = typeof window !== "undefined" ? window.navigator.language : "es";
    const appLang = language;
    const userAgent = typeof window !== "undefined" ? window.navigator.userAgent : "Desconocido";
    const timestamp = new Date().toISOString();

    const recipient = "soporte@mangastoon.com";
    const subject = encodeURIComponent("Reporte de Error - MangaStoon");
    
    let bodyText = "";
    if (language === "es") {
      bodyText = `Por favor, describe detalladamente el error que experimentaste:\n\n\n\n` +
                 `-----------------------------------------\n` +
                 `DATOS DE DIAGNÓSTICO (No borrar)\n` +
                 `-----------------------------------------\n` +
                 `ID de Usuario: ${userId}\n` +
                 `Email: ${userEmail}\n` +
                 `Idioma del Navegador: ${userLang}\n` +
                 `Idioma de la App: ${appLang}\n` +
                 `Fecha y Hora: ${timestamp}\n` +
                 `User-Agent: ${userAgent}\n` +
                 `-----------------------------------------`;
    } else if (language === "pt") {
      bodyText = `Por favor, descreva em detalhes o erro que você experimentou:\n\n\n\n` +
                 `-----------------------------------------\n` +
                 `DADOS DE DIAGNÓSTICO (Não apagar)\n` +
                 `-----------------------------------------\n` +
                 `ID do Usuário: ${userId}\n` +
                 `Email: ${userEmail}\n` +
                 `Idioma do Navegador: ${userLang}\n` +
                 `Idioma do App: ${appLang}\n` +
                 `Data e Hora: ${timestamp}\n` +
                 `User-Agent: ${userAgent}\n` +
                 `-----------------------------------------`;
    } else {
      bodyText = `Please describe the error you experienced in detail:\n\n\n\n` +
                 `-----------------------------------------\n` +
                 `DIAGNOSTIC DATA (Do not delete)\n` +
                 `-----------------------------------------\n` +
                 `User ID: ${userId}\n` +
                 `Email: ${userEmail}\n` +
                 `Browser Language: ${userLang}\n` +
                 `App Language: ${appLang}\n` +
                 `Timestamp: ${timestamp}\n` +
                 `User-Agent: ${userAgent}\n` +
                 `-----------------------------------------`;
    }

    const body = encodeURIComponent(bodyText);
    
    if (typeof window !== "undefined") {
      window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
    }
  };

  // ── Cerrar Sesión ────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("[ProfileForm] logout error:", err);
      setIsLoggingOut(false);
    }
  };

  // ── Eliminar Cuenta ──────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (confirmUsername !== profile?.username) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      
      const result = await deleteAccountAction();
      
      if (result.error) {
        setDeleteError(result.error);
        setIsDeleting(false);
      } else {
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "scheduledDeleteDate",
            result.targetDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          );
        }
        await supabase.auth.signOut();
        setIsDeleteModalOpen(false);
        setConfirmUsername("");
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      console.error("[ProfileForm] delete account error:", err);
      setDeleteError(copy.deleteAccountErrFallback);
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 text-left">
      <div className="flex items-center justify-between gap-3 border-b pb-5" style={{ borderColor: C.border }}>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors w-fit"
          style={{ color: C.dim }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.fg; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.dim; }}
        >
          <ArrowLeft size={14} className="shrink-0" style={{ color: C.accent }} />
          {copy.backToHome}
        </Link>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-extrabold uppercase tracking-widest text-right shrink-0" style={{ color: C.accent }}>
            {copy.userPanel}
          </span>
        </div>
      </div>

      {/* Tabs Selector Segmentado Premium */}
      <div 
        className="relative flex rounded-2xl p-1 border backdrop-blur-md bg-white/[0.01] overflow-hidden" 
        style={{ borderColor: C.border }}
      >
        {(["account", "library", "settings"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const TabIcon = tab === "account" ? User : tab === "library" ? BookOpen : Settings;
          const label = tab === "account" ? copy.myAccount : tab === "library" ? copy.library : copy.settings;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative flex-1 flex items-center justify-center gap-1 py-2 sm:py-3 text-[9px] sm:text-xs md:text-sm font-heading font-bold uppercase tracking-tighter sm:tracking-wider transition-colors duration-300 rounded-xl"
              style={{
                color: isActive ? C.fg : C.dim,
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabBackground"
                  className="absolute inset-0.5 z-0 rounded-xl bg-gradient-to-r from-orange-600/25 to-orange-500/12 border border-orange-500/30"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1">
                <TabIcon size={13} className="hidden sm:inline-block shrink-0" style={{ color: isActive ? C.accent : undefined }} />
                <span>{label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── CONTENIDO TABS ────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          className="w-full flex flex-col gap-8"
        >
          {/* TAB 1: MI CUENTA */}
          {activeTab === "account" && (
            <div className="flex flex-col gap-8">
              {/* Avatar y Datos Básicos */}
              <div className="flex items-center gap-6">
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAvatarPending}
                    className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl transition-all active:scale-95"
                    style={{ border: `2px solid ${C.border}` }}
                    aria-label="Cambiar foto de perfil"
                  >
                    {displayAvatar ? (
                      <img src={displayAvatar} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-3xl font-bold"
                        style={{ background: "rgba(255, 107, 0, 0.12)", color: C.accent }}
                      >
                        {initials}
                      </div>
                    )}
                    {isAvatarPending && (
                      <div className="absolute inset-0 flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.65)" }}>
                        <Loader2 size={26} className="animate-spin" style={{ color: C.accent }} />
                      </div>
                    )}
                  </button>
                  {!isAvatarPending && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full shadow-xl transition-transform active:scale-90"
                      style={{
                        background: C.accent,
                        border: `2px solid #131110`,
                      }}
                      aria-label="Cambiar foto"
                      tabIndex={-1}
                    >
                      <Camera size={15} style={{ color: C.accentText }} />
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <p className={`truncate text-xl font-extrabold ${isPremium ? "premium-username-shimmer" : ""}`} style={isPremium ? undefined : { color: C.fg }}>
                      {profile?.username ?? copy.noUsername}
                    </p>
                    {isPremium && (
                      <Crown size={16} className="text-amber-500 fill-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)] shrink-0 animate-pulse" />
                    )}
                  </div>
                  <p className="truncate text-sm font-semibold" style={{ color: C.dim }}>{user.email}</p>
                  <p className="text-xs font-semibold mt-1" style={{ color: isPremium ? "rgb(245, 158, 11)" : "rgba(194,184,166,0.55)" }}>
                    {isPremium 
                      ? (language === "en" ? `Premium member for ${formatTimeSince(premiumSince, "en")}` : language === "pt" ? `Você é premium há ${formatTimeSince(premiumSince, "pt")}` : `Eres premium desde hace ${formatTimeSince(premiumSince, "es")}`)
                      : (language === "en" ? `Member for ${formatTimeSince(user.created_at, "en")}` : language === "pt" ? `Você é membro há ${formatTimeSince(user.created_at, "pt")}` : `Eres miembro desde hace ${formatTimeSince(user.created_at, "es")}`)
                    }
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold select-none"
                      style={{
                        background: isDiscord ? "rgba(88,101,242,0.12)" : "rgba(255, 107, 0, 0.10)",
                        color: isDiscord ? "#8b95f5" : C.accent,
                        border: `1px solid ${isDiscord ? "rgba(88,101,242,0.25)" : "rgba(255, 107, 0, 0.2)"}`,
                      }}
                    >
                      {isDiscord ? (
                        <>
                          <svg className="h-4 w-4 shrink-0 text-[#5865F2] fill-[#5865F2]" viewBox="0 0 24 24">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z" />
                          </svg>
                          <span>{copy.discordAuth}</span>
                        </>
                      ) : (
                        <>
                          <Mail size={14} className="shrink-0 text-orange-400" />
                          <span>{copy.verifiedEmail}</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {avatarError && <StatusBanner error={avatarError} />}

              {/* Preferencias de Lectura */}
              <div className="flex flex-col gap-4 border-t pt-6" style={{ borderColor: C.border }}>
                <div>
                  <h2 className="text-sm font-heading font-bold uppercase tracking-wider" style={{ color: C.fg }}>
                    {copy.readingPreference}
                  </h2>
                  <p className="text-sm mt-1 leading-normal" style={{ color: C.dim }}>
                    {copy.readingDesc}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {(["vertical", "horizontal"] as const).map((direction) => {
                    const isActive = readingDirection === direction;
                    const Icon = direction === "vertical" ? Scroll : BookOpen;
                    const title = direction === "vertical" ? copy.cascadeWebtoon : copy.traditionalManga;
                    const desc = direction === "vertical" ? copy.cascadeDesc : copy.traditionalDesc;

                    return (
                      <button
                        key={direction}
                        type="button"
                        disabled={isPrefPending}
                        onClick={() => {
                          if (isActive || isPrefPending) return;
                          if (direction === "vertical" && !isPremium) {
                            toast.error(copy.premiumReadingNoticeTitle, {
                              description: copy.premiumReadingNoticeDesc
                            });
                            setIsGiftModalOpen(true);
                            return;
                          }
                          const fakeEvent = {
                            target: { value: direction }
                          } as unknown as React.ChangeEvent<HTMLSelectElement>;
                          handlePrefChange(fakeEvent);
                        }}
                        className="flex flex-col items-center text-center gap-4 rounded-2xl p-6 border transition-all duration-300 disabled:opacity-50 relative overflow-hidden"
                        style={{
                          background: isActive ? "rgba(255, 107, 0, 0.05)" : C.bgInput,
                          borderColor: isActive ? C.accent : C.border,
                          boxShadow: isActive ? "0 4px 20px rgba(255, 107, 0, 0.08)" : "none",
                        }}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeReadingPrefBorder"
                            className="absolute inset-0 border border-orange-500 pointer-events-none rounded-2xl"
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          />
                        )}
                        <div 
                          className="flex h-14 w-14 items-center justify-center rounded-xl transition-all duration-300"
                          style={{
                            background: isActive ? "rgba(255, 107, 0, 0.12)" : "rgba(255,255,255,0.03)",
                            color: isActive ? C.accent : C.muted,
                          }}
                        >
                          <Icon size={28} />
                        </div>
                        <div>
                          <h4 className="text-base md:text-lg font-heading font-bold tracking-tight animate-fade-in flex items-center justify-center gap-1.5" style={{ color: isActive ? C.fg : C.muted }}>
                            <span>{title}</span>
                            {direction === "vertical" && (
                              <Crown size={14} className="text-amber-500 fill-amber-500 shrink-0" />
                            )}
                          </h4>
                          <p className="text-sm font-semibold text-neutral-400 mt-1 md:mt-2" style={{ color: C.dim }}>
                            {desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {prefError && <StatusBanner error={prefError} />}
              </div>

              {/* Formulario de Username */}
              <div className="border-t pt-6" style={{ borderColor: C.border }}>
                <form onSubmit={handleUsernameSubmit} className="flex flex-col gap-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs font-heading font-bold uppercase tracking-wider" style={{ color: C.dim }}>
                        {copy.publicUsername}
                      </label>
                      {isLocked && (
                        <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: C.accent }}>
                          <Clock size={12} />
                          {copy.availableIn
                            .replace("{days}", String(daysLeft))
                            .replace("{plural}", daysLeft === 1 ? "" : "s")}
                        </span>
                      )}
                    </div>

                    <div
                      className="flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all duration-200"
                      style={{
                        background: isLocked ? "rgba(247,242,232,0.01)" : C.bgInput,
                        border: `1px solid ${fieldFocused && !isLocked ? C.borderFocus : C.border}`,
                        boxShadow: fieldFocused && !isLocked ? `0 0 0 3px ${C.ringFocus}` : "none",
                        opacity: isLocked ? 0.6 : 1,
                      }}
                    >
                      <User size={16} style={{ color: fieldFocused && !isLocked ? C.accent : C.dim }} className="shrink-0" />
                      <input
                        type="text"
                        required
                        disabled={isLocked}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onFocus={() => setFieldFocused(true)}
                        onBlur={() => setFieldFocused(false)}
                        placeholder={copy.usernamePlaceholder}
                        className="flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
                        style={{ color: C.fg }}
                      />
                      {isLocked && <Clock size={15} style={{ color: C.dim }} className="shrink-0" />}
                    </div>
                  </div>

                  <StatusBanner error={usernameError} success={usernameSuccess} />

                  {!isLocked && (
                    <Button
                      type="submit"
                      loading={isUsernamePending}
                      icon={<Edit3 size={16} />}
                      className="w-full"
                    >
                      {copy.saveUsername}
                    </Button>
                  )}
                </form>
              </div>

              {/* Banner de Invitación Premium (si es Free) */}
              {!isPremium && (
                <div className="relative overflow-hidden rounded-2xl border border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 to-amber-500/5 p-6 mt-4">
                  <div className="absolute right-0 top-0 h-28 w-28 -translate-y-6 translate-x-6 rounded-full bg-yellow-500/10 blur-xl pointer-events-none" />
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-500">
                      <Crown size={22} className="fill-yellow-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-heading font-bold text-yellow-400">{copy.upgradeToPremium}</h4>
                      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: C.muted }}>
                        {copy.upgradeDesc}
                      </p>
                      <div className="flex flex-wrap gap-3 mt-4">
                        <Link
                          href="/premium"
                          className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-xs font-heading font-bold text-black hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-yellow-500/20"
                        >
                          {copy.viewBenefits}
                        </Link>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setGiftError(null);
                            setGiftSuccess(null);
                            setIsGiftModalOpen(true);
                          }}
                          className="px-5 py-2.5 text-xs font-semibold"
                        >
                          {copy.claimFreePass}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

      {/* TAB 2: BIBLIOTECA */}
      {activeTab === "library" && (
        <div className="flex flex-col gap-5 animate-fade-in">
          {/* Sub-selector: Favoritos vs Historial vs Listas */}
          <div className="flex gap-2 rounded-xl bg-transparent p-1 border overflow-x-auto" style={{ borderColor: C.border }}>
            <button
              onClick={() => setLibrarySubTab("favorites")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-heading font-semibold rounded-xl transition-all shrink-0 min-w-[90px]"
              style={{
                background: librarySubTab === "favorites" ? "rgba(255, 107, 0, 0.1)" : "transparent",
                color: librarySubTab === "favorites" ? C.accent : C.dim,
              }}
            >
              <Heart size={14} className={librarySubTab === "favorites" ? "fill-orange-500" : ""} />
              <span>{copy.favorites} ({favorites.length})</span>
            </button>
            <button
              onClick={() => setLibrarySubTab("history")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-heading font-semibold rounded-xl transition-all shrink-0 min-w-[90px]"
              style={{
                background: librarySubTab === "history" ? "rgba(255, 107, 0, 0.1)" : "transparent",
                color: librarySubTab === "history" ? C.accent : C.dim,
              }}
            >
              <History size={14} />
              <span>{copy.history} ({history.length})</span>
            </button>
            <button
              onClick={() => setLibrarySubTab("lists")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-heading font-semibold rounded-xl transition-all shrink-0 min-w-[90px]"
              style={{
                background: librarySubTab === "lists" ? "rgba(255, 107, 0, 0.1)" : "transparent",
                color: librarySubTab === "lists" ? C.accent : C.dim,
              }}
            >
              <FolderHeart size={14} />
              <span>{copy.myLists} ({userLists.length})</span>
            </button>
          </div>

          {/* Sub-tab 1: Favoritos */}
          {librarySubTab === "favorites" && (
            <div className="mt-2 min-h-[300px]">
              {favorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-20 text-gray-500">
                  <HeartCrack size={56} className="mb-4 opacity-30 text-orange-500" />
                  <p className="text-sm font-bold text-neutral-300">{copy.noFavoritesTitle}</p>
                  <p className="mt-2 text-sm max-w-xs text-neutral-500 leading-relaxed">
                    {copy.noFavoritesDesc}
                  </p>
                  <Link
                    href="/explore"
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold"
                    style={{ color: C.accent }}
                  >
                    {copy.goToCatalog}
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 max-h-[600px] overflow-y-auto pr-1">
                  {favorites.map((manga) => {
                    const item = toShowcaseItem(manga);
                    return (
                      <div key={item.mangaDexId ?? item.title} className="scale-[0.96] origin-top-left transition-transform hover:scale-98">
                        <MangaCard manga={item} variant="grid" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 2: Historial */}
          {librarySubTab === "history" && (
            <div className="mt-2 min-h-[300px]">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-20 text-gray-500">
                  <History size={56} className="mb-4 opacity-30 text-rose-500" />
                  <p className="text-sm font-bold text-neutral-300">{copy.emptyHistoryTitle}</p>
                  <p className="mt-2 text-sm max-w-xs text-neutral-500 leading-relaxed">
                    {copy.emptyHistoryDesc}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3.5 max-h-[600px] overflow-y-auto pr-1">
                  {history.map((item) => {
                    const localeMap = { es: "es-ES", en: "en-US", pt: "pt-BR" };
                    const currentLocale = localeMap[language] || "es-ES";
                    const timeString = new Date(item.timestamp).toLocaleDateString(currentLocale, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const slugifiedTitle = item.mangaTitle
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)/g, "");

                    return (
                      <div
                        key={item.mangaId + item.timestamp}
                        className="flex items-center gap-4 rounded-xl p-3 transition-all hover:bg-neutral-900 border"
                        style={{ borderColor: C.border }}
                      >
                        {/* Cover thumbnail */}
                        <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
                          {item.coverImage ? (
                            <img 
                              src={
                                item.coverImage.startsWith("/api/proxy-image")
                                  ? item.coverImage
                                  : `/api/proxy-image?url=${encodeURIComponent(item.coverImage)}`
                              }
                              alt={item.mangaTitle}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-neutral-600">
                              {copy.noCover}
                            </div>
                          )}
                        </div>

                        {/* Text info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="truncate text-sm font-bold text-neutral-100">{item.mangaTitle}</h4>
                          <p className="truncate text-xs font-semibold mt-1" style={{ color: C.accent }}>
                            Capítulo {item.chapterNumber}
                          </p>
                          <span className="text-xs block mt-1" style={{ color: C.dim }}>
                            {copy.readOn} {timeString}
                          </span>
                        </div>

                        {/* Continue reading link */}
                        <Link
                          href={`/comics/${slugifiedTitle}-${item.mangaId}/chapters/${item.chapterId}`}
                          className="shrink-0 flex items-center justify-center rounded-xl bg-orange-500/10 px-4 py-2.5 text-xs font-bold text-orange-400 hover:bg-orange-500 hover:text-black transition-colors"
                        >
                          <Book size={12} className="mr-1.5" />
                          <span>{copy.read}</span>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 3: Listas de Cómics */}
          {librarySubTab === "lists" && (
            <div className="mt-2 min-h-[300px]">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  {copy.myLists}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 px-3.5 py-2 text-xs font-heading font-bold text-orange-500 hover:bg-orange-500 hover:text-black transition-all active:scale-95"
                >
                  <Plus size={14} />
                  <span>Crear Lista</span>
                </button>
              </div>

              {loadingLists ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-2">
                  <Loader2 size={32} className="animate-spin text-orange-500" />
                  <span className="text-xs">Cargando tus listas...</span>
                </div>
              ) : userLists.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-20 text-gray-500 border border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
                  <FolderHeart size={56} className="mb-4 opacity-30 text-orange-500" />
                  <p className="text-sm font-bold text-neutral-300">{copy.noListsTitle}</p>
                  <p className="mt-2 text-sm max-w-xs text-neutral-500 leading-relaxed px-4">
                    {copy.noListsDesc}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-heading font-bold text-black hover:bg-orange-600 transition-all active:scale-95 shadow-lg shadow-orange-500/10"
                  >
                    <Plus size={14} />
                    <span>Crear mi primera lista</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-h-[600px] overflow-y-auto pr-1">
                  {userLists.map((list) => {
                    const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/lists/${list.id}` : "";
                    const copyShareLink = () => {
                      if (!shareUrl) return;
                      navigator.clipboard.writeText(shareUrl);
                      toast.success(language === "es" ? "¡Enlace copiado al portapapeles!" : language === "pt" ? "Link copiado!" : "Link copied to clipboard!");
                    };

                    const handleDelete = () => {
                      setListToDelete({ id: list.id, name: list.name });
                    };

                    return (
                      <div
                        key={list.id}
                        className="flex flex-col gap-3 rounded-2xl border bg-[#141519]/40 p-4 transition-all hover:bg-neutral-900/60"
                        style={{ borderColor: C.border }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {list.is_public ? (
                                <span title="Pública"><Globe size={14} className="text-gray-500 shrink-0" /></span>
                              ) : (
                                <span title="Privada"><Lock size={14} className="text-gray-500 shrink-0" /></span>
                              )}
                              <h4 className="truncate font-heading text-sm font-bold text-neutral-100">
                                {list.name}
                              </h4>
                            </div>
                            {list.description && (
                              <p className="mt-1 line-clamp-2 text-xs text-neutral-500 leading-normal">
                                {list.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {list.is_public && (
                              <button
                                type="button"
                                onClick={copyShareLink}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02] text-gray-400 hover:border-orange-500/20 hover:text-orange-500 transition-colors"
                                title="Copiar enlace"
                              >
                                <Share2 size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleDelete}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02] text-gray-400 hover:border-red-500/20 hover:text-red-500 transition-colors"
                              title="Eliminar lista"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <div className="mt-auto border-t border-white/5 pt-2 flex items-center justify-between text-[11px] text-gray-500">
                          <span>{list.items_count === 1 ? "1 cómic" : `${list.items_count} cómics`}</span>
                          {list.is_public ? (
                            <Link
                              href={`/lists/${list.id}`}
                              className="font-semibold text-orange-500 hover:text-orange-400"
                            >
                              Ver pública →
                            </Link>
                          ) : (
                            <span className="font-medium text-gray-600">Privada</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Modal de creación de lista */}
              <AnimatePresence>
                {showCreateModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="w-full max-w-md rounded-2xl border bg-[#141519] p-6 shadow-2xl"
                      style={{ borderColor: C.border }}
                    >
                      <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                        <h3 className="font-heading text-base font-bold text-orange-500">
                          Crear Nueva Lista
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateModal(false);
                            setNewListName("");
                            setNewListDesc("");
                          }}
                          className="text-gray-400 hover:text-white"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!newListName.trim()) return;
                          setCreatingList(true);
                          try {
                            const res = await createMangaListAction(newListName, newListDesc, newListPublic);
                            if (res.success) {
                              toast.success("Lista creada con éxito");
                              setNewListName("");
                              setNewListDesc("");
                              setShowCreateModal(false);
                              loadLists();
                            } else {
                              toast.error(res.error || "Error al crear lista");
                            }
                          } catch (err) {
                            console.error(err);
                            toast.error("Error al crear la lista");
                          } finally {
                            setCreatingList(false);
                          }
                        }}
                        className="flex flex-col gap-4"
                      >
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                            Nombre de la Lista
                          </label>
                          <input
                            type="text"
                            required
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            placeholder="Ej. Favoritos de Romance"
                            className="w-full rounded-xl border border-white/5 bg-black/40 px-3.5 py-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-orange-500/50"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                            Descripción (opcional)
                          </label>
                          <textarea
                            value={newListDesc}
                            onChange={(e) => setNewListDesc(e.target.value)}
                            placeholder="Ej. Mis mangas favoritos del género romance y recuentos de la vida."
                            rows={3}
                            className="w-full rounded-xl border border-white/5 bg-black/40 px-3.5 py-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-orange-500/50 resize-none"
                          />
                        </div>

                        <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                            <input
                              type="radio"
                              name="list_privacy"
                              checked={newListPublic}
                              onChange={() => setNewListPublic(true)}
                              className="accent-orange-500"
                            />
                            <div className="flex items-center gap-1.5">
                              <Globe size={13} className="text-gray-500" />
                              <span>Pública (se comparte en la comunidad)</span>
                            </div>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                            <input
                              type="radio"
                              name="list_privacy"
                              checked={!newListPublic}
                              onChange={() => setNewListPublic(false)}
                              className="accent-orange-500"
                            />
                            <div className="flex items-center gap-1.5">
                              <Lock size={13} className="text-gray-500" />
                              <span>Privada (solo vos podés verla)</span>
                            </div>
                          </label>
                        </div>

                        <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-4">
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreateModal(false);
                              setNewListName("");
                              setNewListDesc("");
                            }}
                            className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={creatingList || !newListName.trim()}
                            className="rounded-xl bg-orange-500 px-5 py-2 text-xs font-heading font-bold text-black hover:bg-orange-600 disabled:opacity-50 transition-colors shadow-lg shadow-orange-500/10"
                          >
                            {creatingList ? "Creando..." : "Crear Lista"}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AJUSTES */}
          {activeTab === "settings" && (
            <div className="flex flex-col gap-6">
              {/* Seguridad */}
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-sm font-heading font-bold uppercase tracking-wider" style={{ color: C.fg }}>
                    {copy.security}
                  </h2>
                  <p className="text-sm mt-1 leading-normal" style={{ color: C.dim }}>
                    {copy.securityDesc}
                  </p>
                </div>

                <div className="rounded-2xl p-5 flex flex-col gap-4 border" style={{ background: "rgba(247,242,232,0.01)", borderColor: C.border }}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm min-w-0">
                    <span className="flex items-center gap-2 font-bold shrink-0" style={{ color: C.dim }}>
                      <Mail size={16} /> {copy.email}
                    </span>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-extrabold truncate text-neutral-200">
                        {user.email}
                      </span>
                      {!isOAuth && (
                        <Button
                          variant="secondary"
                          onClick={() => setIsChangeEmailModalOpen(true)}
                          className="px-3 py-1.5 text-[11px] h-auto min-h-0 shrink-0"
                          icon={<Edit3 size={11} />}
                        >
                          {copy.editEmail}
                        </Button>
                      )}
                    </div>
                  </div>

                  {!isOAuth && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t pt-4 text-sm" style={{ borderColor: C.border }}>
                      <span className="flex items-center gap-2 font-bold" style={{ color: C.dim }}>
                        <Key size={16} /> {copy.password}
                      </span>
                      <Button
                        variant="secondary"
                        onClick={() => setIsChangePasswordModalOpen(true)}
                        className="px-4 py-2.5 text-xs"
                        icon={<Key size={13} />}
                      >
                        {copy.changePassword}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-6" style={{ borderColor: C.border }}>
                <h2 className="text-sm font-heading font-bold uppercase tracking-wider" style={{ color: C.fg }}>
                  {copy.accountManagement}
                </h2>
                <p className="text-sm mt-1 leading-normal" style={{ color: C.dim }}>
                  {copy.accountManagementDesc}
                </p>
              </div>

              {/* Acciones de Cuenta */}
              <div className="flex flex-col gap-4 pt-2">
                <Button
                  variant="secondary"
                  loading={isLoggingOut}
                  onClick={handleLogout}
                  className="w-full border-zinc-800"
                  icon={<LogOut size={16} style={{ color: C.accent }} />}
                >
                  {copy.logout}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="w-full mt-2 text-red-500/70 hover:text-red-500 py-3"
                  icon={<Trash2 size={14} />}
                >
                  {copy.deleteAccountPerm}
                </Button>
              </div>

              {/* Soporte de la Plataforma */}
              <div className="border-t pt-6" style={{ borderColor: C.border }}>
                <h2 className="text-sm font-heading font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: C.fg }}>
                  <Bug size={16} className="text-orange-500" />
                  {copy.support}
                </h2>
                <p className="text-sm mt-1.5 leading-normal" style={{ color: C.dim }}>
                  {copy.supportDesc}
                </p>
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    onClick={handleReportBug}
                    className="w-full border-zinc-800 cursor-pointer"
                    icon={<Bug size={16} />}
                  >
                    {copy.reportBug}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE CUENTA ───────────────────── */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
            style={{ background: "rgba(0, 0, 0, 0.8)" }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-3xl p-7 text-left"
              style={{
                background: "#131110",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                boxShadow: "0 24px 50px rgba(0, 0, 0, 0.9)"
              }}
            >
              <div className="flex items-center gap-3.5 text-red-500 mb-4">
                <ShieldAlert size={32} className="shrink-0" />
                <h3 className="text-xl font-bold" style={{ color: C.fg }}>
                  {copy.deleteModalTitle}
                </h3>
              </div>

              <p className="text-sm leading-relaxed mb-4" style={{ color: C.muted }}>
                {copy.deleteModalDesc}
              </p>

              <div className="mb-6">
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-2 text-red-400">
                  {language === "es" 
                    ? "Para confirmar, escribe tu nombre de usuario exacto:" 
                    : language === "pt" 
                      ? "Para confirmar, digite seu nome de usuário exato:" 
                      : "To confirm, enter your exact username:"}
                </label>
                <input
                  type="text"
                  value={confirmUsername}
                  onChange={(e) => setConfirmUsername(e.target.value)}
                  placeholder={profile?.username || ""}
                  disabled={isDeleting}
                  className="w-full px-4 py-2.5 rounded-xl border bg-neutral-900/60 text-sm font-medium focus:outline-none transition-all"
                  style={{
                    borderColor: confirmUsername === profile?.username ? "rgba(239, 68, 68, 0.6)" : "rgba(247,242,232,0.15)",
                    color: C.fg,
                  }}
                />
              </div>

              {deleteError && (
                <div className="mb-4">
                  <StatusBanner error={deleteError} />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3.5">
                <Button
                  variant="danger"
                  loading={isDeleting}
                  disabled={confirmUsername !== profile?.username || isDeleting}
                  onClick={handleDeleteAccount}
                  className="flex-1"
                >
                  {copy.deleteModalConfirm}
                </Button>

                <Button
                  variant="secondary"
                  disabled={isDeleting}
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteError(null);
                    setConfirmUsername("");
                  }}
                  className="flex-1"
                >
                  {copy.deleteModalCancel}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL PARA RECLAMAR EL PASE PREMIUM DE REGALO ───────────────────────────── */}
      <AnimatePresence>
        {isGiftModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
            style={{ background: "rgba(0, 0, 0, 0.8)" }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-3xl p-7 text-left relative overflow-hidden"
              style={{
                background: "#131110",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                boxShadow: "0 24px 50px rgba(0, 0, 0, 0.9)"
              }}
            >
              <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full bg-yellow-500/5 blur-2xl pointer-events-none" />

              <div className="flex items-center gap-3 text-yellow-500 mb-4">
                <Crown size={32} className="shrink-0 fill-yellow-500 animate-pulse" />
                <h3 className="text-xl font-bold" style={{ color: C.fg }}>
                  {copy.giftModalTitle}
                </h3>
              </div>

              <p className="text-sm leading-relaxed mb-6" style={{ color: C.muted }}>
                {copy.giftModalDesc}
              </p>

              {giftError && (
                <div className="mb-4">
                  <StatusBanner error={giftError} />
                </div>
              )}
              {giftSuccess && (
                <div className="mb-4">
                  <StatusBanner success={giftSuccess} />
                </div>
              )}

              {!giftSuccess && (
                <>
                  <div className="flex flex-col gap-4 mb-6">
                    {/* Explicación de código único y Copia de Usuario */}
                    <div className="bg-neutral-900/40 p-3.5 rounded-xl border border-white/5 text-xs text-neutral-300 leading-relaxed">
                      <p className="mb-2">
                        {language === "es" 
                          ? "Para conseguir tu código diario único, unite a la comunidad y escribí el comando:" 
                          : language === "pt"
                          ? "Para obter o seu código diário exclusivo, junte-se à comunidade e escreva o comando:"
                          : "To get your unique daily code, join the community and type the command:"}
                      </p>
                      <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-lg border border-white/5 font-mono text-[11px] text-yellow-500 select-all mb-2">
                        <span>/codigo {username || "tu_usuario"}</span>
                        <span className="text-[9px] text-neutral-500 uppercase font-sans font-bold">
                          {language === "es" ? "Copiar" : "Copy"}
                        </span>
                      </div>
                      {!username && (
                        <p className="text-[10px] text-rose-400 font-semibold mt-1">
                          {language === "es" 
                            ? "⚠️ Primero debés guardar un nombre de usuario arriba en tu panel." 
                            : language === "pt"
                            ? "⚠️ Primeiro você deve salvar um nome de usuário acima no seu painel."
                            : "⚠️ First you must save a username above in your panel."}
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
                      {copy.giftTelegramLinkText}
                    </a>

                    {/* Input del código */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-zinc-400">
                        {copy.giftCodeLabel}
                      </label>
                      <input
                        type="text"
                        value={giftCode}
                        onChange={(e) => setGiftCode(e.target.value)}
                        placeholder={copy.giftCodePlaceholder}
                        disabled={isClaimingGift}
                        className="w-full px-4 py-2.5 rounded-xl border bg-neutral-900/60 text-sm font-medium focus:outline-none focus:border-yellow-500/50 transition-all uppercase"
                        style={{
                          borderColor: "rgba(247,242,232,0.15)",
                          color: C.fg,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3.5">
                    <button
                      type="button"
                      disabled={isClaimingGift || !giftCode.trim()}
                      onClick={handleClaimGift}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-heading font-bold text-black transition-all bg-yellow-500 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shadow-lg shadow-yellow-500/10 cursor-pointer"
                    >
                      {isClaimingGift ? (
                        <><Loader2 size={16} className="animate-spin" /> {copy.giftModalActivating}</>
                      ) : (
                        copy.giftModalActivate
                      )}
                    </button>

                    <Button
                      variant="secondary"
                      disabled={isClaimingGift}
                      onClick={() => {
                        setIsGiftModalOpen(false);
                        setGiftError(null);
                        setGiftCode("");
                      }}
                      className="flex-1"
                    >
                      {copy.giftModalClose}
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL PARA CAMBIAR CORREO ELECTRÓNICO ───────────────────────────── */}
      <AnimatePresence>
        {isChangeEmailModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
            style={{ background: "rgba(0, 0, 0, 0.8)" }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-3xl p-7 text-left relative overflow-hidden"
              style={{
                background: "#131110",
                border: "1px solid rgba(255, 107, 0, 0.3)",
                boxShadow: "0 24px 50px rgba(0, 0, 0, 0.9)"
              }}
            >
              <div className="flex items-center gap-3 text-orange-500 mb-4">
                <Mail size={24} className="shrink-0" />
                <h3 className="text-xl font-bold" style={{ color: C.fg }}>
                  {copy.changeEmailTitle}
                </h3>
              </div>

              <form onSubmit={handleChangeEmail} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-2 text-zinc-400">
                    {copy.newEmailLabel}
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="ejemplo@email.com"
                    disabled={isEmailPending}
                    className="w-full px-4 py-2.5 rounded-xl border bg-neutral-900/60 text-sm font-medium focus:outline-none transition-all"
                    style={{
                      borderColor: "rgba(247,242,232,0.15)",
                      color: C.fg,
                    }}
                  />
                </div>

                {emailError && (
                  <div className="mb-2">
                    <StatusBanner error={emailError} />
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3.5 mt-2">
                  <Button
                    variant="primary"
                    type="submit"
                    loading={isEmailPending}
                    disabled={emailCooldown > 0}
                    loadingText={language === "es" ? "Enviando..." : language === "pt" ? "Enviando..." : "Sending..."}
                    className="flex-1"
                  >
                    {emailCooldown > 0
                      ? (language === "es" ? `Esperá ${emailCooldown}s` : language === "pt" ? `Aguarde ${emailCooldown}s` : `Wait ${emailCooldown}s`)
                      : copy.changeEmailConfirm}
                  </Button>

                  <Button
                    variant="secondary"
                    type="button"
                    disabled={isEmailPending}
                    onClick={() => {
                      setIsChangeEmailModalOpen(false);
                      setEmailError(null);
                      setNewEmail("");
                    }}
                    className="flex-1"
                  >
                    {copy.changeEmailCancel}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL PARA CAMBIAR CONTRASEÑA (ESTILO ICLOUD) ───────────────────────────── */}
      <AnimatePresence>
        {isChangePasswordModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
            style={{ background: "rgba(0, 0, 0, 0.8)" }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-3xl p-7 text-left relative overflow-hidden"
              style={{
                background: "#131110",
                border: "1px solid rgba(255, 107, 0, 0.3)",
                boxShadow: "0 24px 50px rgba(0, 0, 0, 0.9)"
              }}
            >
              <div className="flex items-center gap-3 text-orange-500 mb-4">
                <Lock size={24} className="shrink-0" />
                <h3 className="text-xl font-bold" style={{ color: C.fg }}>
                  {copy.changePassword}
                </h3>
              </div>

              <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                {/* Contraseña Actual */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-2 text-zinc-400">
                    {copy.currentPasswordLabel}
                  </label>
                  <div className="relative">
                    <input
                      type={showOldPwd ? "text" : "password"}
                      required
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={isPasswordPending}
                      className="w-full pl-4 pr-10 py-2.5 rounded-xl border bg-neutral-900/60 text-sm font-medium focus:outline-none transition-all"
                      style={{
                        borderColor: "rgba(247,242,232,0.15)",
                        color: C.fg,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPwd(!showOldPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showOldPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Nueva Contraseña */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-2 text-zinc-400">
                    {copy.newPasswordLabel}
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPwd ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      disabled={isPasswordPending}
                      className="w-full pl-4 pr-10 py-2.5 rounded-xl border bg-neutral-900/60 text-sm font-medium focus:outline-none transition-all"
                      style={{
                        borderColor: "rgba(247,242,232,0.15)",
                        color: C.fg,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd(!showNewPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirmar Nueva Contraseña */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-2 text-zinc-400">
                    {copy.confirmPasswordLabel}
                  </label>
                  <input
                    type={showNewPwd ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    disabled={isPasswordPending}
                    className="w-full px-4 py-2.5 rounded-xl border bg-neutral-900/60 text-sm font-medium focus:outline-none transition-all"
                    style={{
                      borderColor: "rgba(247,242,232,0.15)",
                      color: C.fg,
                    }}
                  />
                </div>

                {passwordError && (
                  <div className="mb-2">
                    <StatusBanner error={passwordError} />
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3.5 mt-2">
                  <Button
                    variant="primary"
                    type="submit"
                    loading={isPasswordPending}
                    className="flex-1"
                  >
                    {copy.changePasswordConfirm}
                  </Button>

                  <Button
                    variant="secondary"
                    type="button"
                    disabled={isPasswordPending}
                    onClick={() => {
                      setIsChangePasswordModalOpen(false);
                      setPasswordError(null);
                      setOldPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    className="flex-1"
                  >
                    {copy.deleteModalCancel}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL PARA CONFIRMAR ELIMINACIÓN DE LISTA ───────────────────────────── */}
      <AnimatePresence>
        {listToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
            style={{ background: "rgba(0, 0, 0, 0.8)" }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-3xl p-7 text-left relative overflow-hidden"
              style={{
                background: "#131110",
                border: "1px solid rgba(255, 107, 0, 0.3)",
                boxShadow: "0 24px 50px rgba(0, 0, 0, 0.9)"
              }}
            >
              <div className="flex items-center gap-3 text-orange-500 mb-4">
                <Trash2 size={28} className="shrink-0 animate-pulse" />
                <h3 className="text-xl font-bold" style={{ color: C.fg }}>
                  {copy.deleteListModalTitle}
                </h3>
              </div>

              <p className="text-sm leading-relaxed mb-6" style={{ color: C.muted }}>
                {copy.deleteListModalDesc.replace("{name}", listToDelete.name)}
              </p>

              <div className="flex flex-col sm:flex-row gap-3.5">
                <Button
                  variant="danger"
                  loading={isDeletingList}
                  disabled={isDeletingList}
                  onClick={handleConfirmDeleteList}
                  className="flex-1"
                >
                  {copy.deleteListConfirm}
                </Button>

                <Button
                  variant="secondary"
                  disabled={isDeletingList}
                  onClick={() => setListToDelete(null)}
                  className="flex-1"
                >
                  {copy.deleteListCancel}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL PARA CONFIRMAR CAMBIO DE NOMBRE DE USUARIO ───────────────────────────── */}
      <AnimatePresence>
        {showUsernameConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
            style={{ background: "rgba(0, 0, 0, 0.8)" }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-3xl p-7 text-left relative overflow-hidden"
              style={{
                background: "#131110",
                border: "1px solid rgba(255, 107, 0, 0.3)",
                boxShadow: "0 24px 50px rgba(0, 0, 0, 0.9)"
              }}
            >
              <div className="flex items-center gap-3 text-orange-500 mb-4">
                <User size={28} className="shrink-0 animate-pulse" />
                <h3 className="text-xl font-bold" style={{ color: C.fg }}>
                  {copy.confirmUsernameTitle}
                </h3>
              </div>

              <p className="text-sm leading-relaxed mb-6" style={{ color: C.muted }}>
                {copy.confirmUsernameDesc.replace("{username}", username)}
              </p>

              <div className="flex flex-col sm:flex-row gap-3.5">
                <Button
                  variant="primary"
                  loading={isUsernamePending}
                  disabled={isUsernamePending}
                  onClick={handleConfirmUsernameSubmit}
                  className="flex-1"
                >
                  {copy.confirmUsernameBtn}
                </Button>

                <Button
                  variant="secondary"
                  disabled={isUsernamePending}
                  onClick={() => setShowUsernameConfirm(false)}
                  className="flex-1"
                >
                  {copy.confirmUsernameCancel}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
