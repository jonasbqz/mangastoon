"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Download, Eye, EyeOff, FileText, List, ImageOff, RefreshCw, BookOpen, Scroll, Palette, Sparkles, Lock, Crown, AlertCircle } from "lucide-react";
import MangaAdBanner from "./components/MangaAdBanner";
import { SupportedLanguage, useLanguage } from "../../../../components/language-provider";
import { useHistoryStore } from "../../../../store/useHistoryStore";
import { useReaderSettingsStore, type ReadingMode, type PageSize } from "../../../../store/useReaderSettingsStore";
import { generateMangaPDF } from "../../../../utils/pdfGenerator";
import { buildComicPath, extractComicIdFromSlugId } from "../../../../utils/slugify";
import { createClient } from "../../../../../utils/supabase/client";
import { upgradeToPremiumAction } from "../../../../actions/profile";
import PremiumBenefitsCard from "../../../../components/PremiumBenefitsCard";
import AuthModal from "../../../../components/AuthModal";
import SuggestSignUpModal from "../../../../components/SuggestSignUpModal";
import CommentsSection from "../../../../components/CommentsSection";
import { getOptimizedImageUrl } from "../../../../utils/image";

// Import newly modularized atomic components
import HorizontalReader from "./components/HorizontalReader";
import MangaPageImage from "./components/MangaPageImage";
import ReaderHeader from "./components/ReaderHeader";
import ReaderSettingsPanel from "./components/ReaderSettingsPanel";

type ScrollSpeed = 1 | 2 | 3 | 4 | 5;
export type ReaderTheme = "dark" | "amoled" | "sepia" | "light" | "gray";

const READER_THEME_KEY = "mangastoon_reader_theme";

const THEME_CLASSES: Record<ReaderTheme, { bg: string; text: string; headerBg: string; border: string; card: string; sidepanelBg: string }> = {
  dark: {
    bg: "bg-[#0a0a0c]",
    text: "text-white",
    headerBg: "bg-[#0a0a0c]/85",
    sidepanelBg: "bg-[#111215]/60",
    border: "border-white/5",
    card: "bg-gradient-to-b from-[#12131a] to-[#0a0a0c]"
  },
  amoled: {
    bg: "bg-black",
    text: "text-neutral-100",
    headerBg: "bg-black/85",
    sidepanelBg: "bg-neutral-900/60",
    border: "border-neutral-800",
    card: "bg-neutral-950"
  },
  sepia: {
    bg: "bg-[#f4ecd8]",
    text: "text-[#5b4636]",
    headerBg: "bg-[#f4ecd8]/90",
    sidepanelBg: "bg-[#ebdcb9]/80",
    border: "border-[#e4dcc8]",
    card: "bg-[#ebdcb9]/50"
  },
  light: {
    bg: "bg-white",
    text: "text-neutral-800",
    headerBg: "bg-white/90",
    sidepanelBg: "bg-neutral-100/80",
    border: "border-neutral-200",
    card: "bg-neutral-50"
  },
  gray: {
    bg: "bg-[#1a1b20]",
    text: "text-gray-200",
    headerBg: "bg-[#1a1b20]/85",
    sidepanelBg: "bg-[#22232a]/60",
    border: "border-white/5",
    card: "bg-[#22232a]"
  }
};

const PAGE_SIZE_CLASSES: Record<PageSize, string> = {
  small: "w-full max-w-[80%] md:max-w-xl",
  medium: "w-full max-w-[90%] md:max-w-3xl",
  large: "w-full max-w-[96%] md:max-w-5xl",
  full: "w-full max-w-full",
};

const MAX_IMAGE_RETRIES = 3;

