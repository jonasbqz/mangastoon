type PdfCacheChapter = {
  number: string | number;
  images: string[];
};

type PdfCacheQuality = "high" | "medium" | "low";

type CachedPdf = {
  blob: Blob;
  filename: string;
};

const DB_NAME = "mangastoon_pdf_cache";
const STORE_NAME = "pdfs";
const DB_VERSION = 1;
const memoryCache = new Map<string, CachedPdf>();

function buildCacheKey(chapters: PdfCacheChapter[], quality: PdfCacheQuality) {
  return JSON.stringify({
    quality,
    chapters: chapters.map((chapter) => ({
      number: chapter.number,
      images: chapter.images,
    })),
  });
}

function openPdfDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readFromIndexedDb(key: string) {
  const db = await openPdfDb();

  return new Promise<CachedPdf | null>((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);

    request.onsuccess = () => resolve((request.result as CachedPdf | undefined) ?? null);
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  });
}

async function writeToIndexedDb(key: string, value: CachedPdf) {
  const db = await openPdfDb();

  return new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(value, key);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      resolve();
    };
  });
}

export const pdfCache = {
  async get(chapters: PdfCacheChapter[], quality: PdfCacheQuality): Promise<CachedPdf | null> {
    const key = buildCacheKey(chapters, quality);
    const memoryHit = memoryCache.get(key);
    if (memoryHit) return memoryHit;

    try {
      const cached = await readFromIndexedDb(key);
      if (cached) memoryCache.set(key, cached);
      return cached;
    } catch {
      return null;
    }
  },

  async set(chapters: PdfCacheChapter[], quality: PdfCacheQuality, blob: Blob, filename: string) {
    const key = buildCacheKey(chapters, quality);
    const value = { blob, filename };
    memoryCache.set(key, value);

    try {
      await writeToIndexedDb(key, value);
    } catch {
      // Memory cache is enough if persistent storage is unavailable.
    }
  },
};
