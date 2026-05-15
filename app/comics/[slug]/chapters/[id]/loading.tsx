export default function ReadLoadingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="flex flex-col items-center gap-5">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-orange-400" />
        <p className="text-sm uppercase tracking-[0.28em] text-gray-400">Cargando capitulo...</p>
      </div>
    </main>
  );
}
