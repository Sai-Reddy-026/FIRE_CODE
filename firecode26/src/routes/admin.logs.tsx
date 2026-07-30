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
  ArrowLeft,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  History,
  Terminal,
  UserCheck,
  Shield,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { isLoggedIn } from "@/lib/auth";

export const Route = createFileRoute("/admin/logs")({
  head: () => ({
    meta: [
      { title: "Audit Logs — FireCode Admin" },
      {
        name: "description",
        content: "Administrative security audit trail and action history log.",
      },
    ],
  }),
  component: AdminLogsPage,
});

interface AuditLogItem {
  _id: string;
  action: string;
  userId: string;
  username: string;
  details: string;
  ipAddress?: string;
  createdAt: string;
}

interface AdminLogsResponse {
  success: boolean;
  logs: AuditLogItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

function AdminLogsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate({ to: "/login" });
    } else if (user && user.role !== "admin") {
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  const { data, isLoading, error } = useQuery<AdminLogsResponse>({
    queryKey: ["admin", "logs", page, search, actionFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.append("search", search);
      if (actionFilter !== "all") params.append("action", actionFilter);
      return api.get<AdminLogsResponse>(`/admin/audit-logs?${params.toString()}`);
    },
    enabled: isLoggedIn() && user?.role === "admin",
  });

  if (user && user.role !== "admin") {
    return (
      <AppShell>
        <div className="p-12 text-center space-y-4">
          <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
          <h2 className="font-display text-xl font-bold">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You must be logged in as an administrator account to access Security Audit Logs.
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

  const logs = data?.logs || [];
  const pagination = data?.pagination || { total: 0, page: 1, limit: 15, totalPages: 1 };

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
            <Badge className="ember-gradient text-primary-foreground border-0">Security</Badge>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Immutable history of administrator mutations, system alterations, and security
            operations.
          </p>
        </div>
      </div>

      {/* Search & Action Filter */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search admin, action or details..."
            className="pl-9 bg-card/60"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-[180px]">
          <Select
            value={actionFilter}
            onValueChange={(val) => {
              setActionFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="bg-card/60">
              <SelectValue placeholder="Filter Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="CREATE_PROBLEM">Create Problem</SelectItem>
              <SelectItem value="UPDATE_PROBLEM">Update Problem</SelectItem>
              <SelectItem value="DELETE_PROBLEM">Delete Problem</SelectItem>
              <SelectItem value="UPDATE_USER_ROLE">Update Role</SelectItem>
              <SelectItem value="DELETE_USER">Delete User</SelectItem>
              <SelectItem value="CREATE_CONTEST">Create Contest</SelectItem>
              <SelectItem value="UPDATE_CONTEST">Update Contest</SelectItem>
              <SelectItem value="DELETE_CONTEST">Delete Contest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Logs Table */}
      <section className="mt-6 rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
        {isLoading && (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-24 rounded" />
                <Skeleton className="h-5 w-28 rounded" />
                <Skeleton className="h-5 flex-1 rounded" />
                <Skeleton className="h-5 w-24 rounded" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="p-6 text-sm text-destructive flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Failed to query audit trail records.
          </div>
        )}

        {!isLoading && logs.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <div className="hidden grid-cols-[140px_160px_minmax(0,2fr)_120px_170px] gap-3 border-b border-border/60 px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground lg:grid">
                <div>Admin</div>
                <div>Action</div>
                <div>Details</div>
                <div>IP Address</div>
                <div>Timestamp (UTC)</div>
              </div>
              <div className="divide-y divide-border/60">
                {logs.map((log) => (
                  <div
                    key={log._id}
                    className="grid grid-cols-2 items-center gap-3 px-5 py-3.5 text-sm lg:grid-cols-[140px_160px_minmax(0,2fr)_120px_170px]"
                  >
                    <div className="font-medium truncate flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-[color:var(--color-ember)] shrink-0" />
                      <span className="truncate">{log.username}</span>
                    </div>
                    <div>
                      <Badge
                        variant="outline"
                        className="mono text-[11px] uppercase tracking-wider"
                      >
                        {log.action}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate" title={log.details}>
                      {log.details}
                    </div>
                    <div className="mono text-xs text-muted-foreground">
                      {log.ipAddress || "::1"}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <History className="h-3 w-3 shrink-0 text-muted-foreground" />
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
              <div>
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} audit
                entries)
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

        {!isLoading && logs.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No audit records matching your search filters.
          </div>
        )}
      </section>
    </AppShell>
  );
}
