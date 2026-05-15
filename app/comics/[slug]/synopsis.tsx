"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function SeoSynopsis({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="mt-6 rounded-xl bg-[#141519] p-5 text-left sm:p-6">
      <div className="mb-6 inline-flex items-center gap-3">
        <span className="h-7 w-1.5 rounded-full bg-[#ff6b00]" />
        <h2 className="text-2xl font-semibold text-white">Sinopsis</h2>
      </div>

      <div className="relative">
        <div
          className={`overflow-hidden transition-all duration-500 ease-in-out ${
            isExpanded ? "max-h-[5000px]" : "max-h-[100px]"
          }`}
        >
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-gray-300 md:text-base md:leading-7">
            {description}
          </p>

          <div
            className={`overflow-hidden border-t border-white/5 text-sm leading-6 text-gray-400 transition-all duration-500 md:text-[15px] md:leading-7 ${
              isExpanded ? "mt-5 max-h-[2400px] pt-5 opacity-100" : "hidden max-h-0"
            }`}
          >
            <p>
              Est&aacute;s leyendo <strong className="font-semibold text-white">{title}</strong>{" "}
              online en MangaStoon, con una experiencia pensada para seguir cada cap&iacute;tulo sin ruido visual,
              sin saltos innecesarios y con una presentaci&oacute;n oscura que acompa&ntilde;a la lectura.
            </p>

            <p className="mt-4">
              En esta p&aacute;gina pod&eacute;s continuar <strong className="font-semibold text-white">{title}</strong>{" "}
              desde una ficha clara, revisar su sinopsis, encontrar los cap&iacute;tulos disponibles y volver cuando
              haya nuevas actualizaciones sin perder el hilo de la historia.
            </p>

            <h3 className="mt-5 flex items-center gap-2 font-semibold text-white">
              <span>{"\uD83D\uDCA1"}</span> Por qu&eacute; leer{" "}
              <strong>{title}</strong>{" "}en MangaStoon
            </h3>

            <ul className="mt-4 space-y-3">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#ff6b00]">{"\uD83D\uDCCC"}</span>
                <span>
                  <strong className="font-semibold text-gray-200">Lectura gratuita:</strong>{" "}
                  avanz&aacute; por los cap&iacute;tulos de <strong className="font-semibold text-white">{title}</strong>{" "}
                  con una navegaci&oacute;n r&aacute;pida y sin muros que interrumpan el ritmo.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#ff6b00]">{"\u26A1"}</span>
                <span>
                  <strong className="font-semibold text-gray-200">Calidad HD:</strong>{" "}
                  disfrut&aacute; mejor el arte de <strong className="font-semibold text-white">{title}</strong>{" "}
                  con im&aacute;genes n&iacute;tidas, buen contraste y una interfaz c&oacute;moda en m&oacute;vil y escritorio.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#ff6b00]">{"\uD83C\uDF10"}</span>
                <span>
                  <strong className="font-semibold text-gray-200">Descargas cuando est&eacute;n disponibles:</strong>{" "}
                  llev&aacute; <strong className="font-semibold text-white">{title}</strong>{" "}
                  con vos para leer sin conexi&oacute;n y retomar la historia a tu ritmo.
                </span>
              </li>
            </ul>

            <p className="mt-5 border-t border-white/5 pt-4 italic">
              Sumergite en <strong className="font-semibold text-white">{title}</strong>{" "}
              desde el primer cap&iacute;tulo o continu&aacute; desde el &uacute;ltimo disponible en MangaStoon.
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
            Leer menos <ChevronUp size={15} strokeWidth={2.4} />
          </>
        ) : (
          <>
            Leer mas <ChevronDown size={15} strokeWidth={2.4} />
          </>
        )}
      </button>
    </section>
  );
}
