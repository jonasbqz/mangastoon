import MangaLoader from "./components/MangaLoader";

export default function Loading() {
  return (
    <main className="relative min-h-screen bg-transparent px-4 py-8 text-white">
      {/* Blurred details skeleton */}
      <div className="pointer-events-none mx-auto max-w-7xl opacity-25 blur-xs">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="md:col-span-4 lg:col-span-3">
            <div className="aspect-[2/3] rounded-xl bg-white/5" />
            <div className="mt-4 rounded-xl border border-white/5 bg-[#141519] p-4">
              <div className="h-5 w-40 rounded bg-white/5" />
              <div className="mt-4 h-10 w-full rounded-md bg-white/5" />
            </div>
          </div>

          <div className="md:col-span-8 lg:col-span-9">
            <div className="h-12 w-3/4 rounded bg-white/5" />
            <div className="mt-4 flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-8 w-24 rounded-full bg-white/5" />
              ))}
            </div>
            <div className="mt-6 rounded-xl bg-[#141519] p-6">
              <div className="h-5 w-32 rounded bg-white/5" />
              <div className="mt-4 space-y-3">
                <div className="h-4 w-full rounded bg-white/5" />
                <div className="h-4 w-11/12 rounded bg-white/5" />
                <div className="h-4 w-10/12 rounded bg-white/5" />
              </div>
            </div>
            <div className="mt-8 space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-16 rounded-lg bg-white/5" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Centered Manga/Anime loader overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <MangaLoader />
      </div>
    </main>
  );
}
