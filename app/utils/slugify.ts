export function slugify(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "comic";
}

export function extractComicIdFromSlugId(slugId: string) {
  const decoded = decodeURIComponent(slugId);
  const uuid = decoded.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)?.[0];

  return uuid ?? decoded;
}

export function buildComicPath(title: string | null | undefined, id: string) {
  return `/comics/${slugify(title)}-${id}`;
}

export function buildChapterPath(title: string | null | undefined, mangaId: string, chapterId: string, lang?: string) {
  const path = `/comics/${slugify(title)}-${mangaId}/chapters/${chapterId}`;
  return lang && lang !== "es" ? `${path}?lang=${encodeURIComponent(lang)}` : path;
}
