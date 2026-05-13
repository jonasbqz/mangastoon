import { applyFallbackDictionary, forceTranslate } from "./translation";

type LocalizedTextMap = Record<string, string>;

type LocalizableManga = {
  attributes?: {
    title?: LocalizedTextMap;
    altTitles?: LocalizedTextMap[];
  };
  titleMap?: LocalizedTextMap;
  altTitles?: LocalizedTextMap[];
  title?: string;
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
    .replace(/(^|[\s'?([{??-])([\p{L}\p{N}])/gu, (_, prefix: string, letter: string) => {
      return `${prefix}${letter.toLocaleUpperCase()}`;
    })
    .replace(/\b(Ii|Iii|Iv|Vi|Vii|Viii|Ix|X)\b/g, (roman) => roman.toUpperCase())
    .replace(/\b(Nsfw|Rpg|Tv|Ai|Vr|Jp)\b/g, (acronym) => acronym.toUpperCase());
}

function looksLikeRoughTransliteration(title: string) {
  const latinWords = title.match(/[A-Za-z]{2,}/g) ?? [];
  const shortConnectorCount =
    title.match(/\b(wo|wa|ni|no|de|ga|to|na|ya|o|e|kara|made|desu|da|yo|ne|ka)\b/gi)?.length ?? 0;
  const apostropheCount = title.match(/[?']/g)?.length ?? 0;
  const longVowelCount = title.match(/\b[a-z]{10,}\b/gi)?.length ?? 0;
  const longNoCommonVowelCount =
    title.match(/\b[A-Za-z]{11,}\b/g)?.filter((word) => !/[aeiou??????]/i.test(word)).length ?? 0;
  const cjkCharacterCount = title.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g)?.length ?? 0;
  const connectorRatio = latinWords.length > 0 ? shortConnectorCount / latinWords.length : 0;

  return (
    cjkCharacterCount > 0 ||
    longNoCommonVowelCount > 0 ||
    (latinWords.length >= 3 && shortConnectorCount >= 3) ||
    (latinWords.length >= 4 && connectorRatio >= 0.35) ||
    (latinWords.length >= 4 && (apostropheCount >= 1 || longVowelCount >= 2))
  );
}

function isUsefulTitle(title: string | undefined) {
  return Boolean(title?.trim());
}

export function cleanTitle(title: string) {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (!normalized) return normalized;

  // Caso editorial: en manhua/manhwa "Green Tea" suele ser arquetipo de persona interesada,
  // no una traducci?n literal de "t? verde".
  const editorial = normalized.replace(/\bGreen Tea\b/gi, "Interesada");

  return toTitleCase(editorial);
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
  const candidates = altTitles.flatMap((alt) => [alt.es, alt["es-la"], alt.en, alt.pt, alt["pt-br"]]);
  return candidates.find((candidate) => isUsefulTitle(candidate) && !looksLikeRoughTransliteration(candidate));
}

function chooseCleanTitle(value: string | undefined, altTitles: LocalizedTextMap[]) {
  if (!value) return value;
  return looksLikeRoughTransliteration(value) ? findCleanAlternative(altTitles) ?? value : value;
}

function getBaseTitle(manga: LocalizableManga, targetLang: string) {
  const title = manga.attributes?.title ?? manga.titleMap ?? (manga.title ? { en: manga.title } : {});
  const altTitles = manga.attributes?.altTitles ?? manga.altTitles ?? [];
  const languageCandidates = getLanguageCandidates(targetLang);

  const localizedAltTitle = findAltTitle(altTitles, languageCandidates);
  if (localizedAltTitle) return { value: chooseCleanTitle(localizedAltTitle, altTitles), translated: false };

  const englishAltTitle = findAltTitle(altTitles, ["en"]);
  if (englishAltTitle) {
    return {
      value: chooseCleanTitle(englishAltTitle, altTitles),
      translated: targetLang === "es" || targetLang === "pt",
    };
  }

  const englishTitle = title.en;
  if (englishTitle) {
    return {
      value: chooseCleanTitle(englishTitle, altTitles),
      translated: targetLang === "es" || targetLang === "pt",
    };
  }

  const fallback = chooseCleanTitle(title["ja-ro"] || Object.values(title).find(isUsefulTitle), altTitles);
  return { value: fallback, translated: false };
}

export const getLocalizedTitle = (
  manga: LocalizableManga,
  targetLang: string = "es"
) => {
  const baseTitle = getBaseTitle(manga, targetLang);

  if (!baseTitle.value) return "T?tulo Desconocido";

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

  if (!baseTitle.value) return "T?tulo Desconocido";

  const cleaned = cleanTitle(baseTitle.value);

  if (!baseTitle.translated || (targetLang !== "es" && targetLang !== "pt")) {
    return cleaned;
  }

  return cleanTitle(await forceTranslate(cleaned, targetLang));
}
