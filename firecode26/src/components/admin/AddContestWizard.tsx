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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import {
  Trophy,
  Calendar,
  Clock,
  Users,
  Lock,
  Globe,
  Key,
  Image as ImageIcon,
  CheckCircle2,
  FileText,
  Code,
  Eye,
  ArrowLeft,
  ArrowRight,
  Save,
  Plus,
  Trash2,
  Search,
  CheckSquare,
  Square,
  ArrowUp,
  ArrowDown,
  Shield,
  Sliders,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Sparkles,
  Info,
  Layers,
  HelpCircle,
} from "lucide-react";

interface StepIndicator {
  id: number;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepIndicator[] = [
  { id: 1, name: "Contest Details", description: "Metadata & Schedule", icon: Trophy },
  { id: 2, name: "Problem Selection", description: "Pick & Order Problems", icon: Layers },
  { id: 3, name: "Contest Rules", description: "Scoring & Penalty Policies", icon: Shield },
  { id: 4, name: "Student Preview", description: "Interactive Simulation", icon: Eye },
  { id: 5, name: "Validation & Publish", description: "Final Verification", icon: CheckCircle2 },
];

export interface SelectedContestProblem {
  id: string;
  problemId: number;
  title: string;
  slug: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  tags: string[];
  points: number;
  letterOrder: string;
}

export interface AddContestFormData {
  // Step 1: Details
  title: string;
  slug: string;
  type: "weekly" | "biweekly" | "practice" | "rated" | "unrated" | "special";
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  regOpenDate: string;
  regCloseDate: string;
  maxParticipants: number;
  visibility: "public" | "private" | "password";
  password?: string;
  bannerUrl: string;
  description: string;

  // Step 2: Problem Selection
  selectedProblems: SelectedContestProblem[];

  // Step 3: Rules
  rules: string;
  scoringPolicy: string;
  tieBreakRules: string;
  allowedLanguages: string[];
  codeVisibility: string;
  publicEditorial: boolean;
  freezeLeaderboard: boolean;
  freezeDurationMinutes: number;
  penaltyRules: string;
}

export interface ContestStepValidation {
  stepId: number;
  title: string;
  isValid: boolean;
  errors: string[];
}

export interface ContestValidationSummary {
  isValid: boolean;
  steps: ContestStepValidation[];
  fieldErrors: Record<string, string>;
}

// -------------------------------------------------
// VALIDATION ENGINE
// -------------------------------------------------
export function validateContestForm(formData: AddContestFormData): ContestValidationSummary {
  const steps: ContestStepValidation[] = [
    { stepId: 1, title: "Contest Details", isValid: true, errors: [] },
    { stepId: 2, title: "Problem Selection", isValid: true, errors: [] },
    { stepId: 3, title: "Contest Rules", isValid: true, errors: [] },
    { stepId: 4, title: "Student Preview", isValid: true, errors: [] },
  ];

  const fieldErrors: Record<string, string> = {};

  const isHtmlEmpty = (html: string) => {
    if (!html) return true;
    const stripped = html.replace(/<[^>]*>/g, "").trim();
    return stripped.length === 0;
  };

  // STEP 1 VALIDATION
  if (!formData.title || !formData.title.trim()) {
    steps[0].errors.push("Contest Name is required.");
    fieldErrors["title"] = "Contest Name is required.";
  }

  if (!formData.slug || !formData.slug.trim()) {
    steps[0].errors.push("Contest Slug is required.");
    fieldErrors["slug"] = "Contest Slug is required.";
  }

  if (!formData.startDate || !formData.startTime) {
    steps[0].errors.push("Start Date and Time are required.");
  }

  if (!formData.endDate || !formData.endTime) {
    steps[0].errors.push("End Date and Time are required.");
  }

  if (formData.startDate && formData.startTime && formData.endDate && formData.endTime) {
    const start = new Date(`${formData.startDate}T${formData.startTime}`);
    const end = new Date(`${formData.endDate}T${formData.endTime}`);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      steps[0].errors.push("Invalid Start or End Date format.");
    } else if (end <= start) {
      steps[0].errors.push("End Time must be greater than Start Time.");
      fieldErrors["endTime"] = "End Time must be after Start Time.";
    }
  }

