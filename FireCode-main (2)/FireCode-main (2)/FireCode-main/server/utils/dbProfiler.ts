import mongoose from "mongoose";
import { logger } from "./logger";
import { metricsRegistry } from "./metrics";

export function initDbProfiler(): void {
    mongoose.plugin((schema: mongoose.Schema) => {
        schema.pre(/(find|findOne|count|update|save|remove|delete|aggregate)/, function (next) {
            (this as any)._startTime = Date.now();
            next();
        });

        schema.post(/(find|findOne|count|update|save|remove|delete|aggregate)/, function (res, next) {
            const startTime = (this as any)._startTime;
            if (startTime) {
                const durationMs = Date.now() - startTime;
                metricsRegistry.recordDbQuery(durationMs);

                if (durationMs > 200) {
                    const opName = (this as any).op || (this.constructor && this.constructor.name) || "query";
                    logger.warn(`SLOW_DB_QUERY [${opName}] - ${durationMs}ms`, {
                        op: opName,
                        durationMs,
                    });
                }
            }
            if (typeof next === "function") {
                next();
            }
        });
    });
}
