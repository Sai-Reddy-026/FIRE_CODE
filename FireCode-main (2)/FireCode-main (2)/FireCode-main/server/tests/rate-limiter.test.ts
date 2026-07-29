import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
    createRateLimiter,
    loginRateLimiter,
    runCodeRateLimiter,
    submitCodeRateLimiter,
    resetRateLimiterStores,
} from "../middlewares/security";

function createMockReqRes(options: {
    ip?: string;
    body?: any;
    user?: any;
}) {
    const headers: Record<string, string | number> = {};
    let statusCode = 200;
    let jsonBody: any = null;
    let isNextCalled = false;

    const req: any = {
        ip: options.ip || "127.0.0.1",
        socket: { remoteAddress: options.ip || "127.0.0.1" },
        body: options.body || {},
        authUser: options.user || null,
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
    };

    const next = () => {
        isNextCalled = true;
    };

    return { req, res, next, headers, getStatusCode: () => statusCode, getJsonBody: () => jsonBody, isNextCalled: () => isNextCalled };
}

describe("Distributed & Endpoint-Specific Rate Limiter Suite", () => {
    beforeEach(() => {
        resetRateLimiterStores();
    });

    it("should allow requests under the limit and set rate limit headers", async () => {
        const limiter = createRateLimiter({
            keyPrefix: "test:allowed",
            limit: 3,
            windowMs: 60000,
        });

        const ctx1 = createMockReqRes({ ip: "1.2.3.4" });
        await limiter(ctx1.req, ctx1.res, ctx1.next);

        assert.equal(ctx1.isNextCalled(), true);
        assert.equal(ctx1.getStatusCode(), 200);
        assert.equal(ctx1.headers["x-ratelimit-limit"], 3);
        assert.equal(ctx1.headers["x-ratelimit-remaining"], 2);
        assert.ok(ctx1.headers["x-ratelimit-reset"] !== undefined);
    });

    it("should enforce endpoint limit and return HTTP 429 when limit exceeded", async () => {
        const limiter = createRateLimiter({
            keyPrefix: "test:exceeded",
            limit: 2,
            windowMs: 60000,
            message: "Custom limit exceeded",
        });

        // 1st request
        const ctx1 = createMockReqRes({ ip: "10.0.0.1" });
        await limiter(ctx1.req, ctx1.res, ctx1.next);
        assert.equal(ctx1.isNextCalled(), true);

        // 2nd request
        const ctx2 = createMockReqRes({ ip: "10.0.0.1" });
        await limiter(ctx2.req, ctx2.res, ctx2.next);
        assert.equal(ctx2.isNextCalled(), true);

        // 3rd request - should be blocked
        const ctx3 = createMockReqRes({ ip: "10.0.0.1" });
        await limiter(ctx3.req, ctx3.res, ctx3.next);

        assert.equal(ctx3.isNextCalled(), false);
        assert.equal(ctx3.getStatusCode(), 429);
        assert.deepEqual(ctx3.getJsonBody(), {
            success: false,
            message: "Custom limit exceeded",
        });
        assert.equal(ctx3.headers["x-ratelimit-remaining"], 0);
        assert.ok(ctx3.headers["retry-after"] !== undefined);
    });

    it("should isolate rate limits across different key prefixes", async () => {
        const ctxRun = createMockReqRes({ user: { id: "user_abc" } });
        const ctxSubmit = createMockReqRes({ user: { id: "user_abc" } });

        // Run code rate limiter hit
        await runCodeRateLimiter(ctxRun.req, ctxRun.res, ctxRun.next);
        assert.equal(ctxRun.isNextCalled(), true);
        assert.equal(ctxRun.headers["x-ratelimit-remaining"], 9); // limit 10 - 1

        // Submit code rate limiter hit for same user should have independent counter
        await submitCodeRateLimiter(ctxSubmit.req, ctxSubmit.res, ctxSubmit.next);
        assert.equal(ctxSubmit.isNextCalled(), true);
        assert.equal(ctxSubmit.headers["x-ratelimit-remaining"], 4); // limit 5 - 1
    });

    it("should isolate login attempts by IP and username combination", async () => {
        const ctxUser1 = createMockReqRes({ ip: "192.168.1.1", body: { username: "alice" } });
        const ctxUser2 = createMockReqRes({ ip: "192.168.1.1", body: { username: "bob" } });

        // Alice hits login 5 times
        for (let i = 0; i < 5; i++) {
            const ctx = createMockReqRes({ ip: "192.168.1.1", body: { username: "alice" } });
            await loginRateLimiter(ctx.req, ctx.res, ctx.next);
            assert.equal(ctx.isNextCalled(), true);
        }

        // Alice 6th attempt should block
        const ctxAlice6 = createMockReqRes({ ip: "192.168.1.1", body: { username: "alice" } });
        await loginRateLimiter(ctxAlice6.req, ctxAlice6.res, ctxAlice6.next);
        assert.equal(ctxAlice6.getStatusCode(), 429);

        // Bob from same IP should still be allowed
        await loginRateLimiter(ctxUser2.req, ctxUser2.res, ctxUser2.next);
        assert.equal(ctxUser2.isNextCalled(), true);
    });
});
