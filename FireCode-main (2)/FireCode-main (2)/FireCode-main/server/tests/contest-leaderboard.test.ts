import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Contest Leaderboard & Ranking Algorithm Suite", () => {
    interface SubTest {
        userId: string;
        username: string;
        problemSlug: string;
        status: string;
        submittedAt: Date;
    }

    function calculateLeaderboard(startTimeMs: number, submissions: SubTest[]) {
        interface UserProbState {
            solved: boolean;
            solveTimeMins: number;
            wrongAttemptsBeforeSolve: number;
            lastAcTimeMs: number;
        }

        interface UserState {
            username: string;
            problems: Record<string, UserProbState>;
        }

        const userMap: Record<string, UserState> = {};

        for (const sub of submissions) {
            const uKey = sub.userId;
            if (!userMap[uKey]) {
                userMap[uKey] = { username: sub.username, problems: {} };
            }

            const pSlug = sub.problemSlug;
            if (!userMap[uKey].problems[pSlug]) {
                userMap[uKey].problems[pSlug] = {
                    solved: false,
                    solveTimeMins: 0,
                    wrongAttemptsBeforeSolve: 0,
                    lastAcTimeMs: 0
                };
            }

            const probState = userMap[uKey].problems[pSlug];

            if (probState.solved) continue;

            if (sub.status === "Accepted") {
                probState.solved = true;
                const subTimeMs = sub.submittedAt.getTime();
                probState.solveTimeMins = Math.max(0, Math.floor((subTimeMs - startTimeMs) / 60000));
                probState.lastAcTimeMs = subTimeMs;
            } else if (sub.status !== "Compilation Error") {
                probState.wrongAttemptsBeforeSolve += 1;
            }
        }

        const leaderboard = Object.values(userMap).map(u => {
            let solvedCount = 0;
            let totalPenalty = 0;
            let maxAcTimeMs = 0;

            for (const pState of Object.values(u.problems)) {
                if (pState.solved) {
                    solvedCount += 1;
                    totalPenalty += pState.solveTimeMins + (pState.wrongAttemptsBeforeSolve * 20);
                    if (pState.lastAcTimeMs > maxAcTimeMs) {
                        maxAcTimeMs = pState.lastAcTimeMs;
                    }
                }
            }

            return {
                username: u.username,
                solvedCount,
                penalty: totalPenalty,
                score: solvedCount * 100,
                maxAcTimeMs
            };
        });

        leaderboard.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.penalty !== b.penalty) return a.penalty - b.penalty;
            return a.maxAcTimeMs - b.maxAcTimeMs;
        });

        return leaderboard;
    }

    it("should calculate zero penalty for unsolved problems", () => {
        const start = new Date("2026-07-26T10:00:00Z").getTime();
        const subs: SubTest[] = [
            { userId: "u1", username: "alice", problemSlug: "p1", status: "Wrong Answer", submittedAt: new Date("2026-07-26T10:05:00Z") },
            { userId: "u1", username: "alice", problemSlug: "p1", status: "Time Limit Exceeded", submittedAt: new Date("2026-07-26T10:10:00Z") },
        ];

        const lb = calculateLeaderboard(start, subs);
        assert.equal(lb.length, 1);
        assert.equal(lb[0].solvedCount, 0);
        assert.equal(lb[0].penalty, 0); // Unsolved problem adds 0 penalty!
    });

    it("should exclude Compilation Error from wrong attempts penalty", () => {
        const start = new Date("2026-07-26T10:00:00Z").getTime();
        const subs: SubTest[] = [
            { userId: "u1", username: "alice", problemSlug: "p1", status: "Compilation Error", submittedAt: new Date("2026-07-26T10:05:00Z") },
            { userId: "u1", username: "alice", problemSlug: "p1", status: "Accepted", submittedAt: new Date("2026-07-26T10:10:00Z") },
        ];

        const lb = calculateLeaderboard(start, subs);
        assert.equal(lb[0].solvedCount, 1);
        // Solve time: 10 mins. Compilation error adds 0 penalty. Total penalty: 10 mins.
        assert.equal(lb[0].penalty, 10);
    });

    it("should calculate 20 min penalty ONLY for wrong attempts BEFORE AC", () => {
        const start = new Date("2026-07-26T10:00:00Z").getTime();
        const subs: SubTest[] = [
            { userId: "u1", username: "alice", problemSlug: "p1", status: "Wrong Answer", submittedAt: new Date("2026-07-26T10:05:00Z") },
            { userId: "u1", username: "alice", problemSlug: "p1", status: "Accepted", submittedAt: new Date("2026-07-26T10:15:00Z") },
            // Extra attempt after AC should be ignored
            { userId: "u1", username: "alice", problemSlug: "p1", status: "Wrong Answer", submittedAt: new Date("2026-07-26T10:20:00Z") },
        ];

        const lb = calculateLeaderboard(start, subs);
        assert.equal(lb[0].solvedCount, 1);
        // Solve time: 15 mins. Wrong attempt before AC: 1. Total penalty: 15 + 20 = 35 mins.
        assert.equal(lb[0].penalty, 35);
    });

    it("should break ties on maxAcTimeMs ONLY when score and penalty are truly equal", () => {
        const start = new Date("2026-07-26T10:00:00Z").getTime();
        const subs: SubTest[] = [
            // Alice: solves p1 at T+5 (5 min) and p2 at T+20 (20 min) → penalty=25, maxAc=T+20
            { userId: "u1", username: "alice", problemSlug: "p1", status: "Accepted", submittedAt: new Date("2026-07-26T10:05:00Z") },
            { userId: "u1", username: "alice", problemSlug: "p2", status: "Accepted", submittedAt: new Date("2026-07-26T10:20:00Z") },
            // Bob: solves p1 at T+10 (10min) and p2 at T+15 (15 min) → penalty=25, maxAc=T+15
            { userId: "u2", username: "bob",   problemSlug: "p1", status: "Accepted", submittedAt: new Date("2026-07-26T10:10:00Z") },
            { userId: "u2", username: "bob",   problemSlug: "p2", status: "Accepted", submittedAt: new Date("2026-07-26T10:15:00Z") },
        ];

        const lb = calculateLeaderboard(start, subs);
        assert.equal(lb.length, 2);

        const aliceEntry = lb.find(u => u.username === "alice")!;
        const bobEntry   = lb.find(u => u.username === "bob")!;

        // Both solved 2 problems → score=200. Penalty: Alice=5+20=25, Bob=10+15=25. EQUAL.
        assert.equal(aliceEntry.score,   200);
        assert.equal(bobEntry.score,     200);
        assert.equal(aliceEntry.penalty, 25);
        assert.equal(bobEntry.penalty,   25);

        // Tiebreak goes to maxAcTimeMs — Bob's last AC was at T+15 (earlier), Alice's at T+20
        assert.equal(lb[0].username, "bob");   // Bob wins — finished earlier
        assert.equal(lb[1].username, "alice");
    });
});
