import mongoose from "mongoose";
import { logger } from "./logger";

/**
 * Execute multi-document database operations within a single MongoDB session transaction.
 *
 * Environment Behavior:
 * - Production (NODE_ENV === "production"):
 *   Enforces strict ACID transactions. If MongoDB is not running as a Replica Set or an error occurs,
 *   the transaction is aborted and the error is thrown immediately. Sequential fallback writes are NEVER executed.
 *
 * - Development (NODE_ENV !== "production"):
 *   Attempts session.withTransaction(). If standalone single-node MongoDB without replica set is detected,
 *   logs a warning and falls back to sequential fallback writes for seamless local development.
 */
export async function runInTransaction(
    operations: (session: mongoose.ClientSession) => Promise<void>,
    fallbackOperations?: () => Promise<void>
): Promise<void> {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            await operations(session);
        });
    } catch (err: any) {
        // MongoDB error code 20 = "Transaction numbers are only allowed on a replica set member or mongos"
        // This is the official way to detect standalone MongoDB (no replica set) in dev environments.
        // String matching on err.message is fragile as messages change between MongoDB versions.
        const isStandaloneError = err?.code === 20 || err?.message?.includes("Transaction numbers are only allowed");
        const isProduction = process.env.NODE_ENV === "production";

        if (isStandaloneError && !isProduction) {
            logger.warn(
                "[MongoDB Transaction Warning] Standalone MongoDB instance detected without Replica Set. " +
                "Falling back to sequential writes for local development."
            );
            if (fallbackOperations) {
                await fallbackOperations();
            }
        } else {
            // In production, or for non-standalone errors, rethrow immediately to prevent partial database updates.
            throw err;
        }
    } finally {
        await session.endSession();
    }
}
