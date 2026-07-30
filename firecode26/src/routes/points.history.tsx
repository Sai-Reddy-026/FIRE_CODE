import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/site/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, History, ArrowLeft, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { isLoggedIn } from "@/lib/auth";
import { useEffect } from "react";

export const Route = createFileRoute("/points/history")({
  head: () => ({
    meta: [
      { title: "Points History — FireCode" },
      {
        name: "description",
        content: "Your FireCode reward points transactions and earnings history.",
      },
    ],
  }),
  component: PointsHistoryPage,
});

interface PointsTransactionItem {
  _id: string;
  points: number;
  type: "problem_solved" | "contest_reward" | "manual_adjustment" | "bonus";
  reason: string;
  createdAt: string;
}

function PointsHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  const userId = user?.id ?? "";

  const {
    data: historyData,
    isLoading,
    error,
  } = useQuery<{ success: boolean; history: PointsTransactionItem[] }>({
    queryKey: ["points-history", userId],
    queryFn: () =>
      api.get<{ success: boolean; history: PointsTransactionItem[] }>(
        `/accounts/${userId}/points/history`,
      ),
    enabled: !!userId,
  });

  const history = historyData?.history || [];

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/profile"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Profile
            </Link>
            <span className="text-xs text-muted-foreground">/</span>
            <Badge className="ember-gradient text-primary-foreground border-0">Rewards</Badge>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-7 w-7 text-[color:var(--color-ember)] fill-current" />
            Points Transaction History
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete audit log of earned points from algorithm problems, contests, and bonuses.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-12 text-center text-sm text-muted-foreground">
          Loading points transaction log...
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" /> Failed to load points history.
        </div>
      )}

      {!isLoading && history.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
          <div className="divide-y divide-border/60">
            {history.map((tx) => (
              <div key={tx._id} className="flex items-center justify-between p-4 text-sm">
                <div className="space-y-1">
                  <div className="font-medium text-foreground flex items-center gap-2">
                    <span>{tx.reason}</span>
                    <Badge variant="outline" className="capitalize text-[10px] font-mono">
                      {tx.type.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <History className="h-3 w-3" /> {new Date(tx.createdAt).toLocaleString()}
                  </div>
                </div>
                <div
                  className={`mono text-base font-bold ${tx.points > 0 ? "text-emerald-500" : "text-destructive"}`}
                >
                  {tx.points > 0 ? `+${tx.points}` : tx.points} pts
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!isLoading && history.length === 0 && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/60 p-12 text-center text-sm text-muted-foreground">
          No points transactions recorded yet. Solve a problem to earn your first reward points!
        </div>
      )}
    </AppShell>
  );
}
