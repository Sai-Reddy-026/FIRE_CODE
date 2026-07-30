import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/site/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Code2,
  CheckCircle2,
  Activity,
  Database,
  Clock,
  ShieldAlert,
  Cpu,
  Zap,
  Trophy,
  History,
  UserCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { isLoggedIn } from "@/lib/auth";
import { useEffect } from "react";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Console — FireCode" },
      {
        name: "description",
        content: "System administrative overview and platform telemetry for FireCode.",
      },
    ],
  }),
  component: AdminPageIndex,
});

interface AuditLogEntry {
  _id: string;
  action: string;
  username: string;
  details: string;
  createdAt: string;
}

interface AdminOverviewStats {
  totalUsers: number;
  activeUsersToday: number;
  totalRewardPointsDistributed: number;
  totalProblems: number;
  easyProblems: number;
  mediumProblems: number;
  hardProblems: number;
  totalSubmissions: number;
  totalAcceptedSubmissions: number;
  todaySubmissions: number;
  acceptanceRate: number;
  totalContestsCount: number;
  liveContestsCount: number;
  recentAuditLogs: AuditLogEntry[];
  dbStatus: string;
  uptimeSeconds: number;
}

interface AdminOverviewResponse {
  success: boolean;
  stats: AdminOverviewStats;
}

function formatUptime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function AdminPageIndex() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate({ to: "/login" });
    } else if (user && user.role !== "admin") {
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  const { data, isLoading, error } = useQuery<AdminOverviewResponse>({
    queryKey: ["admin", "dashboard-overview"],
    queryFn: () => api.get<AdminOverviewResponse>("/admin/dashboard-overview"),
    enabled: isLoggedIn() && user?.role === "admin",
    staleTime: 30 * 1000,
  });

  const stats = data?.stats;

  if (user && user.role !== "admin") {
    return (
      <AppShell>
        <div className="p-12 text-center space-y-4">
          <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
          <h2 className="font-display text-xl font-bold">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You must be logged in as an administrator account to access the Admin Console.
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
      value: stats?.totalUsers.toLocaleString() ?? "—",
      icon: Users,
      sub: "Registered accounts",
    },
    {
      label: "Active Users Today",
      value: stats?.activeUsersToday.toLocaleString() ?? "—",
      icon: UserCheck,
      sub: "Active last 24 hours",
    },
    {
      label: "Points Distributed",
      value: stats?.totalRewardPointsDistributed.toLocaleString() ?? "—",
      icon: Zap,
      sub: "Total reward points",
    },
    {
      label: "Total Contests",
      value: stats?.totalContestsCount.toLocaleString() ?? "—",
      icon: Trophy,
      sub: `${stats?.liveContestsCount ?? 0} currently live`,
    },
    {
      label: "Total Problems",
      value: stats?.totalProblems.toLocaleString() ?? "—",
      icon: Code2,
      sub: "Published catalog",
    },
    {
      label: "Easy / Med / Hard",
      value: stats
        ? `${stats.easyProblems} / ${stats.mediumProblems} / ${stats.hardProblems}`
        : "—",
      icon: CheckCircle2,
      sub: "Problem distribution",
    },
    {
      label: "Total Submissions",
      value: stats?.totalSubmissions.toLocaleString() ?? "—",
      icon: Activity,
      sub: "All-time judge runs",
    },
    {
      label: "Accepted Submissions",
      value: stats?.totalAcceptedSubmissions.toLocaleString() ?? "—",
      icon: CheckCircle2,
      sub: `${stats?.todaySubmissions ?? 0} today`,
    },
    {
      label: "Acceptance Rate",
      value: stats ? `${stats.acceptanceRate}%` : "—",
      icon: CheckCircle2,
      sub: "Global verdict average",
    },
    {
      label: "System Health",
      value: stats?.dbStatus ?? "—",
      icon: Database,
      sub: `Uptime: ${stats ? formatUptime(stats.uptimeSeconds) : "—"}`,
    },
  ];

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="ember-gradient text-primary-foreground border-0">Admin Access</Badge>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            Admin Dashboard Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time system telemetry, reward metrics, active participation, and security
            operations.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/problems">
            <Button variant="outline">Manage Problems</Button>
          </Link>
          <Link to="/admin/contests">
            <Button className="ember-gradient text-primary-foreground border-0">
              Manage Contests
            </Button>
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-12 text-center text-sm text-muted-foreground">
          Fetching comprehensive backend statistics and active telemetry...
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          Failed to load administrative overview. Ensure your account possesses admin rights.
        </div>
      )}

      {!isLoading && stats && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {metricCards.map(({ label, value, icon: Icon, sub }) => (
              <div key={label} className="rounded-2xl border border-border/60 bg-card/60 p-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {label}
                  </div>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-2 font-display text-2xl font-bold">{value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
              </div>
            ))}
          </div>

          <section className="mt-6 rounded-2xl border border-border/60 bg-card/60">
            <div className="flex items-center justify-between border-b border-border/60 p-5">
              <h3 className="font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-[color:var(--color-ember)]" />
                Recent Administrative Audit Operations
              </h3>
              <Link
                to="/admin/logs"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                View all logs →
              </Link>
            </div>
            {stats.recentAuditLogs && stats.recentAuditLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="hidden grid-cols-[140px_minmax(0,2fr)_170px] gap-4 border-b border-border/60 px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground sm:grid">
                  <div>Admin</div>
                  <div>Action & Details</div>
                  <div>Timestamp (UTC)</div>
                </div>
                <div className="divide-y divide-border/60">
                  {stats.recentAuditLogs.map((log) => (
                    <div
                      key={log._id}
                      className="grid grid-cols-1 items-center gap-2 px-5 py-3.5 text-sm sm:grid-cols-[140px_minmax(0,2fr)_170px]"
                    >
                      <div className="font-medium text-foreground">{log.username || "Admin"}</div>
                      <div>
                        <Badge
                          variant="outline"
                          className="mono text-[10px] uppercase tracking-wider mr-2"
                        >
                          {log.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{log.details}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No recent administrative operations recorded.
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
