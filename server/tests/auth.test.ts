import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

describe("Authentication & Token Suite", () => {
    const secret = "test_jwt_secret_key_123";

    it("should sign and verify valid JWT auth payload", () => {
        const payload = { id: "user_123", username: "alex", role: "user" as const };
        const token = jwt.sign(payload, secret, { expiresIn: "1h" });

        const decoded = jwt.verify(token, secret) as any;
        assert.equal(decoded.id, "user_123");
        assert.equal(decoded.username, "alex");
        assert.equal(decoded.role, "user");
    });

    it("should reject expired or corrupted tokens", () => {
        const payload = { id: "user_123", username: "alex", role: "user" };
        const token = jwt.sign(payload, secret, { expiresIn: "-1s" });

        assert.throws(() => {
            jwt.verify(token, secret);
        }, /jwt expired/);

        assert.throws(() => {
            jwt.verify("corrupted.token.value", secret);
        });
    });

    it("should enforce email verification rules for OAuth profiles", () => {
        function validateOAuthEmail(profile: { email?: string; email_verified?: boolean }) {
            if (!profile.email) throw new Error("Missing email");
            if (profile.email_verified === false) throw new Error("Unverified email");
            return true;
        }

        // Explicitly verified — always allowed
        assert.equal(validateOAuthEmail({ email: "user@example.com", email_verified: true }), true);
        // Explicitly unverified — always rejected
        assert.throws(() => validateOAuthEmail({ email: "user@example.com", email_verified: false }), /Unverified email/);
        // Missing email — rejected regardless of verification status
        assert.throws(() => validateOAuthEmail({ email_verified: true }), /Missing email/);
        // email_verified is undefined (GitHub OAuth sometimes omits this field) — should be ALLOWED
        // because we only reject when strictly === false, not when missing
        assert.equal(validateOAuthEmail({ email: "user@example.com", email_verified: undefined }), true);
    });

    it("should reject OAuth login for suspended or deactivated accounts", () => {
        function validateUserStatus(user: { isBanned: boolean; isDeleted: boolean }) {
            if (user.isDeleted) throw new Error("Account deactivated");
            if (user.isBanned) throw new Error("Account suspended");
            return true;
        }

        assert.equal(validateUserStatus({ isBanned: false, isDeleted: false }), true);
        assert.throws(() => validateUserStatus({ isBanned: true, isDeleted: false }), /Account suspended/);
        assert.throws(() => validateUserStatus({ isBanned: false, isDeleted: true }), /Account deactivated/);
    });
});
