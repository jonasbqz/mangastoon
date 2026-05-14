"use client";

import { useState } from "react";

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
      <div className="mb-8 inline-flex items-center gap-3">
        <span className="h-7 w-1.5 rounded-full bg-[#ff6b00]" />
        <h2 className="text-2xl font-semibold text-white">Sinopsis</h2>
      </div>

      <div
        className="relative overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{ maxHeight: isExpanded ? "1400px" : "7.25rem" }}
      >
        <div className="space-y-5">
          <p className="text-[15px] leading-[1.7] text-gray-300 md:text-base md:leading-[1.75]">
            {description}
          </p>

          <div className="border-t border-white/5 pt-5 text-sm leading-6 text-gray-400 md:text-[15px] md:leading-7">
            <p>
              Si llegaste hasta aqu&iacute;, est&aacute;s en el lugar correcto para seguir{" "}
              <strong className="font-semibold text-white">{title}</strong>{" "}
              con una experiencia de lectura limpia, r&aacute;pida y pensada para que cada
              cap&iacute;tulo fluya sin distracciones. Esta fascinante historia combina tensi&oacute;n,
              evoluci&oacute;n y momentos clave que merecen leerse con comodidad.
            </p>

            <p className="mt-4">
              En MangaStoon reunimos los &uacute;ltimos cap&iacute;tulos disponibles para que puedas
              continuar este manhwa desde una sola p&aacute;gina, con una presentaci&oacute;n clara,
              estable y adaptada tanto a lectura m&oacute;vil como de escritorio.
            </p>

            <ul className="mt-4 space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#ff6b00]">&bull;</span>
                <span>
                  Lectura gratuita para avanzar cap&iacute;tulo a cap&iacute;tulo sin fricci&oacute;n.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#ff6b00]">&bull;</span>
                <span>
                  Im&aacute;genes en buena calidad para disfrutar mejor cada escena, combate y giro narrativo.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#ff6b00]">&bull;</span>
                <span>
                  Opciones de descarga en PDF cuando est&eacute;n disponibles, ideales para leer sin conexi&oacute;n.
                </span>
              </li>
            </ul>

            <p className="mt-4">
              Ahora es tu turno: explor&aacute; la evoluci&oacute;n de los personajes, descubr&iacute;
              c&oacute;mo crece el conflicto y sumergite en{" "}
              <strong className="font-semibold text-white">{title}</strong>{" "}
              desde el pr&oacute;ximo cap&iacute;tulo.
            </p>
          </div>
        </div>

        {!isExpanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#141519] to-transparent" />
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="mt-5 text-[15px] font-semibold text-[#ff6b00] transition-colors hover:text-orange-300"
      >
        {isExpanded ? "Leer menos" : "Leer mas"}
      </button>
    </section>
  );
}
