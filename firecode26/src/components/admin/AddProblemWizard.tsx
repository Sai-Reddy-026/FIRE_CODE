import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import {
  SampleTestCaseManager,
  SampleTestCaseItem,
} from "@/components/admin/SampleTestCaseManager";
import {
  HiddenTestCaseManager,
  HiddenTestCaseItem,
} from "@/components/admin/HiddenTestCaseManager";
import {
  FileText,
  Code,
  CheckCircle2,
  Lock,
  Eye,
  ArrowLeft,
  ArrowRight,
  Save,
  Plus,
  Trash2,
  HelpCircle,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  RotateCcw,
  Sparkles,
  Info,
} from "lucide-react";

interface StepIndicator {
  id: number;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepIndicator[] = [
  { id: 1, name: "Basic Information", description: "Metadata & Tags", icon: FileText },
  { id: 2, name: "Problem Content", description: "Rich Specifications", icon: Code },
  { id: 3, name: "Sample Test Cases", description: "Visible Examples", icon: CheckCircle2 },
  { id: 4, name: "Hidden Test Cases", description: "Evaluation Suite", icon: Lock },
  { id: 5, name: "Preview & Publish", description: "Review & Deploy", icon: Eye },
];

export interface AddProblemFormData {
  // Step 1: Basic Info
  problemId: number;
  title: string;
  slug: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  points: number;
  tags: string[];
  status: "draft" | "pending_review" | "published";
  timeLimit: number;
  memoryLimit: number;

  // Step 2: Problem Content (Rich Text)
  description: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  hints: string;
  editorial: string;

