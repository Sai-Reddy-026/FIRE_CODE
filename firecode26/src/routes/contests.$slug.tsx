import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import Editor from "@monaco-editor/react";
import { AppShell } from "@/components/site/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { isLoggedIn } from "@/lib/auth";
import { useState, useEffect, useMemo, useCallback } from "react";
import DOMPurify from "dompurify";
import {
  Trophy,
  Clock,
  Users,
  Lock,
  ChevronLeft,
  ChevronRight,
  Play,
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Shield,
  Award,
  Sparkles,
  Loader2,
  HelpCircle,
  BookOpen,
  X,
  Maximize2,
  RotateCcw,
  CheckCircle2,
  BarChart3,
  ArrowLeft,
  List,
} from "lucide-react";

export const Route = createFileRoute("/contests/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Contest ${params.slug} — FireCode` },
      {
        name: "description",
        content:
          "Compete in live rated algorithm contests with real-time feedback and leaderboards.",
      },
    ],
  }),
  component: StudentContestWorkspace,
});

interface ContestProblemDetail {
  id: string | number;
  problemId: number;
  title: string;
  slug: string;
  difficulty: "easy" | "medium" | "hard";
  category?: string;
  points: number;
  letterOrder: string;
  description_body?: string;
  description?: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  hints?: string[];
  sampleTestCases?: Array<{ input: string; output: string; explanation?: string }>;
}

interface ContestBackendData {
  _id: string;
  id: number;
  title: string;
  slug: string;
  description: string;
  type: string;
  status: "upcoming" | "live" | "past";
  start_time: string;
  end_time: string;
  duration_minutes: number;
  problems: string[];
  problemDetails?: ContestProblemDetail[];
  participants_count: number;
  rules?: string;
  scoring_policy?: string;
  allowed_languages?: string[];
  isFrozen?: boolean;
}

interface ProblemFullData {
  _id: string;
  main: {
    id: number;
    name: string;
    difficulty: string;
    description_body: string;
    hints?: string[];
    code_default_language: string;
    code_body: Record<string, string>;
  };
  test?: any[][];
}

interface ExecutionResult {
  success: boolean;
  status: string;
  runtime: number;
  memory: number;
  error_message?: string | null;
  input?: string | null;
  expected_output?: string | null;
  user_output?: string | null;
}

