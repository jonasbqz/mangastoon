"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Heart, Flag, MoreVertical, Send, EyeOff, Eye, AlertTriangle, User, Crown, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Button from "./Button";

type Comment = {
  id: string;
  chapterId: string;
  mangaId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  userIsPremium?: boolean;
  content: string;
  isSpoiler: boolean;
  isModerated?: boolean;
  likes: string[]; // userIds
  reportedWords: number;
  reportedSpoiler: number;
  createdAt: string;
  parentId?: string | null;
};

type CommentsSectionProps = {
  chapterId?: string;
  mangaId: string;
  currentUser: any | null;
  currentProfile: any | null;
  onLoginRequired?: () => void;
};

function formatDistanceToNow(dateString: string): string {
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return "hace un momento";
    if (diffMin < 60) return `hace ${diffMin} min`;
    if (diffHr < 24) return `hace ${diffHr} hs`;
    if (diffDay === 1) return "ayer";
    if (diffDay < 7) return `hace ${diffDay} días`;

    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "hace tiempo";
  }
}

function AvatarImage({
  src,
  alt,
  fallback,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  fallback: React.ReactNode;
  className?: string;
}) {
  const [error, setError] = useState(false);

  // If the image fails to load (404, bad URL format, etc.) or doesn't exist, use the initials fallback.
  useEffect(() => {
    setError(false);
  }, [src]);

  if (error || !src) return <>{fallback}</>;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      referrerPolicy="no-referrer"
    />
  );
}