  if (formData.visibility === "password" && (!formData.password || !formData.password.trim())) {
    steps[0].errors.push(
      "Access Password is required when Contest Visibility is Password Protected.",
    );
    fieldErrors["password"] = "Password required.";
  }

  if (isHtmlEmpty(formData.description)) {
    steps[0].errors.push("Contest Description cannot be empty.");
    fieldErrors["description"] = "Description is required.";
  }

  steps[0].isValid = steps[0].errors.length === 0;

  // STEP 2 VALIDATION
  if (!Array.isArray(formData.selectedProblems) || formData.selectedProblems.length === 0) {
    steps[1].errors.push("At least one problem must be selected for the contest.");
    fieldErrors["selectedProblems"] = "At least 1 problem required.";
  } else {
    formData.selectedProblems.forEach((p, idx) => {
      if (p.points === undefined || p.points < 0) {
        steps[1].errors.push(`Problem ${p.letterOrder} (${p.title}): Points must be >= 0.`);
      }
    });
  }

  steps[1].isValid = steps[1].errors.length === 0;

  // STEP 3 VALIDATION
  if (!Array.isArray(formData.allowedLanguages) || formData.allowedLanguages.length === 0) {
    steps[2].errors.push("At least one allowed programming language must be selected.");
    fieldErrors["allowedLanguages"] = "At least 1 language required.";
  }

  steps[2].isValid = steps[2].errors.length === 0;

  // STEP 4 VALIDATION
  steps[3].isValid = true;

  const isAllValid = steps.every((s) => s.isValid);

  return {
    isValid: isAllValid,
    steps,
    fieldErrors,
  };
}

const DRAFT_CONTEST_KEY = "firecode_admin_add_contest_draft";

