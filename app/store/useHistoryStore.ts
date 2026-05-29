import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ReadingHistoryItem = {
  mangaId: string;
  mangaTitle: string;
  chapterId: string;
  chapterNumber: string;
  coverImage: string;
  timestamp: number;
};

type HistoryState = {
  history: ReadingHistoryItem[];
  addHistory: (item: ReadingHistoryItem) => void;
  removeHistory: (mangaId: string) => void;
  clearHistory: () => void;
};

const MAX_HISTORY_ITEMS = 20;

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      history: [],
      addHistory: (item) =>
        set((state) => {
          if (!item.mangaId || !item.chapterId) {
            return state;
          }

          // Reject phantom entries with the site-name fallback title
          const normalizedTitle = item.mangaTitle?.trim().toLowerCase();
          if (!normalizedTitle || normalizedTitle === "mangastoon") {
            return state;
          }

          const withoutCurrentManga = state.history.filter(
            (historyItem) =>
              historyItem.mangaId !== item.mangaId &&
              historyItem.mangaTitle.toLowerCase().trim() !== item.mangaTitle.toLowerCase().trim()
          );

          return {
            history: [item, ...withoutCurrentManga].slice(0, MAX_HISTORY_ITEMS),
          };
        }),
      removeHistory: (mangaId) =>
        set((state) => ({
          history: state.history.filter((historyItem) => historyItem.mangaId !== mangaId),
        })),
      clearHistory: () => set({ history: [] }),
    }),
    { name: "mangastoon-reading-history" }
  )
);
