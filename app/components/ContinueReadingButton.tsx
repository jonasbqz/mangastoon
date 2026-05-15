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

export default function ContinueReadingButton({ mangaId }: { mangaId: string }) {
  const [progress, setProgress] = useState<ReadingProgress | null>(null);

  useEffect(() => {
    setProgress(readProgressMap()[mangaId] ?? null);
  }, [mangaId]);

  if (!progress) {
    return null;
  }

  return (
    <Link
      href={buildChapterPath(progress.mangaTitle, mangaId, progress.chapterId)}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff6b00] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
    >
      <BookOpen className="h-4 w-4" />
      Continuar leyendo - {progress.chapterLabel}
    </Link>
  );
}
