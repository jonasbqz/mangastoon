"use client";

import React, { useState, useEffect, useRef } from "react";
import { ListPlus, Check, Plus, Loader2, Globe, Lock, X } from "lucide-react";
import { createClient } from "../../utils/supabase/client";
import { 
  getMangaListsWithStatus, 
  addMangaToListAction, 
  removeMangaFromListAction,
  createMangaListAction
} from "../actions/lists";
import AuthModal from "./AuthModal";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface AddToListButtonProps {
  mangaId: string;
  mangaTitle: string;
  coverImage: string | null;
  language: "es" | "en" | "pt";
}

const COPY = {
  es: {
    addToList: "Agregar a lista",
    createList: "Crear nueva lista",
    listName: "Nombre de la lista",
    listDescription: "Descripción (opcional)",
    public: "Pública (se comparte en la comunidad)",
    private: "Privada (solo tú puedes verla)",
    save: "Crear Lista",
    loading: "Cargando...",
    noLists: "No tienes listas creadas.",
    added: "Agregado a la lista",
    removed: "Eliminado de la lista",
    successCreated: "Lista creada con éxito",
  },
  en: {
    addToList: "Add to list",
    createList: "Create new list",
    listName: "List name",
    listDescription: "Description (optional)",
    public: "Public (shared in the community)",
    private: "Private (only you can see it)",
    save: "Create List",
    loading: "Loading...",
    noLists: "You have no lists created.",
    added: "Added to list",
    removed: "Removed from list",
    successCreated: "List created successfully",
  },
  pt: {
    addToList: "Adicionar à lista",
    createList: "Criar nova lista",
    listName: "Nome da lista",
    listDescription: "Descrição (opcional)",
    public: "Pública (compartilhada na comunidade)",
    private: "Privada (só você pode ver)",
    save: "Criar Lista",
    loading: "Carregando...",
    noLists: "Você não tem listas criadas.",
    added: "Adicionado à lista",
    removed: "Removido da lista",
    successCreated: "Lista criada com sucesso",
  }
};

