"use client";

import { useEffect, useState } from "react";
import type { SupportedLanguage } from "./language-provider";

const LOADING_QUOTES: Record<SupportedLanguage, string[]> = {
  es: [
    "Canalizando chakra para cargar la página...",
    "Abriendo las páginas del grimorio...",
    "Entrenando en la Habitación del Tiempo...",
    "Dibujando las viñetas con tinta premium...",
    "Despertando el poder oculto del servidor...",
    "Afinando la animación del opening...",
    "Esquivando el spoiler del siglo...",
    "Reuniendo las Esferas del Dragón...",
    "Activando el Modo Ermitaño...",
    "Buscando el One Piece (puede tardar)...",
    "Superando los límites (¡Plus Ultra!)...",
    "Cargando el siguiente arco argumental...",
    "Haciendo un pacto con el Shinigami...",
    "Afilando la espada de cazador de demonios..."
  ],
  en: [],
  pt: [
    "Canalizando chakra para carregar a página...",
    "Abrindo as páginas do grimório...",
    "Treinando na Sala do Tempo...",
    "Desenhando os quadros com tinta premium...",
    "Despertando o poder oculto do servidor...",
    "Ajustando a animação de abertura...",
    "Desviando do spoiler do século...",
    "Reunindo as Esferas do Dragão...",
    "Ativando o Modo Eremita...",
    "Procurando o One Piece (pode demorar)...",
    "Indo além dos limites (Plus Ultra!)...",
    "Carregando o próximo arco da história...",
    "Fazendo um acordo com o Shinigami...",
    "Afiando a espada do caçador de demônios..."
  ]
};

// Map 'en' to 'es' quotes for type safety
(LOADING_QUOTES as any).en = LOADING_QUOTES.es;

export default function MangaLoader({ 
  fullScreen = false,
  language: propLang,
  message
}: { 
  fullScreen?: boolean; 
  language?: SupportedLanguage;
  message?: string; 
}) {
  const [language, setLanguage] = useState<SupportedLanguage>("es");

  useEffect(() => {
    if (propLang) {
      setLanguage(propLang === "pt" ? "pt" : "es");
      return;
    }
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("lang");
      if (stored === "pt") {
        setLanguage("pt");
        return;
      }
      
      const cookieValue = document.cookie
        .split("; ")
        .find((row) => row.startsWith("lang="))
        ?.split("=")[1];
      if (cookieValue === "pt") {
        setLanguage("pt");
      }
    }
  }, [propLang]);

  const [quote, setQuote] = useState("");

  useEffect(() => {
    if (message) {
      setQuote(message);
      return;
    }
    const list = LOADING_QUOTES[language] || LOADING_QUOTES.es;
    const randomIndex = Math.floor(Math.random() * list.length);
    setQuote(list[randomIndex]);
  }, [language, message]);

  return (
    <div
      className={`flex flex-col items-center justify-center p-6 text-center transition-opacity duration-300 ${
        fullScreen
          ? "fixed inset-0 z-[9999] h-[100dvh] w-[100dvw] bg-[#0a0908]/95 backdrop-blur-md pt-0 pb-[25vh] md:pb-28"
          : "min-h-[400px] w-full pb-8"
      }`}
    >
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
        {/* Glow backdrop effect */}
        <div className="absolute inset-0 rounded-full bg-orange-500/20 blur-xl animate-pulse" />

        {/* Outer rotating circle (ink-brush / magic circle speed lines) */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full animate-spin-slow text-orange-500/80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="50"
            cy="50"
            r="44"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray="15 20 40 15 10 25"
            strokeLinecap="round"
          />
        </svg>

        {/* Middle reverse-rotating circle */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full animate-spin-reverse-slow text-orange-500/40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="50"
            cy="50"
            r="36"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="5 10 20 10"
            strokeLinecap="round"
          />
        </svg>

        {/* Central Brand Isotipo "M" pulsing */}
        <svg
          viewBox="0 0 100 100"
          className="relative h-11 w-11 text-orange-500 animate-pulse drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M10 85 V20 L35 55 L50 35 L65 55 L90 20 V85 H70 V45 L50 75 L30 45 V85 Z" />
        </svg>
      </div>

      {/* Quote display with smooth pulse */}
      <p className="max-w-xs text-sm font-medium tracking-wide text-neutral-300 md:text-base animate-pulse px-2">
        {quote || LOADING_QUOTES.es[0]}
      </p>

      {/* Stylized small loading indicator bar */}
      <div className="mt-4 h-1 w-24 overflow-hidden rounded-full bg-white/5">
        <div className="h-full w-1/2 animate-shimmer rounded-full bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
      </div>
    </div>
  );
}
