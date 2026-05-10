"use client";

import { jsPDF } from "jspdf";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Download, Eye, EyeOff, List } from "lucide-react";
import { SupportedLanguage, useLanguage } from "../../components/language-provider";

type ScrollSpeed = 1 | 2 | 3;

type ReaderDictionary = {
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
};

type ChapterFeedItem = {
  id: string;
  attributes?: {
    chapter?: string | null;
    title?: string | null;
    translatedLanguage?: string | null;
  };
};

type ReaderApiResponse = {
  mangaTitle?: string;
  chapters?: ChapterFeedItem[];
  currentChapter?: ChapterFeedItem | null;
  pages?: string[];
  englishFallbackChapter?: ChapterFeedItem | null;
  fallbackReason?: "english" | "unavailable" | null;
  error?: string;
  code?: string;
};

const UI_COPY: Record<SupportedLanguage, ReaderDictionary> = {
  es: {
    reader: "Lector Mangastoon",
    backHome: "Volver al inicio",
    chapterUnavailable: "Capitulo no disponible en este idioma",
    chapterUnavailableBody: "No encontramos un capitulo legible para este idioma.",
    chapterAvailableInEnglish: "Este capitulo no esta disponible en espanol, pero si existe en ingles.",
    readInEnglish: "Ver en ingles",
    loadingChapter: "Cargando capitulo...",
    previousChapter: "Anterior",
    nextChapter: "Siguiente",
    chapterList: "Lista de Capitulos",
    noPages: "No pudimos cargar las paginas de este capitulo.",
    downloadPdf: "Descargar PDF",
    generatingPdf: "Generando...",
    pdfModalTitle: "Descargar PDF",
    pdfModalBody: "Elige el rango exacto de capitulos que quieres incluir.",
    currentDownload: "Descarga actual",
    startChapter: "Desde",
    endChapter: "Hasta",
    downloadRange: "Rango incluido",
    maxChaptersNotice: "Maximo 50 capitulos por PDF para evitar bloqueos.",
    pdfLimitExceeded: "No se puede descargar mas de 50 capitulos por PDF.",
    cancel: "Cancelar",
    download: "Descargar",
    play: "Play",
    pause: "Pause",
    page: "Pagina",
    chapter: "Capitulo",
    scrollTop: "Subir",
    fullscreen: "Pantalla completa",
    controls: "Controles",
    hideControls: "Ocultar controles",
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
    cancel: "Cancel",
    download: "Download",
    play: "Play",
    pause: "Pause",
    page: "Page",
    chapter: "Chapter",
    scrollTop: "Scroll top",
    fullscreen: "Fullscreen",
    controls: "Controls",
    hideControls: "Hide controls",
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
    cancel: "Cancelar",
    download: "Baixar",
    play: "Play",
    pause: "Pause",
    page: "Pagina",
    chapter: "Capitulo",
    scrollTop: "Topo",
    fullscreen: "Tela cheia",
    controls: "Controles",
    hideControls: "Ocultar controles",
  },
};

const MAX_PDF_CHAPTERS = 50;
const READING_PROGRESS_KEY = "mangastoon_reading_progress";
const READER_REQUEST_TIMEOUT_MS = 20000;

function normalizeReaderLanguage(value: string | null, fallback: SupportedLanguage) {
  if (value === "en" || value === "pt" || value === "es") {
    return value;
  }

  return fallback;
}

async function fetchChapterPages(chapterId: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), READER_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`/api/read/chapter/${chapterId}`, { signal: controller.signal, cache: "no-store" });

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
  const byId = chapterId ? chapters.findIndex((chapter) => chapter.id === chapterId) : -1;

  if (byId >= 0) {
    return byId;
  }

  const fallbackKey = getChapterNavigationKey(fallbackChapter);
  return fallbackKey
    ? chapters.findIndex((chapter) => getChapterNavigationKey(chapter) === fallbackKey)
    : -1;
}


