import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/site/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Circle, Bookmark, Search } from "lucide-react";
import { useMemo, useState, useEffect, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

export const Route = createFileRoute("/problems/")({
  head: () => ({
    meta: [
      { title: "Problems — FireCode" },
      {
        name: "description",
        content: "Browse curated coding problems by difficulty, tag, and status on FireCode.",
      },
      { property: "og:title", content: "Problems — FireCode" },
      { property: "og:description", content: "Curated coding problems for serious practice." },
    ],
  }),
  component: ProblemsPage,
});

interface FrontendProblem {
  _id: string;
  main: {
    id: number;
    name: string; // slug
    difficulty: string;
    related_topics: string[];
    acceptance_rate_count: number;
    submission_count: number;
    status?: string;
  };
}

function ProblemsPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  const [q, setQ] = useState("");
  const [diff, setDiff] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const {
    data: problems = [],
    isLoading,
    error,
    refetch,
  } = useQuery<FrontendProblem[]>({
    queryKey: ["problems"],
    queryFn: () => api.get<FrontendProblem[]>("/problem/all"),
    // Problem list only changes when an admin publishes — 10 min stale time avoids
    // re-fetching on every tab focus or navigation between pages.
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const rows = useMemo(() => {
    return problems.filter((p) => {
      const name = p.main.name.toLowerCase();
      if (q && !name.includes(q.toLowerCase()) && !String(p.main.id).includes(q)) return false;
      if (diff !== "all" && p.main.difficulty.toLowerCase() !== diff.toLowerCase()) return false;
      if (status !== "all") {
        const s = p.main.status ?? "todo";
        if (status === "Solved" && s !== "solved") return false;
        if (status === "Attempted" && s !== "attempted") return false;
        if (status === "Todo" && s !== undefined && s !== "todo" && s !== "") return false;
      }
      return true;
    });
  }, [problems, q, diff, status]);

  const solvedCount = problems.filter((p) => p.main.status === "solved").length;
  const attemptedCount = problems.filter((p) => p.main.status === "attempted").length;

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Problems</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {problems.length} curated · updated weekly
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-md border border-border/60 bg-card/60 px-3 py-1.5">
            Solved <b className="ml-1 ember-text">{solvedCount}</b>
          </span>
          <span className="rounded-md border border-border/60 bg-card/60 px-3 py-1.5">
            Attempted <b className="ml-1">{attemptedCount}</b>
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card/60 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search problems…"
            className="pl-9"
          />
        </div>
        <Select value={diff} onValueChange={setDiff}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All difficulty</SelectItem>
            <SelectItem value="Easy">Easy</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="Solved">Solved</SelectItem>
            <SelectItem value="Attempted">Attempted</SelectItem>
            <SelectItem value="Todo">Todo</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline">Tags</Button>
        <Button variant="outline">Companies</Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card/60">
        <div className="hidden grid-cols-[40px_minmax(0,1fr)_120px_2fr_100px_60px] gap-4 border-b border-border/60 px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground sm:grid">
          <div>Status</div>
          <div>Title</div>
          <div>Difficulty</div>
          <div>Tags</div>
          <div>Acceptance</div>
          <div></div>
        </div>
        <div className="divide-y divide-border/60">
          {isLoading && (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 flex-1 rounded" />
                  <Skeleton className="h-4 w-20 rounded" />
                  <Skeleton className="h-4 w-32 rounded hidden sm:block" />
                  <Skeleton className="h-4 w-12 rounded hidden sm:block" />
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="p-12 text-center space-y-3">
              <p className="text-sm text-destructive font-medium">
                Failed to load problem catalog. Verify backend connectivity.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try Again
              </Button>
            </div>
          )}
          {!isLoading && !error && rows.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No problems match your filters. Try clearing your search query or changing difficulty.
            </div>
          )}
          {rows.map((p) => {
            const s = p.main.status;
            return (
              <Link
                key={p._id}
                to="/problems/$id"
                params={{ id: p.main.name }}
                className="grid grid-cols-[40px_minmax(0,1fr)_60px] items-center gap-3 px-4 py-3 transition hover:bg-accent/40 sm:grid-cols-[40px_minmax(0,1fr)_120px_2fr_100px_60px] sm:gap-4"
              >
                <div>
                  {s === "solved" ? (
                    <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />
                  ) : s === "attempted" ? (
                    <Circle className="h-4 w-4 text-[color:var(--color-warning)]" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/60" />
                  )}
                </div>
                <div className="min-w-0 truncate font-medium">
                  {p.main.id}.{" "}
                  {p.main.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </div>
                <div className="hidden sm:block">
                  <DiffBadge d={p.main.difficulty} />
                </div>
                <div className="hidden flex-wrap gap-1 sm:flex">
                  {p.main.related_topics.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="hidden mono text-sm text-muted-foreground sm:block">
                  {p.main.acceptance_rate_count}%
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="justify-self-end"
                  aria-label="Bookmark"
                  onClick={(e) => e.preventDefault()}
                >
                  <Bookmark className="h-4 w-4" />
                </Button>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

// Map is defined outside the component so it's created once, not on every render.
const DIFF_CLASS_MAP: Record<string, string> = {
  easy: "text-[color:var(--color-success)] border-[color:var(--color-success)]/30",
  medium: "text-[color:var(--color-warning)] border-[color:var(--color-warning)]/30",
  hard: "text-[color:var(--color-destructive)] border-[color:var(--color-destructive)]/40",
};

// memo: skip re-renders when parent re-renders from search/filter state changes
const DiffBadge = memo(function DiffBadge({ d }: { d: string }) {
  const key = d.toLowerCase();
  return (
    <Badge variant="outline" className={DIFF_CLASS_MAP[key] ?? ""}>
      {d.charAt(0).toUpperCase() + d.slice(1)}
    </Badge>
  );
});
