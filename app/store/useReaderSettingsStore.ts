"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ReadingMode = "vertical" | "horizontal";
export type PageSize = "small" | "medium" | "large" | "full";

type ReaderSettingsState = {
  readingMode: ReadingMode;
  setReadingMode: (mode: ReadingMode) => void;
  pageSize: PageSize;
  setPageSize: (size: PageSize) => void;
  gaplessMode: boolean;
  setGaplessMode: (enabled: boolean) => void;
  doublePageSpread: boolean;
  setDoublePageSpread: (enabled: boolean) => void;
};

export const useReaderSettingsStore = create<ReaderSettingsState>()(
  persist(
    (set) => ({
      readingMode: "vertical",
      setReadingMode: (mode) => set({ readingMode: mode }),
      pageSize: "medium",
      setPageSize: (size) => set({ pageSize: size }),
      gaplessMode: false,
      setGaplessMode: (enabled) => set({ gaplessMode: enabled }),
      doublePageSpread: false,
      setDoublePageSpread: (enabled) => set({ doublePageSpread: enabled }),
    }),
    { name: "mangastoon-reader-settings" }
  )
);
