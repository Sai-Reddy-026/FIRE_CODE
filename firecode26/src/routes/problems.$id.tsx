import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import Editor from "@monaco-editor/react";
import { Logo } from "@/components/site/Logo";
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
import {
  ArrowLeft,
  Bookmark,
  Play,
  Send,
  Maximize2,
  CheckCircle2,
  Loader2,
  Filter,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  AlertTriangle,
  Check,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

export const Route = createFileRoute("/problems/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Problem ${params.id} — FireCode` },
      {
        name: "description",
        content:
          "Solve this problem in the FireCode workspace with test cases, editorial and discussion.",
      },
      { property: "og:title", content: `Problem ${params.id} — FireCode` },
      { property: "og:description", content: "Solve, test and submit in the FireCode workspace." },
    ],
  }),
  component: ProblemDetail,
});

interface LegacyFrontendProblem {
  _id: string;
  main: {
    id: number;
    name: string;
    difficulty: string;
    description_body: string;
    accept_count: number;
    submission_count: number;
    acceptance_rate_count: number;
    discussion_count: number;
    related_topics: string[];
    similar_questions: any[];
    solution_count: number;
    code_default_language: string;
    code_body: Record<string, string>;
    status?: string;
    hints?: string[];
  };
  editorial: {
    editorial_body: string;
  };
  test: any[][];
  function_name: string;
}

interface RunResponse {
  success: boolean;
  status: string;
  runtime: number;
  memory: number;
  error_message?: string | null;
  input?: string | null;
  expected_output?: string | null;
  user_output?: string | null;
  results?: any[];
}

interface SubmissionItem {
  _id: string;
  userId: string;
  username: string;
  problemId: string;
  problemSlug: string;
  problemTitle: string;
  status: string;
  language: string;
  code: string;
  code_body: string;
  runtime: number;
  memory: number;
  error?: string;
  input?: string;
  expected_output?: string;
  user_output?: string;
  testCasesPassed?: number;
  totalTestCases?: number;
  submittedAt: string;
  time: string;
}

interface EditorialResponse {
  editorial_body: string;
}

function ProblemDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  const [lang, setLang] = useState("javascript");
  const [codeCache, setCodeCache] = useState<Record<string, string>>({});
  const [runResult, setRunResult] = useState<RunResponse | null>(null);

  // Tabs & Submission Filters State
  const [activeTab, setActiveTab] = useState("desc");
  const [subLangFilter, setSubLangFilter] = useState("all");
  const [subVerdictFilter, setSubVerdictFilter] = useState("all");
  const [subDateFilter, setSubDateFilter] = useState("all");
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);

  const [selectedCaseIdx, setSelectedCaseIdx] = useState(0);

  useEffect(() => {
    setRunResult(null);
    setCodeCache({});
    setSelectedCaseIdx(0);
  }, [id]);

  const { data: problemData, isLoading } = useQuery<LegacyFrontendProblem>({
    queryKey: ["problem", id],
    queryFn: () => api.get<LegacyFrontendProblem>(`/problem/${id}`),
    enabled: !!id,
  });

  // SMART REAL-TIME POLLING FOR SUBMISSIONS
  const { data: submissions = [], refetch: refetchSubmissions } = useQuery<SubmissionItem[]>({
    queryKey: ["submissions", id],
    queryFn: () => api.get<SubmissionItem[]>(`/problem/submissions/${id}`),
    enabled: !!id,
    refetchInterval: (query) => {
      const subs = query.state.data;
      if (!subs || !Array.isArray(subs)) return false;
      const hasActive = subs.some(
        (s) =>
          s.status === "Pending" ||
          s.status === "Queued" ||
          s.status === "Compiling" ||
          s.status === "Running",
      );
      return hasActive ? 2000 : false;
    },
  });

  const { data: editorialData } = useQuery<EditorialResponse>({
    queryKey: ["editorial", id],
    queryFn: () => api.get<EditorialResponse>(`/problem/${id}/editorial`),
    enabled: !!id,
  });

  const main = problemData?.main;

  useEffect(() => {
    if (main?.code_body) {
      setCodeCache((prev) => {
        const updated = { ...prev };
        Object.entries(main.code_body).forEach(([k, v]) => {
          if (updated[k] === undefined) {
            updated[k] = v;
          }
        });
        return updated;
      });
      if (main.code_default_language && main.code_body[main.code_default_language]) {
        setLang((prev) => (main.code_body[prev] ? prev : main.code_default_language));
      }
    }
  }, [main]);

  const SUPPORTED_LANGUAGES = useMemo(
    () => [
      { id: "javascript", label: "JavaScript" },
      { id: "typescript", label: "TypeScript" },
      { id: "python", label: "Python" },
      { id: "cpp", label: "C++" },
      { id: "c", label: "C" },
      { id: "java", label: "Java" },
      { id: "go", label: "Go" },
      { id: "rust", label: "Rust" },
      { id: "csharp", label: "C#" },
      { id: "kotlin", label: "Kotlin" },
    ],
    [],
  );

  const DEFAULT_STARTER_TEMPLATES: Record<string, string> = useMemo(
    () => ({
      javascript: "// Write your solution here\nfunction solution(nums, target) {\n    return [];\n}\n",
      typescript: "// Write your solution here\nfunction solution(nums: number[], target: number): number[] {\n    return [];\n}\n",
      python: "# Write your solution here\ndef solution(nums: list[int], target: int) -> list[int]:\n    return []\n",
      cpp: "// Write your solution here\n#include <iostream>\n#include <vector>\n#include <unordered_map>\n#include <string>\n#include <algorithm>\nusing namespace std;\n\nvector<int> solution(vector<int>& nums, int target) {\n    unordered_map<int, int> mp;\n    for (int i = 0; i < nums.size(); i++) {\n        int complement = target - nums[i];\n        if (mp.find(complement) != mp.end()) {\n            return {mp[complement], i};\n        }\n        mp[nums[i]] = i;\n    }\n    return {};\n}\n",
      c: "// Write your solution here\n#include <stdio.h>\n#include <stdlib.h>\n\nint* solution(int* nums, int numsSize, int target, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}\n",
      java: "// Write your solution here\nimport java.util.*;\n\npublic class Solution {\n    public int[] solution(int[] nums, int target) {\n        Map<Integer, Integer> map = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int complement = target - nums[i];\n            if (map.containsKey(complement)) {\n                return new int[] { map.get(complement), i };\n            }\n            map.put(nums[i], i);\n        }\n        return new int[]{};\n    }\n}\n",
      go: "// Write your solution here\npackage main\n\nfunc solution(nums []int, target int) []int {\n    return []int{}\n}\n",
      rust: "// Write your solution here\nfn solution(nums: Vec<i32>, target: i32) -> Vec<i32> {\n    vec![]\n}\n",
      csharp: "// Write your solution here\nusing System;\nusing System.Collections.Generic;\n\npublic class Solution {\n    public int[] SolutionMethod(int[] nums, int target) {\n        return new int[]{};\n    }\n}\n",
      kotlin: "// Write your solution here\nfun solution(nums: IntArray, target: Int): IntArray {\n    return intArrayOf()\n}\n",
    }),
    [],
  );

  const activeCode =
    codeCache[lang] ?? (main?.code_body?.[lang] || DEFAULT_STARTER_TEMPLATES[lang] || "");

  const sampleCases = useMemo(() => {
    if (problemData?.test && Array.isArray(problemData.test) && problemData.test.length > 0) {
      return problemData.test.map((t, idx) => ({
        id: idx + 1,
        input: typeof t[0] === "string" ? t[0] : JSON.stringify(t[0]),
        expectedOutput: typeof t[1] === "string" ? t[1] : JSON.stringify(t[1]),
      }));
    }
    return [
      { id: 1, input: 's = "abcabcbb"', expectedOutput: "3" },
      { id: 2, input: 's = "bbbbb"', expectedOutput: "1" },
      { id: 3, input: 's = "pwwkew"', expectedOutput: "3" },
    ];
  }, [problemData?.test]);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCodeCache((prev) => ({
        ...prev,
        [lang]: newCode,
      }));
    },
    [lang],
  );

  const problemTitle = main
    ? `${main.id}. ${main.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`
    : `#${id}`;
  const difficulty = main?.difficulty
    ? main.difficulty.charAt(0).toUpperCase() + main.difficulty.slice(1)
    : "—";
  const topics = main?.related_topics ?? [];
  const acceptanceRate = main ? `${main.acceptance_rate_count}%` : "—";
  const submissionCountText = main ? `${main.submission_count} submissions` : "—";
  const descriptionHtml = main?.description_body;
  const hints = main?.hints ?? [];

  const runMutation = useMutation<RunResponse, Error, { code: string; language: string }>({
    mutationFn: (body) => api.post<RunResponse>(`/problem/run/${id}`, body),
    onSuccess: (data) => {
      setRunResult(data);
    },
    onError: (err) => {
      setRunResult({
        success: false,
        status: "Runtime Error",
        runtime: 0,
        memory: 0,
        error_message: err.message || "Execution failed. Please check backend connection.",
      });
    },
  });

  const submitMutation = useMutation<
    SubmissionItem[],
    Error,
    { code: string; language: string; problem_name?: string; localDate?: string }
  >({
    mutationFn: (body) => api.post<SubmissionItem[]>(`/problem/submit/${id}`, body),
    onSuccess: (data) => {
      queryClient.setQueryData(["submissions", id], data);
      queryClient.invalidateQueries({ queryKey: ["problem", id] });
      setActiveTab("submissions");

      if (Array.isArray(data) && data.length > 0) {
        const latest = data[0];
        setRunResult({
          success: latest.status === "Accepted",
          status: latest.status,
          runtime: latest.runtime,
          memory: latest.memory,
          error_message: latest.error,
          input: latest.input,
          expected_output: latest.expected_output,
          user_output: latest.user_output,
        });
      }
    },
    onError: (err) => {
      setRunResult({
        success: false,
        status: "Submission Failed",
        runtime: 0,
        memory: 0,
        error_message: err.message || "Submission failed. Please check backend connection.",
      });
    },
  });

  // Filter Submissions (Newest First)
  const filteredSubmissions = useMemo(() => {
    return submissions
      .filter((s) => {
        if (subLangFilter !== "all" && s.language.toLowerCase() !== subLangFilter.toLowerCase())
          return false;
        if (subVerdictFilter !== "all" && s.status.toLowerCase() !== subVerdictFilter.toLowerCase())
          return false;
        if (subDateFilter === "today") {
          const subDate = new Date(s.submittedAt || (s as any).time).toDateString();
          if (subDate !== new Date().toDateString()) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.submittedAt || (b as any).time).getTime() -
          new Date(a.submittedAt || (a as any).time).getTime(),
      );
  }, [submissions, subLangFilter, subVerdictFilter, subDateFilter]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between gap-4 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link to="/problems">
            <Button variant="ghost" size="icon" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Logo />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Bookmark className="mr-1.5 h-4 w-4" />
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={runMutation.isPending || submitMutation.isPending || !activeCode.trim()}
            onClick={() => {
              setRunResult(null);
              runMutation.mutate({ code: activeCode, language: lang });
            }}
          >
            <Play className="mr-1.5 h-4 w-4" />
            {runMutation.isPending ? "Running…" : "Run"}
          </Button>
          <Button
            size="sm"
            className="ember-gradient text-primary-foreground border-0"
            disabled={submitMutation.isPending || runMutation.isPending || !activeCode.trim()}
            onClick={() => {
              setRunResult(null);
              submitMutation.mutate({
                code: activeCode,
                language: lang,
                problem_name: main?.name,
                localDate: new Date().toISOString().split("T")[0],
              });
            }}
          >
            <Send className="mr-1.5 h-4 w-4" />
            {submitMutation.isPending ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </header>

      <div className="grid flex-1 gap-0 lg:grid-cols-2">
        {/* Problem pane */}
        <div className="overflow-y-auto border-r border-border/60 p-6 lg:max-h-[calc(100dvh-3.5rem)]">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to="/problems" className="hover:text-foreground">
              Problems
            </Link>{" "}
            / <span>#{id}</span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">{problemTitle}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                main?.difficulty === "hard"
                  ? "text-[color:var(--color-destructive)] border-[color:var(--color-destructive)]/40"
                  : main?.difficulty === "medium"
                    ? "text-[color:var(--color-warning)] border-[color:var(--color-warning)]/30"
                    : "text-[color:var(--color-success)] border-[color:var(--color-success)]/30"
              }
            >
              {difficulty}
            </Badge>
            {topics.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              Acceptance {acceptanceRate} · {submissionCountText}
            </span>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
            <TabsList className="grid w-full max-w-md grid-cols-4">
              <TabsTrigger value="desc">Description</TabsTrigger>
              <TabsTrigger value="editorial">Editorial</TabsTrigger>
              <TabsTrigger value="submissions">Submissions ({submissions.length})</TabsTrigger>
              <TabsTrigger value="discuss">Discuss</TabsTrigger>
            </TabsList>

            {/* DESCRIPTION TAB */}
            <TabsContent value="desc" className="prose prose-invert max-w-none">
              {isLoading && (
                <p className="mt-4 text-sm text-muted-foreground">Loading problem details...</p>
              )}
              {!isLoading && descriptionHtml && (
                <div
                  dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                  className="mt-4 text-sm leading-relaxed text-muted-foreground space-y-3"
                />
              )}

              {hints.length > 0 && (
                <>
                  <h3 className="mt-6 text-sm font-semibold uppercase tracking-wider text-foreground">
                    Hint
                  </h3>
                  <div className="mt-2 rounded-lg border border-[color:var(--color-ember)]/30 bg-[color:var(--color-ember)]/5 p-4 text-sm text-muted-foreground">
                    {hints.join(" ")}
                  </div>
                </>
              )}
            </TabsContent>

            {/* EDITORIAL TAB */}
            <TabsContent value="editorial">
              {editorialData?.editorial_body || problemData?.editorial?.editorial_body ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html:
                      editorialData?.editorial_body || problemData?.editorial?.editorial_body || "",
                  }}
                  className="mt-4 text-sm leading-relaxed text-muted-foreground space-y-2"
                />
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No editorial has been written for this problem yet.
                </p>
              )}
            </TabsContent>

            {/* SUBMISSIONS TAB & REAL-TIME HISTORY MANAGER */}
            <TabsContent value="submissions" className="space-y-4 pt-4">
              {/* Filter Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-border/60 bg-card/60 text-xs">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-bold text-muted-foreground">Filter History:</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select value={subLangFilter} onValueChange={setSubLangFilter}>
                    <SelectTrigger className="h-7 text-xs w-[120px]">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Languages</SelectItem>
                      <SelectItem value="cpp">C++</SelectItem>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="java">Java</SelectItem>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={subVerdictFilter} onValueChange={setSubVerdictFilter}>
                    <SelectTrigger className="h-7 text-xs w-[130px]">
                      <SelectValue placeholder="Verdict" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Verdicts</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="wrong answer">Wrong Answer</SelectItem>
                      <SelectItem value="runtime error">Runtime Error</SelectItem>
                      <SelectItem value="time limit exceeded">TLE</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={subDateFilter} onValueChange={setSubDateFilter}>
                    <SelectTrigger className="h-7 text-xs w-[100px]">
                      <SelectValue placeholder="Date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Submissions List */}
              {filteredSubmissions.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-border/60 rounded-xl bg-card/40">
                  No submissions match your filters.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {filteredSubmissions.map((s) => {
                    const isPending = s.status === "Pending" || s.status === "Queued";
                    const isCompiling = s.status === "Compiling";
                    const isRunning = s.status === "Running";
                    const isAccepted = s.status === "Accepted";
                    const isExpanded = expandedSubId === s._id;
                    const timeStr = new Date(s.submittedAt || (s as any).time).toLocaleString();

                    return (
                      <div
                        key={s._id}
                        className="rounded-xl border border-border/70 bg-card/80 transition-all overflow-hidden shadow-sm"
                      >
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent/40"
                          onClick={() => setExpandedSubId(isExpanded ? null : s._id)}
                        >
                          <div className="flex items-center gap-3">
                            {isAccepted ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1 text-xs font-bold">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Accepted
                              </Badge>
                            ) : isPending ? (
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1 text-xs font-bold animate-pulse">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Queued
                              </Badge>
                            ) : isCompiling ? (
                              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1 text-xs font-bold">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Compiling
                              </Badge>
                            ) : isRunning ? (
                              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 gap-1 text-xs font-bold">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running
                              </Badge>
                            ) : (
                              <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-xs font-bold">
                                {s.status}
                              </Badge>
                            )}

                            <div>
                              <div className="font-mono text-[10px] text-muted-foreground">
                                ID: #{s._id.substring(0, 8)}
                              </div>
                              <div className="text-[11px] text-muted-foreground">{timeStr}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {s.language}
                            </Badge>
                            {s.runtime > 0 && (
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {s.runtime}ms
                              </span>
                            )}
                            {s.memory > 0 && (
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {(s.memory * 1024).toFixed(0)}KB
                              </span>
                            )}
                            {s.totalTestCases ? (
                              <span className="text-[11px] font-bold text-amber-400">
                                {s.testCasesPassed}/{s.totalTestCases} Passed
                              </span>
                            ) : null}
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {/* Expandable Inspection Details */}
                        {isExpanded && (
                          <div className="p-4 border-t border-border/60 bg-background/60 space-y-3 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                              <span>Submitted Code ({s.language})</span>
                            </div>
                            <pre className="p-3 rounded-lg border border-border/60 bg-card font-mono text-xs overflow-x-auto max-h-48">
                              {s.code || s.code_body || "// No code saved"}
                            </pre>

                            {s.error && (
                              <div className="space-y-1">
                                <span className="text-[11px] font-bold text-destructive">
                                  Error Message:
                                </span>
                                <pre className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 font-mono text-xs text-destructive whitespace-pre-wrap">
                                  {s.error}
                                </pre>
                              </div>
                            )}

                            {s.user_output && (
                              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                <div>
                                  <span className="text-[10px] font-bold text-muted-foreground">
                                    Your Output:
                                  </span>
                                  <pre className="p-2 rounded bg-card">{s.user_output}</pre>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold text-muted-foreground">
                                    Expected Output:
                                  </span>
                                  <pre className="p-2 rounded bg-card">{s.expected_output}</pre>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="discuss">
              <p className="mt-4 text-sm text-muted-foreground">Community discussions loading…</p>
            </TabsContent>
          </Tabs>
        </div>

        {/* Editor pane */}
        <div className="flex min-h-[500px] flex-col">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Fullscreen">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-[380px] overflow-hidden bg-background/80 border-b border-border/60">
            <Editor
              height="100%"
              language={lang === "cpp" ? "cpp" : lang}
              theme="vs-dark"
              value={activeCode}
              onChange={(val) => handleCodeChange(val || "")}
              options={{
                minimap: { enabled: false },
                lineNumbers: "on",
                fontSize: 14,
                fontFamily: "'Fira Code', 'Cascadia Code', Consolas, Monaco, monospace",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                automaticLayout: true,
                padding: { top: 12, bottom: 12 },
              }}
            />
          </div>

          <div className="bg-card/40 p-4 space-y-4 border-t border-border/60">
            {/* Testcase & Result Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-3">
                <span className="font-display text-sm font-bold text-foreground">Testcases</span>
                <div className="flex items-center gap-1.5">
                  {sampleCases.map((sc, idx) => {
                    const caseResult = runResult?.results?.[idx];
                    const isPassed = caseResult?.status === "Accepted";

                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setSelectedCaseIdx(idx)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                          selectedCaseIdx === idx
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm"
                            : "bg-background/60 text-muted-foreground hover:bg-background hover:text-foreground border border-transparent"
                        }`}
                      >
                        <span>Case {sc.id}</span>
                        {caseResult && (
                          <span className={isPassed ? "text-emerald-400 font-bold" : "text-destructive font-bold"}>
                            {isPassed ? "✔" : "✖"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                    runResult?.status === "Accepted"
                      ? "text-emerald-400"
                      : runResult?.status
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {runResult?.status ?? "Ready to Run"}
                  {runResult ? ` · ${runResult.runtime}ms · ${runResult.memory}KB` : ""}
                </span>
              </div>
            </div>

            {/* Active Test Case Inputs & Output display */}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-[11px] text-muted-foreground font-semibold flex items-center justify-between">
                  <span>Input (Case {selectedCaseIdx + 1}):</span>
                </div>
                <pre className="mono mt-1 rounded-lg border border-border/60 bg-background/80 p-3 text-xs text-foreground overflow-x-auto">
                  {sampleCases[selectedCaseIdx]?.input || runResult?.input || 's = "pwwkew"'}
                </pre>
              </div>

              <div>
                <div className="text-[11px] text-muted-foreground font-semibold flex items-center justify-between">
                  <span>{runResult ? "Your Output:" : "Expected Output:"}</span>
                  {sampleCases[selectedCaseIdx]?.expectedOutput && (
                    <span className="text-[10px] text-amber-400 font-mono">
                      Expected: {sampleCases[selectedCaseIdx].expectedOutput}
                    </span>
                  )}
                </div>
                <pre className="mono mt-1 rounded-lg border border-border/60 bg-background/80 p-3 text-xs text-foreground overflow-x-auto">
                  {runResult?.error_message
                    ? `Error: ${runResult.error_message}`
                    : runResult?.results?.[selectedCaseIdx]?.user_output !== undefined
                      ? runResult.results[selectedCaseIdx].user_output
                      : runResult?.user_output !== undefined
                        ? runResult.user_output
                        : sampleCases[selectedCaseIdx]?.expectedOutput || "Run output will appear here"}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
