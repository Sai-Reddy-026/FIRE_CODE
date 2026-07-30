import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/site/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Copy,
  Trash2,
  ShieldAlert,
  ArrowLeft,
  Check,
  Code,
  FileText,
  ListOrdered,
  CheckCircle2,
  BarChart2,
  Zap,
  Archive,
  Send,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { isLoggedIn } from "@/lib/auth";

export const Route = createFileRoute("/admin/problems")({
  head: () => ({
    meta: [
      { title: "Manage Problems — FireCode Admin" },
      {
        name: "description",
        content:
          "Problem catalog management, review workflow, points adjustment, and telemetry for FireCode admins.",
      },
    ],
  }),
  component: AdminProblemsPage,
});

interface ProblemItem {
  _id: string;
  problemId: number;
  title: string;
  slug: string;
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "pending_review" | "published" | "archived";
  points?: number;
  category?: string;
  tags: string[];
  description: string;
  constraints?: string;
  hints?: string[];
  editorial?: string;
  submissionCount: number;
  acceptanceRate: number;
  examples?: Array<{ input: string; output: string; explanation?: string }>;
  starterCode?: Array<{ language: string; code: string }>;
}

interface ProblemAnalytics {
  problemId: number;
  title: string;
  slug: string;
  difficulty: string;
  status: string;
  points: number;
  totalAttempts: number;
  acceptedSubmissions: number;
  rejectedSubmissions: number;
  failureRate: number;
  avgSolvingTime: number;
  acceptanceRate: number;
}

interface TestCaseItem {
  _id?: string;
  problemId?: string;
  input: string;
  expectedOutput: string;
  explanation?: string;
  isHidden?: boolean;
}

function AdminProblemsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate({ to: "/login" });
    } else if (user && user.role !== "admin") {
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  // Modals & Panels state
  const [editingProblem, setEditingProblem] = useState<Partial<ProblemItem> | null>(null);
  const [testcaseProblem, setTestcaseProblem] = useState<ProblemItem | null>(null);
  const [analyticsProblemId, setAnalyticsProblemId] = useState<string | null>(null);
  const [testcasesList, setTestcasesList] = useState<TestCaseItem[]>([]);
  const [formError, setFormError] = useState("");
  const [testcaseError, setTestcaseError] = useState("");

  // Fetch Problems List
  const {
    data: problemsData,
    isLoading,
    isFetching,
    error,
  } = useQuery<{ success: boolean; problems: ProblemItem[] }>({
    queryKey: ["admin", "problems"],
    queryFn: () => api.get<{ success: boolean; problems: ProblemItem[] }>("/admin/problems"),
    enabled: isLoggedIn() && user?.role === "admin",
  });

  // Query Problem Analytics
  const { data: analyticsData, isLoading: isAnalyticsLoading } = useQuery<{
    success: boolean;
    analytics: ProblemAnalytics;
  }>({
    queryKey: ["admin", "problem-analytics", analyticsProblemId],
    queryFn: () =>
      api.get<{ success: boolean; analytics: ProblemAnalytics }>(
        `/admin/problems/${analyticsProblemId}/analytics`,
      ),
    enabled: !!analyticsProblemId && user?.role === "admin",
  });

  const problems = problemsData?.problems || [];

  // Mutations
  const saveProblemMutation = useMutation<any, Error, Partial<ProblemItem>>({
    mutationFn: (payload) => {
      if (payload._id) {
        return api.patch(`/admin/problems/${payload._id}`, payload);
      }
      return api.post("/admin/problems", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "problems"] });
      setEditingProblem(null);
      setFormError("");
    },
    onError: (err) => {
      setFormError(err.message || "Failed to save problem.");
    },
  });

  const workflowMutation = useMutation<any, Error, { id: string; status: string }>({
    mutationFn: ({ id, status }) => api.patch(`/admin/problems/${id}/workflow`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "problems"] });
    },
  });

  const pointsMutation = useMutation<any, Error, { id: string; points: number }>({
    mutationFn: ({ id, points }) => api.patch(`/admin/problems/${id}/points`, { points }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "problems"] });
    },
  });

  const deleteProblemMutation = useMutation<any, Error, string>({
    mutationFn: (id) => api.delete(`/admin/problems/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "problems"] });
    },
  });

  const duplicateProblemMutation = useMutation<any, Error, string>({
    mutationFn: (id) => api.post(`/admin/problems/${id}/duplicate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "problems"] });
    },
  });

  const saveTestcasesMutation = useMutation<
    any,
    Error,
    { problemId: string; testcases: TestCaseItem[] }
  >({
    mutationFn: ({ problemId, testcases }) =>
      api.post(`/admin/problems/${problemId}/testcases`, { testcases }),
    onSuccess: () => {
      setTestcaseProblem(null);
      setTestcasesList([]);
    },
  });

  // Open Testcase Editor
  const handleOpenTestcases = async (prob: ProblemItem) => {
    setTestcaseProblem(prob);
    try {
      const res = await api.get<{ success: boolean; testcases: TestCaseItem[] }>(
        `/admin/problems/${prob._id}/testcases`,
      );
      setTestcasesList(res.testcases || []);
    } catch (err) {
      setTestcasesList([]);
    }
  };

  if (user && user.role !== "admin") {
    return (
      <AppShell>
        <div className="p-12 text-center space-y-4">
          <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
          <h2 className="font-display text-xl font-bold">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You must be logged in as an administrator account to access the Problem Management console.
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
            Problem Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review workflow states, adjust points, view telemetry analytics, and manage test cases.
          </p>
        </div>
        <Link to="/admin/add-problem">
          <Button className="ember-gradient text-primary-foreground border-0">
            <Plus className="mr-1.5 h-4 w-4" /> Create Problem Wizard
          </Button>
        </Link>
      </div>

      {/* Problem Analytics Modal */}
      {analyticsProblemId && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/80 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="font-display text-lg font-bold flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-[color:var(--color-ember)]" />
              Problem Telemetry & Analytics
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setAnalyticsProblemId(null)}>
              Close
            </Button>
          </div>

          {isAnalyticsLoading && (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Computing problem submission telemetry...
            </div>
          )}

          {analyticsData?.analytics && (
            <div className="space-y-4">
              <div className="font-medium text-sm">
                #{analyticsData.analytics.problemId} {analyticsData.analytics.title} (
                {analyticsData.analytics.slug})
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Total Attempts
                  </div>
                  <div className="mt-1 font-display text-2xl font-bold">
                    {analyticsData.analytics.totalAttempts}
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Accepted Solves
                  </div>
                  <div className="mt-1 font-display text-2xl font-bold text-emerald-500">
                    {analyticsData.analytics.acceptedSubmissions}
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Failure Rate
                  </div>
                  <div className="mt-1 font-display text-2xl font-bold text-destructive">
                    {analyticsData.analytics.failureRate}%
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Avg Solving Time
                  </div>
                  <div className="mt-1 font-display text-2xl font-bold">
                    {analyticsData.analytics.avgSolvingTime} ms
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Editor Modal / Panel */}
      {editingProblem && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/80 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <h2 className="font-display text-xl font-bold">
              {editingProblem._id
                ? `Edit Problem #${editingProblem.problemId}`
                : "Create New Problem"}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setEditingProblem(null)}>
              Cancel
            </Button>
          </div>

          {formError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive">
              {formError}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="prob-id">Problem Numeric ID</Label>
              <Input
                id="prob-id"
                type="number"
                value={editingProblem.problemId || 1}
                onChange={(e) =>
                  setEditingProblem({ ...editingProblem, problemId: parseInt(e.target.value) || 1 })
                }
              />
            </div>
            <div>
              <Label htmlFor="prob-title">Title</Label>
              <Input
                id="prob-title"
                value={editingProblem.title || ""}
                onChange={(e) => {
                  const title = e.target.value;
                  const slug = title
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/(^-|-$)/g, "");
                  setEditingProblem({
                    ...editingProblem,
                    title,
                    slug: editingProblem._id ? editingProblem.slug : slug,
                  });
                }}
              />
            </div>
            <div>
              <Label htmlFor="prob-slug">Slug</Label>
              <Input
                id="prob-slug"
                value={editingProblem.slug || ""}
                onChange={(e) => setEditingProblem({ ...editingProblem, slug: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label>Difficulty</Label>
              <Select
                value={editingProblem.difficulty || "medium"}
                onValueChange={(val: "easy" | "medium" | "hard") =>
                  setEditingProblem({ ...editingProblem, difficulty: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Review Workflow</Label>
              <Select
                value={editingProblem.status || "draft"}
                onValueChange={(val: "draft" | "pending_review" | "published" | "archived") =>
                  setEditingProblem({ ...editingProblem, status: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="prob-points">Reward Points</Label>
              <Input
                id="prob-points"
                type="number"
                value={editingProblem.points ?? 10}
                onChange={(e) =>
                  setEditingProblem({ ...editingProblem, points: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label htmlFor="prob-tags">Tags (comma separated)</Label>
              <Input
                id="prob-tags"
                value={(editingProblem.tags || []).join(", ")}
                onChange={(e) =>
                  setEditingProblem({
                    ...editingProblem,
                    tags: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="prob-desc">Description (HTML allowed)</Label>
            <textarea
              id="prob-desc"
              rows={5}
              className="w-full rounded-lg border border-border bg-background/60 p-3 text-sm font-mono leading-relaxed outline-none"
              value={editingProblem.description || ""}
              onChange={(e) =>
                setEditingProblem({ ...editingProblem, description: e.target.value })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="prob-constraints">Constraints</Label>
              <textarea
                id="prob-constraints"
                rows={3}
                className="w-full rounded-lg border border-border bg-background/60 p-3 text-sm font-mono outline-none"
                value={editingProblem.constraints || ""}
                onChange={(e) =>
                  setEditingProblem({ ...editingProblem, constraints: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="prob-hints">Hints (one per line)</Label>
              <textarea
                id="prob-hints"
                rows={3}
                className="w-full rounded-lg border border-border bg-background/60 p-3 text-sm outline-none"
                value={(editingProblem.hints || []).join("\n")}
                onChange={(e) =>
                  setEditingProblem({
                    ...editingProblem,
                    hints: e.target.value.split("\n").filter(Boolean),
                  })
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="prob-editorial">Editorial (HTML allowed)</Label>
            <textarea
              id="prob-editorial"
              rows={4}
              className="w-full rounded-lg border border-border bg-background/60 p-3 text-sm font-mono outline-none"
              value={editingProblem.editorial || ""}
              onChange={(e) => setEditingProblem({ ...editingProblem, editorial: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setEditingProblem(null)}>
              Cancel
            </Button>
            <Button
              className="ember-gradient text-primary-foreground border-0"
              disabled={saveProblemMutation.isPending}
              onClick={() => {
                if (!editingProblem.title?.trim()) {
                  setFormError("Problem title is required.");
                  return;
                }
                if (!editingProblem.slug?.trim()) {
                  setFormError("Problem slug is required.");
                  return;
                }
                setFormError("");
                saveProblemMutation.mutate(editingProblem);
              }}
            >
              {saveProblemMutation.isPending ? "Saving..." : "Save Problem"}
            </Button>
          </div>
        </div>
      )}

      {/* Testcases Drawer / Modal */}
      {testcaseProblem && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/80 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="font-display text-lg font-bold">
              Testcases for: <span className="ember-text">{testcaseProblem.title}</span>
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setTestcaseProblem(null)}>
              Close
            </Button>
          </div>

          <div className="space-y-4">
            {testcasesList.map((tc, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border/60 bg-background/50 p-4 space-y-3"
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Test Case #{idx + 1}</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tc.isHidden ?? false}
                      onChange={(e) => {
                        const updated = [...testcasesList];
                        updated[idx].isHidden = e.target.checked;
                        setTestcasesList(updated);
                      }}
                    />
                    Hidden Test Case
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">Input</Label>
                    <textarea
                      rows={2}
                      className="w-full rounded border border-border bg-background p-2 text-xs font-mono"
                      value={tc.input}
                      onChange={(e) => {
                        const updated = [...testcasesList];
                        updated[idx].input = e.target.value;
                        setTestcasesList(updated);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Expected Output</Label>
                    <textarea
                      rows={2}
                      className="w-full rounded border border-border bg-background p-2 text-xs font-mono"
                      value={tc.expectedOutput}
                      onChange={(e) => {
                        const updated = [...testcasesList];
                        updated[idx].expectedOutput = e.target.value;
                        setTestcasesList(updated);
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {testcaseError && (
            <div className="text-xs font-medium text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-2.5">
              {testcaseError}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTestcaseError("");
                setTestcasesList([
                  ...testcasesList,
                  { input: "", expectedOutput: "", isHidden: false },
                ]);
              }}
            >
              + Add Test Case
            </Button>
            <Button
              size="sm"
              className="ember-gradient text-primary-foreground border-0"
              disabled={saveTestcasesMutation.isPending}
              onClick={() => {
                setTestcaseError("");
                if (testcasesList.length === 0) {
                  setTestcaseError("At least one testcase is required.");
                  return;
                }

                const cleaned = testcasesList.map((tc) => ({
                  ...tc,
                  input: tc.input.trim(),
                  expectedOutput: tc.expectedOutput.trim(),
                }));

                for (let i = 0; i < cleaned.length; i++) {
                  if (!cleaned[i].input) {
                    setTestcaseError(`Test Case #${i + 1} has empty input.`);
                    return;
                  }
                  if (!cleaned[i].expectedOutput) {
                    setTestcaseError(`Test Case #${i + 1} has empty expected output.`);
                    return;
                  }
                }

                // Check duplicate inputs
                const inputsSeen = new Set<string>();
                for (let i = 0; i < cleaned.length; i++) {
                  if (inputsSeen.has(cleaned[i].input)) {
                    setTestcaseError(`Duplicate testcase input detected: "${cleaned[i].input}"`);
                    return;
                  }
                  inputsSeen.add(cleaned[i].input);
                }

                saveTestcasesMutation.mutate({
                  problemId: testcaseProblem._id,
                  testcases: cleaned,
                });
              }}
            >
              {saveTestcasesMutation.isPending ? "Saving..." : "Save Test Cases"}
            </Button>
          </div>
        </div>
      )}

      {/* Main Problems Table */}
      <section className="mt-6 rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
        {(isLoading || isFetching) && (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Loading problem catalog...
          </div>
        )}

        {error && !isLoading && !isFetching && (
          <div className="p-6 text-sm text-destructive flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> Failed to load problems list. Verify backend server is running on port 80.
            </div>
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "problems"] })}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && problems.length > 0 && (
          <div className="overflow-x-auto">
            <div className="hidden grid-cols-[70px_minmax(0,1fr)_90px_130px_70px_100px_160px] gap-4 border-b border-border/60 px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground lg:grid">
              <div>ID</div>
              <div>Title</div>
              <div>Difficulty</div>
              <div>Workflow</div>
              <div>Points</div>
              <div>Submissions</div>
              <div className="text-right">Actions</div>
            </div>
            <div className="divide-y divide-border/60">
              {problems.map((p) => (
                <div
                  key={p._id}
                  className="grid grid-cols-2 items-center gap-4 px-5 py-3 text-sm lg:grid-cols-[70px_minmax(0,1fr)_90px_130px_70px_100px_160px]"
                >
                  <div className="mono text-xs font-semibold">#{p.problemId}</div>
                  <div className="min-w-0 truncate font-medium hover:text-foreground">
                    <Link to="/problems/$id" params={{ id: p.slug }} className="hover:underline">
                      {p.title}
                    </Link>
                  </div>
                  <div>
                    <Badge
                      variant="outline"
                      className={
                        p.difficulty === "hard"
                          ? "text-destructive border-destructive/40"
                          : p.difficulty === "medium"
                            ? "text-amber-500 border-amber-500/30"
                            : "text-emerald-500 border-emerald-500/30"
                      }
                    >
                      {p.difficulty}
                    </Badge>
                  </div>
                  <div>
                    <Select
                      value={p.status || "draft"}
                      onValueChange={(val) => workflowMutation.mutate({ id: p._id, status: val })}
                    >
                      <SelectTrigger className="h-7 text-xs bg-background/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="pending_review">Pending Review</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mono text-xs font-semibold">{p.points || 0} pts</div>
                  <div className="hidden lg:block text-xs text-muted-foreground">
                    {p.submissionCount ?? 0} ({p.acceptanceRate ?? 0}%)
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Problem Telemetry"
                      onClick={() => setAnalyticsProblemId(p._id)}
                    >
                      <BarChart2 className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit Problem"
                      onClick={() => setEditingProblem(p)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Manage Testcases"
                      onClick={() => handleOpenTestcases(p)}
                    >
                      <ListOrdered className="h-4 w-4 text-emerald-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Duplicate"
                      onClick={() => duplicateProblemMutation.mutate(p._id)}
                    >
                      <Copy className="h-4 w-4 text-amber-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      onClick={() => {
                        if (
                          window.confirm(`Are you sure you want to delete problem "${p.title}"?`)
                        ) {
                          deleteProblemMutation.mutate(p._id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
