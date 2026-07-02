export function getOptimizedImageUrl(url: string): string {
  if (!url) return "";
  try {
    // Si ya es del proxy, la optimizamos a través de weserv.nl usando nuestro proxy como origen
    if (url.startsWith("/api/proxy-image") || url.includes("/api/proxy-image")) {
      const absoluteProxyUrl = url.startsWith("/") ? `https://lectorfenix.com${url}` : url;
      return `https://images.weserv.nl/?url=${encodeURIComponent(absoluteProxyUrl)}&default=${encodeURIComponent(absoluteProxyUrl)}&output=webp&q=75&w=400&fit=cover`;
    }

    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Detectar URLs rotas del buscador del scraper (ej: https://c14c4b3dd51396dc.jpg)
    // donde el nombre del archivo se convirtió erróneamente en el nombre del host.
    if (
      hostname.endsWith(".jpg") ||
      hostname.endsWith(".jpeg") ||
      hostname.endsWith(".png") ||
      hostname.endsWith(".webp") ||
      hostname.endsWith(".gif")
    ) {
      return "/icon.png";
    }

    const isHotlinkingBlockedHost =
      hostname.endsWith("olympusbiblioteca.com") ||
      hostname.endsWith("olympusxyz.com") ||
      hostname.endsWith("imagesolymp.xyz") ||
      hostname.endsWith("yoveo.xyz") ||
      hostname.endsWith("leercapitulo.co") ||
      hostname.endsWith("t34798ndc.com");

    if (isHotlinkingBlockedHost) {
      const proxyUrl = `https://lectorfenix.com/api/proxy-image?url=${encodeURIComponent(url)}`;
      return `https://images.weserv.nl/?url=${encodeURIComponent(proxyUrl)}&default=${encodeURIComponent(proxyUrl)}&output=webp&q=75&w=400&fit=cover`;
    }

    // MangaDex permite hotlinking y tiene su propia CDN optimizada globalmente
    if (hostname.endsWith("mangadex.org")) {
      return url;
    }

    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=${encodeURIComponent(url)}&output=webp&q=75&w=400&fit=cover`;
  } catch {
    // Return the original URL as fallback if parsing fails (e.g. relative URLs)
    return url;
  }
}
