"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SupportedLanguage } from "../../components/language-provider";

const COPY = {
  es: {
    heading: (title: string) => `Sinopsis de ${title}`,
    intro: (title: string) => (
      <>
        Estás leyendo <strong className="font-semibold text-white">{title}</strong>{" "}
        online en MangaStoon, con una experiencia pensada para seguir cada capítulo sin ruido visual,
        sin saltos innecesarios y con una presentación oscura que acompaña la lectura.
      </>
    ),
    details: (title: string) => (
      <>
        En esta página podés continuar <strong className="font-semibold text-white">{title}</strong>{" "}
        desde una ficha clara, revisar su sinopsis, encontrar los capítulos disponibles y volver cuando
        haya nuevas actualizaciones sin perder el hilo de la historia.
      </>
    ),
    whyRead: (title: string) => <>Por qué leer <strong>{title}</strong> en MangaStoon</>,
    freeLabel: "Lectura gratuita:",
    freeText: (title: string) => (
      <>
        avanzá por los capítulos de <strong className="font-semibold text-white">{title}</strong>{" "}
        con una navegación rápida y sin muros que interrumpan el ritmo.
      </>
    ),
    qualityLabel: "Calidad HD:",
    qualityText: (title: string) => (
      <>
        disfrutá mejor el arte de <strong className="font-semibold text-white">{title}</strong>{" "}
        con imágenes nítidas, buen contraste y una interfaz cómoda en móvil y escritorio.
      </>
    ),
    downloadsLabel: "Descargas cuando estén disponibles:",
    downloadsText: (title: string) => (
      <>
        llevá <strong className="font-semibold text-white">{title}</strong>{" "}
        con vos para leer sin conexión y retomar la historia a tu ritmo.
      </>
    ),
    closing: (title: string) => (
      <>
        Sumergite en <strong className="font-semibold text-white">{title}</strong>{" "}
        desde el primer capítulo o continuá desde el último disponible en MangaStoon.
      </>
    ),
    readLess: "Leer menos",
    readMore: "Leer más",
  },
  en: {
    heading: (title: string) => `Synopsis of ${title}`,
    intro: (title: string) => (
      <>
        You are reading <strong className="font-semibold text-white">{title}</strong>{" "}
        online on MangaStoon, with an experience designed to follow every chapter smoothly,
        without unnecessary jumps and with a dark presentation built for reading.
      </>
    ),
    details: (title: string) => (
      <>
        On this page you can continue <strong className="font-semibold text-white">{title}</strong>{" "}
        from a clear series page, review its synopsis, find available chapters and come back when
        new updates are published without losing your place in the story.
      </>
    ),
    whyRead: (title: string) => <>Why read <strong>{title}</strong> on MangaStoon</>,
    freeLabel: "Free reading:",
    freeText: (title: string) => (
      <>
        move through the chapters of <strong className="font-semibold text-white">{title}</strong>{" "}
        with fast navigation and without walls that interrupt the pace.
      </>
    ),
    qualityLabel: "HD quality:",
    qualityText: (title: string) => (
      <>
        enjoy the art of <strong className="font-semibold text-white">{title}</strong>{" "}
        with sharp images, strong contrast and a comfortable interface on mobile and desktop.
      </>
    ),
    downloadsLabel: "Downloads when available:",
    downloadsText: (title: string) => (
      <>
        take <strong className="font-semibold text-white">{title}</strong>{" "}
        with you to read offline and resume the story at your own pace.
      </>
    ),
    closing: (title: string) => (
      <>
        Dive into <strong className="font-semibold text-white">{title}</strong>{" "}
        from the first chapter or continue from the latest available chapter on MangaStoon.
      </>
    ),
    readLess: "Read less",
    readMore: "Read more",
  },
  pt: {
    heading: (title: string) => `Sinopse de ${title}`,
    intro: (title: string) => (
      <>
        Você está lendo <strong className="font-semibold text-white">{title}</strong>{" "}
        online no MangaStoon, com uma experiência pensada para acompanhar cada capítulo sem ruído visual,
        sem saltos desnecessários e com uma apresentação escura feita para leitura.
      </>
    ),
    details: (title: string) => (
      <>
        Nesta página você pode continuar <strong className="font-semibold text-white">{title}</strong>{" "}
        a partir de uma ficha clara, revisar a sinopse, encontrar os capítulos disponíveis e voltar quando
        houver novas atualizações sem perder o fio da história.
      </>
    ),
    whyRead: (title: string) => <>Por que ler <strong>{title}</strong> no MangaStoon</>,
    freeLabel: "Leitura gratuita:",
    freeText: (title: string) => (
      <>
        avance pelos capítulos de <strong className="font-semibold text-white">{title}</strong>{" "}
        com navegação rápida e sem barreiras que interrompam o ritmo.
      </>
    ),
    qualityLabel: "Qualidade HD:",
    qualityText: (title: string) => (
      <>
        aproveite melhor a arte de <strong className="font-semibold text-white">{title}</strong>{" "}
        com imagens nítidas, bom contraste e uma interface confortável no celular e no desktop.
      </>
    ),
    downloadsLabel: "Downloads quando disponíveis:",
    downloadsText: (title: string) => (
      <>
        leve <strong className="font-semibold text-white">{title}</strong>{" "}
        com você para ler offline e retomar a história no seu ritmo.
      </>
    ),
    closing: (title: string) => (
      <>
        Mergulhe em <strong className="font-semibold text-white">{title}</strong>{" "}
        desde o primeiro capítulo ou continue pelo último disponível no MangaStoon.
      </>
    ),
    readLess: "Ler menos",
    readMore: "Ler mais",
  },
};