  // Step 3 & 4: Test Cases & Solution
  sampleTestCases: SampleTestCaseItem[];
  hiddenTestCases: HiddenTestCaseItem[];
  officialSolution: {
    language: string;
    code: string;
  };
}

export interface StepValidationResult {
  stepId: number;
  title: string;
  isValid: boolean;
  errors: string[];
}

export interface ProblemValidationSummary {
  isValid: boolean;
  steps: StepValidationResult[];
  fieldErrors: Record<string, string>;
}

// -------------------------------------------------
// VALIDATION ENGINE
// -------------------------------------------------
export function validateProblemForm(formData: AddProblemFormData): ProblemValidationSummary {
  const steps: StepValidationResult[] = [
    { stepId: 1, title: "Basic Information", isValid: true, errors: [] },
    { stepId: 2, title: "Problem Content", isValid: true, errors: [] },
    { stepId: 3, title: "Sample Test Cases", isValid: true, errors: [] },
    { stepId: 4, title: "Hidden Test Cases", isValid: true, errors: [] },
  ];

  const fieldErrors: Record<string, string> = {};

  const isHtmlEmpty = (html: string) => {
    if (!html) return true;
    const stripped = html.replace(/<[^>]*>/g, "").trim();
    return stripped.length === 0;
  };

  // STEP 1 VALIDATION
  if (!formData.title || !formData.title.trim()) {
    steps[0].errors.push("Problem Title is required.");
    fieldErrors["title"] = "Problem Title is required.";
  }

  if (!formData.slug || !formData.slug.trim()) {
    steps[0].errors.push("Problem Slug is required.");
    fieldErrors["slug"] = "Problem Slug is required.";
  }

  if (!formData.problemId || formData.problemId <= 0) {
    steps[0].errors.push("Problem ID must be a positive integer.");
    fieldErrors["problemId"] = "Problem ID must be > 0.";
  }

  if (!formData.difficulty) {
    steps[0].errors.push("Difficulty selection is required.");
    fieldErrors["difficulty"] = "Difficulty is required.";
  }

  if (!formData.category || !formData.category.trim()) {
    steps[0].errors.push("Category selection is required.");
    fieldErrors["category"] = "Category is required.";
  }

  if (!Array.isArray(formData.tags) || formData.tags.length === 0) {
    steps[0].errors.push("At least one Tag is required.");
    fieldErrors["tags"] = "At least one Tag is required.";
  }

  if (formData.timeLimit === undefined || formData.timeLimit <= 0) {
    steps[0].errors.push("Time Limit must be > 0 ms.");
    fieldErrors["timeLimit"] = "Time Limit must be > 0 ms.";
  }

  if (formData.memoryLimit === undefined || formData.memoryLimit <= 0) {
    steps[0].errors.push("Memory Limit must be > 0 MB.");
    fieldErrors["memoryLimit"] = "Memory Limit must be > 0 MB.";
  }

  steps[0].isValid = steps[0].errors.length === 0;

  // STEP 2 VALIDATION
  if (isHtmlEmpty(formData.description)) {
    steps[1].errors.push("Problem Description cannot be empty.");
    fieldErrors["description"] = "Description is required.";
  }

  if (isHtmlEmpty(formData.inputFormat)) {
    steps[1].errors.push("Input Format cannot be empty.");
    fieldErrors["inputFormat"] = "Input Format is required.";
  }

  if (isHtmlEmpty(formData.outputFormat)) {
    steps[1].errors.push("Output Format cannot be empty.");
    fieldErrors["outputFormat"] = "Output Format is required.";
  }

  if (isHtmlEmpty(formData.constraints)) {
    steps[1].errors.push("Constraints cannot be empty.");
    fieldErrors["constraints"] = "Constraints are required.";
  }

  steps[1].isValid = steps[1].errors.length === 0;

  // STEP 3 VALIDATION
  if (!Array.isArray(formData.sampleTestCases) || formData.sampleTestCases.length === 0) {
    steps[2].errors.push("At least one sample testcase exists requirement failed.");
  } else {
    const seenInputs = new Set<string>();
    formData.sampleTestCases.forEach((tc, idx) => {
      if (!tc.input || !tc.input.trim()) {
        steps[2].errors.push(`Sample Case #${idx + 1}: Missing Input.`);
      }
      if (!tc.output || !tc.output.trim()) {
        steps[2].errors.push(`Sample Case #${idx + 1}: Missing Expected Output.`);
      }
      const trimmed = tc.input.trim();
      if (seenInputs.has(trimmed)) {
        steps[2].errors.push(`Sample Case #${idx + 1}: Duplicate input content.`);
      } else if (trimmed) {
        seenInputs.add(trimmed);
      }
    });
  }

  steps[2].isValid = steps[2].errors.length === 0;

  // STEP 4 VALIDATION
  if (
    !formData.officialSolution ||
    !formData.officialSolution.code ||
    !formData.officialSolution.code.trim()
  ) {
    steps[3].errors.push("Official Solution exists requirement failed.");
    fieldErrors["officialSolution"] = "Official Solution code is required.";
  }

  if (!Array.isArray(formData.hiddenTestCases) || formData.hiddenTestCases.length === 0) {
    steps[3].errors.push("At least one hidden testcase exists requirement failed.");
  } else {
    const seenHiddenInputs = new Set<string>();
    formData.hiddenTestCases.forEach((tc, idx) => {
      // Check missing input first (always applicable)
      if (!tc.input || !tc.input.trim()) {
        steps[3].errors.push(`Hidden Case #${idx + 1}: Missing Input.`);
      }

      // Status-aware output validation: pending/failed take precedence over generic "missing" message
      if (tc.status === "pending") {
        steps[3].errors.push(
          `Hidden Case #${idx + 1}: Output not generated yet — click "Generate Expected Outputs" first.`,
        );
      } else if (tc.status === "failed") {
        steps[3].errors.push(
          `Hidden Case #${idx + 1}: Output generation Failed — click "Retry Failed" to regenerate.`,
        );
      } else if (!tc.expectedOutput || !tc.expectedOutput.trim()) {
        // Only flag as missing when status is not pending/failed (i.e. success with empty output)
        steps[3].errors.push(`Hidden Case #${idx + 1}: Expected Output is empty after generation.`);
      }

      // Duplicate input detection
      const trimmed = tc.input.trim();
      if (seenHiddenInputs.has(trimmed)) {
        steps[3].errors.push(`Hidden Case #${idx + 1}: Duplicate input content.`);
      } else if (trimmed) {
        seenHiddenInputs.add(trimmed);
      }
    });
  }

  steps[3].isValid = steps[3].errors.length === 0;

  const isAllValid = steps.every((s) => s.isValid);

  return {
    isValid: isAllValid,
    steps,
    fieldErrors,
  };
}

const DRAFT_STORAGE_KEY = "firecode_admin_add_problem_draft";

export function AddProblemWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [publishError, setPublishError] = useState("");
  const [savedDraftFound, setSavedDraftFound] = useState(false);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string>("");

  const topRef = useRef<HTMLDivElement>(null);