function buildReaderUrl(mangaId: string, chapterId?: string, lang?: SupportedLanguage) {
  const search = new URLSearchParams();

  if (chapterId) {
    search.set("chapter", chapterId);
  }

  if (lang) {
    search.set("lang", lang);
  }

  const query = search.toString();
  return query ? `/read/${mangaId}?${query}` : `/read/${mangaId}`;
}

async function loadImageForPdf(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function ToolButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      title={title}
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.9 }}
      className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#1d1e25]/80 text-gray-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_32px_rgba(0,0,0,0.42)] backdrop-blur-md transition-colors hover:border-orange-500/45 hover:bg-orange-500 hover:text-black hover:shadow-orange-900/25"
    >
      {children}
    </motion.button>
  );
}

function ChapterNavButton({
  disabled,
  onClick,
  children,
  variant = "secondary",
}: {
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const className =
    "h-14 w-14 rounded-2xl border border-white/15 bg-[#20212a] text-orange-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_30px_rgba(0,0,0,0.42)] transition-all hover:border-orange-500/50 hover:bg-[#292a34] hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: disabled ? 1 : 0.9 }}
      className={`flex items-center justify-center ${className}`}
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
      <ChapterNavButton disabled={!previousChapter} onClick={onPrevious}>
        <ArrowLeft aria-hidden="true" size={24} strokeWidth={2.6} />
        <span className="sr-only">{dictionary.previousChapter}</span>
      </ChapterNavButton>

      <ChapterNavButton onClick={onList}>
        <List aria-hidden="true" size={24} strokeWidth={2.6} />
        <span className="sr-only">{dictionary.chapterList}</span>
      </ChapterNavButton>

      <ChapterNavButton disabled={!nextChapter} onClick={onNext} variant="primary">
        <ArrowRight aria-hidden="true" size={24} strokeWidth={2.6} />
        <span className="sr-only">{dictionary.nextChapter}</span>
      </ChapterNavButton>
    </div>
  );
}

function MangaPageImage({
  pageUrl,
  alt,
  priority,
}: {
  pageUrl: string;
  alt: string;
  priority: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    const timeout = window.setTimeout(() => setLoaded(true), 12000);
    return () => window.clearTimeout(timeout);
  }, [pageUrl]);

  return (
    <div className="relative w-full overflow-hidden bg-[#111217]">
      {!loaded && !failed ? (
        <div className="absolute inset-0 z-10 flex min-h-[55vh] items-center justify-center bg-[#111217]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-orange-500" />
        </div>
      ) : null}

      {failed ? (
        <div className="flex min-h-[45vh] items-center justify-center px-4 text-center text-sm text-gray-400">
          No pudimos cargar esta pagina. Intenta recargar el capitulo.
        </div>
      ) : (
        <img
          src={pageUrl}
          alt={alt}
          className="block h-auto w-full"
          loading={priority ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(true);
            setFailed(true);
          }}
        />
      )}
    </div>
  );
}

