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
  Terminal,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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
}

interface RunResponse {
  success: boolean;
  status: string;
  runtime: number;
  memory: number;
  error_message?: string | null;
  stdout?: string | null;
  stderr?: string | null;
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

// ─────────────────────────────────────────────────────────────────────────────
// Starter Code Templates — these go into the EDITOR, never the description
// ─────────────────────────────────────────────────────────────────────────────

const STARTER_TEMPLATES: Record<string, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    // Read input from stdin
    // Write output to stdout
    return 0;
}
`,
  c: `#include <stdio.h>

int main() {
    // Read input from stdin
    // Write output to stdout
    return 0;
}
`,
  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Read input and write output
    }
}
`,
  python: `import sys
input = sys.stdin.readline

# Read input and print output
`,
  javascript: `const lines = require('fs').readFileSync('/dev/stdin', 'utf-8').trim().split('\\n');
let idx = 0;

// Read input and print output
`,
  typescript: `import * as readline from 'readline';
const rl = readline.createInterface({ input: process.stdin });
const lines: string[] = [];
rl.on('line', l => lines.push(l));
rl.on('close', () => {
    // Process input lines[] and print output
});
`,
  go: `package main

import (
    "bufio"
    "fmt"
    "os"
)

func main() {
    reader := bufio.NewReader(os.Stdin)
    _ = reader
    // Read input and print output
    fmt.Println()
}
`,
  rust: `use std::io::{self, BufRead};

fn main() {
    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        let _line = line.unwrap();
        // Process input and print output
    }
}
`,
  csharp: `using System;
using System.IO;

class Program {
    static void Main() {
        // Read input and write output
        string line = Console.ReadLine();
    }
}
`,
  kotlin: `fun main() {
    // Read input and print output
    val line = readLine()!!
}
`,
};