export function AddContestWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [publishError, setPublishError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [savedDraftFound, setSavedDraftFound] = useState(false);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string>("");

  // Filters for Problem Selection (Step 2)
  const [probSearch, setProbSearch] = useState("");
  const [probDifficultyFilter, setProbDifficultyFilter] = useState("all");
  const [probTagFilter, setProbTagFilter] = useState("all");

  const topRef = useRef<HTMLDivElement>(null);

  // Initial Date Helpers
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const tomorrowEnd = new Date(tomorrow.getTime() + 7200000); // 2 hours duration

  const formatDate = (d: Date) => d.toISOString().split("T")[0];
  const formatTime = (d: Date) => d.toTimeString().substring(0, 5);

  // Local State holding Contest Data
  const [formData, setFormData] = useState<AddContestFormData>({
    title: "",
    slug: "",
    type: "rated",
    startDate: formatDate(tomorrow),
    startTime: formatTime(tomorrow),
    endDate: formatDate(tomorrowEnd),
    endTime: formatTime(tomorrowEnd),
    regOpenDate: formatDate(now),
    regCloseDate: formatDate(tomorrow),
    maxParticipants: 0,
    visibility: "public",
    password: "",
    bannerUrl:
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1000&auto=format&fit=crop",
    description:
      "<h2>Weekly Rated Contest</h2><p>Welcome to FireCode's algorithm contest! Solve problems, earn rating points, and climb the live leaderboard.</p>",

    selectedProblems: [],

    rules:
      "<h3>Contest Guidelines</h3><ul><li>Submissions will be evaluated against automated test cases on Judge0.</li><li>Cheating or code plagiarsim will result in disqualification.</li></ul>",
    scoringPolicy: "icpc",
    tieBreakRules: "earlier_submission",
    allowedLanguages: ["cpp", "java", "python", "javascript"],
    codeVisibility: "private_until_end",
    publicEditorial: true,
    freezeLeaderboard: true,
    freezeDurationMinutes: 60,
    penaltyRules: "10 minutes penalty per wrong submission",
  });

  const validationSummary = validateContestForm(formData);

  // Fetch Published Problems from Backend for Step 2 Selection
  const { data: problemsData, isLoading: isProblemsLoading } = useQuery<{
    success: boolean;
    problems: any[];
  }>({
    queryKey: ["admin", "problems", "all"],
    queryFn: () => api.get<{ success: boolean; problems: any[] }>("/admin/problems"),
  });

  const availableProblemsList = problemsData?.problems || [];

  // Auto Save Draft every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      try {
        localStorage.setItem(DRAFT_CONTEST_KEY, JSON.stringify(formData));
        setLastAutoSaveTime(new Date().toLocaleTimeString());
      } catch (err) {
        console.error("Auto-save contest draft failed:", err);
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [formData]);

  // Check saved draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_CONTEST_KEY);
      if (saved) setSavedDraftFound(true);
    } catch (err) {
      console.error("Failed checking saved draft:", err);
    }
  }, []);

  // Warn before leaving page
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
      const saved = localStorage.getItem(DRAFT_CONTEST_KEY);
      if (saved) {
        setFormData(JSON.parse(saved));
        setSavedDraftFound(false);
        toast.success("Contest draft restored successfully!");
      }
    } catch (err) {
      toast.error("Failed to restore draft.");
    }
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_CONTEST_KEY);
    setSavedDraftFound(false);
    toast.info("Saved draft discarded.");
  };

  const updateFormField = <K extends keyof AddContestFormData>(
    field: K,
    value: AddContestFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Toggle problem selection in Step 2
  const toggleProblemSelection = (prob: any) => {
    const exists = formData.selectedProblems.some((p) => p.slug === prob.slug || p.id === prob._id);
    if (exists) {
      // Unselect
      const newList = formData.selectedProblems
        .filter((p) => p.slug !== prob.slug && p.id !== prob._id)
        .map((p, idx) => ({ ...p, letterOrder: String.fromCharCode(65 + idx) }));
      updateFormField("selectedProblems", newList);
    } else {
      // Select
      const nextLetter = String.fromCharCode(65 + formData.selectedProblems.length);
      const newProblemItem: SelectedContestProblem = {
        id: prob._id || String(prob.problemId),
        problemId: prob.problemId,
        title: prob.title,
        slug: prob.slug,
        difficulty: prob.difficulty,
        category: prob.category || "Algorithms",
        tags: prob.tags || [],
        points: (formData.selectedProblems.length + 1) * 100,
        letterOrder: nextLetter,
      };
      updateFormField("selectedProblems", [...formData.selectedProblems, newProblemItem]);
    }
  };

  // Reorder problem up/down
  const moveProblemOrder = (index: number, direction: "up" | "down") => {
    const list = [...formData.selectedProblems];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    // Recalculate letters
    const reordered = list.map((item, i) => ({
      ...item,
      letterOrder: String.fromCharCode(65 + i),
    }));
    updateFormField("selectedProblems", reordered);
  };

  // Update points for a problem
  const updateProblemPoints = (index: number, points: number) => {
    const list = [...formData.selectedProblems];
    list[index] = { ...list[index], points: Math.max(0, points) };
    updateFormField("selectedProblems", list);
  };

  // Toggle language selection in Step 3
  const toggleLanguage = (lang: string) => {
    const exists = formData.allowedLanguages.includes(lang);
    if (exists) {
      updateFormField(
        "allowedLanguages",
        formData.allowedLanguages.filter((l) => l !== lang),
      );
    } else {
      updateFormField("allowedLanguages", [...formData.allowedLanguages, lang]);
    }
  };

  // Publish Mutation
  const publishMutation = useMutation({
    mutationFn: (payload: any) =>
      api.post<{ success: boolean; contest: any }>("/admin/contests", payload),
    onSuccess: () => {
      localStorage.removeItem(DRAFT_CONTEST_KEY);
      queryClient.invalidateQueries({ queryKey: ["admin", "contests"] });
      toast.success("Contest published successfully!");
      navigate({ to: "/admin/contests" });
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError ? err.message : err?.message || "Failed to publish contest.";
      setPublishError(msg);
    },
  });

  // Handle Submit & Publish
  const handlePublishSubmit = () => {
    setShowConfirmModal(false);
    setPublishError("");

    const summary = validateContestForm(formData);
    if (!summary.isValid) {
      const invalidStep = summary.steps.find((s) => !s.isValid);
      if (invalidStep) {
        setCurrentStep(invalidStep.stepId);
        topRef.current?.scrollIntoView({ behavior: "smooth" });
        toast.error(`Validation failed on Step ${invalidStep.stepId}: ${invalidStep.title}`);
      }
      return;
    }

    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
    const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000);

    const payload = {
      title: formData.title.trim(),
      slug: formData.slug.trim(),
      type: formData.type,
      description: formData.description,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      duration_minutes: durationMinutes,
      registration_open: true,
      visibility: formData.visibility,
      password: formData.visibility === "password" ? formData.password : undefined,
      banner_url: formData.bannerUrl,
      max_participants: formData.maxParticipants,

      // Step 2 Problems
      problems: formData.selectedProblems.map((p) => p.slug),
      problemDetails: formData.selectedProblems,

      // Step 3 Rules
      rules: formData.rules,
      scoring_policy: formData.scoringPolicy,
      tie_break_rules: formData.tieBreakRules,
      allowed_languages: formData.allowedLanguages,
      code_visibility: formData.codeVisibility,
      public_editorial: formData.publicEditorial,
      isFrozen: formData.freezeLeaderboard,
      freeze_time_minutes: formData.freezeDurationMinutes,
      penalty_rules: formData.penaltyRules,
    };

    publishMutation.mutate(payload);
  };

  const handleNext = () => {
    if (currentStep < 5) setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  // Filtered available problems
  const filteredAvailableProblems = availableProblemsList.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(probSearch.toLowerCase()) ||
      p.slug.toLowerCase().includes(probSearch.toLowerCase());
    const matchesDiff = probDifficultyFilter === "all" || p.difficulty === probDifficultyFilter;
    const matchesTag =
      probTagFilter === "all" || (Array.isArray(p.tags) && p.tags.includes(probTagFilter));
    return matchesSearch && matchesDiff && matchesTag;
  });

  return (
    <div ref={topRef} className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Saved Draft Restore Banner */}
      {savedDraftFound && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-xs text-foreground">Saved Contest Draft Found</div>
              <div className="text-[11px] text-muted-foreground">
                You have an auto-saved contest draft. Would you like to restore your progress?
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

      {/* Header & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/contests"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Contest Manager
            </Link>
            <span className="text-xs text-muted-foreground">/</span>
            <Badge className="ember-gradient text-primary-foreground border-0">
              Contest Wizard
            </Badge>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            Create Contest Wizard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Design rated rounds, problem sets, scoring policies, and student previews.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastAutoSaveTime && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-emerald-400" /> Draft saved {lastAutoSaveTime}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/admin/contests" })}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              localStorage.setItem(DRAFT_CONTEST_KEY, JSON.stringify(formData));
              toast.success("Contest draft saved to local storage!");
            }}
          >
            <Save className="h-4 w-4" /> Save Draft
          </Button>
        </div>
      </div>

      {/* STEPPER NAVIGATION BAR */}
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
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{step.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* STEP CONTENT CONTAINER */}
      <div className="rounded-2xl border border-border/80 bg-card/90 p-6 shadow-xl relative">
        {/* STEP 1: CONTEST DETAILS */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" /> Step 1: Contest Details & Schedule
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Configure contest name, slug, scheduling window, visibility, and banner image.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Contest Name *</span>
                  {validationSummary.fieldErrors["title"] && (
                    <span className="text-destructive text-[11px]">
                      {validationSummary.fieldErrors["title"]}
                    </span>
                  )}
                </Label>
                <Input
                  placeholder="e.g. FireCode Weekly Round #42"
                  value={formData.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    const slug = title
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)+/g, "");
                    setFormData((prev) => ({ ...prev, title, slug }));
                  }}
                  className={validationSummary.fieldErrors["title"] ? "border-destructive" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Contest Slug (URL ID) *</span>
                  {validationSummary.fieldErrors["slug"] && (
                    <span className="text-destructive text-[11px]">
                      {validationSummary.fieldErrors["slug"]}
                    </span>
                  )}
                </Label>
                <Input
                  placeholder="e.g. weekly-round-42"
                  value={formData.slug}
                  onChange={(e) => updateFormField("slug", e.target.value)}
                  className={validationSummary.fieldErrors["slug"] ? "border-destructive" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Contest Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val: any) => updateFormField("type", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rated">Rated (Official Points Round)</SelectItem>
                    <SelectItem value="unrated">Unrated (Friendly Match)</SelectItem>
                    <SelectItem value="practice">Practice Mode</SelectItem>
                    <SelectItem value="weekly">Weekly Rated</SelectItem>
                    <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                    <SelectItem value="special">Special Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Max Participants (0 = Unlimited)</Label>
                <Input
                  type="number"
                  value={formData.maxParticipants}
                  onChange={(e) =>
                    updateFormField("maxParticipants", parseInt(e.target.value) || 0)
                  }
                />
              </div>

              {/* Start Date & Time */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5 text-amber-400">
                  <Calendar className="h-3.5 w-3.5" /> Start Date & Time *
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => updateFormField("startDate", e.target.value)}
                  />
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => updateFormField("startTime", e.target.value)}
                  />
                </div>
              </div>

              {/* End Date & Time */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center justify-between text-amber-400">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> End Date & Time *
                  </span>
                  {validationSummary.fieldErrors["endTime"] && (
                    <span className="text-destructive text-[11px]">
                      {validationSummary.fieldErrors["endTime"]}
                    </span>
                  )}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => updateFormField("endDate", e.target.value)}
                    className={validationSummary.fieldErrors["endTime"] ? "border-destructive" : ""}
                  />
                  <Input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => updateFormField("endTime", e.target.value)}
                    className={validationSummary.fieldErrors["endTime"] ? "border-destructive" : ""}
                  />
                </div>
              </div>

              {/* Visibility & Password */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Contest Visibility *</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(val: any) => updateFormField("visibility", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public (Open for Everyone)</SelectItem>
                    <SelectItem value="private">Private (Invite Only)</SelectItem>
                    <SelectItem value="password">Password Protected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.visibility === "password" && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span>Access Password *</span>
                    {validationSummary.fieldErrors["password"] && (
                      <span className="text-destructive text-[11px]">
                        {validationSummary.fieldErrors["password"]}
                      </span>
                    )}
                  </Label>
                  <Input
                    type="password"
                    placeholder="Set contest access password"
                    value={formData.password || ""}
                    onChange={(e) => updateFormField("password", e.target.value)}
                    className={
                      validationSummary.fieldErrors["password"] ? "border-destructive" : ""
                    }
                  />
                </div>
              )}

              {/* Banner URL */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-blue-400" /> Contest Banner Image URL
                </Label>
                <Input
                  placeholder="https://images.unsplash.com/photo-..."
                  value={formData.bannerUrl}
                  onChange={(e) => updateFormField("bannerUrl", e.target.value)}
                />
              </div>

              {/* Rich Text Description */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Contest Description *</span>
                  {validationSummary.fieldErrors["description"] && (
                    <span className="text-destructive text-[11px]">
                      {validationSummary.fieldErrors["description"]}
                    </span>
                  )}
                </Label>
                <RichTextEditor
                  value={formData.description}
                  onChange={(html) => updateFormField("description", html)}
                  placeholder="Provide contest overview and details..."
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PROBLEM SELECTION */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2 text-emerald-400">
                <Layers className="h-5 w-5 text-emerald-400" /> Step 2: Contest Problem Selection
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Select published problems from the catalog, assign points, and arrange order (A, B,
                C, D...).
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              {/* AVAILABLE PROBLEMS CATALOG (LEFT 7 COLS) */}
              <div className="lg:col-span-7 space-y-4 rounded-xl border border-border/80 bg-background/60 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold flex items-center gap-2">
                    <Search className="h-4 w-4 text-amber-400" /> Problem Catalog
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    {filteredAvailableProblems.length} Available
                  </Badge>
                </div>

                {/* Filters Bar */}
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Search problem title or slug..."
                    className="h-8 text-xs bg-background/80"
                    value={probSearch}
                    onChange={(e) => setProbSearch(e.target.value)}
                  />
                  <Select
                    value={probDifficultyFilter}
                    onValueChange={(val) => setProbDifficultyFilter(val)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Difficulties</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Problems List */}
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {isProblemsLoading ? (
                    <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading published problems...
                    </div>
                  ) : filteredAvailableProblems.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No matching problems found in catalog.
                    </div>
                  ) : (
                    filteredAvailableProblems.map((prob) => {
                      const isSelected = formData.selectedProblems.some(
                        (p) => p.slug === prob.slug || p.id === prob._id,
                      );

                      return (
                        <div
                          key={prob._id || prob.problemId}
                          onClick={() => toggleProblemSelection(prob)}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? "border-emerald-500/60 bg-emerald-500/10 shadow-sm"
                              : "border-border/60 bg-card/60 hover:border-border"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="h-4 w-4 rounded border-border text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div>
                              <div className="font-bold text-xs flex items-center gap-2">
                                <span>{prob.title}</span>
                                <code className="text-[10px] text-muted-foreground">
                                  #{prob.problemId}
                                </code>
                              </div>
                              <div className="text-[10px] text-muted-foreground flex gap-2 mt-0.5">
                                <span>Category: {prob.category || "Algorithms"}</span>
                                <span>
                                  Tags: {Array.isArray(prob.tags) ? prob.tags.join(", ") : "None"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <Badge
                            className={`text-[10px] capitalize ${
                              prob.difficulty === "easy"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : prob.difficulty === "medium"
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                  : "bg-destructive/20 text-destructive border-destructive/30"
                            }`}
                          >
                            {prob.difficulty}
                          </Badge>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SELECTED PROBLEMS ORDERING PANEL (RIGHT 5 COLS) */}
              <div className="lg:col-span-5 space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <h3 className="font-display text-sm font-bold flex items-center gap-2 text-amber-400">
                    <CheckSquare className="h-4 w-4" /> Selected Contest Problems (
                    {formData.selectedProblems.length})
                  </h3>
                  {validationSummary.fieldErrors["selectedProblems"] && (
                    <span className="text-destructive text-[11px]">
                      {validationSummary.fieldErrors["selectedProblems"]}
                    </span>
                  )}
                </div>

                {formData.selectedProblems.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                    <Layers className="h-6 w-6 text-muted-foreground mx-auto" />
                    <div>No problems selected yet.</div>
                    <p className="text-[11px] text-muted-foreground">
                      Check problems from the catalog on the left to add them to this contest.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {formData.selectedProblems.map((prob, idx) => (
                      <div
                        key={prob.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/80 bg-card p-3 shadow-sm gap-2"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs">
                            {prob.letterOrder}
                          </span>
                          <div>
                            <div className="font-bold text-xs truncate max-w-[140px]">
                              {prob.title}
                            </div>
                            <div className="text-[10px] text-muted-foreground capitalize">
                              {prob.difficulty}
                            </div>
                          </div>
                        </div>

                        {/* Points Input & Controls */}
                        <div className="flex items-center gap-2">
                          <div className="w-20">
                            <Input
                              type="number"
                              className="h-7 text-xs px-2 text-center"
                              value={prob.points}
                              onChange={(e) =>
                                updateProblemPoints(idx, parseInt(e.target.value) || 0)
                              }
                              placeholder="Pts"
                            />
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => moveProblemOrder(idx, "up")}
                              disabled={idx === 0}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => moveProblemOrder(idx, "down")}
                              disabled={idx === formData.selectedProblems.length - 1}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => toggleProblemSelection(prob)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: CONTEST RULES */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-400" /> Step 3: Contest Rules & Scoring
                Policies
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Define evaluation rules, penalty policies, allowed programming languages, and
                leaderboard freezing.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Scoring Policy */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Scoring Policy *</Label>
                <Select
                  value={formData.scoringPolicy}
                  onValueChange={(val) => updateFormField("scoringPolicy", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="icpc">ICPC Style (Fixed Points + Time Penalty)</SelectItem>
                    <SelectItem value="ioi">
                      IOI Style (Partial Credit / Test Cases Passed)
                    </SelectItem>
                    <SelectItem value="linear">Linear Point Decay Over Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tie Break Rules */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Tie Break Policy *</Label>
                <Select
                  value={formData.tieBreakRules}
                  onValueChange={(val) => updateFormField("tieBreakRules", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="earlier_submission">
                      Earlier Last Accepted Submission
                    </SelectItem>
                    <SelectItem value="total_submissions">Lower Total Submissions Count</SelectItem>
                    <SelectItem value="first_score">First to Achieve Max Score</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Code Visibility */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Code Visibility *</Label>
                <Select
                  value={formData.codeVisibility}
                  onValueChange={(val) => updateFormField("codeVisibility", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private_until_end">Private Until Contest Ends</SelectItem>
                    <SelectItem value="public_during">Public During Contest</SelectItem>
                    <SelectItem value="private_always">Private Always (Only Admins)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Penalty Rules */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Penalty Rules</Label>
                <Input
                  placeholder="e.g. 10 minutes penalty per wrong submission"
                  value={formData.penaltyRules}
                  onChange={(e) => updateFormField("penaltyRules", e.target.value)}
                />
              </div>

              {/* Allowed Languages Checkboxes */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Allowed Programming Languages *</span>
                  {validationSummary.fieldErrors["allowedLanguages"] && (
                    <span className="text-destructive text-[11px]">
                      {validationSummary.fieldErrors["allowedLanguages"]}
                    </span>
                  )}
                </Label>
                <div className="flex flex-wrap gap-4 rounded-xl border border-border/80 bg-background/60 p-4">
                  {[
                    { id: "cpp", name: "C++ (GCC 9.2)" },
                    { id: "java", name: "Java (OpenJDK 13)" },
                    { id: "python", name: "Python (3.8)" },
                    { id: "javascript", name: "JavaScript (Node.js 12)" },
                  ].map((lang) => {
                    const isChecked = formData.allowedLanguages.includes(lang.id);
                    return (
                      <label
                        key={lang.id}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                          isChecked
                            ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                            : "border-border/60 bg-card/60 text-muted-foreground"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleLanguage(lang.id)}
                          className="h-4 w-4 rounded border-border text-emerald-500 focus:ring-emerald-500"
                        />
                        <span>{lang.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Toggles: Freeze Leaderboard & Public Editorial */}
              <div className="space-y-4 md:col-span-2 border-t border-border/60 pt-4">
                <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card/60 p-4">
                  <div>
                    <div className="font-bold text-xs text-foreground">
                      Freeze Leaderboard Before Contest End
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Hides score updates during final contest minutes to build suspense.
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {formData.freezeLeaderboard && (
                      <div className="w-28">
                        <Input
                          type="number"
                          className="h-8 text-xs text-center"
                          value={formData.freezeDurationMinutes}
                          onChange={(e) =>
                            updateFormField("freezeDurationMinutes", parseInt(e.target.value) || 60)
                          }
                          placeholder="Mins"
                        />
                      </div>
                    )}
                    <input
                      type="checkbox"
                      checked={formData.freezeLeaderboard}
                      onChange={(e) => updateFormField("freezeLeaderboard", e.target.checked)}
                      className="h-5 w-5 rounded border-border text-amber-500 focus:ring-amber-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card/60 p-4">
                  <div>
                    <div className="font-bold text-xs text-foreground">
                      Publish Editorial Automatically After Contest
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Automatically unveils official solutions as soon as the contest finishes.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.publicEditorial}
                    onChange={(e) => updateFormField("publicEditorial", e.target.checked)}
                    className="h-5 w-5 rounded border-border text-amber-500 focus:ring-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Contest Rules Rich Text Editor */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs font-semibold">Detailed Rules & Guidelines</Label>
                <RichTextEditor
                  value={formData.rules}
                  onChange={(html) => updateFormField("rules", html)}
                  placeholder="Specify rules, anti-cheating guidelines..."
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: STUDENT PREVIEW */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2 text-blue-400">
                <Eye className="h-5 w-5 text-blue-400" /> Step 4: Student Contest Preview
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Interactive preview showing exactly how participants will see this contest.
              </p>
            </div>

            {/* HERO BANNER PREVIEW */}
            <div className="rounded-2xl border border-border/80 overflow-hidden bg-card shadow-lg relative">
              <div className="h-44 w-full relative overflow-hidden bg-muted">
                {formData.bannerUrl ? (
                  <img
                    src={formData.bannerUrl}
                    alt="Contest Banner"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full ember-gradient opacity-80" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                <div className="absolute bottom-4 left-6 right-6 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="ember-gradient text-primary-foreground font-bold text-xs uppercase">
                        {formData.type}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-background/80 backdrop-blur-md text-xs font-semibold capitalize"
                      >
                        {formData.visibility} Access
                      </Badge>
                    </div>
                    <h2 className="font-display text-3xl font-bold text-foreground mt-2">
                      {formData.title || "Untitled Contest"}
                    </h2>
                  </div>

                  <div className="rounded-xl border border-amber-500/30 bg-background/90 backdrop-blur-md px-4 py-2 text-right">
                    <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                      Starts In
                    </div>
                    <div className="font-display text-lg font-bold text-foreground">
                      {formData.startDate} @ {formData.startTime}
                    </div>
                  </div>
                </div>
              </div>

              {/* SIMULATED CONTEST TABS */}
              <div className="p-6 space-y-6">
                <Tabs defaultValue="problems">
                  <TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted/60 p-1">
                    <TabsTrigger value="overview">Overview & Description</TabsTrigger>
                    <TabsTrigger value="problems">
                      Contest Problems ({formData.selectedProblems.length})
                    </TabsTrigger>
                    <TabsTrigger value="rules">Rules & Policies</TabsTrigger>
                  </TabsList>

                  {/* OVERVIEW */}
                  <TabsContent value="overview" className="space-y-4 pt-4">
                    <div
                      className="prose prose-invert max-w-none text-sm p-4 rounded-xl bg-card/60 border border-border/60"
                      dangerouslySetInnerHTML={{ __html: formData.description }}
                    />
                  </TabsContent>

                  {/* PROBLEMS LIST */}
                  <TabsContent value="problems" className="space-y-3 pt-4">
                    {formData.selectedProblems.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground">
                        No problems selected for preview.
                      </div>
                    ) : (
                      formData.selectedProblems.map((prob) => (
                        <div
                          key={prob.id}
                          className="flex items-center justify-between p-4 rounded-xl border border-border/70 bg-card/80"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs">
                              {prob.letterOrder}
                            </span>
                            <div>
                              <div className="font-bold text-sm">{prob.title}</div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {prob.difficulty}
                              </div>
                            </div>
                          </div>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-bold">
                            {prob.points} Points
                          </Badge>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  {/* RULES */}
                  <TabsContent value="rules" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-3 text-xs border-b border-border/60 pb-3">
                      <div>
                        <span className="text-muted-foreground block font-bold">
                          Scoring Policy
                        </span>
                        <span className="capitalize">{formData.scoringPolicy}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block font-bold">
                          Allowed Languages
                        </span>
                        <span>{formData.allowedLanguages.join(", ")}</span>
                      </div>
                    </div>
                    <div
                      className="prose prose-invert max-w-none text-xs p-4 rounded-xl bg-card/60 border border-border/60"
                      dangerouslySetInnerHTML={{ __html: formData.rules }}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: VALIDATION & PUBLISH */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Step 5: Validation Summary &
                Deployment
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Review all section validation statuses before triggering final deployment.
              </p>
            </div>

            {publishError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{publishError}</span>
              </div>
            )}

            {/* VALIDATION CHECKLIST */}
            <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="font-display text-base font-bold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-400" /> Contest Pre-Publish Checklist
                </h3>
                <Badge
                  className={
                    validationSummary.isValid
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-destructive/20 text-destructive border-destructive/30"
                  }
                >
                  {validationSummary.isValid ? "Ready for Publish" : "Validation Errors"}
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
          </div>
        )}

        {/* NAVIGATION CONTROLS */}
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
              onClick={() => setShowConfirmModal(true)}
              disabled={publishMutation.isPending || !validationSummary.isValid}
            >
              {publishMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Deploying...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Publish Contest
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* CONFIRMATION DIALOG MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-display text-base font-bold flex items-center gap-2 text-amber-400">
                <Trophy className="h-5 w-5 text-amber-400" /> Confirm Contest Deployment
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setShowConfirmModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3 text-xs text-muted-foreground">
              <p>
                You are about to publish <strong>{formData.title}</strong> to the platform.
              </p>
              <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-1">
                <div>
                  <strong className="text-foreground">Schedule:</strong> {formData.startDate} @{" "}
                  {formData.startTime}
                </div>
                <div>
                  <strong className="text-foreground">Problems Count:</strong>{" "}
                  {formData.selectedProblems.length} Problems
                </div>
                <div>
                  <strong className="text-foreground">Visibility:</strong> {formData.visibility}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="ember-gradient text-primary-foreground border-0 text-xs font-bold"
                onClick={handlePublishSubmit}
                disabled={publishMutation.isPending}
              >
                {publishMutation.isPending ? "Deploying..." : "Confirm & Deploy"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
