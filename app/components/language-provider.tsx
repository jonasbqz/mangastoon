"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

export type SupportedLanguage = "es" | "en" | "pt";

type LanguageContextValue = {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  isAdult: boolean;
  setAdult: (isAdult: boolean) => void;
};

const STORAGE_KEY = "lang";
const COOKIE_NAME = "lang";
const ADULT_STORAGE_KEY = "mangastoon_adult";
const ADULT_COOKIE_NAME = "mangastoon_adult";

const LanguageContext = createContext<LanguageContextValue | null>(null);

function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  if (value === "en" || value === "pt") {
    return value;
  }

  return "es";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [language, setLanguageState] = useState<SupportedLanguage>("es");
  const [isAdult, setIsAdult] = useState(false);

  useEffect(() => {
    const storedLanguage = normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
    const storedAdult = window.localStorage.getItem(ADULT_STORAGE_KEY) === "true";
    const currentCookies = `; ${document.cookie}`;
    const currentLanguageCookie = currentCookies
      .split(`; ${COOKIE_NAME}=`)
      .pop()
      ?.split(";")[0];
    const currentAdultCookie = currentCookies
      .split(`; ${ADULT_COOKIE_NAME}=`)
      .pop()
      ?.split(";")[0];
    const shouldRefresh =
      normalizeLanguage(currentLanguageCookie) !== storedLanguage ||
      (currentAdultCookie === "true") !== storedAdult;

    setLanguageState(storedLanguage);
    setIsAdult(storedAdult);
    document.cookie = `${COOKIE_NAME}=${storedLanguage}; path=/; max-age=31536000; samesite=lax`;
    document.cookie = `${ADULT_COOKIE_NAME}=${storedAdult}; path=/; max-age=31536000; samesite=lax`;

    if (shouldRefresh) {
      router.refresh();
    }
  }, [router]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: (nextLanguage) => {
        setLanguageState(nextLanguage);
        window.localStorage.setItem(STORAGE_KEY, nextLanguage);
        document.cookie = `${COOKIE_NAME}=${nextLanguage}; path=/; max-age=31536000; samesite=lax`;
      },
      isAdult,
      setAdult: (nextAdult) => {
        setIsAdult(nextAdult);
        window.localStorage.setItem(ADULT_STORAGE_KEY, String(nextAdult));
        document.cookie = `${ADULT_COOKIE_NAME}=${nextAdult}; path=/; max-age=31536000; samesite=lax`;
      },
    }),
    [isAdult, language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider.");
  }

  return context;
}
