export function getOptimizedImageUrl(url: string): string {
  if (!url) return "";
  try {
    // Evitar reprocesar URLs que ya son del proxy
    if (url.startsWith("/api/proxy-image") || url.includes("/api/proxy-image")) {
      return url;
    }

    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const isHotlinkingBlockedHost =
      hostname.endsWith("olympusbiblioteca.com") ||
      hostname.endsWith("olympusxyz.com") ||
      hostname.endsWith("yoveo.xyz");

    if (isHotlinkingBlockedHost) {
      return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }

    // MangaDex permite hotlinking y tiene su propia CDN optimizada globalmente
    if (hostname.endsWith("mangadex.org")) {
      return url;
    }

    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=${encodeURIComponent(url)}&output=webp&q=75`;
  } catch {
    // Return the original URL as fallback if parsing fails (e.g. relative URLs)
    return url;
  }
}
