import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/site/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, Zap, Trophy, Shield, Medal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Points Leaderboard — FireCode" },
      { name: "description", content: "Global FireCode user points leaderboard and rankings." },
    ],
  }),
  component: LeaderboardPage,
});

interface LeaderboardUser {
  username: string;
  avatar?: string | null;
  points: number;
  solvedProblems: number;
  rank: number;
  role?: string;
  rating?: number;
}

interface PublicLeaderboardResponse {
  success: boolean;
  users: LeaderboardUser[];
}

function LeaderboardPage() {
  const { data, isLoading, error, refetch } = useQuery<PublicLeaderboardResponse>({
    queryKey: ["leaderboard", "global"],
    queryFn: () => api.get<PublicLeaderboardResponse>("/leaderboard"),
  });

  const rawUsers = data?.users || [];
  // Server already returns users in correct ranked order — preserve it without re-sorting
  const leaderboardUsers = rawUsers;

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="ember-gradient text-primary-foreground border-0">Global</Badge>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-7 w-7 text-[color:var(--color-ember)]" />
            Reward Points Leaderboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compete, solve algorithm challenges, and earn reward points across the platform.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-8 rounded" />
              <Skeleton className="h-5 flex-1 rounded" />
              <Skeleton className="h-5 w-20 rounded" />
              <Skeleton className="h-5 w-24 rounded" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive flex items-center justify-between">
          <span>Failed to load leaderboard data. Verify backend connectivity.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try Again
          </Button>
        </div>
      )}

      {!isLoading && leaderboardUsers.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="hidden grid-cols-[70px_minmax(0,1.5fr)_110px_100px_100px_100px] gap-4 border-b border-border/60 px-5 py-3.5 text-xs uppercase tracking-wider text-muted-foreground lg:grid">
              <div>Rank</div>
              <div>Coder</div>
              <div>Level</div>
              <div>Problems</div>
              <div>Rating</div>
              <div className="text-right">Points</div>
            </div>
            <div className="divide-y divide-border/60">
              {leaderboardUsers.map((u, idx) => {
                const rankNum = idx + 1;
                const points = u.points || 0;
                const level = Math.floor(points / 100) + 1;
                return (
                  <div
                    key={u.username || idx}
                    className="grid grid-cols-2 items-center gap-4 px-5 py-4 text-sm lg:grid-cols-[70px_minmax(0,1.5fr)_110px_100px_100px_100px]"
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      {rankNum === 1 ? (
                        <Medal className="h-5 w-5 text-amber-400" />
                      ) : rankNum === 2 ? (
                        <Medal className="h-5 w-5 text-slate-300" />
                      ) : rankNum === 3 ? (
                        <Medal className="h-5 w-5 text-amber-600" />
                      ) : (
                        `#${rankNum}`
                      )}
                    </div>
                    <div className="font-medium truncate flex items-center gap-2">
                      <span className="truncate">{u.username}</span>
                      {u.role === "admin" && (
                        <Badge
                          variant="outline"
                          className="border-[color:var(--color-ember)]/40 text-[color:var(--color-ember)] text-[10px] px-1.5"
                        >
                          Admin
                        </Badge>
                      )}
                    </div>
                    <div>
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 text-amber-500 font-mono text-xs"
                      >
                        Level {level}
                      </Badge>
                    </div>
                    <div className="mono text-xs text-muted-foreground">
                      {u.solvedProblems || 0} solved
                    </div>
                    <div className="mono text-xs font-semibold">{u.rating || 1500}</div>
                    <div className="mono text-sm font-bold text-right ember-text flex items-center justify-end gap-1">
                      <Zap className="h-3.5 w-3.5 fill-current" />
                      {points.toLocaleString()} pts
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}
