"use client";

import { Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ShareButtonProps = {
  title: string;
  text?: string;
  url?: string;
  variant?: "inline" | "compact" | "icon";
  label?: string;
};

export default function ShareButton({ title, text, url, variant = "inline", label }: ShareButtonProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const handleShare = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const shareUrl = url || window.location.href;
    const shareTitle = title || "LectorFenix";
    const shareText = text || `¡Lee ${shareTitle} en LectorFenix!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Error sharing:", err);
          fallbackCopy(shareUrl);
        }
      }
    } else {
      fallbackCopy(shareUrl);
    }
  };

  const fallbackCopy = (shareUrl: string) => {
    navigator.clipboard.writeText(shareUrl).then(
      () => {
        toast.success("¡Enlace copiado al portapapeles!", {
          description: "Ya puedes compartirlo con tus amigos.",
        });
      },
      (err) => {
        console.error("Failed to copy URL:", err);
        toast.error("No se pudo copiar el enlace.");
      }
    );
  };

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleShare}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-gray-300
          hover:text-white hover:border-white/20 hover:bg-white/10 active:scale-95 transition-all duration-300 w-full"
      >
        <Share2 className="h-4 w-4 md:h-4.5 md:w-4.5" />
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleShare}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-gray-300 transition-all hover:bg-white/10 hover:text-white hover:border-white/20 active:scale-95 cursor-pointer w-full"
      >
        <Share2 className="h-3.5 w-3.5" />
        <span className="hidden md:inline">{label ?? "Compartir"}</span>
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        aria-label={label ?? "Compartir"}
        onClick={handleShare}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-gray-400 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400 transition-colors shrink-0"
      >
        <Share2 className="h-4.5 w-4.5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={label ?? "Compartir"}
      onClick={handleShare}
      className="rounded-full p-2 backdrop-blur-md transition-all border bg-black/50 border-white/10 text-white hover:bg-white/10 hover:border-white/30"
    >
      <Share2 size={16} className="hover:scale-105 transition-transform" />
    </button>
  );
}
