import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addHistoryAction, removeHistoryAction, clearHistoryAction, getHistoryAction } from "../actions/history";

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
  addHistory: (item: ReadingHistoryItem) => Promise<void>;
  removeHistory: (mangaId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  syncWithServer: () => Promise<void>;
};

const MAX_HISTORY_ITEMS = 20;

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      history: [],
      addHistory: async (item) => {
        if (!item.mangaId || !item.chapterId) {
          return;
        }

        // Reject phantom entries with the site-name fallback title
        const normalizedTitle = item.mangaTitle?.trim().toLowerCase();
        if (!normalizedTitle || normalizedTitle === "mangastoon") {
          return;
        }

        // 1. Local updates
        set((state) => {
          const withoutCurrentManga = state.history.filter(
            (historyItem) =>
              historyItem.mangaId !== item.mangaId &&
              historyItem.mangaTitle.toLowerCase().trim() !== item.mangaTitle.toLowerCase().trim()
          );

          return {
            history: [item, ...withoutCurrentManga].slice(0, MAX_HISTORY_ITEMS),
          };
        });

        // 2. Sync to Supabase
        try {
          await addHistoryAction(item);
        } catch (err) {
          console.error("[useHistoryStore] Failed to add reading history to Supabase:", err);
        }
      },

      removeHistory: async (mangaId) => {
        // 1. Local update
        set((state) => ({
          history: state.history.filter((historyItem) => historyItem.mangaId !== mangaId),
        }));

        // 2. Sync to Supabase
        try {
          await removeHistoryAction(mangaId);
        } catch (err) {
          console.error("[useHistoryStore] Failed to remove reading history from Supabase:", err);
        }
      },

      clearHistory: async () => {
        // 1. Local update
        set({ history: [] });

        // 2. Sync to Supabase
        try {
          await clearHistoryAction();
        } catch (err) {
          console.error("[useHistoryStore] Failed to clear reading history from Supabase:", err);
        }
      },

      syncWithServer: async () => {
        try {
          const res = await getHistoryAction();
          if (!res || res.error) {
            // Keep local history if unauthenticated/errors
            return;
          }

          const dbHistory = res.history || [];
          const localHistory = get().history;

          // Merge local and server history:
          const mergedList = [...dbHistory];

          for (const localItem of localHistory) {
            const existsInDb = dbHistory.find((dbItem) => dbItem.mangaId === localItem.mangaId);
            if (!existsInDb) {
              // Upload missing local history item to Supabase
              await addHistoryAction(localItem);
              mergedList.push(localItem);
            } else if (localItem.timestamp > existsInDb.timestamp) {
              // If local is newer, update database
              await addHistoryAction(localItem);
              const idx = mergedList.findIndex((item) => item.mangaId === localItem.mangaId);
              if (idx !== -1) {
                mergedList[idx] = localItem;
              }
            }
          }

          // Sort descending by timestamp and slice to MAX_HISTORY_ITEMS
          mergedList.sort((a, b) => b.timestamp - a.timestamp);
          
          set({ history: mergedList.slice(0, MAX_HISTORY_ITEMS) });
        } catch (err) {
          console.error("[useHistoryStore] syncWithServer error:", err);
        }
      },
    }),
    { name: "mangastoon-reading-history" }
  )
);
