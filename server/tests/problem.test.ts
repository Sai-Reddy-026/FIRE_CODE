import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeStreaks, getPointsForDifficulty, toDateStr } from "../services/problem.service";

describe("Problem & Activity Logic Suite", () => {
    it("should calculate correct reward points for difficulties", () => {
        assert.equal(getPointsForDifficulty("easy"), 10);
        assert.equal(getPointsForDifficulty("medium"), 25);
        assert.equal(getPointsForDifficulty("hard"), 50);
        assert.equal(getPointsForDifficulty("unknown"), 10);
    });

    it("should compute daily streaks accurately", () => {
        const today = new Date();
        const todayStr = toDateStr(today);

        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = toDateStr(yesterday);

        const dayBefore = new Date(today);
        dayBefore.setDate(today.getDate() - 2);
        const dayBeforeStr = toDateStr(dayBefore);

        const dates = [dayBeforeStr, yesterdayStr, todayStr];
        const { current, longest } = computeStreaks(dates);

        assert.equal(current, 3);
        assert.equal(longest, 3);
    });

    it("should handle empty streak dates without crashing", () => {
        const { current, longest } = computeStreaks([]);
        assert.equal(current, 0);
        assert.equal(longest, 0);
    });
});
