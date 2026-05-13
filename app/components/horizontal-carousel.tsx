"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MangaCard, type MangaShowcaseItem } from "./home-carousel";

export default function HorizontalCarousel({
  title,
  mangas,
  featuredCards = false,
  subtitle,
  showChapters = false,
}: {
  title: string;
  mangas: MangaShowcaseItem[];
  featuredCards?: boolean;
  subtitle?: string;
  showChapters?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtStart, setIsAtStart] = useState(true);
  const [isAtEnd, setIsAtEnd] = useState(false);

  if (mangas.length === 0) {
    return null;
  }

  function checkScroll() {
    if (!scrollRef.current) return;

    const { scrollLeft, clientWidth, scrollWidth } = scrollRef.current;
    setIsAtStart(scrollLeft <= 0);
    setIsAtEnd(scrollLeft + clientWidth >= scrollWidth - 1);
  }

  function scrollByAmount(direction: "left" | "right") {
    if (!scrollRef.current) return;

    const amount = Math.round(scrollRef.current.clientWidth * 0.85);
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    checkScroll();
  }, [mangas]);

  return (
    <section>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-6 w-1.5 rounded-full bg-[#ff6b00] md:h-8" />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{title}</h2>
            <p className="text-xs text-gray-500">{subtitle ?? "Descubre algo grande para leer ahora"}</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={() => scrollByAmount("left")}
            disabled={isAtStart}
            className="rounded-full bg-white/5 p-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount("right")}
            disabled={isAtEnd}
            className="rounded-full bg-white/5 p-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="scrollbar-hide -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 [&::-webkit-scrollbar]:hidden md:mx-0 md:gap-6 md:px-0"
      >
        {mangas.map((manga, index) => (
          <MangaCard
            key={manga.mangaDexId ? `${manga.mangaDexId}-${index}` : `${manga.mal_id}-${index}`}
            manga={manga}
            isFeatured={featuredCards}
            showChapters={showChapters}
            latestChapters={manga.latestChapters}
            priorityImage={index < 4}
          />
        ))}
      </div>
    </section>
  );
}
