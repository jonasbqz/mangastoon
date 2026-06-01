"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buildChapterPath } from "../utils/slugify";
import { useHistoryStore } from "../store/useHistoryStore";

export default function ContinueReadingButton({
  mangaId,
  mangaTitle,
  language,
  firstChapterId,
}: {
  mangaId: string;
  mangaTitle?: string;
  language?: string;
  firstChapterId?: string;
}) {
  const history = useHistoryStore((state) => state.history);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cleanId = (id: string) => id.startsWith("lc-") ? id.substring(3) : id;
  const progress = mounted ? (history.find((item) => cleanId(item.mangaId) === cleanId(mangaId)) ?? null) : null;
  const chId = progress?.chapterId ?? firstChapterId;

  if (!chId) {
    return null;
  }

  const chapterWord = language === "pt" ? "Cap. " : language === "en" ? "Ch. " : "Cap. ";
  const labelText = progress
    ? (language === "pt"
        ? `Continuar lendo - ${chapterWord}${progress.chapterNumber}`
        : language === "en"
          ? `Continue reading - ${chapterWord}${progress.chapterNumber}`
          : `Continuar leyendo - ${chapterWord}${progress.chapterNumber}`)
    : (language === "pt"
        ? "Começar a ler"
        : language === "en"
          ? "Read now"
          : "Empezar a leer");

  return (
    <Link
      href={buildChapterPath(mangaTitle || progress?.mangaTitle, mangaId.startsWith("lc-") ? mangaId.substring(3) : mangaId, chId, language)}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#ff8833] px-4 py-3.5 text-sm font-heading font-bold text-black transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-[0_4px_20px_rgba(255,107,0,0.25)] hover:shadow-[0_4px_25px_rgba(255,107,0,0.4)]"
    >
      <BookOpen className="h-4 w-4" />
      <span>{labelText}</span>
    </Link>
  );
}
