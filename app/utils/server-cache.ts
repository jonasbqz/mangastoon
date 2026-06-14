import { logger } from "./logger";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type UpstashResponse<T> = {
  result?: T | null;
  error?: string;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const pendingCache = new Map<string, Promise<unknown>>();
const MAX_MEMORY_ENTRIES = 500;
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisEnabled = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

function pruneMemoryCache() {
  if (memoryCache.size <= MAX_MEMORY_ENTRIES) return;

  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now || memoryCache.size > MAX_MEMORY_ENTRIES) {
      memoryCache.delete(key);
    }
  }
}

function getMemory<T>(key: string) {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;

  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }

  return entry.value;
}

function setMemory<T>(key: string, value: T, ttlSeconds: number) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
  pruneMemoryCache();
}

async function redisCommand<T>(command: unknown[]) {
  if (!redisEnabled) return null;

  try {
    const response = await fetch(`${UPSTASH_URL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as UpstashResponse<T>;
    if (payload.error) {
      logger.warn("Redis cache command failed", payload.error);
      return null;
    }

    return payload.result ?? null;
  } catch (error) {
    logger.warn("Redis cache unavailable", error);
    return null;
  }
}

async function getRedis<T>(key: string) {
  const raw = await redisCommand<string>(["GET", key]);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function setRedis<T>(key: string, value: T, ttlSeconds: number) {
  await redisCommand(["SET", key, JSON.stringify(value), "EX", ttlSeconds]);
}

export function stableCacheKey(prefix: string, parts: Array<string | number | null | undefined>) {
  return [prefix, ...parts.map((part) => encodeURIComponent(String(part ?? "")))].join(":");
}

export async function getCached<T>(key: string) {
  const memoryValue = getMemory<T>(key);
  if (memoryValue !== null) return memoryValue;

  const redisValue = await getRedis<T>(key);
  if (redisValue !== null) {
    // Keep Redis hits hot in memory for a short period.
    setMemory(key, redisValue, 60);
    return redisValue;
  }

  return null;
}

export async function getCachedMulti<T>(keys: string[]): Promise<Record<string, T | null>> {
  const results: Record<string, T | null> = {};
  const missingKeys: string[] = [];

  // 1. Check memory cache first
  for (const key of keys) {
    const mem = getMemory<T>(key);
    if (mem !== null) {
      results[key] = mem;
    } else {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length === 0) return results;

  // 2. Fetch missing keys from Redis via Pipeline
  if (redisEnabled) {
    try {
      const commands = missingKeys.map((key) => ["GET", key]);
      const response = await fetch(`${UPSTASH_URL}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commands),
        cache: "no-store",
      });

      if (response.ok) {
        const payloads = (await response.json()) as Array<{ result?: string | null; error?: string }>;
        if (Array.isArray(payloads)) {
          payloads.forEach((payload, idx) => {
            const key = missingKeys[idx];
            if (payload && payload.result) {
              try {
                const val = JSON.parse(payload.result) as T;
                results[key] = val;
                setMemory(key, val, 60); // cache in memory for 60s
              } catch {
                results[key] = null;
              }
            } else {
              results[key] = null;
            }
          });
        }
      }
    } catch (err) {
      logger.warn("Redis pipeline cache failed", err);
    }
  }

  // Fill in any remaining missing keys with null
  for (const key of missingKeys) {
    if (results[key] === undefined) {
      results[key] = null;
    }
  }

  return results;
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number) {
  setMemory(key, value, ttlSeconds);
  await setRedis(key, value, ttlSeconds);
}

export async function getOrSetCached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
  options?: { shouldCache?: (value: T) => boolean }
) {
  const cached = await getCached<T>(key);
  if (cached !== null) return cached;

  const pending = pendingCache.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = loader()
    .then(async (value) => {
      if (options?.shouldCache ? options.shouldCache(value) : true) {
        await setCached(key, value, ttlSeconds);
      }
      return value;
    })
    .finally(() => {
      pendingCache.delete(key);
    });

  pendingCache.set(key, promise);
  return promise;
}
