import { applyFallbackDictionary, forceTranslate } from "./translation";

type LocalizedTextMap = Record<string, string>;

type LocalizableManga = {
  attributes?: {
    title?: LocalizedTextMap;
    altTitles?: LocalizedTextMap[];
  };
  titleMap?: LocalizedTextMap;
  altTitles?: LocalizedTextMap[];
};

function getLanguageCandidates(targetLang: string) {
  if (targetLang === "es" || targetLang === "es-la") {
    return ["es", "es-la"];
  }

  if (targetLang === "pt" || targetLang === "pt-br") {
    return ["pt-br", "pt"];
  }

  return [targetLang];
}

function toTitleCase(title: string) {
  return title
    .toLocaleLowerCase()
    .replace(/(^|[\s'’([{¿¡-])([\p{L}\p{N}])/gu, (_, prefix: string, letter: string) => {
      return `${prefix}${letter.toLocaleUpperCase()}`;
    })
    .replace(/\b(Ii|Iii|Iv|Vi|Vii|Viii|Ix|X)\b/g, (roman) => roman.toUpperCase())
    .replace(/\b(Nsfw|Rpg|Tv|Ai|Vr|Jp)\b/g, (acronym) => acronym.toUpperCase());
}

function looksLikeRoughTransliteration(title: string) {
  const latinWords = title.match(/[A-Za-z]{2,}/g) ?? [];
  const shortConnectorCount = title.match(/\b(wo|wa|ni|no|de|ga|to|na|ya|o|e)\b/gi)?.length ?? 0;
  const apostropheCount = title.match(/[’']/g)?.length ?? 0;
  const longVowelCount = title.match(/\b[a-z]{9,}\b/gi)?.length ?? 0;

  return (
    latinWords.length >= 4 &&
    (shortConnectorCount >= 2 || apostropheCount >= 1 || longVowelCount >= 2)
  );
}

function isUsefulTitle(title: string | undefined) {
  return Boolean(title?.trim());
}

export function cleanTitle(title: string) {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (!normalized) return normalized;

  // Caso editorial: en manhua/manhwa "Green Tea" suele ser arquetipo de persona interesada,
  // no una traducción literal de "té verde".
  const editorial = normalized.replace(/\bGreen Tea\b/gi, "Interesada");

  return /[A-Za-zÀ-ÿ]/.test(editorial) ? toTitleCase(editorial) : editorial;
}

function findAltTitle(altTitles: LocalizedTextMap[], languages: string[]) {
  for (const alt of altTitles) {
    for (const lang of languages) {
      if (isUsefulTitle(alt[lang])) return alt[lang];
    }
  }

  return undefined;
}

function findCleanAlternative(altTitles: LocalizedTextMap[]) {
  const candidates = altTitles.flatMap((alt) => [alt.en, alt.es, alt["es-la"], alt.pt, alt["pt-br"]]);
  return candidates.find((candidate) => isUsefulTitle(candidate) && !looksLikeRoughTransliteration(candidate));
}

function getBaseTitle(manga: LocalizableManga, targetLang: string) {
  const title = manga.attributes?.title ?? manga.titleMap ?? {};
  const altTitles = manga.attributes?.altTitles ?? manga.altTitles ?? [];
  const languageCandidates = getLanguageCandidates(targetLang);

  const localizedAltTitle = findAltTitle(altTitles, languageCandidates);
  if (localizedAltTitle) return { value: localizedAltTitle, translated: false };

  const englishAltTitle = findAltTitle(altTitles, ["en"]);
  if (englishAltTitle) return { value: englishAltTitle, translated: targetLang === "es" || targetLang === "pt" };

  const englishTitle = title.en;
  if (englishTitle) {
    const cleanAlternative = looksLikeRoughTransliteration(englishTitle)
      ? findCleanAlternative(altTitles)
      : undefined;

    return {
      value: cleanAlternative ?? englishTitle,
      translated: targetLang === "es" || targetLang === "pt",
    };
  }

  const fallback = title["ja-ro"] || Object.values(title).find(isUsefulTitle);
  return { value: fallback, translated: false };
}

export const getLocalizedTitle = (
  manga: LocalizableManga,
  targetLang: string = "es"
) => {
  const baseTitle = getBaseTitle(manga, targetLang);

  if (!baseTitle.value) return "Título Desconocido";

  const cleaned = cleanTitle(baseTitle.value);
  return baseTitle.translated && (targetLang === "es" || targetLang === "pt")
    ? applyFallbackDictionary(cleaned, targetLang)
    : cleaned;
};

export async function getLocalizedTitleAsync(
  manga: LocalizableManga,
  targetLang: string = "es"
) {
  const baseTitle = getBaseTitle(manga, targetLang);

  if (!baseTitle.value) return "Título Desconocido";

  const cleaned = cleanTitle(baseTitle.value);

  if (!baseTitle.translated || (targetLang !== "es" && targetLang !== "pt")) {
    return cleaned;
  }

  return cleanTitle(await forceTranslate(cleaned, targetLang));
}
