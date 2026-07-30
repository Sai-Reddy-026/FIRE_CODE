import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/site/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Timer, Trophy, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { useEffect } from "react";

export const Route = createFileRoute("/contests")({
  head: () => ({
    meta: [
      { title: "Contests — FireCode" },
      {
        name: "description",
        content:
          "Compete in live rated contests on FireCode. Weekly rounds, real-time leaderboard, and badges.",
      },
      { property: "og:title", content: "Contests — FireCode" },
      { property: "og:description", content: "Live rated contests with a real-time leaderboard." },
    ],
  }),
  component: ContestsPage,
});

interface BackendContest {
  id: number;
  title: string;
  slug: string;
  description?: string;
  type: "weekly" | "biweekly" | "virtual" | "special";
  status: "upcoming" | "live" | "past";
  start_time: string;
  end_time: string;
  duration_minutes: number;
  problems?: string[];
  participants_count?: number;
  registration_open?: boolean;
}

function ContestsPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  const {
    data: rawUpcoming,
    isLoading: isUpcomingLoading,
    error: upcomingError,
    refetch: refetchUpcoming,
  } = useQuery<BackendContest[]>({
    queryKey: ["contests", "upcoming"],
    queryFn: () => api.get<BackendContest[]>("/contests/upcoming"),
  });

  const {
    data: rawLive,
    isLoading: isLiveLoading,
    error: liveError,
  } = useQuery<BackendContest[]>({
    queryKey: ["contests", "live"],
    queryFn: () => api.get<BackendContest[]>("/contests/live"),
  });

  const {
    data: rawPast,
    isLoading: isPastLoading,
    error: pastError,
  } = useQuery<BackendContest[]>({
    queryKey: ["contests", "past"],
    queryFn: () => api.get<BackendContest[]>("/contests/past"),
  });

  const upcoming = (rawUpcoming || []).map((c: BackendContest) => {
    const start = new Date(c.start_time);
    const diff = start.getTime() - Date.now();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const startsStr = diff > 0 ? `in ${days > 0 ? `${days}d ` : ""}${hours}h` : "Starting soon";
    const whenStr = isNaN(start.getTime()) ? "TBD" : start.toUTCString().slice(0, 22);

    return {
      name: c.title,
      when: whenStr,
      starts: startsStr,
      rated: c.type === "weekly" || c.type === "biweekly",
      by: `${c.type.charAt(0).toUpperCase() + c.type.slice(1)} Series`,
      registeredCount: c.participants_count ?? 0,
    };
  });

  const liveContests = (rawLive || []).map((c: BackendContest) => {
    const end = new Date(c.end_time);
    const diff = end.getTime() - Date.now();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const endsStr = diff > 0 ? `Ends in ${hours}h ${mins}m` : "Ending soon";

    return {
      name: c.title,
      ends: endsStr,
      participants: c.participants_count ?? 0,
    };
  });

  const past = (rawPast || []).map((p: BackendContest) => {
    return {
      name: p.title,
      rank: "—",
      delta: "—",
      solved: p.problems ? `${p.problems.length} problems` : "—",
    };
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Contests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live rated rounds every weekend. Show up. Ship code.
          </p>
        </div>
        <Button className="ember-gradient text-primary-foreground border-0">
          Register for next round
        </Button>
      </div>

      <Tabs defaultValue="upcoming" className="mt-6">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          {upcomingError && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive flex items-center justify-between">
              <span>Failed to load upcoming contests. Verify backend connectivity.</span>
              <Button variant="outline" size="sm" onClick={() => refetchUpcoming()}>
                Try Again
              </Button>
            </div>
          )}
          {!upcomingError && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((c) => (
                <div
                  key={c.name}
                  className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-6"
                >
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[color:var(--color-ember)]/10 blur-2xl" />
                  <div className="flex items-start justify-between">
                    <Trophy className="h-6 w-6 text-[color:var(--color-ember)]" />
                    {c.rated && (
                      <Badge
                        variant="outline"
                        className="border-[color:var(--color-ember)]/40 text-[color:var(--color-ember)]"
                      >
                        Rated
                      </Badge>
                    )}
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold">{c.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">by {c.by}</p>
                  <div className="mt-4 space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Timer className="h-3.5 w-3.5" /> {c.when}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> {c.registeredCount} registered
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="mono text-xs text-[color:var(--color-ember)]">{c.starts}</span>
                    <Button size="sm" variant="outline">
                      Register
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="live" className="mt-6">
          {liveContests.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {liveContests.map((c) => (
                <div
                  key={c.name}
                  className="relative overflow-hidden rounded-2xl border border-[color:var(--color-ember)]/60 bg-card/60 p-6"
                >
                  <div className="flex items-start justify-between">
                    <Trophy className="h-6 w-6 text-[color:var(--color-ember)]" />
                    <Badge className="ember-gradient text-primary-foreground border-0">LIVE</Badge>
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold">{c.name}</h3>
                  <div className="mt-4 space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Timer className="h-3.5 w-3.5" /> {c.ends}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> {c.participants} active
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No live contests right now. Check back soon for the next round.
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="past"
          className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-card/60"
        >
          <div className="hidden grid-cols-[minmax(0,1fr)_120px_120px_120px] gap-4 border-b border-border/60 px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground sm:grid">
            <div>Contest</div>
            <div>Problems</div>
            <div>Rank</div>
            <div>Δ Rating</div>
          </div>
          <div className="divide-y divide-border/60">
            {past.map((p) => (
              <div
                key={p.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px_120px_120px]"
              >
                <div className="min-w-0 truncate font-medium">{p.name}</div>
                <div className="hidden mono text-sm sm:block">{p.solved}</div>
                <div className="hidden mono text-sm sm:block">{p.rank}</div>
                <div className="mono text-sm text-muted-foreground">{p.delta}</div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
