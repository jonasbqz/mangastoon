export function slugify(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "comic";
}

function cleanMangaSlug(slug: string): string {
  let cleaned = slug.replace(/-\d{8}-[a-zA-Z0-9]+$/, "");
  while (true) {
    if (cleaned.length % 2 === 1) {
      const mid = Math.floor(cleaned.length / 2);
      if (cleaned[mid] === '-') {
        const firstHalf = cleaned.substring(0, mid);
        const secondHalf = cleaned.substring(mid + 1);
        if (firstHalf === secondHalf) {
          cleaned = firstHalf;
          continue;
        }
      }
    }
    break;
  }
  return cleaned;
}

export function extractComicIdFromSlugId(slugId: string) {
  const decoded = decodeURIComponent(slugId);
  const uuid = decoded.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)?.[0];

  if (uuid) return uuid;
  return cleanMangaSlug(decoded);
}

function isMangaDexUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function buildRouteSlug(title: string | null | undefined, id: string) {
  let cleanId = decodeURIComponent(id).replace(/^\/?comics\//, "").replace(/^\/+|\/+$/g, "");

  if (!cleanId) return slugify(title);
  if (isMangaDexUuid(cleanId)) return `${slugify(title)}-${cleanId}`;

  // Strip 'lc-' prefix if present to keep user-facing URLs clean
  if (cleanId.startsWith("lc-")) {
    cleanId = cleanId.substring(3);
  }

  // Local/Monline IDs are already SEO slugs. Prefixing the title again creates
  // duplicated routes like /comics/title-title-20260514...
  return cleanId;
}

export function buildComicPath(title: string | null | undefined, id: string) {
  return `/comics/${buildRouteSlug(title, id)}`;
}

export function buildChapterPath(title: string | null | undefined, mangaId: string, chapterId: string, lang?: string) {
  const path = `/comics/${buildRouteSlug(title, mangaId)}/chapters/${chapterId}`;
  return lang && lang !== "es" ? `${path}?lang=${encodeURIComponent(lang)}` : path;
}
