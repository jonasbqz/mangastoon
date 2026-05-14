export { default, MangaCard } from "./home-carousel";
export type { MangaShowcaseItem } from "./home-carousel";


export function MangaCardSkeleton({ variant = "grid" }: { variant?: "carousel" | "grid" }) {
  const sizeClass = variant === "grid" ? "w-full" : "w-[140px] md:w-[190px]";

  return (
    <article className={`${sizeClass} shrink-0 snap-start`} aria-hidden="true">
      <div className="flex w-full animate-pulse flex-col">
        <div className="aspect-[3/4] w-full rounded-md bg-white/5 ring-1 ring-white/5" />
        <div className="mt-2 space-y-2 px-0.5">
          <div className="h-4 w-full rounded bg-white/5" />
          <div className="h-4 w-2/3 rounded bg-white/5" />
          <div className="h-3 w-1/2 rounded bg-white/5" />
        </div>
      </div>
    </article>
  );
}