// Supported language list for the dropdown
const SUPPORTED_LANGUAGES = [
  { id: "cpp", label: "C++" },
  { id: "c", label: "C" },
  { id: "java", label: "Java" },
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "csharp", label: "C#" },
  { id: "kotlin", label: "Kotlin" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sanitize HTML from backend (never trust raw HTML — strip scripts)
// ─────────────────────────────────────────────────────────────────────────────
function sanitizeHtml(html: string): string {
  // Remove script tags, event handlers, and javascript: URLs
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function ProblemDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  // ── Language & Editor State ────────────────────────────────────────────────
  const [lang, setLang] = useState("cpp");
  // Per-language code cache so switching language preserves edits
  const [codeCache, setCodeCache] = useState<Record<string, string>>({});

  // ── Run State ─────────────────────────────────────────────────────────────
  // customInput is what the user types in the "Custom Input" textarea
  const [customInput, setCustomInput] = useState("");
  const [runResult, setRunResult] = useState<RunResponse | null>(null);

  // ── Tabs & Submission Filters ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("desc");
  const [subLangFilter, setSubLangFilter] = useState("all");
  const [subVerdictFilter, setSubVerdictFilter] = useState("all");
  const [subDateFilter, setSubDateFilter] = useState("all");
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);

  // Reset state when problem changes
  useEffect(() => {
    setRunResult(null);
    setCodeCache({});
    setCustomInput("");
  }, [id]);

  // ── Data Fetching ─────────────────────────────────────────────────────────
  const { data: problemData, isLoading } = useQuery<LegacyFrontendProblem>({
    queryKey: ["problem", id],
    queryFn: () => api.get<LegacyFrontendProblem>(`/problem/${id}`),
    enabled: !!id,
  });

  // Smart real-time polling for pending submissions
  const { data: submissions = [] } = useQuery<SubmissionItem[]>({
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

  // ── Populate starter code from API, but NEVER overwrite user edits ─────────
  useEffect(() => {
    if (!main?.code_body) return;
    setCodeCache((prev) => {
      const updated = { ...prev };
      Object.entries(main.code_body).forEach(([langKey, starterCode]) => {
        // Only set if the user hasn't typed anything yet for this language
        if (updated[langKey] === undefined && starterCode) {
          updated[langKey] = starterCode;
        }
      });
      return updated;
    });
    // Set default language if the server provides one
    if (main.code_default_language && main.code_body[main.code_default_language]) {
      setLang((prev) => (main.code_body[prev] ? prev : main.code_default_language));
    }
  }, [main]);

  // Prefill customInput with first sample input when problem loads
  useEffect(() => {
    if (problemData?.test && problemData.test.length > 0) {
      const firstInput = problemData.test[0];
      if (Array.isArray(firstInput) && firstInput.length > 0) {
        const inputVal = typeof firstInput[0] === "string" ? firstInput[0] : JSON.stringify(firstInput[0]);
        setCustomInput(inputVal);
      }
    }
  }, [problemData]);

  // ── Active code for the editor ─────────────────────────────────────────────
  // Priority: user-edited cache > API starter code > local default template
  const activeCode = useMemo(
    () => codeCache[lang] ?? (main?.code_body?.[lang] || STARTER_TEMPLATES[lang] || ""),
    [codeCache, lang, main],
  );

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCodeCache((prev) => ({ ...prev, [lang]: newCode }));
    },
    [lang],
  );

  // Derive display metadata
  const problemTitle = main
    ? `${main.id}. ${main.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`
    : `#${id}`;
  const difficulty = main?.difficulty
    ? main.difficulty.charAt(0).toUpperCase() + main.difficulty.slice(1)
    : "—";
  const topics = main?.related_topics ?? [];
  const acceptanceRate = main ? `${main.acceptance_rate_count}%` : "—";
  const submissionCountText = main ? `${main.submission_count} submissions` : "—";
  const hints = main?.hints ?? [];

  // ── Run Mutation ──────────────────────────────────────────────────────────
  // Sends: { code, language, customInput }
  // The backend sends ONLY code + customInput to Judge0 — never the problem statement
  const runMutation = useMutation<RunResponse, Error, { code: string; language: string; customInput: string }>({
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

  // ── Submit Mutation ───────────────────────────────────────────────────────
  // Sends: { code, language }  — NO custom input, runs against hidden test cases
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

  // ── Filter Submissions (Newest First) ─────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-dvh flex-col">
      {/* ── Header ── */}
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
              // IMPORTANT: customInput (not the problem statement) is sent to the compiler
              runMutation.mutate({ code: activeCode, language: lang, customInput });
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
              // Submit sends ONLY code + language — hidden test cases are on the backend
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
        {/* ── LEFT: Problem Statement Panel ── */}
        <div className="overflow-y-auto border-r border-border/60 p-6 lg:max-h-[calc(100dvh-3.5rem)]">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to="/problems" className="hover:text-foreground">
              Problems
            </Link>{" "}
            / <span>#{id}</span>
          </div>

          {/* Title */}
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">{problemTitle}</h1>

          {/* Metadata row */}
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

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
            <TabsList className="grid w-full max-w-md grid-cols-4">
              <TabsTrigger value="desc">Description</TabsTrigger>
              <TabsTrigger value="editorial">Editorial</TabsTrigger>
              <TabsTrigger value="submissions">Submissions ({submissions.length})</TabsTrigger>
              <TabsTrigger value="discuss">Discuss</TabsTrigger>
            </TabsList>

            {/* ── DESCRIPTION TAB ── */}
            <TabsContent value="desc" className="mt-4">
              {isLoading && (
                <p className="text-sm text-muted-foreground">Loading problem details...</p>
              )}
              {!isLoading && main?.description_body && (
                /*
                 * IMPORTANT: description_body is ONLY the problem statement HTML.
                 * It is built by dto.ts on the backend and contains ONLY:
                 *   - Description text
                 *   - Input/Output format
                 *   - Constraints
                 *   - Examples
                 * It NEVER contains code and is NEVER sent to the compiler.
                 */
                <div
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(main.description_body) }}
                  className="prose-problem text-sm leading-relaxed text-muted-foreground"
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

            {/* ── EDITORIAL TAB ── */}
            <TabsContent value="editorial">
              {editorialData?.editorial_body || problemData?.editorial?.editorial_body ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(
                      editorialData?.editorial_body || problemData?.editorial?.editorial_body || "",
                    ),
                  }}
                  className="mt-4 text-sm leading-relaxed text-muted-foreground space-y-2"
                />
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No editorial has been written for this problem yet.
                </p>
              )}
            </TabsContent>

            {/* ── SUBMISSIONS TAB ── */}
            <TabsContent value="submissions" className="space-y-4 pt-4">
              {/* Filter Controls */}
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

                        {/* Expandable Details */}
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

        {/* ── RIGHT: Editor Panel ── */}
        <div className="flex min-h-[500px] flex-col">
          {/* Language selector toolbar */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
            <Select
              value={lang}
              onValueChange={(newLang) => {
                setLang(newLang);
                // If no cached code for this language, the editor falls back to STARTER_TEMPLATES
                // The problem description is NEVER put here
              }}
            >
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

          {/*
           * MONACO EDITOR
           * value = activeCode = user's code (from cache or starter template)
           * The problem statement NEVER appears here.
           * The editor value is ONLY sent to /problem/run/:id and /problem/submit/:id
           */}
          <div className="flex-1 min-h-[380px] overflow-hidden bg-background/80 border-b border-border/60">
            <Editor
              height="100%"
              language={lang === "csharp" ? "csharp" : lang}
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

          {/* ── Bottom Panel: Custom Input + Output ── */}
          <div className="bg-card/40 p-4 space-y-4 border-t border-border/60">
            {/* Status bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-amber-400" />
                <span className="font-display text-sm font-bold text-foreground">I/O Panel</span>
              </div>
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
                {runResult?.status ?? "Ready"}
                {runResult && runResult.runtime > 0
                  ? ` · ${runResult.runtime}ms · ${runResult.memory}KB`
                  : ""}
              </span>
            </div>

            {/* Custom Input + Output side by side */}
            <div className="grid gap-3 md:grid-cols-2">
              {/* Custom Input */}
              <div>
                <div className="text-[11px] text-muted-foreground font-semibold mb-1">
                  Custom Input (stdin):
                </div>
                <textarea
                  id="custom-input-textarea"
                  className="w-full min-h-[100px] rounded-lg border border-border/60 bg-background/80 p-3 text-xs text-foreground font-mono resize-y focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  placeholder="Enter your custom input here (will be fed to stdin)..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  spellCheck={false}
                />
              </div>

              {/* Output */}
              <div>
                <div className="text-[11px] text-muted-foreground font-semibold mb-1">
                  Output (stdout):
                </div>
                <pre className="min-h-[100px] rounded-lg border border-border/60 bg-background/80 p-3 text-xs text-foreground overflow-x-auto whitespace-pre-wrap font-mono">
                  {runMutation.isPending || submitMutation.isPending ? (
                    <span className="text-amber-400 animate-pulse">Executing…</span>
                  ) : runResult?.error_message ? (
                    <span className="text-destructive">{runResult.error_message}</span>
                  ) : runResult?.stdout !== undefined && runResult.stdout !== null ? (
                    runResult.stdout || <span className="text-muted-foreground">(empty output)</span>
                  ) : runResult?.user_output !== undefined && runResult.user_output !== null ? (
                    runResult.user_output || <span className="text-muted-foreground">(empty output)</span>
                  ) : (
                    <span className="text-muted-foreground">
                      Click Run to see output here…
                    </span>
                  )}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