export default function CommentsSection({
  chapterId,
  mangaId,
  currentUser,
  currentProfile,
  onLoginRequired,
}: CommentsSectionProps) {
  const handleLoginRequired = useCallback(() => {
    if (onLoginRequired) {
      onLoginRequired();
    } else {
      if (typeof window !== "undefined") {
        window.location.href = `/login?redirectTo=${encodeURIComponent(window.location.pathname)}`;
      }
    }
  }, [onLoginRequired]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCommentText, setNewCommentText] = useState("");
  const [isSpoilerComment, setIsSpoilerComment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [expandedRepliesIds, setExpandedRepliesIds] = useState<Record<string, boolean>>({});
  const [replySubmitting, setReplySubmitting] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const url = chapterId 
        ? `/api/comments?chapterId=${encodeURIComponent(chapterId)}`
        : `/api/comments?mangaId=${encodeURIComponent(mangaId)}`;
      const res = await fetch(url, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) {
      console.error("[Comments] Error loading comments:", err);
    } finally {
      setLoading(false);
    }
  }, [chapterId, mangaId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Cerrar menú de reportes al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentProfile) {
      handleLoginRequired();
      return;
    }

    const text = newCommentText.trim();
    if (!text) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId: chapterId || "general",
          mangaId,
          userId: currentUser.id,
          userName: currentProfile.username || currentUser.user_metadata?.username || "Lector",
          userAvatar: currentProfile.avatar_url || currentUser.user_metadata?.avatar_url || null,
          content: text,
          isSpoiler: isSpoilerComment,
          userIsPremium: !!currentProfile?.is_premium,
        }),
      });

      if (response.ok) {
        const newComment = await response.json();
        setComments((prev) => [newComment, ...prev]);
        setNewCommentText("");
        setIsSpoilerComment(false);
        toast.success("Comentario publicado correctamente.");
      } else {
        toast.error("No se pudo publicar tu comentario.");
      }
    } catch {
      toast.error("Ocurrió un error de red al enviar el comentario.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!currentUser || !currentProfile) {
      handleLoginRequired();
      return;
    }

    const text = replyText.trim();
    if (!text) return;

    setReplySubmitting(true);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId: chapterId || "general",
          mangaId,
          userId: currentUser.id,
          userName: currentProfile.username || currentUser.user_metadata?.username || "Lector",
          userAvatar: currentProfile.avatar_url || currentUser.user_metadata?.avatar_url || null,
          content: text,
          isSpoiler: false, // Las respuestas no son marcadas como spoiler por defecto
          userIsPremium: !!currentProfile?.is_premium,
          parentId,
        }),
      });

      if (response.ok) {
        const newReply = await response.json();
        setComments((prev) => [...prev, newReply]);
        setReplyText("");
        setReplyingToId(null);
        setExpandedRepliesIds((prev) => ({ ...prev, [parentId]: true })); // Auto-expandir
        toast.success("Respuesta publicada correctamente.");
      } else {
        toast.error("No se pudo publicar tu respuesta.");
      }
    } catch {
      toast.error("Ocurrió un error de red al enviar la respuesta.");
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!currentUser) {
      handleLoginRequired();
      return;
    }

    try {
      const response = await fetch("/api/comments/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId,
          userId: currentUser.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, likes: data.likes } : c))
        );
      }
    } catch {
      toast.error("Error al registrar tu like.");
    }
  };

  const handleReportComment = async (commentId: string, type: "words" | "spoiler") => {
    try {
      const response = await fetch("/api/comments/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId,
          type,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (type === "spoiler" && data.isSpoiler) {
          // Si el reporte de spoiler forzó el spoiler, actualizamos el estado
          setComments((prev) =>
            prev.map((c) => (c.id === commentId ? { ...c, isSpoiler: true } : c))
          );
        }
        toast.success(
          type === "spoiler"
            ? "Reportado como spoiler. ¡Gracias por ayudar a la comunidad!"
            : "Reportado por vocabulario inapropiado. Revisaremos el contenido."
        );
      }
    } catch {
      toast.error("Error al enviar el reporte.");
    } finally {
      setActiveMenuId(null);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const response = await fetch(`/api/comments?commentId=${encodeURIComponent(commentId)}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        toast.success("Comentario eliminado correctamente.");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "No se pudo eliminar el comentario.");
      }
    } catch {
      toast.error("Ocurrió un error al eliminar el comentario.");
    } finally {
      setActiveMenuId(null);
    }
  };

  const toggleRevealSpoiler = (id: string) => {
    setRevealedSpoilers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div id="comments" className="mt-16 border-t border-white/5 pt-10 pb-16">
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare className="text-orange-500 h-5 w-5" />
        <h3 className="text-lg font-bold text-white tracking-tight">Comentarios ({comments.length})</h3>
      </div>

      {/* Caja de comentarios */}
      {currentUser ? (
        <form onSubmit={handleSubmitComment} className="mb-8 rounded-2xl border border-white/5 bg-white/[0.02] p-4 shadow-sm">
          <div className="flex gap-3">
            <div className={`h-10 w-10 shrink-0 overflow-hidden border transition-all ${
              currentProfile?.is_premium 
                ? "rounded-full border-amber-500/60 shadow-[0_0_8px_rgba(245,158,11,0.3)] bg-amber-500/5" 
                : "rounded-xl border-white/10 bg-white/5"
            }`}>
              <AvatarImage
                src={currentProfile?.avatar_url}
                alt="Avatar"
                className="h-full w-full object-cover"
                fallback={
                  <div className={`flex h-full w-full items-center justify-center text-xs font-bold ${
                    currentProfile?.is_premium ? "bg-amber-500/10 text-amber-400" : "bg-[#ff6b00]/10 text-[#ff6b00]"
                  }`}>
                    {getInitials(currentProfile?.username || currentUser.email || "U")}
                  </div>
                }
              />
            </div>

            <div className="flex-1">
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={chapterId ? "Escribe un comentario sobre este capítulo..." : "Escribe un comentario sobre este manga..."}
                className="w-full min-h-[90px] resize-none rounded-xl border border-white/5 bg-black/20 p-3 text-sm text-gray-200 outline-none focus:border-[#ff6b00]/40 focus:ring-1 focus:ring-[#ff6b00]/25 transition-all placeholder:text-gray-500"
                maxLength={500}
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-400 select-none hover:text-[#ff6b00] transition-colors">
                  <input
                    type="checkbox"
                    checked={isSpoilerComment}
                    onChange={(e) => setIsSpoilerComment(e.target.checked)}
                    className="h-4 w-4 rounded border-white/10 bg-black/45 text-[#ff6b00] focus:ring-0 accent-[#ff6b00]"
                  />
                  <span>¿Contiene spoilers?</span>
                </label>

                <Button
                  type="submit"
                  disabled={!newCommentText.trim()}
                  loading={submitting}
                  icon={<Send className="h-3.5 w-3.5" />}
                  className="px-4 py-2 text-xs"
                >
                  Publicar
                </Button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-8 rounded-2xl border border-[#ff6b00]/10 bg-[#ff6b00]/[0.02] p-6 text-center shadow-inner">
          <User className="mx-auto h-8 w-8 text-[#ff6b00]/50 mb-3" />
          <h4 className="text-sm font-bold text-white">¿Quieres unirte al debate?</h4>
          <p className="mt-1 text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
            Inicia sesión en MangaStoon para publicar comentarios, reaccionar y reportar spoilers.
          </p>
          <Button
            type="button"
            onClick={handleLoginRequired}
            className="mt-4 px-5 py-2.5 text-xs"
          >
            Iniciar sesión
          </Button>
        </div>
      )}

      {/* Listado de comentarios */}
      {loading ? (
        <div className="flex flex-col gap-4 py-8">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-10 w-10 rounded-xl bg-white/5" />
              <div className="flex-1">
                <div className="h-4 w-32 rounded bg-white/5 mb-2" />
                <div className="h-12 w-full rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <MessageSquare className="mx-auto h-8 w-8 text-white/10 mb-3" />
          <p className="text-sm">
            {chapterId 
              ? "Todavía no hay comentarios en este capítulo." 
              : "Todavía no hay comentarios sobre este manga."}
          </p>
          <p className="mt-1 text-xs text-white/30">¡Sé el primero en dejar tu comentario!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <AnimatePresence initial={false}>
            {comments.filter((c) => !c.parentId).map((comment) => {
              const isUserLiked = currentUser && comment.likes?.includes(currentUser.id);
              const isSpoiler = comment.isSpoiler;
              const isRevealed = revealedSpoilers[comment.id];
              const isModerated = comment.isModerated;
              const isPremium = comment.userIsPremium || (currentUser && comment.userId === currentUser.id && !!currentProfile?.is_premium);

              return (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex gap-3 border-b border-white/5 pb-5 last:border-b-0 transition-all rounded-r-xl ${
                    isPremium 
                      ? "bg-gradient-to-r from-amber-500/[0.08] via-amber-500/[0.02] to-transparent border-l-[3px] border-amber-500 pl-3 pt-3 pr-2 shadow-[inset_0_0_12px_rgba(245,158,11,0.02)]" 
                      : ""
                  }`}
                >
                  {/* Avatar redondeado si es premium */}
                  <div className="relative shrink-0 select-none">
                    <div className={`h-10 w-10 overflow-hidden border transition-all ${
                      isPremium 
                        ? "rounded-full border-amber-500/60 shadow-[0_0_8px_rgba(245,158,11,0.3)] bg-amber-500/5" 
                        : "rounded-xl border-white/5 bg-white/5"
                    }`}>
                      <AvatarImage
                        src={comment.userAvatar}
                        alt={comment.userName}
                        className="h-full w-full object-cover"
                        fallback={
                          <div className={`flex h-full w-full items-center justify-center text-xs font-bold ${
                            isPremium ? "bg-amber-500/10 text-amber-400" : "bg-[#ff6b00]/10 text-[#ff6b00]"
                          }`}>
                            {getInitials(comment.userName)}
                          </div>
                        }
                      />
                    </div>
                  </div>

                  {/* Detalle */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm font-bold tracking-wide truncate max-w-[150px] ${
                          isPremium ? "premium-username-shimmer" : "text-white"
                        }`}>
                          {comment.userName}
                        </span>
                        {isPremium && (
                          <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-600 border border-yellow-300/40 shadow-[0_0_8px_rgba(245,158,11,0.2)] shrink-0" title="Premium">
                            <Crown size={9} className="text-black fill-black stroke-[1.5]" />
                          </span>
                        )}
                        <span className="text-[10px] text-gray-500 font-semibold uppercase">
                          {formatDistanceToNow(comment.createdAt)}
                        </span>
                      </div>

                      {/* Botón de reporte / eliminar */}
                      {(!isModerated || (currentUser && comment.userId === currentUser.id)) && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setActiveMenuId(activeMenuId === comment.id ? null : comment.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-white/5 hover:text-white transition-colors"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {activeMenuId === comment.id && (
                            <div
                              ref={menuRef}
                              className="absolute right-0 top-9 z-50 w-44 rounded-xl border border-white/5 bg-[#141519] p-1 shadow-2xl"
                            >
                              {currentUser && comment.userId === currentUser.id ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                >
                                  <Trash2 size={14} className="text-red-400 shrink-0" />
                                  <span>Eliminar comentario</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleReportComment(comment.id, "words")}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-gray-300 hover:bg-white/5 hover:text-[#ff6b00] transition-colors cursor-pointer"
                                  >
                                    <AlertTriangle size={14} />
                                    <span>Palabras inapropiadas</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReportComment(comment.id, "spoiler")}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-gray-300 hover:bg-white/5 hover:text-[#ff6b00] transition-colors cursor-pointer"
                                  >
                                    <EyeOff size={14} />
                                    <span>Es un spoiler</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Contenido con Spoiler overlay o moderado */}
                    <div className="mt-1 text-sm text-gray-300 leading-relaxed break-words text-left">
                      {isModerated ? (
                        <div className="rounded-xl border border-red-500/10 bg-red-500/[0.02] p-3 my-1 select-none flex items-center gap-2 text-left">
                          <AlertTriangle size={14} className="text-red-500 shrink-0" />
                          <p className="text-xs font-medium text-red-400/90 italic text-left">
                            Este comentario fue ocultado porque infringe las normas de la comunidad.
                          </p>
                        </div>
                      ) : isSpoiler && !isRevealed ? (
                        <div className="rounded-xl border border-[#ff6b00]/10 bg-[#ff6b00]/[0.02] p-3 text-center my-1 select-none">
                          <p className="text-xs font-bold text-[#ff6b00]/90 flex items-center justify-center gap-1">
                            <EyeOff size={13} />
                            <span>Comentario oculto por spoilers</span>
                          </p>
                          <button
                            type="button"
                            onClick={() => toggleRevealSpoiler(comment.id)}
                            className="mt-2 text-[10px] font-heading font-bold uppercase tracking-wider text-[#ff6b00] border border-[#ff6b00]/20 bg-[#ff6b00]/5 px-2.5 py-1.5 rounded-xl hover:bg-[#ff6b00] hover:text-black transition-all cursor-pointer"
                          >
                            Revelar spoiler
                          </button>
                        </div>
                      ) : (
                        <div className="relative text-left">
                          {isSpoiler && (
                            <span className="inline-flex items-center gap-1 rounded bg-[#ff6b00]/10 px-1.5 py-0.5 text-[9px] font-heading font-bold text-[#ff6b00] uppercase tracking-wider mb-1.5">
                              Spoiler
                            </span>
                          )}
                          <p className="text-left text-gray-200">{comment.content}</p>
                          {isSpoiler && isRevealed && (
                            <button
                              type="button"
                              onClick={() => toggleRevealSpoiler(comment.id)}
                              className="mt-2 text-[10px] font-heading font-bold text-[#ff6b00]/70 hover:text-[#ff6b00] underline block cursor-pointer text-left"
                            >
                              Ocultar spoiler
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Botones de acción */}
                    {!isModerated && (
                      <div className="flex flex-col gap-3">
                        <div className="mt-3 flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => handleLikeComment(comment.id)}
                            className={`inline-flex items-center gap-1.5 text-xs font-bold transition-all active:scale-90
                              ${isUserLiked ? "text-rose-500" : "text-gray-500 hover:text-rose-400"}`}
                          >
                            <Heart size={14} className={isUserLiked ? "fill-rose-500" : ""} />
                            <span>{comment.likes?.length || 0}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (!currentUser) {
                                handleLoginRequired();
                                return;
                              }
                              setReplyingToId(replyingToId === comment.id ? null : comment.id);
                              setReplyText("");
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-[#ff6b00] transition-colors"
                          >
                            <MessageSquare size={14} />
                            <span>Responder</span>
                          </button>
                        </div>

                        {/* Caja de respuesta inline */}
                        <AnimatePresence>
                          {replyingToId === comment.id && (
                            <motion.form
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              onSubmit={(e) => handlePostReply(e, comment.id)}
                              className="mt-2 flex gap-3 items-start"
                            >
                              <div className={`h-8 w-8 shrink-0 overflow-hidden border ${
                                currentProfile?.is_premium 
                                  ? "rounded-full border-amber-500/60 bg-amber-500/5" 
                                  : "rounded-lg border-white/10 bg-white/5"
                              }`}>
                                <AvatarImage
                                  src={currentProfile?.avatar_url}
                                  alt="Avatar"
                                  className="h-full w-full object-cover"
                                  fallback={
                                    <div className={`flex h-full w-full items-center justify-center text-[10px] font-bold ${
                                      currentProfile?.is_premium ? "bg-amber-500/10 text-amber-400" : "bg-[#ff6b00]/10 text-[#ff6b00]"
                                    }`}>
                                      {getInitials(currentProfile?.username || currentUser.email || "U")}
                                    </div>
                                  }
                                />
                              </div>
                              <div className="flex-1 relative">
                                <input
                                  type="text"
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder={`Responder a @${comment.userName}...`}
                                  className="w-full rounded-xl border border-white/5 bg-black/35 px-3 py-2 pr-10 text-xs text-gray-200 outline-none focus:border-[#ff6b00]/45 focus:ring-1 focus:ring-[#ff6b00]/25 transition-all placeholder:text-gray-500"
                                  maxLength={300}
                                  autoFocus
                                />
                                <button
                                  type="submit"
                                  disabled={!replyText.trim() || replySubmitting}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#ff6b00] disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                                >
                                  {replySubmitting ? (
                                    <Loader2 size={13} className="animate-spin" />
                                  ) : (
                                    <Send size={13} />
                                  )}
                                </button>
                              </div>
                            </motion.form>
                          )}
                        </AnimatePresence>

                        {/* Respuestas anidadas */}
                        {(() => {
                          const replies = comments.filter((c) => c.parentId === comment.id);
                          const hasReplies = replies.length > 0;
                          const isExpanded = expandedRepliesIds[comment.id];

                          if (!hasReplies) return null;

                          return (
                            <div className="mt-2.5">
                              <button
                                type="button"
                                onClick={() => setExpandedRepliesIds((prev) => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-orange-500/80 hover:text-orange-500 transition-colors select-none ml-1"
                              >
                                <span className="w-5 h-[1px] bg-white/10 inline-block mr-1"></span>
                                <span>
                                  {isExpanded 
                                    ? "Ocultar respuestas" 
                                    : `Ver ${replies.length} ${replies.length === 1 ? "respuesta" : "respuestas"}`}
                                </span>
                              </button>

                              {/* Hilo de respuestas */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-3 ml-3 sm:ml-6 flex flex-col gap-4 border-l border-white/5 pl-4"
                                  >
                                    {replies.map((reply) => {
                                      const isReplyUserLiked = currentUser && reply.likes?.includes(currentUser.id);
                                      const isReplyPremium = reply.userIsPremium || (currentUser && reply.userId === currentUser.id && !!currentProfile?.is_premium);

                                      return (
                                        <div
                                          key={reply.id}
                                          className={`flex gap-2.5 transition-all rounded-r-lg py-2 px-2.5 ${
                                            isReplyPremium 
                                              ? "bg-gradient-to-r from-amber-500/[0.04] via-amber-500/[0.01] to-transparent border-l border-amber-500/40 shadow-[inset_0_0_8px_rgba(245,158,11,0.01)]" 
                                              : ""
                                          }`}
                                        >
                                          {/* Avatar de la respuesta */}
                                          <div className="relative shrink-0 select-none">
                                            <div className={`h-8 w-8 overflow-hidden border transition-all ${
                                              isReplyPremium 
                                                ? "rounded-full border-amber-500/50 shadow-[0_0_6px_rgba(245,158,11,0.2)] bg-amber-500/5" 
                                                : "rounded-lg border-white/5 bg-white/5"
                                            }`}>
                                              <AvatarImage
                                                src={reply.userAvatar}
                                                alt={reply.userName}
                                                className="h-full w-full object-cover"
                                                fallback={
                                                  <div className={`flex h-full w-full items-center justify-center text-[10px] font-bold ${
                                                    isReplyPremium ? "bg-amber-500/10 text-amber-400" : "bg-[#ff6b00]/10 text-[#ff6b00]"
                                                  }`}>
                                                    {getInitials(reply.userName)}
                                                  </div>
                                                }
                                              />
                                            </div>
                                          </div>

                                          {/* Detalle y contenido de la respuesta */}
                                          <div className="flex-1 min-w-0 text-left">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex flex-wrap items-center gap-1.5">
                                                <span className={`text-xs font-bold tracking-wide truncate max-w-[120px] ${
                                                  isReplyPremium ? "premium-username-shimmer" : "text-white"
                                                }`}>
                                                  {reply.userName}
                                                </span>
                                                {isReplyPremium && (
                                                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border border-yellow-300/30 shrink-0">
                                                    <Crown size={7} className="text-black fill-black" />
                                                  </span>
                                                )}
                                                <span className="text-[9px] text-gray-500 font-semibold uppercase">
                                                  {formatDistanceToNow(reply.createdAt)}
                                                </span>
                                              </div>

                                              {/* Opciones de la respuesta */}
                                              {(!reply.isModerated || (currentUser && reply.userId === currentUser.id)) && (
                                                <div className="relative">
                                                  <button
                                                    type="button"
                                                    onClick={() => setActiveMenuId(activeMenuId === reply.id ? null : reply.id)}
                                                    className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-white/5 hover:text-white transition-colors"
                                                  >
                                                    <MoreVertical size={13} />
                                                  </button>

                                                  {activeMenuId === reply.id && (
                                                    <div
                                                      ref={menuRef}
                                                      className="absolute right-0 top-7 z-50 w-44 rounded-xl border border-white/5 bg-[#141519] p-1 shadow-2xl"
                                                    >
                                                      {currentUser && reply.userId === currentUser.id ? (
                                                        <button
                                                          type="button"
                                                          onClick={() => handleDeleteComment(reply.id)}
                                                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                        >
                                                          <Trash2 size={13} className="text-red-400 shrink-0" />
                                                          <span>Eliminar respuesta</span>
                                                        </button>
                                                      ) : (
                                                        <>
                                                          <button
                                                            type="button"
                                                            onClick={() => handleReportComment(reply.id, "words")}
                                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-gray-300 hover:bg-white/5 hover:text-[#ff6b00] transition-colors cursor-pointer"
                                                          >
                                                            <AlertTriangle size={13} />
                                                            <span>Palabras inapropiadas</span>
                                                          </button>
                                                          <button
                                                            type="button"
                                                            onClick={() => handleReportComment(reply.id, "spoiler")}
                                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-gray-300 hover:bg-white/5 hover:text-[#ff6b00] transition-colors cursor-pointer"
                                                          >
                                                            <EyeOff size={13} />
                                                            <span>Es un spoiler</span>
                                                          </button>
                                                        </>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>

                                            {/* Contenido */}
                                            <div className="mt-1 text-xs text-gray-300 leading-relaxed break-words text-left">
                                              {reply.isModerated ? (
                                                <p className="text-[10px] font-medium text-red-400/90 italic">
                                                  Esta respuesta fue ocultada por infringir las normas de la comunidad.
                                                </p>
                                              ) : reply.isSpoiler && !revealedSpoilers[reply.id] ? (
                                                <div className="rounded-xl border border-[#ff6b00]/10 bg-[#ff6b00]/[0.02] p-2 text-center my-0.5 select-none">
                                                  <p className="text-[10px] font-bold text-[#ff6b00]/90 flex items-center justify-center gap-1">
                                                    <EyeOff size={11} />
                                                    <span>Oculto por spoilers</span>
                                                  </p>
                                                  <button
                                                    type="button"
                                                    onClick={() => toggleRevealSpoiler(reply.id)}
                                                    className="mt-1 text-[9px] font-heading font-bold uppercase tracking-wider text-[#ff6b00] border border-[#ff6b00]/20 bg-[#ff6b00]/5 px-2 py-1 rounded-lg hover:bg-[#ff6b00] hover:text-black transition-all cursor-pointer"
                                                  >
                                                    Revelar
                                                  </button>
                                                </div>
                                              ) : (
                                                <div className="relative text-left">
                                                  {reply.isSpoiler && (
                                                    <span className="inline-block bg-[#ff6b00]/10 px-1 py-0.2 text-[8px] font-heading font-bold text-[#ff6b00] uppercase tracking-wider mb-1 rounded mr-1">
                                                      Spoiler
                                                    </span>
                                                  )}
                                                  <span className="text-gray-200">{reply.content}</span>
                                                  {reply.isSpoiler && revealedSpoilers[reply.id] && (
                                                    <button
                                                      type="button"
                                                      onClick={() => toggleRevealSpoiler(reply.id)}
                                                      className="mt-1 text-[9px] font-bold text-[#ff6b00]/70 hover:text-[#ff6b00] underline block cursor-pointer"
                                                    >
                                                      Ocultar spoiler
                                                    </button>
                                                  )}
                                                </div>
                                              )}
                                            </div>

                                            {/* Likes de la respuesta */}
                                            {!reply.isModerated && (
                                              <div className="mt-2 flex items-center gap-3">
                                                <button
                                                  type="button"
                                                  onClick={() => handleLikeComment(reply.id)}
                                                  className={`inline-flex items-center gap-1 text-[10px] font-bold transition-all active:scale-90
                                                    ${isReplyUserLiked ? "text-rose-500" : "text-gray-500 hover:text-rose-400"}`}
                                                >
                                                  <Heart size={11} className={isReplyUserLiked ? "fill-rose-500" : ""} />
                                                  <span>{reply.likes?.length || 0}</span>
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