export function StudentContestWorkspace() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Auth Guard
  useEffect(() => {
    if (!isLoggedIn()) {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  // Query Contest Details
  const { data: contestData, isLoading: isContestLoading } = useQuery<ContestBackendData>({
    queryKey: ["contest", slug],
    queryFn: async () => {
      const res = await api.get<any>(`/contests/slug/${slug}`);
      return res.contest || res;
    },
    enabled: !!slug,
  });

  // State
  const [activeProblemIndex, setActiveProblemIndex] = useState(0);
  const [selectedLang, setSelectedLang] = useState("python");
  const [codeCache, setCodeCache] = useState<Record<string, string>>({}); // Key: `${problemSlug}_${lang}`
  const [problemStatusMap, setProblemStatusMap] = useState<
    Record<string, "unopened" | "attempted" | "solved">
  >({});
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState("");

  // Timer State
  const [timeRemainingText, setTimeRemainingText] = useState("00:00:00");
  const [contestStateStatus, setContestStateStatus] = useState<"upcoming" | "live" | "past">(
    "upcoming",
  );

  // Construct Problem List
  const problemsList: ContestProblemDetail[] = useMemo(() => {
    if (contestData?.problemDetails && contestData.problemDetails.length > 0) {
      return contestData.problemDetails.map((p, idx) => ({
        ...p,
        letterOrder: p.letterOrder || String.fromCharCode(65 + idx),
        points: p.points || (idx + 1) * 100,
      }));
    } else if (contestData?.problems && contestData.problems.length > 0) {
      return contestData.problems.map((probSlug, idx) => ({
        id: probSlug,
        problemId: idx + 1,
        title: probSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        slug: probSlug,
        difficulty: "medium",
        points: (idx + 1) * 100,
        letterOrder: String.fromCharCode(65 + idx),
      }));
    }
    return [];
  }, [contestData]);

  const activeProblem = problemsList[activeProblemIndex] || null;
  const activeProblemSlug = activeProblem?.slug || "";

  // Fetch Full Problem Data for Active Problem
  const { data: fullProblemData, isLoading: isProblemLoading } = useQuery<ProblemFullData>({
    queryKey: ["problem", activeProblemSlug],
    queryFn: () => api.get<ProblemFullData>(`/problem/${activeProblemSlug}`),
    enabled: !!activeProblemSlug,
  });

  const mainProblem = fullProblemData?.main;

  // Live Timer Update Hook
  useEffect(() => {
    if (!contestData?.start_time || !contestData?.end_time) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const start = new Date(contestData.start_time).getTime();
      const end = new Date(contestData.end_time).getTime();

      if (now < start) {
        setContestStateStatus("upcoming");
        const diff = Math.max(0, start - now);
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeRemainingText(
          `Starts in ${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
        );
      } else if (now >= start && now <= end) {
        setContestStateStatus("live");
        const diff = Math.max(0, end - now);
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeRemainingText(
          `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
        );
      } else {
        setContestStateStatus("past");
        setTimeRemainingText("Contest Finished");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [contestData]);

  // Code Auto-Save to LocalStorage every 5 seconds
  useEffect(() => {
    if (!slug || !activeProblemSlug) return;

    const timer = setInterval(() => {
      const currentCode = codeCache[`${activeProblemSlug}_${selectedLang}`];
      if (currentCode) {
        const storageKey = `firecode_code_${slug}_${activeProblemSlug}_${selectedLang}`;
        localStorage.setItem(storageKey, currentCode);
        setLastSavedTime(new Date().toLocaleTimeString());
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [slug, activeProblemSlug, selectedLang, codeCache]);

  // Restore Saved Code on Problem or Language Switch
  useEffect(() => {
    if (!activeProblemSlug) return;

    const storageKey = `firecode_code_${slug}_${activeProblemSlug}_${selectedLang}`;
    const saved = localStorage.getItem(storageKey);

    if (saved) {
      setCodeCache((prev) => ({ ...prev, [`${activeProblemSlug}_${selectedLang}`]: saved }));
    } else if (mainProblem?.code_body?.[selectedLang]) {
      setCodeCache((prev) => ({
        ...prev,
        [`${activeProblemSlug}_${selectedLang}`]: mainProblem.code_body[selectedLang],
      }));
    } else {
      const defaultSnippets: Record<string, string> = {
        python: `# Solution for ${activeProblemSlug}\n`,
        cpp: `// Solution for ${activeProblemSlug}\n#include <iostream>\nusing namespace std;\n\nint main() {\n    return 0;\n}\n`,
        java: `// Solution for ${activeProblemSlug}\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n    }\n}\n`,
        javascript: `// Solution for ${activeProblemSlug}\n`,
      };
      setCodeCache((prev) => ({
        ...prev,
        [`${activeProblemSlug}_${selectedLang}`]: defaultSnippets[selectedLang] || "",
      }));
    }
  }, [slug, activeProblemSlug, selectedLang, mainProblem]);

  // Keyboard Shortcuts (Alt + Left / Alt + Right) for Problem Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        if (activeProblemIndex < problemsList.length - 1) {
          setActiveProblemIndex((prev) => prev + 1);
        }
      } else if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        if (activeProblemIndex > 0) {
          setActiveProblemIndex((prev) => prev - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeProblemIndex, problemsList.length]);

  // Warn before leaving if code changed
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const activeCode = codeCache[`${activeProblemSlug}_${selectedLang}`] || "";

  const handleCodeChange = (newCode: string) => {
    setCodeCache((prev) => ({ ...prev, [`${activeProblemSlug}_${selectedLang}`]: newCode }));
  };

  // Run Code Mutation — sends code + language + customInput to backend
  // The backend compiles code with customInput as stdin (NEVER the problem statement)
  const runMutation = useMutation<ExecutionResult, Error, { code: string; language: string; customInput: string }>({
    mutationFn: (body) => api.post<ExecutionResult>(`/problem/run/${activeProblemSlug}`, body),
    onSuccess: (data) => {
      setExecResult(data);
      setProblemStatusMap((prev) => ({
        ...prev,
        [activeProblemSlug]: prev[activeProblemSlug] === "solved" ? "solved" : "attempted",
      }));
    },
    onError: (err) => {
      setExecResult({
        success: false,
        status: "Runtime Error",
        runtime: 0,
        memory: 0,
        error_message: err.message || "Execution error.",
      });
    },
  });

  // Submit Solution Mutation using Judge0
  const submitMutation = useMutation<any, Error, { code: string; language: string }>({
    mutationFn: (body) => api.post<any>(`/problem/submit/${activeProblemSlug}`, body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["problem", activeProblemSlug] });
      const statusStr =
        Array.isArray(data) && data.length > 0 ? data[0].status : data.status || "Accepted";
      const isAccepted = statusStr === "Accepted";

      setExecResult({
        success: isAccepted,
        status: statusStr,
        runtime: Array.isArray(data) ? data[0]?.runtime || 0 : data.runtime || 0,
        memory: Array.isArray(data) ? data[0]?.memory || 0 : data.memory || 0,
        error_message: Array.isArray(data) ? data[0]?.error : data.error_message,
        input: Array.isArray(data) ? data[0]?.input : data.input,
        expected_output: Array.isArray(data) ? data[0]?.expected_output : data.expected_output,
        user_output: Array.isArray(data) ? data[0]?.user_output : data.user_output,
      });

      setProblemStatusMap((prev) => ({
        ...prev,
        [activeProblemSlug]: isAccepted ? "solved" : "attempted",
      }));
      toast.success(isAccepted ? "Accepted! Great job!" : `Status: ${statusStr}`);
    },
    onError: (err) => {
      setExecResult({
        success: false,
        status: "Submission Error",
        runtime: 0,
        memory: 0,
        error_message: err.message || "Submission failed.",
      });
    },
  });

  const isSubmissionsLocked = contestStateStatus === "past";

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
        {/* HEADER & CONTEST TOP BAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <Link
              to="/contests"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> All Contests
            </Link>
            <span className="text-xs text-muted-foreground">/</span>
            <div className="font-display text-xl font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400" />
              <span>{contestData?.title || slug}</span>
              <Badge className="ember-gradient text-primary-foreground text-xs uppercase font-bold">
                {contestData?.type || "Rated"}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Timer Display */}
            <div
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border text-xs font-bold font-mono shadow-sm ${
                contestStateStatus === "live"
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                  : contestStateStatus === "past"
                    ? "border-border bg-card/60 text-muted-foreground"
                    : "border-blue-500/60 bg-blue-500/10 text-blue-400"
              }`}
            >
              <Clock className="h-4 w-4 animate-pulse" />
              <span>{timeRemainingText}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => setShowRulesModal(true)}
            >
              <Shield className="h-3.5 w-3.5" /> Rules
            </Button>

            <Button
              size="sm"
              className="ember-gradient text-primary-foreground border-0 text-xs gap-1.5 font-bold"
              onClick={() => navigate({ to: `/leaderboard` })}
            >
              <BarChart3 className="h-3.5 w-3.5" /> Leaderboard
            </Button>
          </div>
        </div>

        {/* WORKSPACE MAIN LAYOUT (3 PANELS: LEFT INFO, CENTER NAV + DETAILS, RIGHT EDITOR) */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* LEFT PANEL: CONTEST INFO & NAVIGATOR (3 COLS) */}
          <div className="lg:col-span-3 space-y-5">
            {/* Contest Info Card */}
            <div className="rounded-2xl border border-border/80 bg-card/80 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Contest Telemetry
                </span>
                <Badge
                  className={`text-[10px] capitalize ${
                    contestStateStatus === "live"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {contestStateStatus}
                </Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Participants</span>
                  <span className="font-bold flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-blue-400" />{" "}
                    {contestData?.participants_count || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-semibold">
                    {contestData?.duration_minutes || 90} Minutes
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Freeze Scoreboard</span>
                  <span className="font-semibold">
                    {contestData?.isFrozen ? "Yes (60m)" : "No"}
                  </span>
                </div>
              </div>
            </div>

            {/* PROBLEM NAVIGATOR BADGES */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="font-display text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <List className="h-4 w-4" /> Contest Problems
                </h3>
                <span className="text-[10px] text-muted-foreground">Alt + Left/Right</span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {problemsList.map((prob, idx) => {
                  const isCurrent = idx === activeProblemIndex;
                  const probStatus = problemStatusMap[prob.slug] || "unopened";
                  const isSolved = probStatus === "solved";
                  const isAttempted = probStatus === "attempted";

                  return (
                    <button
                      key={prob.id}
                      onClick={() => {
                        setActiveProblemIndex(idx);
                        setExecResult(null);
                      }}
                      className={`flex flex-col items-center justify-center h-12 rounded-xl border font-display font-bold text-sm transition-all ${
                        isCurrent
                          ? "ember-gradient text-primary-foreground shadow-md ring-2 ring-amber-500/50 scale-105"
                          : isSolved
                            ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-400"
                            : isAttempted
                              ? "border-amber-500/60 bg-amber-500/20 text-amber-400"
                              : "border-border/70 bg-card/70 hover:border-border text-foreground"
                      }`}
                    >
                      <span>{prob.letterOrder}</span>
                      <span className="text-[9px] font-normal opacity-80">{prob.points}p</span>
                    </button>
                  );
                })}
              </div>

              {/* Navigator Legend */}
              <div className="flex items-center justify-around pt-2 text-[10px] text-muted-foreground border-t border-border/50">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Solved
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400" /> Attempted
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted" /> Unopened
                </span>
              </div>
            </div>
          </div>

          {/* CENTER PANEL: PROBLEM SPECIFICATIONS (4 COLS) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-border/80 bg-card/90 p-5 space-y-4 shadow-sm min-h-[600px] max-h-[750px] overflow-y-auto">
              {isProblemLoading ? (
                <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                  <span>Loading problem specifications...</span>
                </div>
              ) : !activeProblem ? (
                <div className="p-12 text-center text-xs text-muted-foreground">
                  Select a problem from navigator.
                </div>
              ) : (
                <>
                  {/* Problem Title & Header */}
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold text-sm">
                        {activeProblem.letterOrder}
                      </span>
                      <div>
                        <h2 className="font-display text-lg font-bold">
                          {mainProblem?.name || activeProblem.title}
                        </h2>
                        <span className="text-[10px] text-muted-foreground">
                          Points: {activeProblem.points}
                        </span>
                      </div>
                    </div>
                    <Badge
                      className={`text-xs capitalize ${
                        activeProblem.difficulty === "easy"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : activeProblem.difficulty === "medium"
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                            : "bg-destructive/20 text-destructive border-destructive/30"
                      }`}
                    >
                      {activeProblem.difficulty}
                    </Badge>
                  </div>

                  {/* Problem Description HTML — sanitized via DOMPurify to prevent stored XSS */}
                  <div className="space-y-4 text-xs">
                    <div
                      className="prose prose-invert max-w-none text-xs space-y-2"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(
                          mainProblem?.description_body ||
                            activeProblem.description_body ||
                            "<p>Problem statement content.</p>",
                        ),
                      }}
                    />

                    {/* Hints Accordion */}
                    {mainProblem?.hints && mainProblem.hints.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-border/60">
                        <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                          <HelpCircle className="h-3.5 w-3.5" /> Problem Hints
                        </span>
                        <div className="space-y-1">
                          {mainProblem.hints.map((h, i) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-lg bg-card/60 border border-border/50 text-[11px]"
                            >
                              Hint {i + 1}: {h}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* PREV / NEXT PROBLEM CONTROLS */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                disabled={activeProblemIndex === 0}
                onClick={() => setActiveProblemIndex((prev) => Math.max(0, prev - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Previous (Alt+←)
              </Button>

              <span className="text-xs text-muted-foreground">
                Problem {activeProblemIndex + 1} of {problemsList.length}
              </span>

              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                disabled={activeProblemIndex === problemsList.length - 1}
                onClick={() =>
                  setActiveProblemIndex((prev) => Math.min(problemsList.length - 1, prev + 1))
                }
              >
                Next (Alt+→) <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* RIGHT PANEL: MONACO CODE EDITOR & RUN/SUBMIT (5 COLS) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-border/80 bg-card/90 overflow-hidden shadow-xl space-y-3 p-4">
              {/* Editor Header Bar */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-3">
                  <Select value={selectedLang} onValueChange={(val) => setSelectedLang(val)}>
                    <SelectTrigger className="h-8 text-xs w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="python">Python (3.8)</SelectItem>
                      <SelectItem value="cpp">C++ (GCC 9.2)</SelectItem>
                      <SelectItem value="java">Java (OpenJDK 13)</SelectItem>
                      <SelectItem value="javascript">JavaScript (Node.js)</SelectItem>
                    </SelectContent>
                  </Select>

                  {lastSavedTime && (
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                      Saved {lastSavedTime}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    disabled={runMutation.isPending || submitMutation.isPending}
                    onClick={() => runMutation.mutate({ code: activeCode, language: selectedLang, customInput })}
                  >
                    {runMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    Run Code
                  </Button>

                  <Button
                    type="button"
                    className="h-8 ember-gradient text-primary-foreground border-0 text-xs gap-1.5 font-bold shadow-lg"
                    disabled={submitMutation.isPending || isSubmissionsLocked}
                    onClick={() =>
                      submitMutation.mutate({ code: activeCode, language: selectedLang })
                    }
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    {isSubmissionsLocked ? "Locked" : "Submit"}
                  </Button>
                </div>
              </div>

              {/* MONACO CODE EDITOR */}
              <div className="rounded-xl border border-border/80 bg-background/95 overflow-hidden">
                <Editor
                  height="420px"
                  language={selectedLang === "cpp" ? "cpp" : selectedLang}
                  theme="vs-dark"
                  value={activeCode}
                  onChange={(val) => handleCodeChange(val || "")}
                  options={{
                    minimap: { enabled: false },
                    lineNumbers: "on",
                    fontSize: 13,
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    padding: { top: 10, bottom: 10 },
                  }}
                />
              </div>

              {/* CUSTOM INPUT + OUTPUT */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold mb-1 uppercase tracking-wider">
                    Custom Input (stdin):
                  </div>
                  <textarea
                    id="contest-custom-input"
                    className="w-full min-h-[80px] rounded-lg border border-border/60 bg-background/80 p-2.5 text-xs text-foreground font-mono resize-y focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    placeholder="Enter input for your code..."
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    spellCheck={false}
                  />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold mb-1 uppercase tracking-wider">
                    Output (stdout):
                  </div>
                  <pre className="min-h-[80px] rounded-lg border border-border/60 bg-background/80 p-2.5 text-xs text-foreground font-mono whitespace-pre-wrap overflow-x-auto">
                    {runMutation.isPending ? (
                      <span className="text-amber-400 animate-pulse">Executing…</span>
                    ) : execResult?.error_message ? (
                      <span className="text-destructive">{execResult.error_message}</span>
                    ) : (execResult as any)?.stdout !== undefined && (execResult as any)?.stdout !== null ? (
                      (execResult as any).stdout || <span className="text-muted-foreground">(empty)</span>
                    ) : execResult?.user_output ? (
                      execResult.user_output
                    ) : (
                      <span className="text-muted-foreground">Click Run to see output…</span>
                    )}
                  </pre>
                </div>
              </div>

              {/* EXECUTION STATUS BANNER */}
              {execResult && (
                <div
                  className={`rounded-xl border p-3 text-xs space-y-2 animate-in fade-in duration-150 ${
                    execResult.success
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                      : "border-destructive/50 bg-destructive/10 text-destructive"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      {execResult.success ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      Status: {execResult.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {execResult.runtime > 0 ? `${execResult.runtime}ms | ${execResult.memory}KB` : ""}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* RULES MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-display text-base font-bold flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-400" /> Contest Rules & Guidelines
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setShowRulesModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Contest Rules HTML — sanitized via DOMPurify to prevent stored XSS */}
            <div
              className="prose prose-invert max-w-none text-xs space-y-2 max-h-[300px] overflow-y-auto"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  contestData?.rules || "<p>Standard FireCode contest rules apply.</p>",
                ),
              }}
            />

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setShowRulesModal(false)}
              >
                Close Rules
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
