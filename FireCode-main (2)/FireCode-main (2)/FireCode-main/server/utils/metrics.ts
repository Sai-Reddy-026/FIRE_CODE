export interface MetricsSummary {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    successRate: string;
    errorRate: string;
    avgLatencyMs: number;
    avgDbLatencyMs: number;
    avgJudgeLatencyMs: number;
    cacheHitRatio: string;
    activeUsersCount: number;
    codeSubmissions: number;
    judgeFailures: number;
    loginFailures: number;
    rateLimitViolations: number;
    oauthLogins: number;
    contestSubmissions: number;
    uptimeSeconds: number;
}

class MetricsRegistry {
    private totalRequests = 0;
    private successCount = 0;
    private errorCount = 0;
    private latencySumMs = 0;
    private latencyCount = 0;

    private dbQueryTimeSumMs = 0;
    private dbQueryCount = 0;

    private judgeExecTimeSumMs = 0;
    private judgeExecCount = 0;
    private judgeFailures = 0;

    private queueWaitTimeSumMs = 0;
    private queueProcTimeSumMs = 0;
    private queueCount = 0;

    private cacheHits = 0;
    private cacheMisses = 0;

    private activeUsers = new Set<string>();
    private codeSubmissions = 0;
    private loginFailures = 0;
    private rateLimitViolations = 0;
    private oauthLogins = 0;
    private contestSubmissions = 0;

    private startTime = Date.now();
    private securityEvents: Array<{ timestamp: string; event: string; details?: any }> = [];

    recordRequest(status: number, durationMs: number, userId?: string) {
        this.totalRequests++;
        this.latencySumMs += durationMs;
        this.latencyCount++;

        if (status >= 200 && status < 400) {
            this.successCount++;
        } else {
            this.errorCount++;
        }

        if (userId) {
            this.activeUsers.add(userId);
        }
    }

    recordDbQuery(durationMs: number) {
        this.dbQueryTimeSumMs += durationMs;
        this.dbQueryCount++;
    }

    recordJudgeExec(durationMs: number, success: boolean) {
        this.judgeExecTimeSumMs += durationMs;
        this.judgeExecCount++;
        if (!success) {
            this.judgeFailures++;
        }
    }

    recordQueueJob(waitTimeMs: number, procTimeMs: number) {
        this.queueWaitTimeSumMs += waitTimeMs;
        this.queueProcTimeSumMs += procTimeMs;
        this.queueCount++;
    }

    recordCacheHit() {
        this.cacheHits++;
    }

    recordCacheMiss() {
        this.cacheMisses++;
    }

    recordSubmission() {
        this.codeSubmissions++;
    }

    recordLoginFailure() {
        this.loginFailures++;
    }

    recordRateLimitViolation() {
        this.rateLimitViolations++;
    }

    recordOAuthLogin() {
        this.oauthLogins++;
    }

    recordContestSubmission() {
        this.contestSubmissions++;
    }

    recordSecurityEvent(event: string, details?: any) {
        const item = { timestamp: new Date().toISOString(), event, details };
        this.securityEvents.push(item);
        if (this.securityEvents.length > 100) {
            this.securityEvents.shift();
        }
    }

    getSummary(): MetricsSummary {
        const total = this.totalRequests || 1;
        const totalCache = (this.cacheHits + this.cacheMisses) || 1;
        const avgLat = this.latencyCount ? Math.round((this.latencySumMs / this.latencyCount) * 100) / 100 : 0;
        const avgDb = this.dbQueryCount ? Math.round((this.dbQueryTimeSumMs / this.dbQueryCount) * 100) / 100 : 0;
        const avgJudge = this.judgeExecCount ? Math.round((this.judgeExecTimeSumMs / this.judgeExecCount) * 100) / 100 : 0;

        return {
            totalRequests: this.totalRequests,
            successCount: this.successCount,
            errorCount: this.errorCount,
            successRate: ((this.successCount / total) * 100).toFixed(2) + "%",
            errorRate: ((this.errorCount / total) * 100).toFixed(2) + "%",
            avgLatencyMs: avgLat,
            avgDbLatencyMs: avgDb,
            avgJudgeLatencyMs: avgJudge,
            cacheHitRatio: ((this.cacheHits / totalCache) * 100).toFixed(2) + "%",
            activeUsersCount: this.activeUsers.size,
            codeSubmissions: this.codeSubmissions,
            judgeFailures: this.judgeFailures,
            loginFailures: this.loginFailures,
            rateLimitViolations: this.rateLimitViolations,
            oauthLogins: this.oauthLogins,
            contestSubmissions: this.contestSubmissions,
            uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        };
    }

    getSecurityEvents() {
        return [...this.securityEvents];
    }

    /** Reset all counters — call in beforeEach() to isolate test state */
    reset() {
        this.totalRequests = 0;
        this.successCount = 0;
        this.errorCount = 0;
        this.latencySumMs = 0;
        this.latencyCount = 0;
        this.dbQueryTimeSumMs = 0;
        this.dbQueryCount = 0;
        this.judgeExecTimeSumMs = 0;
        this.judgeExecCount = 0;
        this.judgeFailures = 0;
        this.queueWaitTimeSumMs = 0;
        this.queueProcTimeSumMs = 0;
        this.queueCount = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.activeUsers = new Set<string>();
        this.codeSubmissions = 0;
        this.loginFailures = 0;
        this.rateLimitViolations = 0;
        this.oauthLogins = 0;
        this.contestSubmissions = 0;
        this.securityEvents = [];
    }
}

export const metricsRegistry = new MetricsRegistry();
