import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/site/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Activity,
  CheckCircle2,
  TrendingUp,
  ArrowLeft,
  ShieldAlert,
  Code2,
  Cpu,
  BarChart3,
  Terminal,
  UserCheck,
  Calendar,
  Zap,
  PieChart,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { isLoggedIn } from "@/lib/auth";
import { useEffect } from "react";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [
      { title: "System Analytics — FireCode Admin" },
      {
        name: "description",
        content:
          "Advanced user growth, active user retention, problem solving trends, and execution telemetry for FireCode.",
      },
    ],
  }),
  component: AdminAnalyticsPage,
});

interface AnalyticsData {
  users: {
    total: number;
    today: number;
    weeklyGrowth: number;
    monthlyGrowth: number;
  };
  problems: {
    totalSolved: number;
    mostSolved: Array<{
      _id: string;
      problemId: number;
      title: string;
      slug: string;
      difficulty: string;
      successCount: number;
      submissionCount: number;
      acceptanceRate: number;
    }>;
    distribution: {
      easy: number;
      medium: number;
      hard: number;
    };
  };
  submissions: {
    total: number;
    accepted: number;
    rejected: number;
    acceptanceRate: number;
  };
  activity: {
    dailySubmissions: Record<string, number>;
  };
  languages: {
    mostUsed: Array<{
      language: string;
      count: number;
    }>;
  };
}

interface AdvancedAnalyticsData {
  userGrowthTrend: Array<{
    date: string;
    newUsers: number;
    totalUsers: number;
  }>;
  dau: number;
  mau: number;
  problemSolvingTrends: Array<{
    date: string;
    accepted: number;
    rejected: number;
    total: number;
  }>;
  difficultyPopularity: {
    easy: number;
    medium: number;
    hard: number;
  };
  retention: {
    week1Rate: number;
    week2Rate: number;
    month1Rate: number;
  };
  codingLanguageTrends: Array<{
    language: string;
    count: number;
    percentage: number;
  }>;
}

function AdminAnalyticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate({ to: "/login" });
    } else if (user && user.role !== "admin") {
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  // Standard analytics query
  const { data, isLoading, error } = useQuery<{ success: boolean; analytics: AnalyticsData }>({
    queryKey: ["admin", "analytics"],
    queryFn: () => api.get<{ success: boolean; analytics: AnalyticsData }>("/admin/analytics"),
    enabled: isLoggedIn() && user?.role === "admin",
  });

  // Advanced analytics query
  const { data: advData, isLoading: isAdvLoading } = useQuery<{
    success: boolean;
    analytics: AdvancedAnalyticsData;
  }>({
    queryKey: ["admin", "analytics-advanced"],
    queryFn: () =>
      api.get<{ success: boolean; analytics: AdvancedAnalyticsData }>("/admin/analytics/advanced"),
    enabled: isLoggedIn() && user?.role === "admin",
  });

  const analytics = data?.analytics;
  const adv = advData?.analytics;

  if (user && user.role !== "admin") {
    return (
      <AppShell>
        <div className="p-12 text-center space-y-4">
          <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
          <h2 className="font-display text-xl font-bold">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You must be logged in as an administrator account to access System Analytics.
          </p>
          <div className="pt-2">
            <Link to="/login">
              <Button className="ember-gradient text-primary-foreground border-0">
                Sign in as Admin
              </Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const metricCards = [
    {
      label: "Total Users",
      value: analytics?.users.total.toLocaleString() ?? "—",
      icon: Users,
      sub: `+${analytics?.users.today ?? 0} new today`,
    },
    {
      label: "Daily Active Users (DAU)",
      value: adv ? adv.dau.toLocaleString() : "—",
      icon: UserCheck,
      sub: "Unique users active today",
    },
    {
      label: "Monthly Active Users (MAU)",
      value: adv ? adv.mau.toLocaleString() : "—",
      icon: Calendar,
      sub: "Unique users active in 30d",
    },
    {
      label: "Acceptance Rate",
      value: analytics ? `${analytics.submissions.acceptanceRate}%` : "—",
      icon: CheckCircle2,
      sub: "Platform global average",
    },
  ];

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Console
            </Link>
            <span className="text-xs text-muted-foreground">/</span>
            <Badge className="ember-gradient text-primary-foreground border-0">Analytics</Badge>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            System Analytics & Telemetry
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Advanced user growth, active user retention cohorts, submission trends, and language
            preference breakdown.
          </p>
        </div>
      </div>

      {(isLoading || isAdvLoading) && (
        <div className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-12 text-center text-sm text-muted-foreground">
          Aggregating real-time MongoDB analytics and retention cohorts...
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0" /> Failed to load analytics metrics. Ensure your
          user role has admin privileges.
        </div>
      )}

      {!isLoading && analytics && (
        <>
          {/* Top Metric Cards */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metricCards.map(({ label, value, icon: Icon, sub }) => (
              <div key={label} className="rounded-2xl border border-border/60 bg-card/60 p-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {label}
                  </div>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-2 font-display text-3xl font-bold">{value}</div>
                <div className="mt-1 text-xs text-[color:var(--color-success)]">{sub}</div>
              </div>
            ))}
          </div>

          {/* User Retention Cohorts */}
          {adv && (
            <section className="mt-6 rounded-2xl border border-border/60 bg-card/60 p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-[color:var(--color-ember)]" />
                User Retention Cohorts
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Week 1 Active
                  </div>
                  <div className="mt-1 font-display text-2xl font-bold text-emerald-500">
                    {adv.retention.week1Rate}%
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Active in last 7 days
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Week 2 Active
                  </div>
                  <div className="mt-1 font-display text-2xl font-bold text-amber-500">
                    {adv.retention.week2Rate}%
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Active in last 14 days
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Month 1 Active (MAU %)
                  </div>
                  <div className="mt-1 font-display text-2xl font-bold text-blue-500">
                    {adv.retention.month1Rate}%
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Active in last 30 days
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Submission Activity Heatmap */}
          <section className="mt-6 rounded-2xl border border-border/60 bg-card/60 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[color:var(--color-ember)]" />
                Submission Activity — Last 90 Days
              </h3>
              <span className="text-xs text-muted-foreground">
                {Object.keys(analytics.activity.dailySubmissions).length} active days recorded
              </span>
            </div>
            <SubmissionHeatmap dailySubmissions={analytics.activity.dailySubmissions} />
          </section>

          {/* User Growth & Problem Solving Trends */}
          {adv && (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {/* User Growth Trend */}
              <div className="rounded-2xl border border-border/60 bg-card/60 p-5 space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[color:var(--color-ember)]" />
                  User Growth Trend (30 Days)
                </h3>
                {adv.userGrowthTrend.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {adv.userGrowthTrend.map((u) => (
                      <div
                        key={u.date}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-background/40"
                      >
                        <span className="mono text-muted-foreground">{u.date}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-500 font-medium">+{u.newUsers} new</span>
                          <span className="font-bold">{u.totalUsers} total</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No new registrations recorded in last 30 days.
                  </p>
                )}
              </div>

              {/* Problem Solving Trends */}
              <div className="rounded-2xl border border-border/60 bg-card/60 p-5 space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[color:var(--color-ember)]" />
                  Problem Solving Verdict Trends
                </h3>
                {adv.problemSolvingTrends.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {adv.problemSolvingTrends.map((t) => (
                      <div
                        key={t.date}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-background/40"
                      >
                        <span className="mono text-muted-foreground">{t.date}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-500 font-medium">
                            {t.accepted} accepted
                          </span>
                          <span className="text-destructive font-medium">
                            {t.rejected} rejected
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No verdict data recorded in last 30 days.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Difficulty Popularity & Language Breakdown */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {/* Difficulty Distribution */}
            <div className="rounded-2xl border border-border/60 bg-card/60 p-5 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Code2 className="h-4 w-4 text-[color:var(--color-ember)]" />
                Difficulty Popularity & Distribution
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-emerald-500 font-medium">Easy Problems</span>
                    <span>{analytics.problems.distribution.easy}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{
                        width: `${Math.min(100, (analytics.problems.distribution.easy / Math.max(1, analytics.problems.distribution.easy + analytics.problems.distribution.medium + analytics.problems.distribution.hard)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-amber-500 font-medium">Medium Problems</span>
                    <span>{analytics.problems.distribution.medium}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{
                        width: `${Math.min(100, (analytics.problems.distribution.medium / Math.max(1, analytics.problems.distribution.easy + analytics.problems.distribution.medium + analytics.problems.distribution.hard)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-destructive font-medium">Hard Problems</span>
                    <span>{analytics.problems.distribution.hard}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full bg-destructive rounded-full"
                      style={{
                        width: `${Math.min(100, (analytics.problems.distribution.hard / Math.max(1, analytics.problems.distribution.easy + analytics.problems.distribution.medium + analytics.problems.distribution.hard)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Coding Language Trends */}
            <div className="rounded-2xl border border-border/60 bg-card/60 p-5 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[color:var(--color-ember)]" />
                Coding Language Share Trends
              </h3>
              {adv?.codingLanguageTrends && adv.codingLanguageTrends.length > 0 ? (
                <div className="space-y-3">
                  {adv.codingLanguageTrends.map((l) => (
                    <div key={l.language}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium capitalize">{l.language}</span>
                        <span className="text-muted-foreground">
                          {l.count.toLocaleString()} ({l.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                        <div
                          className="h-full ember-gradient rounded-full"
                          style={{ width: `${Math.max(5, l.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No language submissions recorded yet.
                </p>
              )}
            </div>
          </div>

          {/* Top Solved Problems */}
          <section className="mt-6 rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 p-5">
              <h3 className="font-semibold flex items-center gap-2">
                <Cpu className="h-4 w-4 text-[color:var(--color-ember)]" />
                Top Solved Problems
              </h3>
            </div>
            {analytics.problems.mostSolved && analytics.problems.mostSolved.length > 0 ? (
              <div className="divide-y divide-border/60">
                {analytics.problems.mostSolved.map((p) => (
                  <div key={p._id} className="flex items-center justify-between p-4 text-sm">
                    <div>
                      <div className="font-medium hover:underline">
                        <Link to="/problems/$id" params={{ id: p.slug }}>
                          #{p.problemId} {p.title}
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        Difficulty: {p.difficulty}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="mono font-semibold">{p.successCount} solved</div>
                      <div className="text-xs text-muted-foreground">
                        {p.acceptanceRate}% acceptance
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No solved problems data available.
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}

function SubmissionHeatmap({ dailySubmissions }: { dailySubmissions: Record<string, number> }) {
  const days = 90;
  const today = new Date();
  const cells: { date: string; count: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const str = d.toISOString().split("T")[0];
    cells.push({ date: str, count: dailySubmissions[str] || 0 });
  }

  const maxCount = Math.max(1, ...cells.map((c) => c.count));

  return (
    <div className="mt-4 overflow-x-auto">
      <div className="flex items-end gap-1.5 h-32 pt-4">
        {cells.map(({ date, count }, idx) => {
          const heightPct = Math.max(8, (count / maxCount) * 100);
          return (
            <div
              key={idx}
              className="flex-1 rounded-t transition-all hover:opacity-80"
              style={{
                height: `${heightPct}%`,
                background: count > 0 ? "oklch(0.72 0.18 40 / 0.85)" : "oklch(0.28 0.01 45 / 0.4)",
              }}
              title={`${date}: ${count} submission${count !== 1 ? "s" : ""}`}
            />
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{cells[0]?.date}</span>
        <span>{cells[cells.length - 1]?.date}</span>
      </div>
    </div>
  );
}
