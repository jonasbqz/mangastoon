export const MANGADEX_USER_AGENT = "Mangastoon/1.0.0";

export function getMangaDexApiBase() {
  let base = (process.env.NEXT_PUBLIC_MANGADEX_API_URL || "https://api.mangadex.org").replace(/\/+$/, "");
  if (base && !base.startsWith("http://") && !base.startsWith("https://")) {
    base = `https://${base}`;
  }
  return base;
}

export function toMangaDexApiUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("https://api.mangadex.org")) {
    return pathOrUrl.replace("https://api.mangadex.org", getMangaDexApiBase());
  }

  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${getMangaDexApiBase()}${path}`;
}

export function getMangaDexRequestHeaders() {
  return {
    Accept: "application/json",
    "User-Agent": MANGADEX_USER_AGENT,
  };
}


export type MangaStoonLanguage = "es" | "en" | "pt";

export function normalizeMangaStoonLanguage(value: string | null | undefined): MangaStoonLanguage {
  if (value === "en" || value === "pt") {
    return value;
  }

  return "es";
}

export function getMangaDexAvailableLanguages(language: MangaStoonLanguage) {
  if (language === "es") {
    return ["es", "es-la", "es-419"];
  }

  if (language === "pt") {
    return ["pt-br", "pt"];
  }

  return ["en"];
}

export function appendMangaDexAvailableLanguageFilters(
  params: URLSearchParams,
  language: MangaStoonLanguage
) {
  params.delete("availableTranslatedLanguage[]");

  getMangaDexAvailableLanguages(language).forEach((translatedLanguage) => {
    if (/^[a-z]{2}(-[a-z]{2})?$/i.test(translatedLanguage)) {
      params.append("availableTranslatedLanguage[]", translatedLanguage);
    }
  });
}
