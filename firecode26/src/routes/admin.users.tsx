import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
import {
  Search,
  Shield,
  ShieldOff,
  Trash2,
  Eye,
  ArrowLeft,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Zap,
  FileText,
  Trophy,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { isLoggedIn } from "@/lib/auth";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Manage Users — FireCode Admin" },
      {
        name: "description",
        content:
          "User account management, status, points adjustment, and history for FireCode administrators.",
      },
    ],
  }),
  component: AdminUsersPage,
});

interface UserItem {
  id: string;
  username: string;
  email: string;
  role: "user" | "admin";
  provider: string;
  rating: number;
  rank: number;
  points?: number;
  isBanned?: boolean;
  banReason?: string;
  problems_solved_count: number;
  problems_attempted_count: number;
  createdAt: string;
}

interface AdminUsersResponse {
  success: boolean;
  users: UserItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface UserDetailResponse {
  success: boolean;
  profile: {
    id: string;
    username: string;
    email: string;
    display_name?: string;
    bio?: string;
    location?: string;
    role: "user" | "admin";
    isBanned?: boolean;
    banReason?: string;
    createdAt: string;
  };
  statistics: {
    problems_solved_count: number;
    problems_solved_easy: number;
    problems_solved_medium: number;
    problems_solved_hard: number;
    problems_attempted_count: number;
    longest_streak: number;
    submission_count: number;
  };
  provider: string;
  rating: number;
  rank: number;
  solved_problems: string[];
}

function AdminUsersPage() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);
  const [banningUser, setBanningUser] = useState<UserItem | null>(null);
  const [banReason, setBanReason] = useState("");
  const [pointsUser, setPointsUser] = useState<UserItem | null>(null);
  const [pointsAmount, setPointsAmount] = useState(100);
  const [pointsReason, setPointsReason] = useState("");
  const [activeTab, setActiveTab] = useState<"details" | "submissions" | "contests">("details");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate({ to: "/login" });
    } else if (authUser && authUser.role !== "admin") {
      navigate({ to: "/dashboard" });
    }
  }, [authUser, navigate]);

  // Query users
  const { data, isLoading, error } = useQuery<AdminUsersResponse>({
    queryKey: ["admin", "users", page, search, roleFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.append("search", search);
      if (roleFilter !== "all") params.append("role", roleFilter);
      return api.get<AdminUsersResponse>(`/admin/users?${params.toString()}`);
    },
    enabled: isLoggedIn() && authUser?.role === "admin",
  });

  // Query single user detail modal
  const { data: userDetail } = useQuery<UserDetailResponse>({
    queryKey: ["admin", "user-detail", selectedUserId],
    queryFn: () => api.get<UserDetailResponse>(`/admin/users/${selectedUserId}`),
    enabled: !!selectedUserId && authUser?.role === "admin",
  });

  // Query user submissions history
  const { data: userSubmissionsData } = useQuery<{ success: boolean; submissions: any[] }>({
    queryKey: ["admin", "user-submissions", selectedUserId],
    queryFn: () =>
      api.get<{ success: boolean; submissions: any[] }>(
        `/admin/users/${selectedUserId}/submissions`,
      ),
    enabled: !!selectedUserId && activeTab === "submissions" && authUser?.role === "admin",
  });

  // Query user contest participation history
  const { data: userContestsData } = useQuery<{ success: boolean; contests: any[] }>({
    queryKey: ["admin", "user-contests", selectedUserId],
    queryFn: () =>
      api.get<{ success: boolean; contests: any[] }>(`/admin/users/${selectedUserId}/contests`),
    enabled: !!selectedUserId && activeTab === "contests" && authUser?.role === "admin",
  });

  // Mutations
  const updateRoleMutation = useMutation<any, Error, { id: string; role: "user" | "admin" }>({
    mutationFn: ({ id, role }) => api.patch(`/admin/users/${id}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setActionError("");
    },
    onError: (err) => {
      setActionError(err.message || "Failed to update role.");
    },
  });

  const banUserMutation = useMutation<
    any,
    Error,
    { id: string; isBanned: boolean; reason: string }
  >({
    mutationFn: ({ id, isBanned, reason }) =>
      api.patch(`/admin/users/${id}/status`, { isBanned, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setBanningUser(null);
      setBanReason("");
      setActionError("");
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError("Failed to update user ban status.");
      }
    },
  });

  const pointsMutation = useMutation<any, Error, { id: string; amount: number; reason: string }>({
    mutationFn: ({ id, amount, reason }) =>
      api.post(`/admin/users/${id}/reward`, { points: amount, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setPointsUser(null);
      setPointsReason("");
      setActionError("");
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError("Failed to adjust user reward points.");
      }
    },
  });

  const deleteUserMutation = useMutation<any, Error, string>({
    mutationFn: (id) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setDeletingUser(null);
      setActionError("");
    },
    onError: (err) => {
      setActionError(err.message || "Failed to delete user.");
    },
  });

  if (authUser && authUser.role !== "admin") {
    return (
      <AppShell>
        <div className="p-12 text-center space-y-4">
          <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
          <h2 className="font-display text-xl font-bold">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You must be logged in as an administrator account to access User Management.
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

  const users = data?.users || [];
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
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">User Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage roles, ban/unban status, adjust reward points, and view submission history.
          </p>
        </div>
      </div>

      {actionError && (
        <div className="mt-4 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{actionError}</span>
          <button className="text-xs underline ml-2" onClick={() => setActionError("")}>
            Dismiss
          </button>
        </div>
      )}

      {/* Ban / Unban Modal */}
      {banningUser && (
        <div className="mt-6 rounded-2xl border border-destructive/40 bg-card/80 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="font-display text-lg font-bold text-destructive flex items-center gap-2">
              <UserX className="h-5 w-5 text-destructive" />
              {banningUser.isBanned ? "Unban Account" : "Ban Account"} — {banningUser.username}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setBanningUser(null)}>
              Cancel
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {banningUser.isBanned
              ? `Are you sure you want to lift the suspension for user ${banningUser.username}?`
              : `Are you sure you want to ban user ${banningUser.username}? They will be blocked from logging in or submitting code.`}
          </p>
          {!banningUser.isBanned && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Reason for Ban</label>
              <Input
                placeholder="Violation of terms, cheating in contests..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="mt-1 bg-background/60"
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setBanningUser(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className={
                banningUser.isBanned
                  ? "ember-gradient text-primary-foreground border-0"
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
              disabled={banUserMutation.isPending}
              onClick={() =>
                banUserMutation.mutate({
                  id: banningUser.id,
                  isBanned: !banningUser.isBanned,
                  reason: banReason,
                })
              }
            >
              {banUserMutation.isPending
                ? "Processing..."
                : banningUser.isBanned
                  ? "Confirm Unban"
                  : "Confirm Ban"}
            </Button>
          </div>
        </div>
      )}

      {/* Points Adjustment Modal */}
      {pointsUser && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/80 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="font-display text-lg font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-[color:var(--color-ember)]" />
              Adjust Reward Points — {pointsUser.username}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setPointsUser(null)}>
              Cancel
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Current balance:{" "}
            <strong className="text-foreground">{pointsUser.points || 0} pts</strong>. Enter a
            positive number to add points or a negative number to deduct points.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Points Amount (+ / -)
              </label>
              <Input
                type="number"
                placeholder="e.g. 50 or -25"
                value={pointsAmount}
                onChange={(e) => setPointsAmount(parseInt(e.target.value) || 0)}
                className="mt-1 bg-background/60"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Reason for Adjustment
              </label>
              <Input
                placeholder="Contest reward bonus, penalty correction..."
                value={pointsReason}
                onChange={(e) => setPointsReason(e.target.value)}
                className="mt-1 bg-background/60"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setPointsUser(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="ember-gradient text-primary-foreground border-0"
              disabled={pointsMutation.isPending || pointsAmount === 0 || !pointsReason.trim()}
              onClick={() =>
                pointsMutation.mutate({
                  id: pointsUser.id,
                  amount: pointsAmount,
                  reason: pointsReason,
                })
              }
            >
              {pointsMutation.isPending ? "Applying..." : "Apply Points Adjustment"}
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Card */}
      {deletingUser && (
        <div className="mt-6 rounded-2xl border border-destructive/40 bg-card/80 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="font-display text-lg font-bold text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Confirm User Deletion
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setDeletingUser(null)}>
              Cancel
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete user{" "}
            <strong className="text-foreground">{deletingUser.username}</strong> (
            {deletingUser.email})? This action will disable the account but preserve historical
            submissions.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeletingUser(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUserMutation.isPending}
              onClick={() => deleteUserMutation.mutate(deletingUser.id)}
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Confirm Delete"}
            </Button>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search username or email..."
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
            value={roleFilter}
            onValueChange={(val) => {
              setRoleFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="bg-card/60">
              <SelectValue placeholder="Role Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* User Detail & History Drawer / Modal */}
      {selectedUserId && userDetail?.profile && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/80 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-3">
              <h3 className="font-display text-lg font-bold flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-[color:var(--color-ember)]" />
                {userDetail.profile.username}
              </h3>
              {userDetail.profile.isBanned && (
                <Badge variant="outline" className="border-destructive/40 text-destructive">
                  Banned Account
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedUserId(null);
                setActiveTab("details");
              }}
            >
              Close
            </Button>
          </div>

          <div className="flex gap-2 border-b border-border/60 pb-3 text-xs">
            <button
              className={`px-3 py-1.5 rounded-lg font-medium transition ${activeTab === "details" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("details")}
            >
              Overview Details
            </button>
            <button
              className={`px-3 py-1.5 rounded-lg font-medium transition ${activeTab === "submissions" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("submissions")}
            >
              Submission History
            </button>
            <button
              className={`px-3 py-1.5 rounded-lg font-medium transition ${activeTab === "contests" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("contests")}
            >
              Contest Participation
            </button>
          </div>

          {activeTab === "details" && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="text-sm font-medium">{userDetail.profile.email}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Role</div>
                  <Badge
                    variant="outline"
                    className={
                      userDetail.profile.role === "admin"
                        ? "border-[color:var(--color-ember)]/40 text-[color:var(--color-ember)]"
                        : ""
                    }
                  >
                    {userDetail.profile.role}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Provider</div>
                  <div className="text-sm capitalize">{userDetail.provider}</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4 pt-2 border-t border-border/60">
                <div>
                  <div className="text-xs text-muted-foreground">Rating</div>
                  <div className="text-lg font-bold ember-text">{userDetail.rating}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Global Rank</div>
                  <div className="text-lg font-bold">#{userDetail.rank || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Solved / Attempted</div>
                  <div className="text-sm font-medium">
                    {userDetail.statistics.problems_solved_count} /{" "}
                    {userDetail.statistics.problems_attempted_count}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total Submissions</div>
                  <div className="text-sm font-medium">
                    {userDetail.statistics.submission_count}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "submissions" && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                User Submissions Log
              </h4>
              {userSubmissionsData?.submissions && userSubmissionsData.submissions.length > 0 ? (
                <div className="max-h-60 overflow-y-auto divide-y divide-border/60 border rounded-lg">
                  {userSubmissionsData.submissions.map((sub, i) => (
                    <div
                      key={sub._id || i}
                      className="p-3 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-foreground">
                          {sub.problemTitle || sub.problemSlug}
                        </div>
                        <div className="text-muted-foreground">
                          {sub.language} · {new Date(sub.submittedAt).toLocaleString()}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          sub.status === "Accepted"
                            ? "border-emerald-500/40 text-emerald-500"
                            : "border-destructive/40 text-destructive"
                        }
                      >
                        {sub.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No submission records found for this user.
                </p>
              )}
            </div>
          )}

          {activeTab === "contests" && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Contests Participated / Solved
              </h4>
              {userContestsData?.contests && userContestsData.contests.length > 0 ? (
                <div className="max-h-60 overflow-y-auto divide-y divide-border/60 border rounded-lg">
                  {userContestsData.contests.map((c, i) => (
                    <div key={c._id || i} className="p-3 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-medium text-foreground">{c.title}</div>
                        <div className="text-muted-foreground">
                          Type: {c.type} · {new Date(c.start_time).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {c.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No contest participation records found.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Table */}
      <section className="mt-6 rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
        {isLoading && (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-28 rounded" />
                <Skeleton className="h-5 flex-1 rounded" />
                <Skeleton className="h-5 w-16 rounded" />
                <Skeleton className="h-5 w-16 rounded" />
                <Skeleton className="h-5 w-20 rounded" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="p-6 text-sm text-destructive flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Failed to load users list.
          </div>
        )}

        {!isLoading && users.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_90px_90px_80px_80px_100px_160px] gap-3 border-b border-border/60 px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground lg:grid">
                <div>Username</div>
                <div>Email</div>
                <div>Role</div>
                <div>Status</div>
                <div>Points</div>
                <div>Solved</div>
                <div>Joined Date</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y divide-border/60">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="grid grid-cols-2 items-center gap-3 px-5 py-3 text-sm lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_90px_90px_80px_80px_100px_160px]"
                  >
                    <div className="font-medium truncate">{u.username}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    <div>
                      <Badge
                        variant="outline"
                        className={
                          u.role === "admin"
                            ? "border-[color:var(--color-ember)]/40 text-[color:var(--color-ember)]"
                            : ""
                        }
                      >
                        {u.role}
                      </Badge>
                    </div>
                    <div>
                      {u.isBanned ? (
                        <Badge
                          variant="outline"
                          className="border-destructive/40 text-destructive text-[11px]"
                        >
                          Banned
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/40 text-emerald-500 text-[11px]"
                        >
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="mono text-xs font-semibold">{u.points || 0} pts</div>
                    <div className="mono text-xs">{u.problems_solved_count}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="View Details & History"
                        onClick={() => {
                          setSelectedUserId(u.id);
                          setActiveTab("details");
                        }}
                      >
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Adjust Reward Points"
                        onClick={() => {
                          setPointsUser(u);
                          setPointsAmount(100);
                          setPointsReason("");
                        }}
                      >
                        <Zap className="h-4 w-4 text-amber-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={u.isBanned ? "Unban Account" : "Ban Account"}
                        onClick={() => {
                          setBanningUser(u);
                          setBanReason("");
                        }}
                      >
                        <UserX
                          className={`h-4 w-4 ${u.isBanned ? "text-emerald-500" : "text-amber-500"}`}
                        />
                      </Button>
                      {u.role === "user" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Promote to Admin"
                          disabled={updateRoleMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Promote user "${u.username}" to Admin role?`)) {
                              updateRoleMutation.mutate({ id: u.id, role: "admin" });
                            }
                          }}
                        >
                          <Shield className="h-4 w-4 text-emerald-500" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Demote to User"
                          disabled={updateRoleMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Demote admin "${u.username}" to User role?`)) {
                              updateRoleMutation.mutate({ id: u.id, role: "user" });
                            }
                          }}
                        >
                          <ShieldOff className="h-4 w-4 text-amber-500" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Soft Delete User"
                        onClick={() => setDeletingUser(u)}
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
                users)
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
