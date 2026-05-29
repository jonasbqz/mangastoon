"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buildChapterPath } from "../utils/slugify";

type ReadingProgress = {
  mangaId: string;
  mangaTitle: string;
  chapterId: string;
  chapterLabel: string;
  updatedAt: string;
};

const READING_PROGRESS_KEY = "mangastoon_reading_progress";

function readProgressMap() {
  try {
    return JSON.parse(localStorage.getItem(READING_PROGRESS_KEY) ?? "{}") as Record<
      string,
      ReadingProgress
    >;
  } catch {
    return {};
  }
}

export default function ContinueReadingButton({
  mangaId,
  mangaTitle,
  language,
}: {
  mangaId: string;
  mangaTitle?: string;
  language?: string;
}) {
  const [progress, setProgress] = useState<ReadingProgress | null>(null);

  useEffect(() => {
    setProgress(readProgressMap()[mangaId] ?? null);
  }, [mangaId]);

  if (!progress) {
    return null;
  }

  return (
    <Link
      href={buildChapterPath(mangaTitle || progress.mangaTitle, mangaId, progress.chapterId, language)}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-3.5 text-sm font-heading font-bold text-black transition-all duration-300 hover:from-amber-600 hover:to-yellow-600 hover:scale-[1.02] active:scale-95 shadow-[0_4px_20px_rgba(245,158,11,0.25)] hover:shadow-[0_4px_25px_rgba(245,158,11,0.4)]"
    >
      <BookOpen className="h-4 w-4" />
      <span>Continuar leyendo - {progress.chapterLabel}</span>
    </Link>
  );
}