  // Local state holding problem content
  const [formData, setFormData] = useState<AddProblemFormData>({
    problemId: Math.floor(100 + Math.random() * 900),
    title: "",
    slug: "",
    difficulty: "medium",
    category: "Algorithms",
    points: 25,
    tags: ["Array", "Hash Table"],
    status: "published",
    timeLimit: 2000,
    memoryLimit: 256,

    officialSolution: {
      language: "python",
      code: "def solution(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        diff = target - num\n        if diff in seen:\n            return [seen[diff], i]\n        seen[num] = i\n    return []\n",
    },

    // Step 2 TipTap Rich Text Fields
    description:
      "<h2>Problem Description</h2><p>Write a detailed description of the problem here...</p>",
    inputFormat:
      "<p>The first line contains an integer <code>N</code> denoting the size of the array.</p>",
    outputFormat: "<p>Return a single integer representing the result.</p>",
    constraints:
      "<ul><li>1 &le; N &le; 10<sup>5</sup></li><li>-10<sup>9</sup> &le; A[i] &le; 10<sup>9</sup></li></ul>",
    hints:
      "<ol><li>Try using a Hash Map to store previously visited elements.</li><li>What is the time complexity of your solution?</li></ol>",
    editorial:
      "<h3>Official Editorial</h3><p>An optimal solution can be achieved using Two Pointers or a Hash Table in <strong>O(N)</strong> time.</p>",

    sampleTestCases: [
      {
        id: "tc_sample_1",
        input: "nums = [2, 7, 11, 15]\ntarget = 9",
        output: "[0, 1]",
        explanation:
          "<p>Because <code>nums[0] + nums[1] == 9</code>, we return <code>[0, 1]</code>.</p>",
        isExpanded: true,
        isSelected: false,
      },
      {
        id: "tc_sample_2",
        input: "nums = [3, 2, 4]\ntarget = 6",
        output: "[1, 2]",
        explanation:
          "<p>Because <code>nums[1] + nums[2] == 6</code>, we return <code>[1, 2]</code>.</p>",
        isExpanded: true,
        isSelected: false,
      },
    ],
    hiddenTestCases: [
      {
        id: "htc_init_1",
        inputType: "array",
        input: "5\n1 4 7 2 8",
        expectedOutput: "8",
        status: "success",
        generatedTime: "Auto-Generated",
        isExpanded: false,
        isSelected: false,
      },
      {
        id: "htc_init_2",
        inputType: "string",
        input: "firecode",
        expectedOutput: "edocerif",
        status: "success",
        generatedTime: "Auto-Generated",
        isExpanded: false,
        isSelected: false,
      },
    ],
  });

  const validationSummary = validateProblemForm(formData);