const cleanSynopsis = (text: string) => {
  if (!text) return "";
  return text.replace(/^(?:[\[\{\(<【『].*?[\]\}\)>】』]\s*)+/g, "").trim();
};

export default function SeoSynopsis({
  title,
  description,
  language,
}: {
  title: string;
  description: string;
  language: SupportedLanguage;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const copy = COPY[language];
  const cleanedDescription = cleanSynopsis(description);

  return (
    <section className="mt-6 rounded-xl bg-[#141519] p-5 text-left sm:p-6">
      <div className="mb-6 inline-flex items-center gap-3">
        <span className="h-7 w-1.5 rounded-full bg-[#ff6b00]" />
        <h2 className="text-2xl font-semibold text-white">{copy.heading(title)}</h2>
      </div>

      <div className="relative">
        <div
          className={`overflow-hidden transition-all duration-500 ease-in-out ${
            isExpanded ? "max-h-[5000px]" : "max-h-[100px]"
          }`}
        >
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-gray-300 md:text-base md:leading-7">
            {cleanedDescription}
          </p>

          <div
            className={`overflow-hidden border-t border-white/5 text-sm leading-6 text-gray-400 transition-all duration-500 md:text-[15px] md:leading-7 ${
              isExpanded ? "mt-5 max-h-[2400px] pt-5 opacity-100" : "hidden max-h-0"
            }`}
          >
            <p>
              {copy.intro(title)}
            </p>

            <p className="mt-4">
              {copy.details(title)}
            </p>

            <h3 className="mt-5 flex items-center gap-2 font-semibold text-white">
              <span>{"\uD83D\uDCA1"}</span> {copy.whyRead(title)}
            </h3>

            <ul className="mt-4 space-y-3">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#ff6b00]">{"\uD83D\uDCCC"}</span>
                <span>
                  <strong className="font-semibold text-gray-200">{copy.freeLabel}</strong>{" "}
                  {copy.freeText(title)}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#ff6b00]">{"\u26A1"}</span>
                <span>
                  <strong className="font-semibold text-gray-200">{copy.qualityLabel}</strong>{" "}
                  {copy.qualityText(title)}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#ff6b00]">{"\uD83C\uDF10"}</span>
                <span>
                  <strong className="font-semibold text-gray-200">{copy.downloadsLabel}</strong>{" "}
                  {copy.downloadsText(title)}
                </span>
              </li>
            </ul>

            <p className="mt-5 border-t border-white/5 pt-4 italic">
              {copy.closing(title)}
            </p>
          </div>
        </div>

        {!isExpanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#141519] via-[#141519]/85 to-transparent" />
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="mt-1 inline-flex w-fit items-center gap-1 py-1 text-[15px] font-semibold text-[#ff6b00] transition-colors hover:text-orange-300"
      >
        {isExpanded ? (
          <>
            {copy.readLess} <ChevronUp size={15} strokeWidth={2.4} />
          </>
        ) : (
          <>
            {copy.readMore} <ChevronDown size={15} strokeWidth={2.4} />
          </>
        )}
      </button>
    </section>
  );
}
