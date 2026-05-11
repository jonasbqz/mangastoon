"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { useHistoryStore } from "../store/useHistoryStore";

function formatChapterLabel(chapterNumber: string) {
  return chapterNumber ? `Capitulo ${chapterNumber}` : "Continuar leyendo";
}

export default function ReadingHistoryList() {
  const history = useHistoryStore((state) => state.history);

  if (history.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-[#101116] p-4 shadow-2xl shadow-black/20 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="border-l-4 border-[#ff6b00] pl-3">
          <h2 className="text-2xl font-semibold text-white">Continuar Leyendo</h2>
          <p className="mt-1 text-sm text-gray-400">Volvé directo al capítulo donde te quedaste.</p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin] [scrollbar-color:#ff6b00_#1f2028]">
        {history.map((item) => (
          <Link
            key={`${item.mangaId}-${item.chapterId}`}
            href={`/read/${item.mangaId}?chapter=${item.chapterId}`}
            className="group flex min-w-[260px] max-w-[300px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-[#ff6b00]/50 hover:bg-[#ff6b00]/10"
          >
            <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10">
              {item.coverImage ? (
                <Image
                  src={item.coverImage}
                  alt={item.mangaTitle}
                  fill
                  sizes="56px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  unoptimized
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#ff6b00]">
                  <BookOpen size={20} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white">
                {item.mangaTitle}
              </h3>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#ff6b00]">
                {formatChapterLabel(item.chapterNumber)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}