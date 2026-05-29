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
    const shareTitle = title || "MangaStoon";
    const shareText = text || `¡Leé ${shareTitle} en MangaStoon!`;

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
          description: "Ya podés compartirlo con tus amigos.",
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
        className="flex items-center justify-center transition-all duration-300 active:scale-95 w-full
          md:flex-row md:gap-2.5 md:rounded-xl md:border md:py-3 md:text-sm md:font-heading md:font-semibold md:border-white/10 md:bg-white/5
          flex-col gap-1 py-2.5 text-[10px] font-bold border-transparent bg-transparent text-gray-400
          hover:text-white md:hover:border-white/20 md:hover:bg-white/10"
      >
        <Share2 className="h-5 w-5 md:h-4.5 md:w-4.5" />
        <span className="md:hidden block truncate w-full text-center">Compartir</span>
        <span className="hidden md:inline">{label ?? "Compartir"}</span>
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        aria-label={label ?? "Compartir"}
        onClick={handleShare}
        className="rounded-full p-1.5 backdrop-blur-md transition-all border bg-black/60 border-white/10 text-white hover:bg-white/10 hover:border-white/30"
      >
        <Share2 className="h-4 w-4" />
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
