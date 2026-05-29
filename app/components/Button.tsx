"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { C } from "../lib/colors";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
}

export default function Button({
  children,
  variant = "primary",
  loading = false,
  loadingText,
  icon,
  className = "",
  style,
  ...props
}: ButtonProps) {
  
  const baseStyles = "inline-flex items-center justify-center gap-2 rounded-xl py-3 px-5 text-sm font-heading font-bold transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100 shadow-md cursor-pointer select-none";
  
  const variants = {
    primary: "text-black hover:brightness-110 shadow-orange-500/10",
    secondary: "text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white",
    danger: "text-white hover:brightness-110",
    ghost: "bg-transparent shadow-none border-none hover:bg-white/5 text-gray-400 hover:text-white",
  };

  const inlineStyles: React.CSSProperties = {
    ...style,
    ...(variant === "primary" ? { background: `linear-gradient(135deg, ${C.accent}, ${C.accentStrong})` } : {}),
    ...(variant === "danger" ? { backgroundColor: C.danger } : {}),
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      style={inlineStyles}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-1.5">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>{loadingText || "Procesando..."}</span>
        </span>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
