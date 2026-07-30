import { createClient } from "redis";
import { metricsRegistry } from "../utils/metrics";

// Lazy import to avoid potential circular dependency (logger → cache → logger)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const getLogger = () => require("../utils/logger").logger;

class CacheService {
    private client: any = null;
    private isReady: boolean = false;

    constructor() {
        // Skip Redis connection entirely in test environments.
        // Tests don't need caching and ECONNREFUSED errors pollute test output.
        if (process.env.NODE_ENV === "test") {
            this.isReady = false;
            return;
        }

        const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
        try {
            this.client = createClient({
                url: redisUrl,
                socket: {
                    reconnectStrategy: (retries: number) => {
                        // Retry up to 5 times with exponential back-off (100ms, 200ms, 400ms, 800ms, 1600ms).
                        // Giving up after 1 retry caused permanent cache degradation on any transient Redis blip.
                        if (retries > 5) return false;
                        return Math.min(100 * Math.pow(2, retries - 1), 2000);
                    },
                },
            });

            // BUG-24 FIX: Only one "error" listener — the previous code registered two,
            // causing every error to be handled twice. The second empty handler was
            // intended to suppress raw stderr output but Redis v4 doesn't print to stderr.
            this.client.on("error", (err: any) => {
                getLogger().warn("[Cache] Redis client error", { error: err?.message || String(err) });
                this.isReady = false;
            });
            this.client.on("connect", () => {
                getLogger().info("[Cache] Redis connecting...", { url: redisUrl });
            });
            this.client.on("ready", () => {
                getLogger().info("[Cache] Redis cache connected and ready.");
                this.isReady = true;
            });

            this.client.connect().catch((err: any) => {
                getLogger().warn("[Cache] Redis connection failed, running in fallback (in-memory) mode.", { error: err?.message || String(err) });
                this.isReady = false;
            });
        } catch (e: any) {
            getLogger().error("[Cache] Redis client creation failed", { error: e?.message || String(e) });
            this.isReady = false;
        }
    }

    async get(key: string): Promise<any | null> {
        if (!this.isReady || !this.client) return null;
        try {
            const data = await this.client.get(key);
            if (data) {
                metricsRegistry.recordCacheHit();
                return JSON.parse(data);
            } else {
                metricsRegistry.recordCacheMiss();
                return null;
            }
        } catch (err: any) {
            getLogger().error(`[Cache] Redis GET error for key [${key}]`, { error: err?.message || String(err) });
            return null;
        }
    }

    async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
        if (!this.isReady || !this.client) return;
        try {
            await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
        } catch (err: any) {
            getLogger().error(`[Cache] Redis SET error for key [${key}]`, { error: err?.message || String(err) });
        }
    }

    async del(key: string): Promise<void> {
        if (!this.isReady || !this.client) return;
        try {
            await this.client.del(key);
        } catch (err: any) {
            getLogger().error(`[Cache] Redis DEL error for key [${key}]`, { error: err?.message || String(err) });
        }
    }

    async delByPattern(pattern: string): Promise<void> {
        if (!this.isReady || !this.client) return;
        try {
            // Use SCAN instead of KEYS to avoid blocking Redis on large keyspaces.
            // KEYS is O(N) and can pause Redis for hundreds of ms on a large DB.
            let cursor = 0;
            do {
                const reply = await this.client.scan(cursor, { MATCH: pattern, COUNT: 100 });
                cursor = reply.cursor;
                if (reply.keys && reply.keys.length > 0) {
                    await this.client.del(reply.keys);
                }
            } while (cursor !== 0);
        } catch (err: any) {
            getLogger().error(`[Cache] Redis DEL pattern [${pattern}] error`, { error: err?.message || String(err) });
        }
    }

    // In-flight promise map: prevents multiple concurrent requests from all missing
    // the cache and simultaneously querying the DB (thundering herd / cache stampede).
    private inflight = new Map<string, Promise<any>>();

    /**
     * Get a cached value, or compute + cache it if missing.
     * Only ONE fetcher call runs even if many requests arrive simultaneously on a cold miss.
     */
    async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T> {
        // 1. Cache hit
        const cached = await this.get(key);
        if (cached !== null) return cached as T;

        // 2. Already in-flight — return shared promise
        if (this.inflight.has(key)) {
            return this.inflight.get(key) as Promise<T>;
        }

        // 3. Start fetch, register in-flight
        const promise = (async () => {
            try {
                const value = await fetcher();
                await this.set(key, value, ttlSeconds);
                return value;
            } finally {
                this.inflight.delete(key);
            }
        })();

        this.inflight.set(key, promise);
        return promise;
    }

    async flushAll(): Promise<void> {
        if (!this.isReady || !this.client) return;
        try {
            await this.client.flushAll();
        } catch (err: any) {
            getLogger().error("[Cache] Redis FLUSHALL error", { error: err?.message || String(err) });
        }
    }

    /**
     * Atomically increment a rate-limit counter and set its TTL if it's a new key.
     *
     * BUG-12 FIX: Previous implementation used two separate commands (INCR then EXPIRE).
     * This created a TOCTOU race: if multiple workers all get count=1 simultaneously,
     * only one sets the expiry — or if the server crashes between INCR and EXPIRE, the
     * key lives forever and the rate limiter never resets.
     *
     * Fix: Use a Redis pipeline (multi-exec) to send both commands atomically.
     * We use NX (only set if not exists) on EXPIRE to avoid resetting TTL on subsequent hits.
     */
    async incrWithTtl(key: string, ttlSeconds: number): Promise<{ count: number; ttl: number } | null> {
        if (!this.isReady || !this.client) return null;
        try {
            // Pipeline: INCR + EXPIRE NX + TTL — all sent in one round-trip
            const pipeline = this.client.multi();
            pipeline.incr(key);
            pipeline.expire(key, ttlSeconds, "NX"); // NX = only set expiry if key has no TTL yet
            pipeline.ttl(key);

            const [count, , ttl] = await pipeline.exec();

            return { count: count as number, ttl: (ttl as number) > 0 ? (ttl as number) : ttlSeconds };
        } catch (err: any) {
            getLogger().error(`[Cache] Redis INCR pipeline error for key [${key}]`, { error: err?.message || String(err) });
            return null;
        }
    }

    isAvailable(): boolean {
        return this.isReady;
    }
}

export const cacheService = new CacheService();
export default cacheService;