export default function AddToListButton({ mangaId, mangaTitle, coverImage, language }: AddToListButtonProps) {
  const t = COPY[language] || COPY.es;
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [lists, setLists] = useState<any[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [processingListId, setProcessingListId] = useState<string | null>(null);
  
  // Formulario de nueva lista
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [newListPublic, setNewListPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setAuthLoaded(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Cargar listas y estado cuando se abre el panel
  useEffect(() => {
    if (!isOpen || !user) return;

    async function loadListsStatus() {
      setLoadingLists(true);
      try {
        const res = await getMangaListsWithStatus(mangaId);
        if (res.lists) {
          setLists(res.lists);
        }
      } catch (err) {
        console.error("Error fetching list status:", err);
      } finally {
        setLoadingLists(false);
      }
    }

    loadListsStatus();
  }, [isOpen, user, mangaId]);

  // Cerrar al hacer click afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCreateForm(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleButtonClick = () => {
    if (!authLoaded) return;
    if (!user) {
      setIsAuthModalOpen(true);
    } else {
      setIsOpen(!isOpen);
    }
  };

  const handleToggleMangaInList = async (listId: string, hasManga: boolean) => {
    setProcessingListId(listId);
    try {
      if (hasManga) {
        // Quitar de la lista
        const res = await removeMangaFromListAction(listId, mangaId);
        if (res.success) {
          setLists(prev => prev.map(l => l.id === listId ? { ...l, has_manga: false } : l));
          toast.success(t.removed);
        } else {
          toast.error(res.error || "Error");
        }
      } else {
        // Agregar a la lista
        const res = await addMangaToListAction(listId, mangaId, mangaTitle, coverImage);
        if (res.success) {
          setLists(prev => prev.map(l => l.id === listId ? { ...l, has_manga: true } : l));
          toast.success(t.added);
        } else {
          toast.error(res.error || "Error");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al procesar");
    } finally {
      setProcessingListId(null);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    setCreating(true);
    try {
      const res = await createMangaListAction(newListName, newListDesc, newListPublic);
      if (res.success) {
        toast.success(t.successCreated);
        setNewListName("");
        setNewListDesc("");
        setShowCreateForm(false);
        // Recargar la lista de carpetas
        const updated = await getMangaListsWithStatus(mangaId);
        if (updated.lists) {
          setLists(updated.lists);
        }
      } else {
        toast.error(res.error || "Error");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al crear lista");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={handleButtonClick}
        className="flex items-center justify-center transition-all duration-300 active:scale-95 w-full
          md:flex-row md:gap-2 md:rounded-xl md:border md:border-white/5 md:bg-white/[0.03] md:px-4 md:py-2.5 md:text-sm md:font-heading md:font-bold md:shadow-md
          flex-col gap-1 py-2.5 text-[10px] font-bold border-transparent bg-transparent text-gray-400
          hover:text-orange-500 md:hover:border-orange-500/30 md:hover:bg-orange-500/10"
      >
        <ListPlus className="h-5 w-5 md:h-4.5 md:w-4.5" />
        <span className="md:hidden block truncate w-full text-center">Listas</span>
        <span className="hidden md:inline">{t.addToList}</span>
      </button>

      <AnimatePresence>
        {isOpen && user && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 right-0 z-50 mt-2 max-h-[360px] overflow-y-auto rounded-2xl border border-white/5 bg-[#141519]/95 p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3">
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-orange-500">
                {t.addToList}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowCreateForm(false);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {!showCreateForm ? (
              <div className="flex flex-col gap-1.5">
                {loadingLists ? (
                  <div className="flex flex-col items-center justify-center py-6 text-gray-400 gap-2">
                    <Loader2 size={20} className="animate-spin text-orange-500" />
                    <span className="text-xs">{t.loading}</span>
                  </div>
                ) : lists.length === 0 ? (
                  <div className="py-4 text-center text-xs text-gray-500">
                    <p className="mb-3">{t.noLists}</p>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 text-xs font-semibold text-orange-500 hover:bg-orange-500 hover:text-black transition-all"
                    >
                      <Plus size={14} />
                      {t.createList}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto pr-1">
                      {lists.map((list) => (
                        <button
                          key={list.id}
                          type="button"
                          disabled={processingListId === list.id}
                          onClick={() => handleToggleMangaInList(list.id, list.has_manga)}
                          className={`flex items-center justify-between rounded-lg p-2.5 text-left text-xs transition-colors hover:bg-white/[0.04] disabled:opacity-50 ${
                            list.has_manga ? "text-orange-500 font-semibold" : "text-gray-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {list.is_public ? (
                              <Globe size={14} className="text-gray-500 shrink-0" />
                            ) : (
                              <Lock size={14} className="text-gray-500 shrink-0" />
                            )}
                            <span className="truncate">{list.name}</span>
                          </div>
                          {processingListId === list.id ? (
                            <Loader2 size={14} className="animate-spin text-orange-500" />
                          ) : list.has_manga ? (
                            <Check size={16} className="text-orange-500" />
                          ) : null}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCreateForm(true)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 p-2.5 text-xs font-semibold text-orange-500 hover:bg-orange-500/5 transition-all"
                    >
                      <Plus size={14} />
                      {t.createList}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <form onSubmit={handleCreateList} className="flex flex-col gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    {t.listName}
                  </label>
                  <input
                    type="text"
                    required
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="Ej. Favoritos de Romance"
                    className="w-full rounded-xl border border-white/5 bg-black/40 px-3.5 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-orange-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    {t.listDescription}
                  </label>
                  <textarea
                    value={newListDesc}
                    onChange={(e) => setNewListDesc(e.target.value)}
                    placeholder="Ej. Mis mangas favoritos del género romance y recuentos de la vida."
                    rows={2}
                    className="w-full rounded-xl border border-white/5 bg-black/40 px-3.5 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-orange-500/50 resize-none"
                  />
                </div>

                <div className="flex flex-col gap-2 border-t border-white/5 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-gray-300">
                    <input
                      type="radio"
                      checked={newListPublic}
                      onChange={() => setNewListPublic(true)}
                      className="accent-orange-500"
                    />
                    <div className="flex items-center gap-1">
                      <Globe size={12} className="text-gray-500" />
                      <span>{t.public}</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-gray-300">
                    <input
                      type="radio"
                      checked={!newListPublic}
                      onChange={() => setNewListPublic(false)}
                      className="accent-orange-500"
                    />
                    <div className="flex items-center gap-1">
                      <Lock size={12} className="text-gray-500" />
                      <span>{t.private}</span>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                  >
                    Atrás
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newListName.trim()}
                    className="rounded-xl bg-orange-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-orange-600 disabled:opacity-50 transition-colors"
                  >
                    {creating ? t.loading : t.save}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal open={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
