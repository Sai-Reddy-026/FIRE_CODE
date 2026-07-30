import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/site/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  ArrowLeft,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Timer,
  Users,
  Snowflake,
  Megaphone,
  BarChart3,
  Award,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { isLoggedIn } from "@/lib/auth";

export const Route = createFileRoute("/admin/contests")({
  head: () => ({
    meta: [
      { title: "Manage Contests — FireCode Admin" },
      {
        name: "description",
        content:
          "Contest management, leaderboard freezing, announcements, and telemetry for FireCode administrators.",
      },
    ],
  }),
  component: AdminContestsPage,
});

interface ContestItem {
  _id: string;
  id: number;
  title: string;
  slug: string;
  description?: string;
  type: "weekly" | "biweekly" | "virtual" | "special";
  status: "upcoming" | "live" | "past";
  start_time: string;
  end_time: string;
  duration_minutes: number;
  problems: string[];
  participants_count: number;
  registration_open: boolean;
  isFrozen?: boolean;
}

interface AdminContestsResponse {
  success: boolean;
  contests: ContestItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface LeaderboardResponse {
  success: boolean;
  contest: {
    id: number;
    title: string;
    slug: string;
    status: string;
    start_time: string;
    end_time: string;
    announcements?: Array<{ message: string; createdAt: string }>;
  };
  isFrozen: boolean;
  leaderboard: Array<{
    rank: number;
    username: string;
    solvedCount: number;
    penalty: number;
    score: number;
  }>;
  statistics: {
    participantsCount: number;
    totalProblemsSolved: number;
    avgScore: number;
    topPerformers: Array<{
      rank: number;
      username: string;
      solvedCount: number;
      score: number;
    }>;
  };
}

function toDatetimeLocal(dateStr?: string | Date): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AdminContestsPage() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingContest, setEditingContest] = useState<Partial<ContestItem> | null>(null);
  const [deletingContest, setDeletingContest] = useState<ContestItem | null>(null);
  const [leaderboardContestId, setLeaderboardContestId] = useState<string | null>(null);
  const [announcementContest, setAnnouncementContest] = useState<ContestItem | null>(null);
  const [announcementMsg, setAnnouncementMsg] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate({ to: "/login" });
    } else if (authUser && authUser.role !== "admin") {
      navigate({ to: "/dashboard" });
    }
  }, [authUser, navigate]);

  // Query contests list
  const { data, isLoading, error } = useQuery<AdminContestsResponse>({
    queryKey: ["admin", "contests", page, search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.append("search", search);
      if (statusFilter !== "all") params.append("status", statusFilter);
      return api.get<AdminContestsResponse>(`/admin/contests?${params.toString()}`);
    },
    enabled: isLoggedIn() && authUser?.role === "admin",
  });

  // Query Contest Leaderboard & Telemetry
  const { data: leaderboardData, isLoading: isLeaderboardLoading } = useQuery<LeaderboardResponse>({
    queryKey: ["admin", "contest-leaderboard", leaderboardContestId],
    queryFn: () =>
      api.get<LeaderboardResponse>(`/admin/contests/${leaderboardContestId}/leaderboard`),
    enabled: !!leaderboardContestId && authUser?.role === "admin",
  });

  // Mutations
  const saveContestMutation = useMutation<any, Error, Partial<ContestItem>>({
    mutationFn: (payload) => {
      if (payload._id) {
        return api.patch(`/admin/contests/${payload._id}`, payload);
      }
      return api.post("/admin/contests", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "contests"] });
      setEditingContest(null);
      setFormError("");
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Failed to save contest.");
      }
    },
  });

  const freezeMutation = useMutation<any, Error, { id: string; isFrozen: boolean }>({
    mutationFn: ({ id, isFrozen }) => api.patch(`/admin/contests/${id}/freeze`, { isFrozen }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "contest-leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "contests"] });
    },
  });

  const announcementMutation = useMutation<any, Error, { id: string; message: string }>({
    mutationFn: ({ id, message }) => api.post(`/admin/contests/${id}/announcement`, { message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "contest-leaderboard"] });
      setAnnouncementContest(null);
      setAnnouncementMsg("");
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Failed to post announcement.");
      }
    },
  });

  const deleteContestMutation = useMutation<any, Error, string>({
    mutationFn: (id) => api.delete(`/admin/contests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "contests"] });
      setDeletingContest(null);
      setFormError("");
    },
    onError: (err) => {
      setFormError(err.message || "Failed to delete contest.");
    },
  });

  if (authUser && authUser.role !== "admin") {
    return (
      <AppShell>
        <div className="p-12 text-center space-y-4">
          <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
          <h2 className="font-display text-xl font-bold">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You must be logged in as an administrator account to access Contest Management.
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

  const contests = data?.contests || [];
  const pagination = data?.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 };

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
            <Badge className="ember-gradient text-primary-foreground border-0">Admin</Badge>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            Contest Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule rated rounds, view live leaderboards, freeze scores, and broadcast
            announcements.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            className="ember-gradient text-primary-foreground border-0 gap-1.5 font-bold shadow-lg"
            onClick={() => navigate({ to: "/admin/add-contest" })}
          >
            <Plus className="h-4 w-4" /> Create Contest Wizard
          </Button>
        </div>
      </div>

      {formError && (
        <div className="mt-4 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{formError}</span>
          <button className="text-xs underline ml-2" onClick={() => setFormError("")}>
            Dismiss
          </button>
        </div>
      )}

      {/* Announcement Modal */}
      {announcementContest && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/80 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="font-display text-lg font-bold flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-[color:var(--color-ember)]" />
              Broadcast Contest Announcement — {announcementContest.title}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setAnnouncementContest(null)}>
              Cancel
            </Button>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Announcement Message
            </label>
            <textarea
              rows={3}
              placeholder="Clarification for Problem B: inputs will not exceed 10^9..."
              value={announcementMsg}
              onChange={(e) => setAnnouncementMsg(e.target.value)}
              className="w-full mt-1 rounded-lg border border-border bg-background/60 p-3 text-sm outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setAnnouncementContest(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="ember-gradient text-primary-foreground border-0"
              disabled={announcementMutation.isPending || !announcementMsg.trim()}
              onClick={() =>
                announcementMutation.mutate({
                  id: announcementContest._id,
                  message: announcementMsg,
                })
              }
            >
              {announcementMutation.isPending ? "Broadcasting..." : "Broadcast Announcement"}
            </Button>
          </div>
        </div>
      )}

      {/* Leaderboard & Telemetry Drawer */}
      {leaderboardContestId && leaderboardData && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/80 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div>
              <h3 className="font-display text-xl font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-[color:var(--color-ember)]" />
                {leaderboardData.contest.title} — Live Leaderboard
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {leaderboardData.isFrozen
                  ? "Leaderboard is currently FROZEN"
                  : "Live real-time ranking computation"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className={leaderboardData.isFrozen ? "border-amber-500/50 text-amber-500" : ""}
                disabled={freezeMutation.isPending}
                onClick={() =>
                  freezeMutation.mutate({
                    id: leaderboardContestId,
                    isFrozen: !leaderboardData.isFrozen,
                  })
                }
              >
                <Snowflake className="mr-1.5 h-4 w-4" />
                {leaderboardData.isFrozen ? "Unfreeze Scores" : "Freeze Leaderboard"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setLeaderboardContestId(null)}>
                Close
              </Button>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-background/50 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Participants
              </div>
              <div className="mt-1 font-display text-2xl font-bold">
                {leaderboardData.statistics.participantsCount}
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/50 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Problems Solved
              </div>
              <div className="mt-1 font-display text-2xl font-bold text-emerald-500">
                {leaderboardData.statistics.totalProblemsSolved}
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/50 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Average Score
              </div>
              <div className="mt-1 font-display text-2xl font-bold">
                {leaderboardData.statistics.avgScore} pts
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/50 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Top Winner
              </div>
              <div className="mt-1 font-display text-lg font-bold ember-text truncate">
                {leaderboardData.statistics.topPerformers[0]?.username || "—"}
              </div>
            </div>
          </div>

          {/* Announcements List */}
          {leaderboardData.contest.announcements &&
            leaderboardData.contest.announcements.length > 0 && (
              <div className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-4">
                <h4 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Megaphone className="h-3.5 w-3.5 text-[color:var(--color-ember)]" /> Contest
                  Announcements
                </h4>
                <div className="divide-y divide-border/60 space-y-2">
                  {leaderboardData.contest.announcements.map((a, i) => (
                    <div key={i} className="pt-2 text-xs flex justify-between">
                      <span className="text-foreground">{a.message}</span>
                      <span className="text-muted-foreground">
                        {new Date(a.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Leaderboard Table */}
          <div className="rounded-xl border border-border/60 bg-background/40 overflow-hidden">
            {leaderboardData.leaderboard.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="grid grid-cols-[60px_minmax(0,1.5fr)_100px_100px_100px] gap-3 border-b border-border/60 px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                  <div>Rank</div>
                  <div>User</div>
                  <div>Solved</div>
                  <div>Penalty</div>
                  <div className="text-right">Score</div>
                </div>
                <div className="divide-y divide-border/60">
                  {leaderboardData.leaderboard.map((row) => (
                    <div
                      key={row.rank}
                      className="grid grid-cols-[60px_minmax(0,1.5fr)_100px_100px_100px] items-center gap-3 px-5 py-3 text-sm"
                    >
                      <div className="font-bold flex items-center gap-1">
                        {row.rank === 1 ? (
                          <Award className="h-4 w-4 text-amber-400" />
                        ) : (
                          `#${row.rank}`
                        )}
                      </div>
                      <div className="font-medium truncate">{row.username}</div>
                      <div className="mono text-xs">{row.solvedCount} problems</div>
                      <div className="mono text-xs text-muted-foreground">{row.penalty}m</div>
                      <div className="mono text-xs font-bold text-right ember-text">
                        {row.score} pts
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No submissions recorded during this contest duration yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingContest && (
        <div className="mt-6 rounded-2xl border border-destructive/40 bg-card/80 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="font-display text-lg font-bold text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Confirm Contest Deletion
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setDeletingContest(null)}>
              Cancel
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <strong className="text-foreground">{deletingContest.title}</strong>? This action will
            remove the contest from the live portal.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeletingContest(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteContestMutation.isPending}
              onClick={() => deleteContestMutation.mutate(deletingContest._id)}
            >
              {deleteContestMutation.isPending ? "Deleting..." : "Confirm Delete"}
            </Button>
          </div>
        </div>
      )}

      {/* Editor Drawer / Form */}
      {editingContest && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/80 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <h2 className="font-display text-xl font-bold">
              {editingContest._id ? `Edit Contest #${editingContest.id}` : "Schedule New Contest"}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setEditingContest(null)}>
              Cancel
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="c-title">Contest Title</Label>
              <Input
                id="c-title"
                placeholder="Weekly Round 215"
                value={editingContest.title || ""}
                onChange={(e) => setEditingContest({ ...editingContest, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Contest Type</Label>
              <Select
                value={editingContest.type || "weekly"}
                onValueChange={(val: "weekly" | "biweekly" | "virtual" | "special") =>
                  setEditingContest({ ...editingContest, type: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly Series</SelectItem>
                  <SelectItem value="biweekly">Biweekly Series</SelectItem>
                  <SelectItem value="virtual">Virtual Round</SelectItem>
                  <SelectItem value="special">Special Event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="c-duration">Duration (Minutes)</Label>
              <Input
                id="c-duration"
                type="number"
                value={editingContest.duration_minutes || 90}
                onChange={(e) =>
                  setEditingContest({
                    ...editingContest,
                    duration_minutes: parseInt(e.target.value) || 90,
                  })
                }
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="c-start">Start Date & Time (UTC)</Label>
              <Input
                id="c-start"
                type="datetime-local"
                value={toDatetimeLocal(editingContest.start_time)}
                onChange={(e) =>
                  setEditingContest({
                    ...editingContest,
                    start_time: new Date(e.target.value).toISOString(),
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="c-end">End Date & Time (UTC)</Label>
              <Input
                id="c-end"
                type="datetime-local"
                value={toDatetimeLocal(editingContest.end_time)}
                onChange={(e) =>
                  setEditingContest({
                    ...editingContest,
                    end_time: new Date(e.target.value).toISOString(),
                  })
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="c-desc">Description</Label>
            <textarea
              id="c-desc"
              rows={3}
              className="w-full rounded-lg border border-border bg-background/60 p-3 text-sm leading-relaxed outline-none"
              value={editingContest.description || ""}
              onChange={(e) =>
                setEditingContest({ ...editingContest, description: e.target.value })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="c-problems">Problem Slugs (comma separated)</Label>
              <Input
                id="c-problems"
                placeholder="two-sum, reverse-linked-list"
                value={(editingContest.problems || []).join(", ")}
                onChange={(e) =>
                  setEditingContest({
                    ...editingContest,
                    problems: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input
                  type="checkbox"
                  checked={editingContest.registration_open ?? true}
                  onChange={(e) =>
                    setEditingContest({ ...editingContest, registration_open: e.target.checked })
                  }
                  className="rounded border-border"
                />
                Registration Open for Users
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setEditingContest(null)}>
              Cancel
            </Button>
            <Button
              className="ember-gradient text-primary-foreground border-0"
              disabled={saveContestMutation.isPending}
              onClick={() => {
                if (!editingContest.title?.trim()) {
                  setFormError("Contest title is required.");
                  return;
                }
                if (!editingContest.start_time) {
                  setFormError("Start date and time is required.");
                  return;
                }
                if (!editingContest.end_time) {
                  setFormError("End date and time is required.");
                  return;
                }
                const startDate = new Date(editingContest.start_time);
                const endDate = new Date(editingContest.end_time);
                if (endDate <= startDate) {
                  setFormError("End time must be after Start time.");
                  return;
                }
                if (!editingContest.duration_minutes || editingContest.duration_minutes <= 0) {
                  setFormError("Duration must be greater than zero minutes.");
                  return;
                }
                const titleText = editingContest.title.trim();
                const isDuplicate = contests.some(
                  (c) =>
                    c._id !== editingContest._id &&
                    c.title.toLowerCase().trim() === titleText.toLowerCase(),
                );
                if (isDuplicate) {
                  setFormError(`A contest with title "${titleText}" already exists.`);
                  return;
                }
                setFormError("");
                saveContestMutation.mutate(editingContest);
              }}
            >
              {saveContestMutation.isPending ? "Saving..." : "Save Contest"}
            </Button>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contest title..."
            className="pl-9 bg-card/60"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-[140px]">
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="bg-card/60">
              <SelectValue placeholder="Status Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="past">Past</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Contests Table */}
      <section className="mt-6 rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
        {isLoading && (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 flex-1 rounded" />
                <Skeleton className="h-5 w-20 rounded" />
                <Skeleton className="h-5 w-20 rounded" />
                <Skeleton className="h-5 w-28 rounded" />
                <Skeleton className="h-5 w-24 rounded" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="p-6 text-sm text-destructive flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Failed to load contests.
          </div>
        )}

        {!isLoading && contests.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <div className="hidden grid-cols-[minmax(0,1.5fr)_100px_90px_150px_150px_90px_160px] gap-3 border-b border-border/60 px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground lg:grid">
                <div>Title</div>
                <div>Type</div>
                <div>Status</div>
                <div>Start Time (UTC)</div>
                <div>End Time (UTC)</div>
                <div>Problems</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y divide-border/60">
                {contests.map((c) => (
                  <div
                    key={c._id}
                    className="grid grid-cols-2 items-center gap-3 px-5 py-3 text-sm lg:grid-cols-[minmax(0,1.5fr)_100px_90px_150px_150px_90px_160px]"
                  >
                    <div className="font-medium truncate flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-[color:var(--color-ember)] shrink-0" />
                      <span className="truncate">{c.title}</span>
                    </div>
                    <div>
                      <Badge variant="outline" className="capitalize text-xs">
                        {c.type}
                      </Badge>
                    </div>
                    <div>
                      <Badge
                        variant="outline"
                        className={
                          c.status === "live"
                            ? "border-[color:var(--color-ember)]/60 text-[color:var(--color-ember)]"
                            : c.status === "upcoming"
                              ? "border-emerald-500/40 text-emerald-500"
                              : "border-border text-muted-foreground"
                        }
                      >
                        {c.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Timer className="h-3 w-3 shrink-0" />
                      {new Date(c.start_time).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(c.end_time).toLocaleString()}
                    </div>
                    <div className="mono text-xs">{c.problems?.length || 0} problems</div>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Leaderboard & Telemetry"
                        onClick={() => setLeaderboardContestId(c._id)}
                      >
                        <BarChart3 className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Broadcast Announcement"
                        onClick={() => setAnnouncementContest(c)}
                      >
                        <Megaphone className="h-4 w-4 text-amber-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit Contest"
                        onClick={() => setEditingContest(c)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete Contest"
                        onClick={() => setDeletingContest(c)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
              <div>
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total
                contests)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