export default function ReadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const mangaId = Array.isArray(params.id) ? params.id[0] : params.id;
  const currentChapterParam = searchParams.get("chapter");
  const readerLanguage = normalizeReaderLanguage(searchParams.get("lang"), language);
  const dictionary = UI_COPY[readerLanguage];

  const [mangaTitle, setMangaTitle] = useState("Mangastoon");
  const [chapters, setChapters] = useState<ChapterFeedItem[]>([]);
  const [currentChapter, setCurrentChapter] = useState<ChapterFeedItem | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [englishFallbackChapter, setEnglishFallbackChapter] = useState<ChapterFeedItem | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfStartChapterId, setPdfStartChapterId] = useState("");
  const [pdfEndChapterId, setPdfEndChapterId] = useState("");
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState<ScrollSpeed>(1);
  const [isReaderUiVisible, setIsReaderUiVisible] = useState(true);
  const autoScrollIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (currentChapter?.id) {
      setPdfStartChapterId(currentChapter.id);
      setPdfEndChapterId(currentChapter.id);
    }
  }, [currentChapter?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadReader() {
      setLoading(true);
      setError("");
      setEnglishFallbackChapter(null);

      try {
        const requestParams = new URLSearchParams();
        requestParams.set("lang", readerLanguage);

        if (currentChapterParam) {
          requestParams.set("chapter", currentChapterParam);
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

        setMangaTitle(payload.mangaTitle ?? "Mangastoon");
        setChapters(feed);
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

        setPages(chapterPages);
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

  useEffect(() => {
    if (!currentChapter?.id || !mangaId) {
      return;
    }

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
  }, [currentChapter, dictionary, mangaId, mangaTitle]);

  const readableChapters = dedupeChaptersByNumber(chapters);
  const currentChapterIndex = findChapterIndexByIdOrNumber(
    readableChapters,
    currentChapter?.id,
    currentChapter
  );
  const previousChapter = currentChapterIndex > 0 ? readableChapters[currentChapterIndex - 1] : null;
  const nextChapter =
    currentChapterIndex >= 0 && currentChapterIndex < readableChapters.length - 1
      ? readableChapters[currentChapterIndex + 1]
      : null;
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
  const maxPdfEndIndex = Math.min(readableChapters.length - 1, normalizedPdfStartIndex + MAX_PDF_CHAPTERS - 1);
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

    if (requestedPdfChapterCount > MAX_PDF_CHAPTERS) {
      toast.error(dictionary.pdfLimitExceeded);
      return;
    }

    setDownloading(true);
    setShowPdfModal(false);

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const chaptersToExport = selectedPdfChapters.length > 0 ? selectedPdfChapters : [currentChapter];
      let pageIndex = 0;

      for (const chapter of chaptersToExport) {
        const chapterPages =
          chapter.id === currentChapter.id ? pages : await fetchChapterPages(chapter.id);

        for (const pageUrl of chapterPages) {
          const image = await loadImageForPdf(pageUrl);
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) {
            throw new Error("Canvas context unavailable.");
          }

          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          context.drawImage(image, 0, 0);

          const imageData = canvas.toDataURL("image/jpeg", 0.92);
          const imageRatio = image.naturalWidth / image.naturalHeight;
          let renderWidth = pdfWidth;
          let renderHeight = renderWidth / imageRatio;

          if (renderHeight > pdfHeight) {
            renderHeight = pdfHeight;
            renderWidth = renderHeight * imageRatio;
          }

          const x = (pdfWidth - renderWidth) / 2;
          const y = (pdfHeight - renderHeight) / 2;

          if (pageIndex > 0) {
            pdf.addPage();
          }

          pdf.addImage(imageData, "JPEG", x, y, renderWidth, renderHeight);
          pageIndex += 1;
        }
      }

      const firstExportedChapter = chaptersToExport[0] ?? currentChapter;
      const chapterName = getChapterNumber(firstExportedChapter);
      const endChapterName =
        chaptersToExport.length === 1
          ? chapterName
          : getChapterNumber(chaptersToExport[chaptersToExport.length - 1] ?? currentChapter);
      const fileSuffix =
        chaptersToExport.length === 1 ? `cap-${chapterName}` : `cap-${chapterName}-to-${endChapterName}`;

      pdf.save(`mangastoon-${mangaTitle}-${fileSuffix}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  function handleChapterNavigation(chapterId: string) {
    setAutoScroll(false);
    router.push(buildReaderUrl(mangaId, chapterId, readerLanguage !== language ? readerLanguage : undefined));
  }

  function cycleSpeed() {
    setScrollSpeed((current) => {
      if (current === 1) return 2;
      if (current === 2) return 3;
      return 1;
    });
  }

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
    router.push(`/manga/${mangaId}#chapters`);
  }

  return (
    <main
      className="min-h-screen bg-[#0a0a0c] px-4 pb-10 pt-2 text-white sm:px-4 md:px-6 md:pt-3"
    >
      <Script id="monetag-vignette" src="https://dd133.com/vignette.min.js" data-zone="10986315" strategy="afterInteractive" />

      <AnimatePresence>
        {isReaderUiVisible ? (
          <motion.div
            key="reader-tools-visible"
            initial={{ opacity: 0, x: 18, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 18, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            className="fixed right-3 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-3 rounded-2xl border border-white/10 bg-[#141519]/78 p-2 shadow-2xl shadow-black/45 backdrop-blur-xl md:right-4"
          >
            <ToolButton title={dictionary.hideControls} onClick={() => setIsReaderUiVisible(false)}>
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

            <ToolButton
              title={autoScroll ? dictionary.pause : dictionary.play}
              onClick={() => setAutoScroll((current) => !current)}
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

            <ToolButton title={`${scrollSpeed}x`} onClick={cycleSpeed}>
              <span className="text-sm font-semibold">{scrollSpeed}x</span>
            </ToolButton>

            <ToolButton title={dictionary.scrollTop} onClick={scrollToTop}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19V5" />
                <path d="m5 12 7-7 7 7" />
              </svg>
            </ToolButton>
          </motion.div>
        ) : (
          <motion.div
            key="reader-tools-hidden"
            initial={{ opacity: 0, x: 10, scale: 0.92 }}
            animate={{ opacity: 0.58, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.92 }}
            transition={{ duration: 0.22 }}
            className="fixed right-3 top-1/2 z-50 -translate-y-1/2 md:right-4"
          >
            <ToolButton title={dictionary.controls} onClick={() => setIsReaderUiVisible(true)}>
              <Eye className="h-5 w-5" />
            </ToolButton>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <section className="flex min-h-[70vh] items-center justify-center">
          <div className="flex flex-col items-center gap-5">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-orange-500" />
            <p className="text-sm uppercase tracking-[0.28em] text-gray-400">{dictionary.loadingChapter}</p>
          </div>
        </section>
      ) : error ? (
        <>
          <section className="mx-auto max-w-5xl pt-0">
            <div className="mb-2 flex w-full items-center justify-between px-1 sm:px-2 md:px-4">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex min-h-10 items-center gap-2 rounded-full bg-[#1a1b20] px-4 py-2 text-sm font-semibold text-gray-300 shadow-lg shadow-black/20 transition-all duration-300 hover:bg-[#ff6b00] hover:text-white"
              >
                <ArrowLeft size={24} />
                <span className="hidden font-medium sm:inline">{dictionary.backHome}</span>
              </button>

              <button
                type="button"
                disabled
                className="flex min-h-10 items-center gap-2 rounded-full bg-[#1a1b20] px-4 py-2 text-sm font-semibold text-gray-300 opacity-50"
              >
                <Download size={24} />
                <span className="hidden font-medium sm:inline">{dictionary.downloadPdf}</span>
              </button>
            </div>

            <div className="mb-2 flex flex-col items-center justify-center px-3 text-center">
              <h1 className="mb-1 line-clamp-1 max-w-3xl hyphens-auto text-xl font-semibold leading-tight tracking-tight text-orange-500 md:text-2xl">
                {mangaTitle}
              </h1>
              <h2 className="text-base font-semibold text-white">
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

          <section className="flex min-h-[38vh] items-center justify-center px-1">
            <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-neutral-900/50 p-6 text-center sm:p-8">
                <h2 className="text-2xl font-semibold text-white">{dictionary.chapterUnavailable}</h2>
              <p className="mt-4 text-sm leading-7 text-gray-400">{error}</p>
              {englishFallbackChapter ? (
                <button
                  type="button"
                  onClick={() => {
                    setAutoScroll(false);
                    router.push(buildReaderUrl(mangaId, englishFallbackChapter.id, "en"));
                  }}
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-orange-400"
                >
                  {dictionary.readInEnglish}
                </button>
              ) : null}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="mx-auto max-w-5xl pt-0">
            <div className="mb-2 flex w-full items-center justify-between px-1 sm:px-2 md:px-4">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex min-h-10 items-center gap-2 rounded-full bg-[#1a1b20] px-4 py-2 text-sm font-semibold text-gray-300 shadow-lg shadow-black/20 transition-all duration-300 hover:bg-[#ff6b00] hover:text-white"
              >
                <ArrowLeft size={24} />
                <span className="hidden font-medium sm:inline">{dictionary.backHome}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPdfModal(true)}
                disabled={downloading || pages.length === 0}
                className="flex min-h-10 items-center gap-2 rounded-full bg-[#1a1b20] px-4 py-2 text-sm font-semibold text-gray-300 shadow-lg shadow-black/20 transition-all duration-300 hover:bg-[#ff6b00] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={24} />
                <span className="hidden font-medium sm:inline">
                  {downloading ? dictionary.generatingPdf : dictionary.downloadPdf}
                </span>
              </button>
            </div>

            <div className="mb-2 flex flex-col items-center justify-center px-3 text-center">
              <h1 className="mb-1 line-clamp-1 max-w-3xl hyphens-auto text-xl font-semibold leading-tight tracking-tight text-orange-500 md:text-2xl">
                {mangaTitle}
              </h1>
              <h2 className="text-base font-semibold text-white">
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

          <section className="pb-0 pt-0">
            <div className="mx-auto flex w-full max-w-3xl flex-col">
              {pages.map((pageUrl, index) => (
                <MangaPageImage
                  key={pageUrl}
                  pageUrl={pageUrl}
                  alt={`${dictionary.page} ${index + 1} · ${getChapterLabel(currentChapter, dictionary)}`}
                  priority={index === 0}
                />
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-5xl pb-8 pt-6">
            <ChapterNavigation
              dictionary={dictionary}
              previousChapter={previousChapter}
              nextChapter={nextChapter}
              onPrevious={() => previousChapter && handleChapterNavigation(previousChapter.id)}
              onNext={() => nextChapter && handleChapterNavigation(nextChapter.id)}
              onList={openChapterList}
            />
          </section>

          {showPdfModal ? (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141519] p-6 shadow-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
                  {dictionary.pdfModalTitle}
                </p>
                <h2 className="mt-2 line-clamp-2 text-xl font-semibold text-white">{mangaTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-400">{dictionary.pdfModalBody}</p>

                <div className="mt-5 rounded-xl border border-white/10 bg-black/35 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    {dictionary.currentDownload}
                  </p>
                  <p className="mt-2 text-base font-semibold text-white">
                    {getChapterLabel(currentChapter, dictionary)}
                  </p>

                  <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                        {dictionary.startChapter}
                      </span>
                      <select
                        value={pdfStartChapterId || currentChapter?.id || ""}
                        onChange={(event) => setPdfStartChapterId(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                      >
                        {readableChapters.map((chapter) => (
                          <option key={chapter.id} value={chapter.id}>
                            {getChapterLabel(chapter, dictionary)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
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
                        className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                      >
                        {pdfEndOptions.map((chapter) => (
                          <option key={chapter.id} value={chapter.id}>
                            {getChapterLabel(chapter, dictionary)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      {dictionary.downloadRange}
                    </p>
                    <p className="mt-2 text-sm font-medium text-orange-400">{pdfRangeLabel}</p>
                    <p className="mt-2 text-xs text-gray-500">{dictionary.maxChaptersNotice}</p>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPdfModal(false)}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-300 transition hover:bg-white/10"
                  >
                    {dictionary.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={downloading}
                    className="flex-1 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {downloading ? dictionary.generatingPdf : dictionary.download}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
