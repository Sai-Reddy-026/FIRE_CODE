import { AsyncLocalStorage } from "async_hooks";
import fs from "fs";
import path from "path";

export interface RequestContext {
    requestId: string;
    userId?: string;
    ip?: string;
    method?: string;
    endpoint?: string;
    startTime?: number;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

const SENSITIVE_KEYS = new Set([
    "password", "pass", "secret", "token", "authorization",
    "accesstoken", "refreshtoken", "jwt", "cookie", "key",
    "privatekey", "clientsecret", "code", "source_code"
]);

function sanitizeMeta(meta: any): any {
    if (meta === null || meta === undefined) return meta;
    if (meta instanceof Error) {
        return {
            name: meta.name,
            message: meta.message,
            stack: process.env.NODE_ENV === "development" ? meta.stack : undefined,
        };
    }
    if (typeof meta !== "object") return meta;

    if (Array.isArray(meta)) {
        return meta.map((item) => sanitizeMeta(item));
    }

    const clean: Record<string, any> = {};
    for (const key of Object.keys(meta)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.has(lowerKey)) {
            clean[key] = "[REDACTED]";
        } else if (typeof meta[key] === "object" && meta[key] !== null) {
            clean[key] = sanitizeMeta(meta[key]);
        } else {
            clean[key] = meta[key];
        }
    }
    return clean;
}

// Log File Stream & Rotation Setup
const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "firecode.log");
const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_BACKUP_FILES = 5;

function ensureLogDirectory(): void {
    try {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }
    } catch {
        // Fallback silently if filesystem is restricted
    }
}

// Async log rotation — does NOT block the event loop
async function rotateLogFileIfNeeded(): Promise<void> {
    try {
        const stats = await fs.promises.stat(LOG_FILE).catch(() => null);
        if (stats && stats.size >= MAX_LOG_SIZE_BYTES) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const rotatedPath = path.join(LOG_DIR, `firecode-${timestamp}.log`);
            await fs.promises.rename(LOG_FILE, rotatedPath);

            // Clean up old backups beyond retention limit
            const files = (await fs.promises.readdir(LOG_DIR))
                .filter((f) => f.startsWith("firecode-") && f.endsWith(".log"))
                .map((f) => path.join(LOG_DIR, f))
                .sort((a, b) => {
                    // Sort by mtime descending without blocking stat — filenames encode timestamp
                    return b.localeCompare(a);
                });

            for (let i = MAX_BACKUP_FILES; i < files.length; i++) {
                await fs.promises.unlink(files[i]).catch(() => {});
            }
        }
    } catch {
        // Silently ignore rotation errors — logging must never crash the app
    }
}

// Async file append — non-blocking
async function writeLogToFile(logJsonStr: string): Promise<void> {
    try {
        ensureLogDirectory();
        await rotateLogFileIfNeeded();
        await fs.promises.appendFile(LOG_FILE, logJsonStr + "\n", { encoding: "utf8" });
    } catch {
        // Fallback to stdout only if file write fails
    }
}

function formatLogPayload(level: string, message: string, meta?: any): Record<string, any> {
    const store = requestContextStorage.getStore();
    const payload: Record<string, any> = {
        timestamp: new Date().toISOString(),
        level,
        message,
        requestId: store?.requestId || meta?.requestId || "N/A",
        userId: store?.userId || meta?.userId || undefined,
        ip: store?.ip || meta?.ip || undefined,
        method: store?.method || meta?.method || undefined,
        endpoint: store?.endpoint || meta?.endpoint || undefined,
    };

    if (meta !== undefined) {
        payload.meta = sanitizeMeta(meta);
    }

    return payload;
}

export const logger = {
    info: (message: string, meta?: any) => {
        const payload = formatLogPayload("INFO", message, meta);
        const str = JSON.stringify(payload);
        console.log(str);
        void writeLogToFile(str); // fire-and-forget: non-blocking
    },

    warn: (message: string, meta?: any) => {
        const payload = formatLogPayload("WARN", message, meta);
        const str = JSON.stringify(payload);
        console.warn(str);
        void writeLogToFile(str);
    },

    error: (message: string, metaOrError?: any) => {
        const payload = formatLogPayload("ERROR", message, metaOrError);
        const str = JSON.stringify(payload);
        console.error(str);
        void writeLogToFile(str);
    },

    debug: (message: string, meta?: any) => {
        if (process.env.NODE_ENV === "development") {
            const payload = formatLogPayload("DEBUG", message, meta);
            const str = JSON.stringify(payload);
            console.debug(str);
            void writeLogToFile(str);
        }
    },

    security: (event: string, meta?: any) => {
        const payload = formatLogPayload("SECURITY", event, meta);
        payload.securityEvent = true;
        const str = JSON.stringify(payload);
        console.warn(str);
        void writeLogToFile(str);
    },
};
