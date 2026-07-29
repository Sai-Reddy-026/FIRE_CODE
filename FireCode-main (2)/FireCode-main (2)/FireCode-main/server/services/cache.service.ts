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
                        if (retries > 1) return false;
                        return 100;
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
            const keys = await this.client.keys(pattern);
            if (keys && keys.length > 0) {
                await this.client.del(keys);
            }
        } catch (err: any) {
            getLogger().error(`[Cache] Redis DEL pattern [${pattern}] error`, { error: err?.message || String(err) });
        }
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
