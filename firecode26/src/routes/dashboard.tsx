import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/site/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, TrendingUp, Zap, Target, ArrowUpRight, Timer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { isLoggedIn } from "@/lib/auth";
import { useEffect } from "react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — FireCode" },
      {
        name: "description",
        content:
          "Your FireCode dashboard: streak, points, rating, recent submissions and upcoming contests.",
      },
      { property: "og:title", content: "Dashboard — FireCode" },
      {
        property: "og:description",
        content: "Track your streak, points, rating, and submissions.",
      },
    ],
  }),
  component: DashboardPage,
});

interface ActivityData {
  solved_dates: string[];
  current_streak: number;
  longest_streak: number;
  today_count: number;
  week_count: number;
  month_count: number;
  total_solved: number;
}

interface ContestItem {
  _id: string;
  id?: number;
  title: string;
  slug: string;
  type?: string;
  start_time?: string;
  startTime?: string;
}

interface UserProfile {
  _id: string;
  username: string;
  display_name?: string;
  rating?: number;
  rank?: number;
  points?: number;
  total_points_earned?: number;
}

interface RecentSubmissionItem {
  _id: string;
  problemTitle?: string;
  problemSlug?: string;
  status: string;
  language: string;
  submittedAt: string;
  runtime?: number;
}

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  const userId = user?.id ?? "";

  const { data: recentSubmissions } = useQuery<RecentSubmissionItem[]>({
    queryKey: ["submissions", "recent", userId],
    queryFn: () => api.get<RecentSubmissionItem[]>("/problem/user/submissions?limit=5"),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  const { data: activity } = useQuery<ActivityData>({
    queryKey: ["activity", userId],
    queryFn: () => api.get<ActivityData>(`/problem/activity/${userId}`),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: upcomingContests } = useQuery<ContestItem[]>({
    queryKey: ["contests", "upcoming"],
    queryFn: () => api.get<ContestItem[]>("/contests/upcoming"),
    // Contests are scheduled events that change rarely — 15 min stale avoids re-fetching on every visit.
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: profileData } = useQuery<UserProfile>({
    queryKey: ["profile", userId],
    queryFn: () => api.get<UserProfile>(`/accounts/id/${userId}`),
    enabled: !!userId,
    // Profile stats update after submissions — 10 min stale is fine since the dashboard shows trends.
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const currentStreak = activity?.current_streak ?? 0;
  const totalSolved = activity?.total_solved ?? 0;
  const solvedDates = activity?.solved_dates ?? [];

  const rating = profileData?.rating;
  const points = profileData?.points ?? 0;

  const stats = [
    { label: "Reward points", value: points.toLocaleString(), delta: "⚡ pts", icon: Zap },
    {
      label: "Current rating",
      value: rating ? rating.toLocaleString() : "N/A",
      delta: "—",
      icon: TrendingUp,
    },
    { label: "Streak", value: `${currentStreak}d`, delta: "🔥", icon: Flame },
    { label: "Solved", value: totalSolved.toString(), delta: "/ problems", icon: Target },
  ];

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {(() => {
              const h = new Date().getHours();
              return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
            })()},{" "}
            <span className="ember-text">{user?.username ?? "…"}</span>
          </h1>
        </div>
        <Link to="/problems">
          <Button className="ember-gradient text-primary-foreground border-0">
            Solve a problem <ArrowUpRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, delta, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border/60 bg-card/60 p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 font-display text-3xl font-bold">{value}</div>
            <div className="mt-1 text-xs text-[color:var(--color-success)]">{delta}</div>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Activity — last 30 weeks</h3>
            <div className="text-xs text-muted-foreground">{solvedDates.length} active days</div>
          </div>
          <Heatmap solvedDates={solvedDates} />
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <h3 className="font-semibold">Upcoming contests</h3>
          {upcomingContests && upcomingContests.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {upcomingContests.slice(0, 3).map((c) => {
                const start = new Date(c.start_time || c.startTime || "");
                const diff = start.getTime() - Date.now();
                const days = Math.floor(diff / 86400000);
                const hours = Math.floor((diff % 86400000) / 3600000);
                const whenStr =
                  diff > 0 ? `in ${days > 0 ? `${days}d ` : ""}${hours}h` : "Starting soon";
                return (
                  <li
                    key={c._id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{c.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Timer className="h-3 w-3" />{" "}
                        {isNaN(start.getTime()) ? "TBD" : start.toUTCString().slice(0, 16)} ·{" "}
                        {whenStr}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-[color:var(--color-ember)]/40 text-[color:var(--color-ember)]"
                    >
                      Rated
                    </Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No upcoming contests.</p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border/60 bg-card/60">
        <div className="flex items-center justify-between border-b border-border/60 p-5">
          <h3 className="font-semibold">Recent submissions</h3>
          <Link to="/problems" className="text-xs text-muted-foreground hover:text-foreground">
            View all →
          </Link>
        </div>
        <div className="divide-y divide-border/60">
          {recentSubmissions && recentSubmissions.length > 0 ? (
            recentSubmissions.map((s) => (
              <div key={s._id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <Link
                    to="/problems/$id"
                    params={{ id: s.problemSlug || "1" }}
                    className="font-medium hover:underline"
                  >
                    {s.problemTitle || s.problemSlug || "Problem"}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {s.language} · {new Date(s.submittedAt).toLocaleDateString()}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    s.status === "Accepted"
                      ? "border-emerald-500/40 text-emerald-500"
                      : "border-rose-500/40 text-rose-500"
                  }
                >
                  {s.status}
                </Badge>
              </div>
            ))
          ) : (
            <div className="p-5 text-sm text-muted-foreground">
              No submissions yet. Start solving!
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function Heatmap({ solvedDates }: { solvedDates: string[] }) {
  const weeks = 30;
  const days = 7;
  const dateSet = new Set(solvedDates);

  const today = new Date();
  const cells: { date: string; count: number }[] = [];
  for (let i = weeks * days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const str = d.toISOString().split("T")[0];
    cells.push({ date: str, count: dateSet.has(str) ? 1 : 0 });
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <div
        className="grid grid-flow-col gap-1"
        style={{ gridTemplateRows: `repeat(${days}, minmax(0, 1fr))` }}
      >
        {cells.map(({ date, count }, i) => (
          <div
            key={i}
            className="h-3 w-3 rounded-sm"
            style={{
              background: count > 0 ? "oklch(0.72 0.18 40 / 0.75)" : "oklch(0.28 0.01 45)",
            }}
            title={`${date}: ${count} submission${count !== 1 ? "s" : ""}`}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <div
            key={l}
            className="h-3 w-3 rounded-sm"
            style={{ background: `oklch(0.72 ${0.06 + l * 0.04} 40 / ${0.2 + l * 0.15})` }}
          />
        ))}
        More
      </div>
    </div>
  );
}
