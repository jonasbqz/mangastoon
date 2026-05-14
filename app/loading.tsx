import { MangaCardSkeleton } from "./components/MangaCard";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 md:px-8">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-white/5" />
      <div className="flex gap-4 overflow-x-hidden pb-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <MangaCardSkeleton key={`home-skeleton-${index}`} variant="carousel" />
        ))}
      </div>
    </div>
  );
}