function withImageRetryParam(src: string, retry: number) {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return src;

  const retryValue = `${retry}_${Date.now()}`;

  try {
    const url = new URL(src, window.location.origin);
    url.searchParams.set("retry", retryValue);
    return src.startsWith("/") ? `${url.pathname}${url.search}${url.hash}` : url.toString();
  } catch {
    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}retry=${retryValue}`;
  }
}

export type ReaderDictionary = {
  reader: string;
  backHome: string;
  chapterUnavailable: string;
  chapterUnavailableBody: string;
  chapterAvailableInEnglish: string;
  readInEnglish: string;
  loadingChapter: string;
  previousChapter: string;
  nextChapter: string;
  chapterList: string;
  noPages: string;
  downloadPdf: string;
  generatingPdf: string;
  pdfModalTitle: string;
  pdfModalBody: string;
  currentDownload: string;
  startChapter: string;
  endChapter: string;
  downloadRange: string;
  maxChaptersNotice: string;
  pdfLimitExceeded: string;
  pdfNoImages: string;
  pdfFailed: string;
  cancel: string;
  download: string;
  play: string;
  pause: string;
  page: string;
  chapter: string;
  scrollTop: string;
  fullscreen: string;
  controls: string;
  hideControls: string;
  nextChapterCta: string;
  backToSeries: string;
  endReachedTitle: string;
  endReachedBody: string;
  suggestedTitle: string;
  exploreMore: string;
  scrollSpeedTooltip: string;
  modeVertical: string;
  modeHorizontal: string;
  pageIndicator: (current: number, total: number) => string;
  tapHint: string;
  previousPage: string;
  nextPage: string;
};

export type ChapterFeedItem = {
  id: string;
  attributes?: {
    chapter?: string | null;
    title?: string | null;
    translatedLanguage?: string | null;
  };
};

type ReaderApiResponse = {
  mangaTitle?: string;
  coverImage?: string;
  chapters?: ChapterFeedItem[];
  currentChapter?: ChapterFeedItem | null;
  pages?: string[];
  englishFallbackChapter?: ChapterFeedItem | null;
  fallbackReason?: "english" | "unavailable" | null;
  error?: string;
  code?: string;
};

type SuggestedComic = {
  slug: string;
  title: string;
  coverImage: string;
};

const UI_COPY: Record<SupportedLanguage, ReaderDictionary> = {
  es: {
    reader: "Lector Mangastoon",
    backHome: "Volver",
    chapterUnavailable: "Capítulo no disponible en este idioma",
    chapterUnavailableBody: "No encontramos un capítulo legible para este idioma.",
    chapterAvailableInEnglish: "Este capítulo no está disponible en español, pero sí existe en inglés.",
    readInEnglish: "Ver en inglés",
    loadingChapter: "Cargando capítulo...",
    previousChapter: "Anterior",
    nextChapter: "Siguiente",
    chapterList: "Lista de Capítulos",
    noPages: "No pudimos cargar las páginas de este capítulo.",
    downloadPdf: "Descargar PDF",
    generatingPdf: "Generando...",
    pdfModalTitle: "Descargar PDF",
    pdfModalBody: "Elige el rango exacto de capítulos que quieres incluir.",
    currentDownload: "Descarga actual",
    startChapter: "Desde",
    endChapter: "Hasta",
    downloadRange: "Rango incluido",
    maxChaptersNotice: "Máximo 50 capítulos por PDF para evitar bloqueos.",
    pdfLimitExceeded: "No se puede descargar más de 50 capítulos por PDF.",
    pdfNoImages: "No encontramos páginas válidas para generar este PDF.",
    pdfFailed: "No se pudo generar el PDF. Intentá de nuevo.",
    cancel: "Cancelar",
    download: "Descargar",
    play: "Lectura automática",
    pause: "Pausar desplazamiento",
    page: "Página",
    chapter: "Capítulo",
    scrollTop: "Subir al inicio",
    fullscreen: "Pantalla completa",
    controls: "Mostrar controles",
    hideControls: "Ocultar controles",
    nextChapterCta: "Siguiente Capítulo",
    backToSeries: "Volver",
    endReachedTitle: "Llegaste al último capítulo disponible",
    endReachedBody: "Por ahora no hay más episodios publicados. Te dejamos lecturas de MangaStoon para que sigas con el ritmo.",
    suggestedTitle: "Seguir leyendo en MangaStoon",
    exploreMore: "Explorar más mangas",
    scrollSpeedTooltip: "Velocidad de desplazamiento",
    modeVertical: "Modo Vertical (Manhwas)",
    modeHorizontal: "Modo Horizontal (Página)",
    pageIndicator: (current, total) => `${current} / ${total}`,
    tapHint: "Toca los lados para navegar",
    previousPage: "Página anterior",
    nextPage: "Página siguiente",
  },
  en: {
    reader: "Mangastoon Reader",
    backHome: "Back to home",
    chapterUnavailable: "Chapter unavailable in this language",
    chapterUnavailableBody: "We could not find a readable chapter for this language.",
    chapterAvailableInEnglish: "This chapter is available in English.",
    readInEnglish: "Read in English",
    loadingChapter: "Loading chapter...",
    previousChapter: "Previous",
    nextChapter: "Next",
    chapterList: "Chapter List",
    noPages: "We could not load the pages for this chapter.",
    downloadPdf: "Download PDF",
    generatingPdf: "Generating...",
    pdfModalTitle: "Download PDF",
    pdfModalBody: "Choose the exact chapter range to include.",
    currentDownload: "Current download",
    startChapter: "From",
    endChapter: "To",
    downloadRange: "Included range",
    maxChaptersNotice: "Maximum 50 chapters per PDF to avoid freezing.",
    pdfLimitExceeded: "You cannot download more than 50 chapters per PDF.",
    pdfNoImages: "We could not find valid pages to generate this PDF.",
    pdfFailed: "The PDF could not be generated. Please try again.",
    cancel: "Cancel",
    download: "Download",
    play: "Auto-scroll",
    pause: "Pause scroll",
    page: "Page",
    chapter: "Chapter",
    scrollTop: "Scroll to top",
    fullscreen: "Fullscreen",
    controls: "Show controls",
    hideControls: "Hide controls",
    nextChapterCta: "Next Chapter",
    backToSeries: "Back to series",
    endReachedTitle: "You reached the latest available chapter",
    endReachedBody: "There are no more published episodes yet. Here are MangaStoon picks so you can keep reading.",
    suggestedTitle: "Keep reading on MangaStoon",
    exploreMore: "Explore more manga",
    scrollSpeedTooltip: "Scroll speed",
    modeVertical: "Vertical Mode (Manhwas)",
    modeHorizontal: "Horizontal Mode (Page)",
    pageIndicator: (current, total) => `${current} / ${total}`,
    tapHint: "Tap sides to navigate",
    previousPage: "Previous page",
    nextPage: "Next page",
  },
  pt: {
    reader: "Leitor Mangastoon",
    backHome: "Voltar ao inicio",
    chapterUnavailable: "Capitulo indisponivel neste idioma",
    chapterUnavailableBody: "Nao encontramos um capitulo legivel para este idioma.",
    chapterAvailableInEnglish: "Este capitulo nao esta disponivel neste idioma, mas existe em ingles.",
    readInEnglish: "Ler em ingles",
    loadingChapter: "Carregando capitulo...",
    previousChapter: "Anterior",
    nextChapter: "Proximo",
    chapterList: "Lista de Capitulos",
    noPages: "Nao foi possivel carregar as paginas deste capitulo.",
    downloadPdf: "Baixar PDF",
    generatingPdf: "Gerando...",
    pdfModalTitle: "Baixar PDF",
    pdfModalBody: "Escolha o intervalo exato de capitulos para incluir.",
    currentDownload: "Download atual",
    startChapter: "De",
    endChapter: "Ate",
    downloadRange: "Intervalo incluido",
    maxChaptersNotice: "Maximo de 50 capitulos por PDF para evitar travamentos.",
    pdfLimitExceeded: "Nao e possivel baixar mais de 50 capitulos por PDF.",
    pdfNoImages: "Nao encontramos paginas validas para gerar este PDF.",
    pdfFailed: "Nao foi possivel gerar o PDF. Tente novamente.",
    cancel: "Cancelar",
    download: "Baixar",
    play: "Rolagem automática",
    pause: "Pausar rolagem",
    page: "Pagina",
    chapter: "Capitulo",
    scrollTop: "Subir ao topo",
    fullscreen: "Tela cheia",
    controls: "Mostrar controles",
    hideControls: "Ocultar controles",
    nextChapterCta: "Próximo Capítulo",
    backToSeries: "Voltar para a série",
    endReachedTitle: "Você chegou ao último capítulo disponible",
    endReachedBody: "Por enquanto não há mais episódios publicados. Deixamos recomendações da MangaStoon para você continuar lendo.",
    suggestedTitle: "Continuar lendo na MangaStoon",
    exploreMore: "Explorar mais mangas",
    scrollSpeedTooltip: "Velocidade de rolagem",
    modeVertical: "Modo Vertical (Manhwas)",
    modeHorizontal: "Modo Horizontal (Página)",
    pageIndicator: (current, total) => `${current} / ${total}`,
    tapHint: "Toque nos lados para navegar",
    previousPage: "Página anterior",
    nextPage: "Próxima página",
  },
};

const MAX_PDF_CHAPTERS = 50;
const READING_PROGRESS_KEY = "mangastoon_reading_progress";
const SIDEBAR_VISIBILITY_KEY = "mangastoon_sidebar_is_hidden";
const READER_REQUEST_TIMEOUT_MS = 20000;

function normalizeReaderLanguage(value: string | null, fallback: SupportedLanguage) {
  if (value === "en" || value === "pt" || value === "es") {
    return value;
  }
  return fallback;
}

function getStringValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function normalizeSuggestedCover(value: string) {
  if (!value) return "";
  const imageUrl = value.startsWith("//") ? `https:${value}` : value;
  return getOptimizedImageUrl(imageUrl);
}

function extractSuggestedComics(payload: unknown): SuggestedComic[] {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const data = record.data;
  const nested = data && !Array.isArray(data) && typeof data === "object" ? data as Record<string, unknown> : {};
  const comics = Array.isArray(data)
    ? data
    : Array.isArray(nested.comics)
      ? nested.comics
      : Array.isArray(nested.items)
        ? nested.items
        : Array.isArray(nested.results)
          ? nested.results
          : Array.isArray(record.comics)
            ? record.comics
            : Array.isArray(record.items)
              ? record.items
              : Array.isArray(record.results)
                ? record.results
                : [];

  return comics.flatMap((comic): SuggestedComic[] => {
    if (!comic || typeof comic !== "object") return [];
    const source = comic as Record<string, unknown>;
    const slug = getStringValue(source, ["slug", "manga_slug", "comic_slug", "id"]);
    const title = getStringValue(source, ["title", "name", "comic_title", "original_title"]);
    const coverImage = normalizeSuggestedCover(
      getStringValue(source, ["coverImage", "cover_image", "cover", "thumbnail", "image", "poster", "url_cover"])
    );

    return slug && title ? [{ slug, title, coverImage }] : [];
  });
}

async function fetchChapterPages(
  chapterId: string,
  context?: { mangaTitle?: string; chapter?: ChapterFeedItem | null }
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), READER_REQUEST_TIMEOUT_MS);

  try {
    const search = new URLSearchParams();
    if (context?.mangaTitle) search.set("mangaTitle", context.mangaTitle);
    if (context?.chapter?.attributes?.title) search.set("chapterTitle", context.chapter.attributes.title);
    if (context?.chapter?.attributes?.chapter) search.set("chapterNumber", context.chapter.attributes.chapter);
    const query = search.toString();
    const response = await fetch(`/api/read/chapter/${chapterId}${query ? `?${query}` : ""}`, { signal: controller.signal, cache: "no-store" });

    if (!response.ok) {
      throw new Error("Failed to fetch chapter pages.");
    }

    const payload = (await response.json()) as { pages?: string[] };
    return payload.pages ?? [];
  } finally {
    window.clearTimeout(timeout);
  }
}

function getChapterLabel(chapter: ChapterFeedItem | null, dictionary: ReaderDictionary) {
  if (!chapter) return `${dictionary.chapter} 1`;
  return chapter.attributes?.chapter
    ? `${dictionary.chapter} ${chapter.attributes.chapter}`
    : `${dictionary.chapter} 1`;
}

function getChapterNumber(chapter: ChapterFeedItem | null) {
  return chapter?.attributes?.chapter ?? "1";
}

function getChapterNavigationKey(chapter: ChapterFeedItem | null) {
  return chapter?.attributes?.chapter?.trim() || chapter?.id || "";
}

function normalizeChapterNumber(chapter: ChapterFeedItem | null) {
  return chapter?.attributes?.chapter?.trim() ?? "";
}

function parseChapterNumber(chapter: ChapterFeedItem | null) {
  const value = Number(normalizeChapterNumber(chapter));
  return Number.isFinite(value) ? value : null;
}

function dedupeChaptersByNumber(chapters: ChapterFeedItem[]) {
  const seen = new Set<string>();
  const uniqueChapters: ChapterFeedItem[] = [];

  for (const chapter of chapters) {
    const key = getChapterNavigationKey(chapter);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueChapters.push(chapter);
  }

  return uniqueChapters;
}

function findChapterIndexByIdOrNumber(
  chapters: ChapterFeedItem[],
  chapterId: string | null | undefined,
  fallbackChapter: ChapterFeedItem | null
) {
  const fallbackNumber = normalizeChapterNumber(fallbackChapter);
  const shouldPreferNumber = !chapterId || chapterId === fallbackChapter?.id;

  if (fallbackNumber && shouldPreferNumber) {
    const byNumber = chapters.findIndex((chapter) => normalizeChapterNumber(chapter) === fallbackNumber);

    if (byNumber >= 0) {
      return byNumber;
    }
  }

  const byId = chapterId ? chapters.findIndex((chapter) => chapter.id === chapterId) : -1;

  if (byId >= 0) {
    return byId;
  }

  return fallbackNumber
    ? chapters.findIndex((chapter) => normalizeChapterNumber(chapter) === fallbackNumber)
    : -1;
}

function findChapterByNumberDelta(
  chapters: ChapterFeedItem[],
  currentChapter: ChapterFeedItem | null,
  delta: -1 | 1
) {
  const currentNumber = parseChapterNumber(currentChapter);

  if (currentNumber === null) {
    return null;
  }

  const targetNumber = String(currentNumber + delta);
  return chapters.find((chapter) => normalizeChapterNumber(chapter) === targetNumber) ?? null;
}

function buildReaderUrl(comicSlug: string, chapterId?: string, lang?: SupportedLanguage) {
  const search = new URLSearchParams();

  if (lang) {
    search.set("lang", lang);
  }

  const query = search.toString();
  return chapterId
    ? `/comics/${comicSlug}/chapters/${chapterId}${query ? `?${query}` : ""}`
    : `/comics/${comicSlug}${query ? `?${query}` : ""}`;
}



function ChapterNavButton({
  disabled,
  onClick,
  children,
  variant = "secondary",
  hiddenWhenDisabled = false,
}: {
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  hiddenWhenDisabled?: boolean;
}) {
  const className =
    variant === "primary"
      ? "h-11 w-11 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-lg transition-all hover:from-amber-400 hover:to-yellow-400 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
      : "h-11 w-11 rounded-xl border border-white/10 bg-[#141519]/75 text-gray-300 hover:border-amber-500/30 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-40 shadow-sm";
  const hiddenClass = disabled && hiddenWhenDisabled ? "hidden" : "";

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      className={`flex items-center justify-center ${className} ${hiddenClass}`}
      aria-hidden={disabled && hiddenWhenDisabled ? true : undefined}
    >
      {children}
    </motion.button>
  );
}

function ChapterNavigation({
  dictionary,
  previousChapter,
  nextChapter,
  onPrevious,
  onNext,
  onList,
}: {
  dictionary: ReaderDictionary;
  previousChapter: ChapterFeedItem | null;
  nextChapter: ChapterFeedItem | null;
  onPrevious: () => void;
  onNext: () => void;
  onList: () => void;
}) {
  return (
    <div className="my-4 flex flex-wrap items-center justify-center gap-3 md:my-5 md:gap-4">
      <ChapterNavButton disabled={!previousChapter} hiddenWhenDisabled onClick={onPrevious}>
        <ArrowLeft aria-hidden="true" size={20} strokeWidth={2.2} />
        <span className="sr-only">{dictionary.previousChapter}</span>
      </ChapterNavButton>

      <ChapterNavButton onClick={onList}>
        <List aria-hidden="true" size={20} strokeWidth={2.2} />
        <span className="sr-only">{dictionary.chapterList}</span>
      </ChapterNavButton>

      <ChapterNavButton disabled={!nextChapter} hiddenWhenDisabled onClick={onNext} variant="primary">
        <ArrowRight aria-hidden="true" size={20} strokeWidth={2.2} />
        <span className="sr-only">{dictionary.nextChapter}</span>
      </ChapterNavButton>
    </div>
  );
}


function RetryableSuggestedImage({ src, alt }: { src: string; alt: string }) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setCurrentSrc(src);
    setRetryCount(0);
  }, [src]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      className="h-full w-full object-cover transition-transform group-hover:scale-105"
      loading="lazy"
      onError={() => {
        if (retryCount >= MAX_IMAGE_RETRIES) return;
        const nextRetry = retryCount + 1;
        setRetryCount(nextRetry);
        setCurrentSrc(withImageRetryParam(src, nextRetry));
      }}
    />
  );
}

const REG_BANNER_COPY = {
  es: {
    title: "¡Te está gustando la lectura! 📖",
    body: "Regístrate gratis en MangaStoon para guardar tu historial, marcar tus favoritos y crear listas personalizadas.",
    cta: "Crear Cuenta Gratis",
    dismiss: "Cerrar"
  },
  en: {
    title: "Enjoying the read? 📖",
    body: "Sign up free on MangaStoon to save your progress, bookmark favorites, and create custom manga lists.",
    cta: "Create Free Account",
    dismiss: "Dismiss"
  },
  pt: {
    title: "Está gostando da leitura? 📖",
    body: "Cadastre-se grátis no MangaStoon para salvar seu progresso, favoritar mangás e criar listas personalizadas.",
    cta: "Criar Conta Grátis",
    dismiss: "Fechar"
  }
};

type ReaderClientProps = {
  initialData?: ReaderApiResponse | null;
  initialMangaId?: string;
  initialChapterParam?: string | null;
  initialReaderLanguage?: SupportedLanguage;
  initialProfile?: {
    id: string;
    username: string | null;
    avatar_url: string | null;
    is_premium: boolean;
    telegram_grace_started: string | null;
    premium_until: string | null;
  } | null;
};

export default function ReaderClient({
  initialData = null,
  initialMangaId,
  initialChapterParam,
  initialReaderLanguage,
  initialProfile = null,
}: ReaderClientProps) {
  const params = useParams<{ slug: string; id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const routeSlug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const routeChapterId = Array.isArray(params.id) ? params.id[0] : params.id;
  const mangaId = initialMangaId ?? extractComicIdFromSlugId(routeSlug);
  const slugFallbackTitle = routeSlug
    ?.replace(/-\d{8}-[a-zA-Z0-9]+$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase())
    .trim() || "";
  const currentChapterParam = initialChapterParam ?? searchParams.get("chapter") ?? routeChapterId;
  const readerLanguage = initialReaderLanguage ?? normalizeReaderLanguage(searchParams.get("lang"), language);



  const dictionary = UI_COPY[readerLanguage];
  const addHistory = useHistoryStore((state) => state.addHistory);
  const readingMode = useReaderSettingsStore((state) => state.readingMode);
  const setReadingMode = useReaderSettingsStore((state) => state.setReadingMode);
  const pageSize = useReaderSettingsStore((state) => state.pageSize);
  const setPageSize = useReaderSettingsStore((state) => state.setPageSize);

  const initialSelectedChapter = initialData?.currentChapter ?? null;
  const initialPages = (initialData?.pages ?? []).map(getOptimizedImageUrl);
  const [mangaTitle, setMangaTitle] = useState(initialData?.mangaTitle || slugFallbackTitle || "");
  const [coverImage, setCoverImage] = useState(initialData?.coverImage ?? "");
  const [chapters, setChapters] = useState<ChapterFeedItem[]>(initialData?.chapters ?? []);
  const [currentChapter, setCurrentChapter] = useState<ChapterFeedItem | null>(initialSelectedChapter);
  const [pages, setPages] = useState<string[]>(initialPages);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(
    initialData?.error ??
    (initialData?.fallbackReason === "english"
      ? dictionary.chapterAvailableInEnglish
      : initialData?.fallbackReason
        ? dictionary.chapterUnavailableBody
        : !initialSelectedChapter && initialData
          ? dictionary.chapterUnavailableBody
          : initialSelectedChapter && initialPages.length === 0 && initialData
            ? dictionary.noPages
            : "")
  );
  const [englishFallbackChapter, setEnglishFallbackChapter] = useState<ChapterFeedItem | null>(initialData?.englishFallbackChapter ?? null);
  const [downloading, setDownloading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfMode, setPdfMode] = useState<"single" | "range">("single");
  const [pdfStartChapterId, setPdfStartChapterId] = useState("");
  const [pdfEndChapterId, setPdfEndChapterId] = useState("");
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState<ScrollSpeed>(1);
  const [isReaderUiVisible, setIsReaderUiVisible] = useState(true);
  const [suggestedComics, setSuggestedComics] = useState<SuggestedComic[]>([]);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("up");
  const [isAtTop, setIsAtTop] = useState(true);

  // Inicializar estado premium directamente desde el prop del servidor (sin fetch client-side)
  const [isPremium, setIsPremium] = useState(!!initialProfile?.is_premium);
  const [telegramGraceStarted, setTelegramGraceStarted] = useState<string | null>(initialProfile?.telegram_grace_started ?? null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>("dark");
  const [hasScrolledPastHalf, setHasScrolledPastHalf] = useState(false);
  const [pageRetryVersions, setPageRetryVersions] = useState<number[]>([]);

  useEffect(() => {
    setPageRetryVersions(new Array(pages.length).fill(0));
  }, [pages]);

  const handleRetrySubsequent = useCallback((startIndex: number) => {
    setPageRetryVersions((prev) => {
      const next = [...prev];
      for (let i = startIndex; i < next.length; i++) {
        next[i] = (next[i] || 0) + 1;
      }
      return next;
    });
  }, []);
  const [showNextChapterBanner, setShowNextChapterBanner] = useState(false);
  const maxPdfChapters = isPremium ? 50 : 10;

  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [currentProfile, setCurrentProfile] = useState<any | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"signin" | "signup">("signin");
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [pendingChapterNavId, setPendingChapterNavId] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [dismissedRegBanner, setDismissedRegBanner] = useState(false);
  const nextChapterRef = useRef<any>(null);

  // Protect readingMode: only allow "horizontal" if the user is confirmed premium.
  // While auth is still loading, default to "vertical" to prevent flash of horizontal mode.
  const activeReadingMode = (authLoaded && isPremium) ? readingMode : "vertical";

  useEffect(() => {
    const handleOpenAuthModal = (e: Event) => {
      const customEvent = e as CustomEvent;
      const tab = customEvent.detail?.tab || "signin";
      setAuthModalTab(tab);
      setIsAuthModalOpen(true);
    };
    window.addEventListener("open-auth-modal", handleOpenAuthModal);
    return () => {
      window.removeEventListener("open-auth-modal", handleOpenAuthModal);
    };
  }, []);

  const handleDismissRegBanner = () => {
    setDismissedRegBanner(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("mangastoon:dismiss-reg-banner", "true");
    }
  };

  useEffect(() => {
    async function loadPremiumAndTheme() {
      try {
        const storedTheme = localStorage.getItem(READER_THEME_KEY) as ReaderTheme;

        // Default to "dark" (free/classic) theme initially to prevent flash of premium theme
        setReaderTheme("dark");

        const dismissed = sessionStorage.getItem("mangastoon:dismiss-reg-banner") === "true";
        if (dismissed) {
          setDismissedRegBanner(true);
        }

        // Si ya tenemos el perfil desde el servidor, no necesitamos un fetch extra
        if (initialProfile !== null) {
          const isUserPremium = !!initialProfile?.is_premium;
          setCurrentUser({ id: initialProfile?.id });
          setCurrentProfile(initialProfile);
          if (storedTheme && isUserPremium) {
            setReaderTheme(storedTheme);
          } else {
            setReaderTheme("dark");
            if (storedTheme && storedTheme !== "dark") {
              localStorage.setItem(READER_THEME_KEY, "dark");
            }
          }
          setAuthLoaded(true);
          return;
        }

        // Fallback: fetch client-side si no llegó el prop del servidor (ej. navegación SPA)
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // Guests can only use "dark" theme
          if (storedTheme && storedTheme !== "dark") {
            localStorage.setItem(READER_THEME_KEY, "dark");
          }
          setAuthLoaded(true);
          return;
        }
        setCurrentUser(user);

        const { data } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, is_premium, telegram_grace_started, premium_until")
          .eq("id", user.id)
          .maybeSingle();

        let isUserPremium = false;
        if (data) {
          setCurrentProfile(data);
          if (data.is_premium) {
            setIsPremium(true);
            isUserPremium = true;
          }
          if (data.telegram_grace_started) {
            setTelegramGraceStarted(data.telegram_grace_started);
          }
        }

        if (isUserPremium && storedTheme) {
          // Premium users get their stored theme applied
          setReaderTheme(storedTheme);
        } else {
          // Non-premium users are forced to "dark" theme
          setReaderTheme("dark");
          if (storedTheme && storedTheme !== "dark") {
            localStorage.setItem(READER_THEME_KEY, "dark");
          }
        }
      } catch (err) {
        console.warn("[ReaderClient] Error loading premium/theme:", err);
        setReaderTheme("dark");
      } finally {
        setAuthLoaded(true);
      }
    }
    loadPremiumAndTheme();
  }, []);

  useEffect(() => {
    if (authLoaded && !isPremium && readingMode === "horizontal") {
      setReadingMode("vertical");
      const title = readerLanguage === "en"
        ? "Horizontal reading mode is exclusive for Premium users."
        : readerLanguage === "pt"
        ? "O modo de leitura horizontal é exclusivo para usuários Premium."
        : "El modo horizontal es exclusivo para usuarios Premium.";
      const desc = readerLanguage === "en"
        ? "Reading mode has been reset to vertical scroll view."
        : readerLanguage === "pt"
        ? "O modo de leitura foi redefinido para a visualização vertical em cascata."
        : "Se ha restablecido la lectura al modo vertical (cascada).";
      toast.info(title, {
        description: desc
      });
    }
  }, [authLoaded, isPremium, readingMode, setReadingMode, readerLanguage]);

  useEffect(() => {
    let lastScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    let ticking = false;

    const updateScroll = () => {
      const currentScrollY = window.scrollY;
      setIsAtTop(currentScrollY < 120);

      if (Math.abs(currentScrollY - lastScrollY) > 8) {
        const direction = currentScrollY > lastScrollY ? "down" : "up";
        setScrollDirection(direction);
      }
      lastScrollY = currentScrollY;
      ticking = false;

      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const totalScrollable = scrollHeight - clientHeight;
      if (totalScrollable > 0) {
        const scrolledPercentage = (currentScrollY / totalScrollable) * 100;
        
        // Only set state if the boolean boundary crosses 50%
        const pastHalf = scrolledPercentage > 50;
        setHasScrolledPastHalf((prev) => (prev !== pastHalf ? pastHalf : prev));

        // Only set state if the boolean boundary crosses the >= 98% range
        // and the user has scrolled past half and at least 1000px to avoid initial load trigger shifts
        const showNext = scrolledPercentage >= 98 && pastHalf && currentScrollY > 1000 && !!nextChapterRef.current;
        setShowNextChapterBanner((prev) => (prev !== showNext ? showNext : prev));
      }
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScroll);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Track and save vertical reading progress
  useEffect(() => {
    if (activeReadingMode !== "vertical" || pages.length === 0 || !currentChapter?.id) return;

    let scrollTimeout: number;

    const handleVerticalScroll = () => {
      window.clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(() => {
        const pageElements = document.querySelectorAll("[data-page-index]");
        let currentVisibleIndex = 0;
        let minDistance = Infinity;

        pageElements.forEach((el) => {
          const rect = el.getBoundingClientRect();
          const distance = Math.abs(rect.top);
          if (distance < minDistance) {
            minDistance = distance;
            currentVisibleIndex = parseInt(el.getAttribute("data-page-index") || "0", 10);
          }
        });

        try {
          localStorage.setItem(
            `mangastoon_last_page:${mangaId}:${currentChapter.id}`,
            String(currentVisibleIndex)
          );
        } catch {}
      }, 150);
    };

    window.addEventListener("scroll", handleVerticalScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleVerticalScroll);
      window.clearTimeout(scrollTimeout);
    };
  }, [activeReadingMode, pages, mangaId, currentChapter?.id]);

  // Restore vertical scroll progress when pages or chapter changes
  useEffect(() => {
    if (activeReadingMode !== "vertical" || pages.length === 0 || !currentChapter?.id || loading) return;

    const restoreVerticalScroll = () => {
      try {
        const saved = localStorage.getItem(`mangastoon_last_page:${mangaId}:${currentChapter.id}`);
        if (saved) {
          const pageIndex = parseInt(saved, 10);
          if (Number.isFinite(pageIndex) && pageIndex > 0 && pageIndex < pages.length) {
            setTimeout(() => {
              const el = document.querySelector(`[data-page-index="${pageIndex}"]`);
              if (el) {
                el.scrollIntoView({ behavior: "instant", block: "start" });
              }
            }, 120);
          }
        }
      } catch {}
    };

    restoreVerticalScroll();
  }, [activeReadingMode, pages, mangaId, currentChapter?.id, loading]);

  const showControlsUI = activeReadingMode === "horizontal" ? true : (isAtTop || scrollDirection === "up");

  const autoScrollIntervalRef = useRef<number | null>(null);
  const initialRequestKeyRef = useRef(
    initialData ? `${mangaId}:${readerLanguage}:${currentChapterParam ?? ""}` : null
  );

  // Sistema de anuncios desactivado temporalmente para mejorar retención en el lector.

  useEffect(() => {
    try {
      setIsReaderUiVisible(localStorage.getItem(SIDEBAR_VISIBILITY_KEY) !== "true");
    } catch {
      // Sidebar visibility is a preference; keep the default if storage is unavailable.
    }
  }, []);

  function setReaderUiVisibility(isVisible: boolean) {
    setIsReaderUiVisible(isVisible);

    try {
      localStorage.setItem(SIDEBAR_VISIBILITY_KEY, String(!isVisible));
    } catch {
      // Never block reading if storage is unavailable.
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSuggestions() {
      try {
        const response = await fetch("/api/monline/api/comics?limit=5&order=updated_at&sort=desc", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const items = extractSuggestedComics(await response.json())
          .filter((comic) => comic.slug !== mangaId)
          .slice(0, 5);

        if (!cancelled) {
          setSuggestedComics(items);
        }
      } catch {
        if (!cancelled) {
          setSuggestedComics([]);
        }
      }
    }

    loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [mangaId]);

  useEffect(() => {
    if (currentChapter?.id) {
      setPdfStartChapterId(currentChapter.id);
      setPdfEndChapterId(currentChapter.id);
    }
  }, [currentChapter?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadReader() {
      const requestKey = `${mangaId}:${readerLanguage}:${currentChapterParam ?? ""}`;
      if (initialRequestKeyRef.current === requestKey) {
        initialRequestKeyRef.current = null;
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setEnglishFallbackChapter(null);

      try {
        const requestParams = new URLSearchParams();
        requestParams.set("lang", readerLanguage);

        if (currentChapterParam) {
          requestParams.set("chapter", currentChapterParam);
        }

        if (chapters.length > 0) {
          requestParams.set("excludeChapters", "true");
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), READER_REQUEST_TIMEOUT_MS);
        const response = await fetch(`/api/read/${mangaId}?${requestParams.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        window.clearTimeout(timeout);

        if (cancelled) return;

        const payload = (await response.json()) as ReaderApiResponse;

        if (!response.ok || payload.error) {
          setPages([]);
          setError(
            payload.code === "RATE_LIMIT"
              ? payload.error ?? "Servidor ocupado, reintentando..."
              : payload.error ?? dictionary.chapterUnavailableBody
          );
          return;
        }

        const feed = payload.chapters ?? [];
        const selectedChapter = payload.currentChapter ?? null;
        const chapterPages = payload.pages ?? [];

        setMangaTitle(payload.mangaTitle || slugFallbackTitle || "");
        setCoverImage(payload.coverImage ?? "");
        
        if (feed && feed.length > 0) {
          setChapters(feed);
        }
        
        setCurrentChapter(selectedChapter);
        setEnglishFallbackChapter(payload.englishFallbackChapter ?? null);

        if (payload.fallbackReason) {
          setPages([]);
          setError(
            payload.fallbackReason === "english"
              ? dictionary.chapterAvailableInEnglish
              : dictionary.chapterUnavailableBody
          );
          return;
        }

        if (!selectedChapter || chapterPages.length === 0) {
          setPages([]);
          setError(selectedChapter ? dictionary.noPages : dictionary.chapterUnavailableBody);
          return;
        }

        setPages(chapterPages.map(getOptimizedImageUrl));
      } catch {
        if (cancelled) return;
        setPages([]);
        setError(dictionary.chapterUnavailableBody);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadReader();

    return () => {
      cancelled = true;
    };
  }, [
    mangaId,
    readerLanguage,
    currentChapterParam,
    dictionary.chapterAvailableInEnglish,
    dictionary.chapterUnavailableBody,
    dictionary.noPages,
  ]);

  useEffect(() => {
    if (!autoScroll) {
      if (autoScrollIntervalRef.current !== null) {
        window.clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }
      return;
    }

    const pixelsPerTick: Record<ScrollSpeed, number> = {
      1: 1,
      2: 2,
      3: 3,
      4: 5.5,
      5: 8,
    };

    autoScrollIntervalRef.current = window.setInterval(() => {
      window.scrollBy(0, pixelsPerTick[scrollSpeed]);
    }, 16);

    return () => {
      if (autoScrollIntervalRef.current !== null) {
        window.clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }
    };
  }, [autoScroll, scrollSpeed]);

  // Pausar auto-scroll automáticamente cuando el usuario interactúa manualmente con la pantalla
  useEffect(() => {
    if (!autoScroll) return;

    const stopAutoScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        // Ignorar clics o gestos dentro del panel de control
        if (
          target.closest('[data-is-controls-panel="true"]') ||
          target.closest('button') ||
          target.closest('input') ||
          target.closest('select') ||
          target.closest('[role="button"]')
        ) {
          return;
        }
      }
      setAutoScroll(false);
    };

    window.addEventListener("wheel", stopAutoScroll, { passive: true });
    window.addEventListener("touchstart", stopAutoScroll, { passive: true });
    window.addEventListener("mousedown", stopAutoScroll, { passive: true });
    window.addEventListener("keydown", stopAutoScroll, { passive: true });

    return () => {
      window.removeEventListener("wheel", stopAutoScroll);
      window.removeEventListener("touchstart", stopAutoScroll);
      window.removeEventListener("mousedown", stopAutoScroll);
      window.removeEventListener("keydown", stopAutoScroll);
    };
  }, [autoScroll]);

  useEffect(() => {
    if (!currentChapter?.id || !mangaId || pages.length === 0) {
      return;
    }

    const chapterNumber = getChapterNumber(currentChapter);

    addHistory({
      mangaId,
      mangaTitle,
      chapterId: currentChapter.id,
      chapterNumber,
      coverImage,
      timestamp: Date.now(),
    });

    try {
      const storedProgress = JSON.parse(
        localStorage.getItem(READING_PROGRESS_KEY) ?? "{}"
      ) as Record<string, unknown>;

      storedProgress[mangaId] = {
        mangaId,
        mangaTitle,
        chapterId: currentChapter.id,
        chapterLabel: getChapterLabel(currentChapter, dictionary),
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(storedProgress));
    } catch {
      // Reading progress is a convenience feature; never block the reader if storage fails.
    }
  }, [addHistory, coverImage, currentChapter, dictionary, mangaId, mangaTitle, pages.length]);

  const readableChapters = dedupeChaptersByNumber(chapters).sort((a, b) => {
    const aNum = parseChapterNumber(a);
    const bNum = parseChapterNumber(b);
    if (aNum !== null && bNum !== null) {
      return aNum - bNum;
    }
    const aStr = normalizeChapterNumber(a) || "";
    const bStr = normalizeChapterNumber(b) || "";
    return aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: "base" });
  });
  const currentChapterIndex = findChapterIndexByIdOrNumber(
    readableChapters,
    currentChapter?.id,
    currentChapter
  );
  const previousChapter =
    currentChapterIndex > 0 ? readableChapters[currentChapterIndex - 1] : null;
  const nextChapter =
    currentChapterIndex >= 0 && currentChapterIndex < readableChapters.length - 1
      ? readableChapters[currentChapterIndex + 1]
      : null;

  useEffect(() => {
    nextChapterRef.current = nextChapter;
  }, [nextChapter]);
  const pdfStartChapterIndex = Math.max(
    0,
    findChapterIndexByIdOrNumber(
      readableChapters,
      pdfStartChapterId || currentChapter?.id,
      currentChapter
    )
  );
  const pdfEndChapterIndex = Math.max(
    0,
    findChapterIndexByIdOrNumber(
      readableChapters,
      pdfEndChapterId || pdfStartChapterId || currentChapter?.id,
      currentChapter
    )
  );
  const normalizedPdfStartIndex = Math.max(0, Math.min(pdfStartChapterIndex, pdfEndChapterIndex));
  const normalizedPdfEndIndex = Math.max(pdfStartChapterIndex, pdfEndChapterIndex);
  const requestedPdfChapterCount = normalizedPdfEndIndex - normalizedPdfStartIndex + 1;
  const maxPdfEndIndex = Math.min(readableChapters.length - 1, normalizedPdfStartIndex + maxPdfChapters - 1);
  const allowedPdfEndIndex = Math.min(normalizedPdfEndIndex, maxPdfEndIndex);
  const pdfEndOptions = readableChapters.slice(normalizedPdfStartIndex, maxPdfEndIndex + 1);
  const selectedPdfChapters = readableChapters
    .slice(normalizedPdfStartIndex, allowedPdfEndIndex + 1);
  const pdfStartChapter = selectedPdfChapters[0] ?? currentChapter;
  const pdfEndChapter = selectedPdfChapters[selectedPdfChapters.length - 1] ?? currentChapter;
  const pdfRangeLabel =
    selectedPdfChapters.length <= 1
      ? getChapterLabel(pdfStartChapter, dictionary)
      : `${getChapterLabel(pdfStartChapter, dictionary)} - ${getChapterLabel(pdfEndChapter, dictionary)}`;

  async function handleDownloadPdf() {
    if (!currentChapter || pages.length === 0 || downloading) {
      return;
    }

    if (pdfMode === "range" && requestedPdfChapterCount > maxPdfChapters) {
      toast.error(dictionary.pdfLimitExceeded);
      return;
    }

    setDownloading(true);
    setPdfProgress(0);

    try {
      const chaptersToExport = pdfMode === "single" ? [currentChapter] : (selectedPdfChapters.length > 0 ? selectedPdfChapters : [currentChapter]);
      const allImages: string[] = [];

      for (const chapter of chaptersToExport) {
        const chapterPages =
          chapter.id === currentChapter.id ? pages : await fetchChapterPages(chapter.id, { mangaTitle, chapter });

        allImages.push(...chapterPages);
      }

      if (allImages.length === 0) {
        toast.error(dictionary.pdfNoImages);
        return;
      }

      const firstExportedChapter = chaptersToExport[0] ?? currentChapter;
      const chapterName = getChapterNumber(firstExportedChapter);
      const endChapterName =
        chaptersToExport.length === 1
          ? chapterName
          : getChapterNumber(chaptersToExport[chaptersToExport.length - 1] ?? currentChapter);
      const chapterLabel =
        chaptersToExport.length === 1 ? chapterName : `${chapterName}-to-${endChapterName}`;

      await generateMangaPDF(mangaTitle, chapterLabel, allImages, setPdfProgress);
      setShowPdfModal(false);
    } catch (error) {
      console.error("PDF generation failed", error);
      toast.error(dictionary.pdfFailed);
    } finally {
      setDownloading(false);
      setPdfProgress(0);
    }
  }

  function handleChapterNavigation(chapterId: string) {
    setAutoScroll(false);

    if (authLoaded && !currentUser) {
      let count = 0;
      if (typeof window !== "undefined") {
        try {
          count = Number(sessionStorage.getItem("mangastoon_chapters_navigated") ?? "0");
          count += 1;
          sessionStorage.setItem("mangastoon_chapters_navigated", String(count));
        } catch {
          // Fallback if sessionStorage is blocked/disabled
          count = 1;
        }
      } else {
        count = 1;
      }

      if (count === 1 || (count > 1 && (count - 1) % 10 === 0)) {
        setPendingChapterNavId(chapterId);
        setIsSuggestModalOpen(true);
        return;
      }
    }

    router.push(buildReaderUrl(routeSlug, chapterId, readerLanguage !== language ? readerLanguage : undefined));
  }

  function cycleSpeed() {
    setScrollSpeed((current) => {
      if (current === 1) return 2;
      if (current === 2) return 3;
      if (current === 3) {
        if (isPremium) {
          return 4;
        } else {
          setShowPremiumModal(true);
          toast.info("Las velocidades 4x y 5x son beneficios Premium.");
          return 1;
        }
      }
      if (current === 4) return 5;
      return 1;
    });
  }

  function cycleTheme() {
    const themes: ReaderTheme[] = ["dark", "amoled", "sepia", "light", "gray"];
    const currentIndex = themes.indexOf(readerTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];

    if (nextTheme !== "dark" && !isPremium) {
      setShowPremiumModal(true);
      toast.info("¡Los temas de lectura son un beneficio Premium! Pasate a Premium para desbloquearlos.");
      return;
    }

    setReaderTheme(nextTheme);
    localStorage.setItem(READER_THEME_KEY, nextTheme);
    toast.success(`Tema cambiado a ${nextTheme.toUpperCase()}`);
  }

  function selectTheme(theme: ReaderTheme) {
    if (theme !== "dark" && !isPremium) {
      setShowPremiumModal(true);
      toast.info("¡Los temas de lectura son un beneficio Premium! Pasate a Premium para desbloquearlos.");
      return;
    }

    setReaderTheme(theme);
    localStorage.setItem(READER_THEME_KEY, theme);
    toast.success(`Tema cambiado a ${theme.toUpperCase()}`);
  }

  async function handleUpgradePremium() {
    try {
      const response = await upgradeToPremiumAction();
      if (response.error) {
        toast.error(response.error);
        return;
      }
      setIsPremium(true);
      setShowPremiumModal(false);
      toast.success("¡Bienvenido al Club Premium de MangaStoon! 🎉 Disfruta de todos tus beneficios.");
    } catch {
      toast.error("Ocurrió un error al activar tu cuenta Premium.");
    }
  }

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "SELECT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      }

      if (e.key === " " && activeReadingMode === "vertical") {
        e.preventDefault();
        window.scrollBy({
          top: window.innerHeight * 0.8,
          behavior: "smooth",
        });
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [activeReadingMode]);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    void document.documentElement.requestFullscreen();
  }

  function openChapterList() {
    router.push(`/comics/${routeSlug}#chapters`);
  }

  const renderGraceWarning = () => {
    if (!telegramGraceStarted) return null;
    const graceStart = new Date(telegramGraceStarted);
    const graceEnd = new Date(graceStart.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const diffMs = graceEnd.getTime() - now.getTime();
    if (diffMs <= 0) return null;
    
    const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
    const diffMins = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
    
    return (
      <div 
        className="w-full bg-red-950/90 border-b border-red-500/30 text-red-200 px-4 py-3 text-center text-xs font-semibold shadow-inner flex flex-wrap items-center justify-center gap-3 relative z-[45] animate-fade-in"
      >
        <AlertCircle size={14} className="text-red-400 shrink-0" />
        <span>
          {readerLanguage === "es"
            ? `⚠️ ¡Tu Premium corre peligro! Detectamos que saliste de nuestro Telegram. Volvé a unirte en las próximas ${diffHours}h ${diffMins}m o se te revocará el Pase Premium.`
            : readerLanguage === "pt"
              ? `⚠️ Seu Premium está em perigo! Detectamos que você saiu do Telegram. Volte a entrar nas próximas ${diffHours}h ${diffMins}m ou seu Passe Premium será revogado.`
              : `⚠️ Your Premium is in danger! We detected that you left our Telegram. Rejoin within the next ${diffHours}h ${diffMins}m or your Premium Pass will be revoked.`}
        </span>
        <a
          href="https://t.me/+dtPKjcBfiDUyOWQx"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-red-500 text-black px-3 py-1 rounded-lg hover:bg-red-400 transition-all font-bold text-[10px] uppercase tracking-wider"
        >
          {readerLanguage === "es" ? "Unirse al Grupo" : readerLanguage === "pt" ? "Entrar no Grupo" : "Join Group"}
        </a>
      </div>
    );
  };

  return (
    <main
      className={`${
        activeReadingMode === "horizontal"
          ? "h-[100dvh] max-h-[100dvh] overflow-hidden relative"
          : "min-h-screen px-0 pb-10 pt-2"
      } ${THEME_CLASSES[readerTheme].bg} ${THEME_CLASSES[readerTheme].text} transition-colors duration-300`}
    >
      {renderGraceWarning()}
      <ReaderHeader
        isAtTop={isAtTop}
        scrollDirection={scrollDirection}
        readingMode={activeReadingMode}
        loading={loading}
        error={error}
        readerTheme={readerTheme}
        routeSlug={routeSlug}
        mangaTitle={mangaTitle}
        isPremium={isPremium}
        currentChapter={currentChapter}
        dictionary={dictionary}
        previousChapter={previousChapter}
        nextChapter={nextChapter}
        handleChapterNavigation={handleChapterNavigation}
        openChapterList={openChapterList}
        setShowPdfModal={setShowPdfModal}
        downloading={downloading}
        pagesCount={pages.length}
      />

      <ReaderSettingsPanel
        isReaderUiVisible={isReaderUiVisible}
        showControlsUI={showControlsUI}
        readerTheme={readerTheme}
        dictionary={dictionary}
        setReaderUiVisibility={setReaderUiVisibility}
        toggleFullscreen={toggleFullscreen}
        cycleTheme={cycleTheme}
        selectTheme={selectTheme}
        readingMode={activeReadingMode}
        setReadingMode={setReadingMode}
        setAutoScroll={setAutoScroll}
        autoScroll={autoScroll}
        scrollSpeed={scrollSpeed}
        cycleSpeed={cycleSpeed}
        scrollToTop={scrollToTop}
        isPremium={isPremium}
        pageSize={pageSize}
        setPageSize={setPageSize}
        onOpenPremiumModal={() => setShowPremiumModal(true)}
      />

      {loading ? (
        <section className="flex min-h-[70vh] items-center justify-center px-4 md:px-6">
          <div className="flex flex-col items-center gap-5">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-amber-500" />
            <p className="text-sm uppercase tracking-[0.28em] text-gray-400">{dictionary.loadingChapter}</p>
          </div>
        </section>
      ) : error ? (
        <>
          <section className="mx-auto max-w-5xl pt-0 px-4 md:px-6">
            <div className="mb-2 flex w-full items-center justify-between px-1 sm:px-2 md:px-4">
              <Link
                href="/"
                className="flex min-h-10 items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2 text-xs font-heading font-semibold text-gray-300 shadow-md transition-all duration-300 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400"
              >
                <ArrowLeft size={18} />
                <span className="hidden font-bold sm:inline">{dictionary.backHome}</span>
              </Link>

              <button
                type="button"
                disabled
                className="flex min-h-10 items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2 text-xs font-bold text-gray-300 opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={18} />
                <span className="hidden font-bold sm:inline">{dictionary.downloadPdf}</span>
              </button>
            </div>

            <div className="mb-2 flex flex-col items-center justify-center px-3 text-center">
              <h1 className="mb-1 line-clamp-1 max-w-3xl hyphens-auto text-xl font-bold leading-tight tracking-tight text-amber-500 md:text-2xl">
                {mangaTitle}
              </h1>
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 mt-1">
                {getChapterLabel(currentChapter, dictionary)}
              </h2>
            </div>

            <ChapterNavigation
              dictionary={dictionary}
              previousChapter={previousChapter}
              nextChapter={nextChapter}
              onPrevious={() => previousChapter && handleChapterNavigation(previousChapter.id)}
              onNext={() => nextChapter && handleChapterNavigation(nextChapter.id)}
              onList={openChapterList}
            />
          </section>

          <section className="flex min-h-[38vh] items-center justify-center px-4 md:px-6">
            <div className={`w-full max-w-3xl rounded-3xl border ${THEME_CLASSES[readerTheme].border} ${THEME_CLASSES[readerTheme].card} p-6 text-center sm:p-8 transition-colors duration-300`}>
              <h2 className="text-2xl font-semibold text-white">{dictionary.chapterUnavailable}</h2>
              <p className="mt-4 text-sm leading-7 text-gray-400">{error}</p>
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                {englishFallbackChapter ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAutoScroll(false);
                      router.push(buildReaderUrl(routeSlug, englishFallbackChapter.id, "en"));
                    }}
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-3 text-sm font-heading font-bold text-black transition hover:from-amber-400 hover:to-yellow-400"
                  >
                    {dictionary.readInEnglish}
                  </button>
                ) : null}
                <Link
                  href={`/comics/${routeSlug}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-heading font-bold text-gray-300 hover:bg-white/10 transition-colors"
                >
                  <ArrowLeft size={16} />
                  <span>{dictionary.backToSeries}</span>
                </Link>
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="mx-auto max-w-5xl pt-0 px-4 md:px-6">
            <div className="mb-2 flex w-full items-center justify-between px-1 sm:px-2 md:px-4">
              <Link
                href={`/comics/${routeSlug}`}
                className="group inline-flex cursor-pointer items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-xs font-heading font-bold text-amber-500 backdrop-blur transition-all hover:border-amber-500/50 hover:bg-amber-500 hover:text-black shadow-md"
              >
                <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
                <span>{dictionary.backToSeries}</span>
              </Link>

              <button
                type="button"
                onClick={() => setShowPdfModal(true)}
                disabled={downloading || pages.length === 0}
                className="flex min-h-10 items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2 text-xs font-heading font-semibold text-gray-300 shadow-md transition-all duration-300 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Download size={18} />
                <span className="hidden font-bold sm:inline">
                  {downloading ? dictionary.generatingPdf : dictionary.downloadPdf}
                </span>
              </button>
            </div>

            <div className="mb-2 px-3 text-center">
              <h1 className="mb-1 text-xl font-bold leading-tight tracking-tight text-amber-500 md:text-2xl select-text">
                <span className="align-middle">{mangaTitle}</span>
              </h1>
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 mt-1">
                {getChapterLabel(currentChapter, dictionary)}
              </h2>
            </div>
          </section>

          <section className="pb-0 pt-0">
            {activeReadingMode === "horizontal" ? (
              <HorizontalReader
                pages={pages}
                dictionary={dictionary}
                chapterLabel={getChapterLabel(currentChapter, dictionary)}
                onNextChapter={() => nextChapter && handleChapterNavigation(nextChapter.id)}
                onPreviousChapter={() => previousChapter && handleChapterNavigation(previousChapter.id)}
                hasNextChapter={!!nextChapter}
                hasPreviousChapter={!!previousChapter}
                onList={openChapterList}
                mangaId={mangaId}
                chapterId={currentChapter?.id || ""}
                pageSize={pageSize}
                isReaderUiVisible={isReaderUiVisible}
                showControlsUI={showControlsUI}
              />
            ) : (
              <div className={`mx-auto flex w-full flex-col transition-all duration-300 ${PAGE_SIZE_CLASSES[pageSize]}`}>
                {pages.map((pageUrl, index) => {
                  const showAd = !isPremium && index > 0 && index % 5 === 0;
                  return (
                    <div key={pageUrl} className="flex flex-col w-full items-center">
                      <MangaPageImage
                        pageUrl={pageUrl}
                        alt={`${dictionary.page} ${index + 1} · ${getChapterLabel(currentChapter, dictionary)}`}
                        priority={index < 2}
                        retryVersion={pageRetryVersions[index] || 0}
                        onRetrySubsequent={() => handleRetrySubsequent(index)}
                        pageIndex={index}
                      />
                      {showAd && (
                        <MangaAdBanner
                          index={index}
                          onUpgrade={() => setShowPremiumModal(true)}
                          lang={readerLanguage}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="mx-auto max-w-5xl px-4 md:px-6">
            {nextChapter ? (
              <div className={`mt-14 mb-24 mx-auto max-w-2xl rounded-2xl border ${THEME_CLASSES[readerTheme].border} ${THEME_CLASSES[readerTheme].card} p-8 text-center shadow-xl shadow-black/45 transition-colors duration-300`}>
                <span className="text-[10px] font-heading font-bold uppercase tracking-[0.25em] text-amber-500">Capítulo Completado</span>
                <h3 className="mt-2 text-lg font-bold text-white">{getChapterLabel(currentChapter, dictionary)}</h3>
                <p className="mt-1 text-xs text-gray-400">¿Quieres seguir con la lectura? El siguiente capítulo ya está listo.</p>
                
                <div className="mt-6 flex items-center justify-center gap-4">
                  {previousChapter ? (
                    <button
                      type="button"
                      onClick={() => handleChapterNavigation(previousChapter.id)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-gray-400 hover:border-amber-500/30 hover:text-amber-400 transition-colors"
                      title={dictionary.previousChapter}
                    >
                      <ArrowLeft size={18} />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => handleChapterNavigation(nextChapter.id)}
                    className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-3 text-sm font-heading font-bold text-black hover:from-amber-400 hover:to-yellow-400 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    <span>{dictionary.nextChapterCta} · {getChapterLabel(nextChapter, dictionary)}</span>
                    <ArrowRight size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ) : (
              <div className={`mx-auto my-16 max-w-3xl rounded-3xl border ${THEME_CLASSES[readerTheme].border} ${THEME_CLASSES[readerTheme].card} p-8 text-center shadow-2xl shadow-black/50 md:p-10 transition-colors duration-300`}>
                <span className="text-[10px] font-heading font-bold uppercase tracking-[0.3em] text-amber-500">MangaStoon</span>
                <h2 className="mt-3 text-2xl font-black text-white md:text-3xl tracking-tight">{dictionary.endReachedTitle}</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-gray-400">{dictionary.endReachedBody}</p>

                {suggestedComics.length > 0 ? (
                  <div className="mt-10 text-left">
                    <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-gray-500 border-b border-white/5 pb-2">{dictionary.suggestedTitle}</h3>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
                      {suggestedComics.map((comic, index) => (
                        <a
                          key={comic.slug}
                          href={buildComicPath(comic.title, comic.slug)}
                          className={`group block ${index >= 4 ? "hidden lg:block" : ""}`}
                        >
                          <div className="aspect-[2/3] overflow-hidden rounded-xl border border-white/5 bg-[#0f1015] shadow-md transition-all duration-300 group-hover:border-amber-500/40 group-hover:shadow-[0_0_15px_rgba(245,158,11,0.15)] group-hover:scale-[1.03]">
                            {comic.coverImage ? (
                              <RetryableSuggestedImage
                                src={comic.coverImage}
                                alt={comic.title}
                              />
                            ) : null}
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs font-bold text-gray-300 group-hover:text-amber-500 transition-colors leading-tight">
                            {comic.title}
                          </p>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-10 pt-6 border-t border-white/5">
                  <a
                    href="/explore"
                    className="inline-flex rounded-xl border border-amber-500/20 bg-amber-500/5 px-6 py-2.5 text-xs font-heading font-bold text-amber-500 hover:bg-amber-500 hover:text-black transition-all duration-300 active:scale-95"
                  >
                    {dictionary.exploreMore}
                  </a>
                </div>
              </div>
            )}
          </section>

          <section className="mx-auto max-w-3xl px-4 md:px-6 mt-6">
            <CommentsSection
              chapterId={routeChapterId}
              mangaId={mangaId}
              currentUser={currentUser}
              currentProfile={currentProfile}
              onLoginRequired={() => { setAuthModalTab("signin"); setIsAuthModalOpen(true); }}
            />
          </section>

          {showPdfModal ? (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
              <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/90 p-6 shadow-2xl backdrop-blur-xl">
                {/* Background glow effects */}
                <div className="absolute -right-16 -top-16 -z-10 h-36 w-36 rounded-full bg-amber-500/10 blur-3xl" />
                <div className="absolute -left-16 -bottom-16 -z-10 h-36 w-36 rounded-full bg-yellow-500/10 blur-3xl" />

                <button
                  type="button"
                  onClick={() => !downloading && setShowPdfModal(false)}
                  className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-40"
                  disabled={downloading}
                >
                  ✕
                </button>

                {downloading ? (
                  /* Premium Loading State */
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="relative flex items-center justify-center">
                      {/* SVG circular progress */}
                      <svg className="h-32 w-32 transform -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="54"
                          className="stroke-white/5 fill-none"
                          strokeWidth="8"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="54"
                          className="stroke-amber-500 fill-none transition-all duration-300 ease-out"
                          strokeWidth="8"
                          strokeDasharray={2 * Math.PI * 54}
                          strokeDashoffset={2 * Math.PI * 54 * (1 - pdfProgress / 100)}
                          strokeLinecap="round"
                        />
                      </svg>
                      {/* Inner percentage */}
                      <div className="absolute flex flex-col items-center">
                        <span className="text-2xl font-bold font-heading text-white">{pdfProgress}%</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 animate-pulse">
                          {dictionary.generatingPdf}
                        </span>
                      </div>
                    </div>

                    <h3 className="mt-8 text-lg font-bold text-white font-heading">
                      {pdfProgress <= 25
                        ? (readerLanguage === "es" ? "Descargando páginas..." : readerLanguage === "pt" ? "Baixando imagens..." : "Downloading images...")
                        : pdfProgress <= 65
                        ? (readerLanguage === "es" ? "Procesando y optimizando..." : readerLanguage === "pt" ? "Processando e otimizando..." : "Processing and optimizing...")
                        : pdfProgress <= 90
                        ? (readerLanguage === "es" ? "Compilando PDF en HD..." : readerLanguage === "pt" ? "Compilando PDF em HD..." : "Compiling PDF in HD...")
                        : (readerLanguage === "es" ? "¡Listo! Guardando archivo..." : readerLanguage === "pt" ? "Pronto! Salvando arquivo..." : "Ready! Saving file...")}
                    </h3>
                    <p className="mt-2 text-xs text-gray-400 max-w-xs">
                      {readerLanguage === "es" 
                        ? "Por favor no cierres esta pestaña. Estamos compilando tu contenido de alta definición."
                        : readerLanguage === "pt"
                        ? "Por favor, não feche esta aba. Estamos compilando seu conteúdo de alta definição."
                        : "Please do not close this tab. We are compiling your high-definition content."}
                    </p>
                  </div>
                ) : (
                  /* Standard Setup Mode */
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isPremium ? "bg-amber-500/10 text-amber-500" : "bg-[#ff6b00]/10 text-[#ff6b00]"}`}>
                          <FileText size={18} />
                        </div>
                        <span className={`text-xs font-heading font-bold uppercase tracking-[0.2em] ${isPremium ? "text-amber-500" : "text-[#ff6b00]"}`}>
                          {dictionary.pdfModalTitle}
                        </span>
                      </div>
                      {isPremium && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500" title="Premium">
                          <Crown size={14} className="fill-amber-500 text-amber-500 shrink-0 animate-pulse" />
                        </div>
                      )}
                    </div>
                    <h2 className="mt-3 text-xl font-bold text-white font-heading tracking-tight line-clamp-1">{mangaTitle}</h2>
                    
                    {/* Toggle Selector Tabs */}
                    <div className="mt-5 rounded-2xl border border-white/5 bg-black/40 p-1 flex gap-1">
                      <button
                        type="button"
                        onClick={() => setPdfMode("single")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-heading font-bold transition-all cursor-pointer ${
                          pdfMode === "single"
                            ? isPremium
                              ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-lg shadow-amber-500/10"
                              : "bg-[#ff6b00] text-white shadow-lg shadow-orange-500/20"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <BookOpen size={14} />
                        <span>{readerLanguage === "es" ? "Capítulo Actual" : readerLanguage === "pt" ? "Capítulo Atual" : "Current Chapter"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfMode("range")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-heading font-bold transition-all cursor-pointer ${
                          pdfMode === "range"
                            ? isPremium
                              ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-lg shadow-amber-500/10"
                              : "bg-[#ff6b00] text-white shadow-lg shadow-orange-500/20"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <FileText size={14} />
                        <span>{readerLanguage === "es" ? "Varios Capítulos" : readerLanguage === "pt" ? "Vários Capítulos" : "Multiple Chapters"}</span>
                      </button>
                    </div>

                    {pdfMode === "single" ? (
                      /* Single Chapter Preview UI */
                      <div className="mt-5 rounded-2xl border border-white/5 bg-black/25 p-5 flex flex-col gap-4 relative overflow-hidden">
                        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-[0.02]">
                          <BookOpen size={120} className="text-white" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
                            {readerLanguage === "es" ? "VISTA PREVIA DE DESCARGA" : readerLanguage === "pt" ? "PRÉVIA DE DOWNLOAD" : "DOWNLOAD PREVIEW"}
                          </p>
                          <h3 className="mt-2 text-base font-bold text-white tracking-tight leading-snug">
                            {getChapterLabel(currentChapter, dictionary)}
                          </h3>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-white/5 px-2.5 py-1 text-xs text-gray-300">
                            <span className={`font-semibold ${isPremium ? "text-amber-500" : "text-[#ff6b00]"}`}>{pages.length}</span>
                            <span className="text-gray-500 font-medium">
                              {pages.length === 1
                                ? (readerLanguage === "es" ? "página" : readerLanguage === "pt" ? "página" : "page")
                                : (readerLanguage === "es" ? "páginas" : readerLanguage === "pt" ? "páginas" : "pages")}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-white/5 px-2.5 py-1 text-xs text-gray-300">
                            <span className="text-gray-500 font-medium">{readerLanguage === "es" ? "Formato:" : readerLanguage === "pt" ? "Formato:" : "Format:"}</span>
                            <span className="font-semibold text-white">PDF</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Range Chapters Selection UI */
                      <div className="mt-5 rounded-2xl border border-white/5 bg-black/25 p-5 flex flex-col gap-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
                              {dictionary.startChapter}
                            </span>
                            <select
                              value={pdfStartChapterId || currentChapter?.id || ""}
                              onChange={(event) => setPdfStartChapterId(event.target.value)}
                              className="mt-2 w-full rounded-xl border border-white/5 bg-[#0f1015] px-4 py-3 text-sm font-semibold text-white outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/35 transition-all shadow-inner cursor-pointer"
                            >
                              {readableChapters.map((chapter) => (
                                <option key={chapter.id} value={chapter.id}>
                                  {getChapterLabel(chapter, dictionary)}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="block">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
                              {dictionary.endChapter}
                            </span>
                            <select
                              value={
                                pdfEndOptions.some(
                                  (chapter) =>
                                    chapter.id ===
                                    (pdfEndChapterId || pdfStartChapterId || currentChapter?.id)
                                )
                                  ? pdfEndChapterId || pdfStartChapterId || currentChapter?.id || ""
                                  : pdfEndOptions[pdfEndOptions.length - 1]?.id ?? ""
                              }
                              onChange={(event) => setPdfEndChapterId(event.target.value)}
                              className="mt-2 w-full rounded-xl border border-white/5 bg-[#0f1015] px-4 py-3 text-sm font-semibold text-white outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/35 transition-all shadow-inner cursor-pointer"
                            >
                              {pdfEndOptions.map((chapter) => (
                                <option key={chapter.id} value={chapter.id}>
                                  {getChapterLabel(chapter, dictionary)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="border-t border-white/10 pt-4 flex flex-col gap-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
                              {dictionary.downloadRange}
                            </span>
                            <p className={`mt-1 text-sm font-semibold ${isPremium ? "text-amber-500" : "text-[#ff6b00]"}`}>{pdfRangeLabel}</p>
                          </div>
                          
                          {/* Clear Limits Indicator Box */}
                          <div className={`rounded-xl border p-3.5 text-xs flex flex-col gap-1.5 transition-all ${
                            isPremium
                              ? "border-amber-500/20 bg-amber-500/5 text-amber-500"
                              : "border-[#ff6b00]/20 bg-[#ff6b00]/5 text-[#ff6b00]"
                          }`}>
                            <div className="flex items-center justify-between font-bold text-sm">
                              <span className="flex items-center gap-1">
                                {isPremium ? <Crown size={13} className="fill-amber-500 text-amber-500 shrink-0" /> : <FileText size={13} className="shrink-0" />}
                                {readerLanguage === "es" ? "Límite de capítulos:" : readerLanguage === "pt" ? "Limite de capítulos:" : "Chapter limit:"}
                              </span>
                              <span>{isPremium ? "50 Capítulos (Premium)" : "10 Capítulos (Gratuito)"}</span>
                            </div>
                            <p className="text-[11px] text-gray-400 leading-normal">
                              {isPremium
                                ? (readerLanguage === "es" ? "Tienes el beneficio Premium activo: puedes compilar hasta 50 capítulos en un solo archivo PDF." : readerLanguage === "pt" ? "Você tem o benefício Premium ativo: pode compilar até 50 capítulos em um único PDF." : "You have active Premium benefits: compile up to 50 chapters in a single PDF file.")
                                : (readerLanguage === "es" ? "Como usuario gratuito, el límite es de 10 capítulos. Mejora a Premium para ampliar el límite y descargar hasta 50." : readerLanguage === "pt" ? "Como usuário gratuito, o limite é de 10 capítulos. Faça upgrade para Premium para aumentar o limite para 50." : "As a free user, the limit is 10 chapters. Upgrade to Premium to extend the limit and download up to 50.")
                              }
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-900/50 px-3 py-2 text-[11px] text-gray-400">
                            <span>
                              {readerLanguage === "es" ? "Capítulos seleccionados:" : readerLanguage === "pt" ? "Capítulos selecionados:" : "Selected chapters:"}
                            </span>
                            <span className={`font-bold ${requestedPdfChapterCount > maxPdfChapters ? "text-red-500" : "text-white"}`}>
                              {requestedPdfChapterCount} / {maxPdfChapters}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {!isPremium && (
                      <div className="mt-4 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-yellow-500/5 p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-xs text-amber-500 font-heading font-bold">
                          <Sparkles size={14} className="animate-pulse text-amber-400" />
                          <span>
                            {readerLanguage === "es" ? "Límite de 10 capítulos por descarga" : readerLanguage === "pt" ? "Limite de 10 capítulos por download" : "Limit of 10 chapters per download"}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] text-gray-400 leading-normal">
                          {readerLanguage === "es" ? "¿Querés descargas masivas e ilimitadas de hasta 50 capítulos?" : readerLanguage === "pt" ? "Quer downloads massivos e ilimitados de até 50 capítulos?" : "Want massive and unlimited downloads of up to 50 chapters?"}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPdfModal(false);
                            setShowPremiumModal(true);
                          }}
                          className="mt-3 w-full rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 py-2 text-xs font-heading font-bold text-amber-400 hover:from-amber-500 hover:to-yellow-500 hover:text-black transition-all cursor-pointer"
                        >
                          {readerLanguage === "es" ? "Desbloquear 50 capítulos" : readerLanguage === "pt" ? "Desbloquear 50 capítulos" : "Unlock 50 chapters"}
                        </button>
                      </div>
                    )}

                    <div className="mt-6 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowPdfModal(false)}
                        className="flex-1 rounded-xl border border-white/5 bg-white/5 py-3 text-sm font-heading font-bold text-gray-300 transition-all hover:bg-white/10 active:scale-95 cursor-pointer"
                      >
                        {dictionary.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={downloading || (pdfMode === "range" && requestedPdfChapterCount > maxPdfChapters)}
                        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-heading font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer ${
                          isPremium
                            ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-lg shadow-amber-500/10 hover:from-amber-400 hover:to-yellow-400"
                            : "bg-[#ff6b00] text-white hover:bg-[#ff8833] shadow-lg shadow-orange-500/20"
                        }`}
                      >
                        <FileText className="h-4 w-4" />
                        <span>{dictionary.download}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {/* Floating Bottom Next Chapter Banner */}
          <AnimatePresence>
            {showNextChapterBanner && nextChapter && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="fixed bottom-6 left-1/2 z-40 w-[90%] max-w-sm -translate-x-1/2"
              >
                <button
                  type="button"
                  onClick={() => handleChapterNavigation(nextChapter.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-3.5 text-black shadow-[0_12px_24px_rgba(0,0,0,0.4),0_0_15px_rgba(245,158,11,0.2)] hover:from-amber-400 hover:to-yellow-400 hover:scale-[1.02] active:scale-95 transition-all duration-300"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/10">
                      <ArrowRight size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-[10px] font-heading font-bold uppercase tracking-wider text-black/60 leading-none">
                        {readerLanguage === "es" ? "Próximo Capítulo" : readerLanguage === "pt" ? "Próximo Capítulo" : "Next Chapter"}
                      </p>
                      <p className="mt-1 text-xs font-heading font-semibold text-black truncate max-w-[180px]">
                        {getChapterLabel(nextChapter, dictionary)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-heading font-bold uppercase tracking-wider bg-black/15 px-2.5 py-1 rounded-lg">
                    {readerLanguage === "es" ? "Leer Ahora" : readerLanguage === "pt" ? "Ler Agora" : "Read Now"}
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Premium benefits modal */}
          {showPremiumModal ? (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
              <div className="relative w-full max-w-md">
                <button
                  type="button"
                  onClick={() => setShowPremiumModal(false)}
                  className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
                <PremiumBenefitsCard
                  lang={readerLanguage}
                  isLoggedIn={!!currentUser}
                  onUpgrade={() => {
                    if (!currentUser) {
                      setShowPremiumModal(false);
                      setAuthModalTab("signin");
                      setIsAuthModalOpen(true);
                    } else {
                      handleUpgradePremium();
                    }
                  }}
                />
              </div>
            </div>
          ) : null}

          {/* Floating Register Suggestion Banner for Guests */}
          <AnimatePresence>
            {authLoaded && !currentUser && hasScrolledPastHalf && !dismissedRegBanner && (
              <motion.div
                initial={{ opacity: 0, y: 100, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 100, scale: 0.95 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="fixed bottom-6 right-6 z-50 w-[90%] max-w-sm rounded-2xl border border-amber-500/20 bg-black/85 p-5 shadow-2xl backdrop-blur-lg md:max-w-md"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <h4 className="text-sm font-heading font-bold text-amber-500 flex items-center gap-1.5">
                      <Sparkles size={16} className="animate-pulse text-amber-400" />
                      {REG_BANNER_COPY[readerLanguage].title}
                    </h4>
                    <button
                      type="button"
                      onClick={handleDismissRegBanner}
                      className="text-gray-400 hover:text-white text-xs font-semibold px-2 py-1 rounded-lg transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {REG_BANNER_COPY[readerLanguage].body}
                  </p>
                  <div className="mt-1 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={handleDismissRegBanner}
                      className="text-xs font-bold text-gray-400 hover:text-white px-3 py-1.5 transition-colors"
                    >
                      {REG_BANNER_COPY[readerLanguage].dismiss}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthModalTab("signup");
                        setIsAuthModalOpen(true);
                      }}
                      className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2 text-xs font-heading font-bold text-black hover:from-amber-400 hover:to-yellow-400 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      {REG_BANNER_COPY[readerLanguage].cta}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AuthModal
            open={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            defaultTab={authModalTab}
          />

          <SuggestSignUpModal
            open={isSuggestModalOpen}
            onClose={() => {
              setIsSuggestModalOpen(false);
              if (pendingChapterNavId) {
                router.push(buildReaderUrl(routeSlug, pendingChapterNavId, readerLanguage !== language ? readerLanguage : undefined));
                setPendingChapterNavId(null);
              }
            }}
          />
        </>
      )}
    </main>
  );
}