  // Auto-Save Draft to LocalStorage every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
        const timestamp = new Date().toLocaleTimeString();
        setLastAutoSaveTime(timestamp);
      } catch (err) {
        console.error("Failed to auto-save draft:", err);
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [formData]);

  // Check for saved draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        setSavedDraftFound(true);
      }
    } catch (err) {
      console.error("Error reading saved draft:", err);
    }
  }, []);

  // Warn before leaving page if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const restoreDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFormData(parsed);
        setSavedDraftFound(false);
        toast.success("Saved draft restored successfully!");
      }
    } catch (err) {
      toast.error("Failed to restore saved draft.");
    }
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setSavedDraftFound(false);
    toast.info("Saved draft discarded.");
  };

  const updateFormField = <K extends keyof AddProblemFormData>(
    field: K,
    value: AddProblemFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const publishMutation = useMutation({
    mutationFn: (payload: any) =>
      api.post<{ success: boolean; problem: any }>("/admin/problems", payload),
    onSuccess: () => {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      queryClient.invalidateQueries({ queryKey: ["admin", "problems"] });
      toast.success("Problem published successfully!");
      navigate({ to: "/admin/problems" });
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError ? err.message : err?.message || "Failed to publish problem.";
      setPublishError(msg);
    },
  });

  const handlePublish = () => {
    setPublishError("");

    const summary = validateProblemForm(formData);
    if (!summary.isValid) {
      // Find first invalid step
      const invalidStep = summary.steps.find((s) => !s.isValid);
      if (invalidStep) {
        setCurrentStep(invalidStep.stepId);
        topRef.current?.scrollIntoView({ behavior: "smooth" });
        toast.error(`Validation failed on Step ${invalidStep.stepId}: ${invalidStep.title}`);
      }
      return;
    }

    const hintsArray =
      typeof formData.hints === "string"
        ? formData.hints
            .replace(/<[^>]*>/g, "\n")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : Array.isArray(formData.hints)
          ? formData.hints
          : [];

    const sampleCasesForBackend = formData.sampleTestCases.map((tc, idx) => ({
      input: tc.input,
      expectedOutput: tc.output,
      explanation: tc.explanation || "",
      isHidden: false,
      executionOrder: idx,
    }));

    const hiddenCasesForBackend = formData.hiddenTestCases.map((tc, idx) => ({
      input: tc.input,
      expectedOutput: tc.expectedOutput || "",
      explanation: "",
      isHidden: true,
      executionOrder: sampleCasesForBackend.length + idx,
    }));

    const payload = {
      problemId: Number(formData.problemId),
      title: formData.title.trim(),
      slug: formData.slug.trim(),
      difficulty: formData.difficulty,
      category: formData.category,
      points: Number(formData.points),
      tags: formData.tags,
      status: formData.status || "published",

      description: formData.description,
      inputFormat: formData.inputFormat,
      outputFormat: formData.outputFormat,
      constraints: formData.constraints,
      hints: hintsArray,
      editorial: formData.editorial,

      examples: formData.sampleTestCases.map((tc) => ({
        input: tc.input,
        output: tc.output,
        explanation: tc.explanation,
      })),

      starterCode: [
        { language: "javascript", code: "// Write your solution here\nfunction solution() {\n\n}" },
        { language: "python", code: "# Write your solution here\ndef solution():\n    pass" },
      ],
      timeLimit: formData.timeLimit,
      memoryLimit: formData.memoryLimit,

      officialSolution: formData.officialSolution,
      testcases: [...sampleCasesForBackend, ...hiddenCasesForBackend],
    };

    publishMutation.mutate(payload);
  };

  const handleNext = () => {
    if (currentStep < 5) setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  return (
    <div ref={topRef} className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Restore Saved Draft Notification */}
      {savedDraftFound && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-xs text-foreground">Saved Draft Found</div>
              <div className="text-[11px] text-muted-foreground">
                You have a previously auto-saved problem draft. Would you like to restore it?
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={discardDraft}
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              className="ember-gradient text-primary-foreground border-0 text-xs font-bold"
              onClick={restoreDraft}
            >
              Restore Draft
            </Button>
          </div>
        </div>
      )}

      {/* Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/problems"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Problem Catalog
            </Link>
            <span className="text-xs text-muted-foreground">/</span>
            <Badge className="ember-gradient text-primary-foreground border-0">Wizard</Badge>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            Create Problem Wizard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Multi-step workflow for crafting algorithmic challenges, test cases, and editorials.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastAutoSaveTime && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-emerald-400" /> Auto-saved {lastAutoSaveTime}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/admin/problems" })}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
              toast.success("Draft saved successfully to local storage!");
            }}
          >
            <Save className="h-4 w-4" /> Save Draft
          </Button>
        </div>
      </div>

      {/* STEPPER BAR */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          const stepStatus = validationSummary.steps.find((s) => s.stepId === step.id);
          const hasError = stepStatus && !stepStatus.isValid;

          return (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                hasError
                  ? "border-destructive/80 bg-destructive/10 ring-1 ring-destructive/40"
                  : isActive
                    ? "border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500/40"
                    : isCompleted
                      ? "border-emerald-500/40 bg-emerald-500/5 text-foreground"
                      : "border-border/60 bg-card/60 text-muted-foreground hover:border-border"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold text-xs ${
                  hasError
                    ? "bg-destructive text-destructive-foreground"
                    : isActive
                      ? "ember-gradient text-primary-foreground"
                      : isCompleted
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-muted text-muted-foreground"
                }`}
              >
                {hasError ? "❌" : isCompleted ? <CheckCircle2 className="h-4 w-4" /> : step.id}
              </div>
              <div className="overflow-hidden">
                <div className="font-display text-xs font-bold truncate flex items-center gap-1">
                  {step.name}
                  {hasError && (
                    <span className="text-[10px] text-destructive font-bold">(Error)</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{step.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* STEP CONTENT BODY */}
      <div className="rounded-2xl border border-border/80 bg-card/90 p-6 shadow-xl relative">
        {/* STEP 1: Basic Information */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-400" /> Step 1: Basic Problem Information
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Configure primary metadata, slug, tags, and execution limits.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Problem Title *</span>
                  {validationSummary.fieldErrors["title"] && (
                    <span className="text-destructive text-[11px] font-medium">
                      {validationSummary.fieldErrors["title"]}
                    </span>
                  )}
                </Label>
                <Input
                  placeholder="e.g. Two Sum"
                  value={formData.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    const slug = title
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)+/g, "");
                    setFormData((prev) => ({ ...prev, title, slug }));
                  }}
                  className={
                    validationSummary.fieldErrors["title"]
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Slug (URL identifier) *</span>
                  {validationSummary.fieldErrors["slug"] && (
                    <span className="text-destructive text-[11px] font-medium">
                      {validationSummary.fieldErrors["slug"]}
                    </span>
                  )}
                </Label>
                <Input
                  placeholder="e.g. two-sum"
                  value={formData.slug}
                  onChange={(e) => updateFormField("slug", e.target.value)}
                  className={
                    validationSummary.fieldErrors["slug"]
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Problem ID (Unique Number) *</Label>
                <Input
                  type="number"
                  value={formData.problemId}
                  onChange={(e) => updateFormField("problemId", parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Difficulty Level *</Label>
                <Select
                  value={formData.difficulty}
                  onValueChange={(val: "easy" | "medium" | "hard") =>
                    updateFormField("difficulty", val)
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

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Category *</Label>
                <Input
                  placeholder="e.g. Algorithms"
                  value={formData.category}
                  onChange={(e) => updateFormField("category", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Reward Points</Label>
                <Input
                  type="number"
                  value={formData.points}
                  onChange={(e) => updateFormField("points", parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Time Limit (milliseconds) *</Label>
                <Input
                  type="number"
                  value={formData.timeLimit}
                  onChange={(e) => updateFormField("timeLimit", parseInt(e.target.value) || 2000)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Memory Limit (megabytes) *</Label>
                <Input
                  type="number"
                  value={formData.memoryLimit}
                  onChange={(e) => updateFormField("memoryLimit", parseInt(e.target.value) || 256)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Tags (Comma-Separated) *</span>
                  {validationSummary.fieldErrors["tags"] && (
                    <span className="text-destructive text-[11px] font-medium">
                      {validationSummary.fieldErrors["tags"]}
                    </span>
                  )}
                </Label>
                <Input
                  placeholder="Array, Hash Table, Two Pointers"
                  value={formData.tags.join(", ")}
                  onChange={(e) =>
                    updateFormField(
                      "tags",
                      e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Problem Content (TipTap Rich Text) */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Code className="h-5 w-5 text-amber-400" /> Step 2: Problem Content Specifications
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Provide rich formatting for problem description, input/output formats, and
                constraints.
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Problem Description *</span>
                  {validationSummary.fieldErrors["description"] && (
                    <span className="text-destructive text-[11px] font-medium">
                      {validationSummary.fieldErrors["description"]}
                    </span>
                  )}
                </Label>
                <RichTextEditor
                  value={formData.description}
                  onChange={(html) => updateFormField("description", html)}
                  placeholder="Provide a detailed problem statement..."
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span>Input Format *</span>
                    {validationSummary.fieldErrors["inputFormat"] && (
                      <span className="text-destructive text-[11px] font-medium">
                        {validationSummary.fieldErrors["inputFormat"]}
                      </span>
                    )}
                  </Label>
                  <RichTextEditor
                    value={formData.inputFormat}
                    onChange={(html) => updateFormField("inputFormat", html)}
                    placeholder="Describe input parameters format..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span>Output Format *</span>
                    {validationSummary.fieldErrors["outputFormat"] && (
                      <span className="text-destructive text-[11px] font-medium">
                        {validationSummary.fieldErrors["outputFormat"]}
                      </span>
                    )}
                  </Label>
                  <RichTextEditor
                    value={formData.outputFormat}
                    onChange={(html) => updateFormField("outputFormat", html)}
                    placeholder="Describe expected return output format..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Constraints *</span>
                  {validationSummary.fieldErrors["constraints"] && (
                    <span className="text-destructive text-[11px] font-medium">
                      {validationSummary.fieldErrors["constraints"]}
                    </span>
                  )}
                </Label>
                <RichTextEditor
                  value={formData.constraints}
                  onChange={(html) => updateFormField("constraints", html)}
                  placeholder="Specify problem constraints..."
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Hints (Optional)</Label>
                <RichTextEditor
                  value={formData.hints}
                  onChange={(html) => updateFormField("hints", html)}
                  placeholder="Add hints for students..."
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Official Editorial (Optional)</Label>
                <RichTextEditor
                  value={formData.editorial}
                  onChange={(html) => updateFormField("editorial", html)}
                  placeholder="Add full solution breakdown..."
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Sample Test Cases */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Step 3: Sample Test Cases
                Manager
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Configure visible example test cases, Monaco editors, TipTap explanations, and JSON
                batch operations.
              </p>
            </div>

            <SampleTestCaseManager
              testCases={formData.sampleTestCases}
              onChange={(updatedCases) => updateFormField("sampleTestCases", updatedCases)}
            />
          </div>
        )}

        {/* STEP 4: Hidden Test Cases */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <HiddenTestCaseManager
              testCases={formData.hiddenTestCases}
              onChange={(updatedCases) => updateFormField("hiddenTestCases", updatedCases)}
              officialSolution={formData.officialSolution}
              onOfficialSolutionChange={(solution) => updateFormField("officialSolution", solution)}
            />
          </div>
        )}

        {/* STEP 5: Preview & Publish Validation */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2 text-emerald-400">
                <Eye className="h-5 w-5 text-emerald-400" /> Step 5: Validation Summary & Publish
                Verification
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Review problem specifications and section validation statuses before deployment.
              </p>
            </div>

            {publishError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{publishError}</span>
              </div>
            )}

            {/* VALIDATION SUMMARY CARD */}
            <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="font-display text-base font-bold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-400" /> Problem Section Validation
                  Checklist
                </h3>
                <Badge
                  className={
                    validationSummary.isValid
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-destructive/20 text-destructive border-destructive/30"
                  }
                >
                  {validationSummary.isValid ? "All Sections Passed" : "Action Required"}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {validationSummary.steps.map((step) => (
                  <button
                    key={step.stepId}
                    type="button"
                    onClick={() => setCurrentStep(step.stepId)}
                    className={`rounded-xl border p-4 text-left transition-all flex items-start justify-between gap-3 ${
                      step.isValid
                        ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50"
                        : "border-destructive/50 bg-destructive/5 hover:border-destructive/80"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        {step.isValid ? (
                          <span className="text-emerald-400 font-bold">✔</span>
                        ) : (
                          <span className="text-destructive font-bold">❌</span>
                        )}
                        <span>{step.title}</span>
                      </div>
                      {step.isValid ? (
                        <p className="text-[11px] text-emerald-400/80 mt-1">
                          Section requirements satisfied
                        </p>
                      ) : (
                        <ul className="text-[11px] text-destructive mt-1 space-y-0.5 list-disc pl-4">
                          {step.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      Step {step.stepId}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            {/* Problem Overview Card */}
            <div className="rounded-xl border border-border/80 bg-background/50 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-2xl font-bold">
                    {formData.title || "Untitled Problem"}
                  </h3>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-4">
                    <span>
                      ID: <code>{formData.problemId}</code>
                    </span>
                    <span>
                      Slug: <code>{formData.slug || "n/a"}</code>
                    </span>
                    <span>Category: {formData.category}</span>
                    <span>Points: {formData.points}</span>
                  </div>
                </div>
                <Badge className="ember-gradient text-primary-foreground text-sm font-semibold capitalize">
                  {formData.difficulty}
                </Badge>
              </div>

              {/* Render HTML Description Preview */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Problem Description Preview:
                </div>
                <div
                  className="prose prose-invert max-w-none text-sm p-4 rounded-xl bg-card/60 border border-border/60"
                  dangerouslySetInnerHTML={{ __html: formData.description }}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP NAVIGATION CONTROLS */}
        <div className="flex items-center justify-between pt-8 border-t border-border/60 mt-8">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1 || publishMutation.isPending}
            className="gap-2 text-xs"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>

          <div className="text-xs text-muted-foreground font-medium">Step {currentStep} of 5</div>

          {currentStep < 5 ? (
            <Button
              className="ember-gradient text-primary-foreground border-0 gap-2 text-xs font-bold"
              onClick={handleNext}
            >
              Next Step <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              className="ember-gradient text-primary-foreground border-0 gap-2 text-xs font-bold shadow-xl min-w-[160px]"
              onClick={handlePublish}
              disabled={publishMutation.isPending || !validationSummary.isValid}
            >
              {publishMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Publishing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Publish Problem
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
