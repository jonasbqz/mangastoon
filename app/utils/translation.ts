const FALLBACK_TRANSLATIONS: Record<"es" | "pt" | "en", Array<[RegExp, string]>> = {
  es: [
    [/\bSeason\b/gi, "Temporada"],
    [/\bVolume\b/gi, "Volumen"],
    [/\bChapter\b/gi, "Capítulo"],
    [/\bAbout\b/gi, "Sobre"],
    [/\bIncident\b/gi, "Incidente"],
    [/\bStory\b/gi, "Historia"],
    [/\bWorld\b/gi, "Mundo"],
    [/\bReincarnation\b/gi, "Reencarnación"],
    [/\bGreen Tea\b/gi, "Interesada"],
  ],
  pt: [
    [/\bSeason\b/gi, "Temporada"],
    [/\bVolume\b/gi, "Volume"],
    [/\bChapter\b/gi, "Capítulo"],
    [/\bAbout\b/gi, "Sobre"],
    [/\bIncident\b/gi, "Incidente"],
    [/\bStory\b/gi, "História"],
    [/\bWorld\b/gi, "Mundo"],
    [/\bReincarnation\b/gi, "Reencarnação"],
    [/\bGreen Tea\b/gi, "Interesseira"],
  ],
  en: [],
};

export function applyFallbackDictionary(text: string, targetLang: "es" | "pt" | "en") {
  return FALLBACK_TRANSLATIONS[targetLang].reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    text
  );
}

export async function forceTranslate(text: string, targetLang: "es" | "pt" | "en", sourceLang = "auto") {
  const cleanText = text.replace(/\s+/g, " ").trim();

  if (!cleanText || sourceLang === targetLang) return cleanText;

  const dictionaryFallback = targetLang === "en" ? cleanText : applyFallbackDictionary(cleanText, targetLang);

  try {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(cleanText)}`,
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) return dictionaryFallback;

    const payload = (await response.json()) as Array<Array<[string]>>;
    const translated = payload?.[0]?.map((part) => part?.[0] ?? "").join("").trim();

    return translated || dictionaryFallback;
  } catch {
    return dictionaryFallback;
  }
}
