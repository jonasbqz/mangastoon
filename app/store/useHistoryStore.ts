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
  reset: () => void;
};

const MAX_HISTORY_ITEMS = 20;

/** Strip the "lc-" prefix so local IDs match DB IDs regardless of format. */
const cleanId = (id: string) => (id.startsWith("lc-") ? id.substring(3) : id);

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

        // Save locally only — DB persistence is handled by syncWithServer()
        // which runs on every page load when the user is authenticated.
        // Calling addHistoryAction here fails with 'unauthenticated' during
        // client-side chapter navigation because Next.js doesn't forward
        // auth cookies properly in Server Action POSTs after router.push().
        set((state) => {
          const itemCleanId = cleanId(item.mangaId);
          const withoutCurrentManga = state.history.filter(
            (historyItem) =>
              cleanId(historyItem.mangaId) !== itemCleanId &&
              historyItem.mangaTitle.toLowerCase().trim() !== item.mangaTitle.toLowerCase().trim()
          );

          return {
            history: [item, ...withoutCurrentManga].slice(0, MAX_HISTORY_ITEMS),
          };
        });
      },

      removeHistory: async (mangaId) => {
        const targetCleanId = cleanId(mangaId);
        // 1. Local update
        set((state) => ({
          history: state.history.filter((historyItem) => cleanId(historyItem.mangaId) !== targetCleanId),
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

          const dbHistory: ReadingHistoryItem[] = res.history || [];
          const localHistory = get().history;

          // Merge local and server history, normalizing lc- prefix:
          const mergedMap = new Map<string, ReadingHistoryItem>();

          // Seed with DB entries
          for (const dbItem of dbHistory) {
            mergedMap.set(cleanId(dbItem.mangaId), dbItem);
          }

          // Merge local entries — upload missing or newer items to DB
          for (const localItem of localHistory) {
            const key = cleanId(localItem.mangaId);
            const existing = mergedMap.get(key);

            if (!existing) {
              // Local item not in DB → upload it
              try {
                await addHistoryAction(localItem);
              } catch { /* non-critical */ }
              mergedMap.set(key, localItem);
            } else if (localItem.timestamp > existing.timestamp) {
              // Local is newer → update DB
              try {
                await addHistoryAction(localItem);
              } catch { /* non-critical */ }
              mergedMap.set(key, localItem);
            }
          }

          // Sort descending by timestamp and slice to MAX_HISTORY_ITEMS
          const mergedList = Array.from(mergedMap.values())
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, MAX_HISTORY_ITEMS);

          set({ history: mergedList });
        } catch (err) {
          console.error("[useHistoryStore] syncWithServer error:", err);
        }
      },

      reset: () => {
        set({ history: [] });
      },
    }),
    { name: "mangastoon-reading-history" }
  )
);

