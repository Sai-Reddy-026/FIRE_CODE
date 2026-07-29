import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { requestTracing } from "../middlewares/tracing";
import { classifyError } from "../middlewares/error";
import { metricsRegistry } from "../utils/metrics";
import { HealthController } from "../controllers/health.controller";

function createMockReqRes() {
    const headers: Record<string, string | number> = {};
    const reqHeaders: Record<string, string> = {};
    let statusCode = 200;
    let jsonBody: any = null;
    let isNextCalled = false;
    const finishListeners: Array<() => void> = [];

    const req: any = {
        headers: reqHeaders,
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
        method: "GET",
        originalUrl: "/api/health",
        url: "/api/health",
    };

    const res: any = {
        setHeader(name: string, value: string | number) {
            headers[name.toLowerCase()] = value;
        },
        status(code: number) {
            statusCode = code;
            return res;
        },
        json(data: any) {
            jsonBody = data;
            return res;
        },
        on(event: string, fn: () => void) {
            if (event === "finish") {
                finishListeners.push(fn);
            }
        },
        emitFinish() {
            finishListeners.forEach((fn) => fn());
        },
    };

    const next = () => {
        isNextCalled = true;
    };

    return { req, res, next, headers, getStatusCode: () => statusCode, getJsonBody: () => jsonBody, isNextCalled: () => isNextCalled };
}

describe("SRE & Production Observability Suite", () => {
    beforeEach(() => {
        metricsRegistry.reset();
    });

    it("should generate X-Request-ID header and propagate tracing context", () => {
        const ctx = createMockReqRes();
        requestTracing(ctx.req, ctx.res, ctx.next);

        assert.equal(ctx.isNextCalled(), true);
        assert.ok(ctx.headers["x-request-id"] !== undefined);
        assert.ok(typeof ctx.headers["x-request-id"] === "string");
        assert.ok((ctx.headers["x-request-id"] as string).length > 10);
    });

    it("should correctly classify production error types", () => {
        assert.equal(classifyError({ name: "ValidationError", message: "Invalid email" }), "VALIDATION_ERROR");
        assert.equal(classifyError({ name: "CastError", message: "Cast to ObjectId failed" }), "DATABASE_ERROR");
        assert.equal(classifyError({ message: "connect ECONNREFUSED 127.0.0.1:6379" }), "REDIS_ERROR");
        assert.equal(classifyError({ message: "Judge0 sandbox timeout" }), "JUDGE0_ERROR");
        assert.equal(classifyError({ message: "BullMQ queue connection failed" }), "QUEUE_ERROR");
        assert.equal(classifyError({ message: "Google OAuth exchange failed" }), "OAUTH_ERROR");
        assert.equal(classifyError({ message: "jwt expired" }), "AUTH_ERROR");
        assert.equal(classifyError({ message: "Unknown unexpected error" }), "UNEXPECTED_ERROR");
    });

    it("should accurately track request, latency, and cache hit metrics", () => {
        metricsRegistry.recordRequest(200, 45, "user_1");
        metricsRegistry.recordRequest(500, 120, "user_2");
        metricsRegistry.recordCacheHit();
        metricsRegistry.recordCacheMiss();

        const summary = metricsRegistry.getSummary();
        // Deterministic assertions — state is reset before each test via beforeEach
        assert.equal(summary.totalRequests, 2);
        assert.equal(summary.activeUsersCount, 2);
        assert.equal(summary.successCount, 1);  // status 200
        assert.equal(summary.errorCount, 1);    // status 500
        assert.equal(summary.cacheHitRatio, "50.00%"); // 1 hit / (1 hit + 1 miss)
    });

    it("should return production health status object suitable for load balancers", async () => {
        const ctx = createMockReqRes();
        await HealthController.getHealth(ctx.req, ctx.res);

        assert.equal(ctx.getStatusCode() === 200 || ctx.getStatusCode() === 503, true);
        const body = ctx.getJsonBody();
        assert.ok(body.status !== undefined);
        assert.ok(body.system !== undefined);
        assert.ok(body.services !== undefined);
        assert.ok(body.metrics !== undefined);
        assert.ok(typeof body.uptimeSeconds === "number");
    });
});
