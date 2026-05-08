"use client";

import { useState } from "react";

export default function SynopsisBlock({
  title,
  content,
  expandLabel,
  collapseLabel,
}: {
  title: string;
  content: string;
  expandLabel: string;
  collapseLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > 280;

  return (
    <section className="mt-6 rounded-xl bg-[#141519] p-5 sm:p-6">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <div className="mt-4">
        <p className={`text-base leading-[1.65] text-gray-300 ${!expanded && isLong ? "line-clamp-3" : ""}`}>
          {content}
        </p>

        {isLong ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="mt-4 text-sm font-semibold text-orange-400 transition-colors hover:text-orange-300"
          >
            {expanded ? collapseLabel : expandLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}
