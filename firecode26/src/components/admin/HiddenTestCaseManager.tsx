import React, { useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";
import {
  Wand2,
  List,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  Search,
  Lock,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Sparkles,
  RotateCcw,
  Sliders,
  Code2,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  X,
  AlertTriangle,
  Play,
  FileCode,
} from "lucide-react";

export type InputTypeOption = "integer" | "array" | "matrix" | "string" | "graph" | "tree";

export interface HiddenTestCaseItem {
  id: string;
  inputType?: InputTypeOption;
  input: string;
  expectedOutput: string;
  status?: "pending" | "success" | "failed";
  error?: string;
  generatedTime?: string;
  isExpanded?: boolean;
  isSelected?: boolean;
}

export interface OfficialSolutionData {
  language: string;
  code: string;
}

interface HiddenTestCaseManagerProps {
  testCases: HiddenTestCaseItem[];
  onChange: (testCases: HiddenTestCaseItem[]) => void;
  officialSolution: OfficialSolutionData;
  onOfficialSolutionChange: (solution: OfficialSolutionData) => void;
}

// Random Generator Utility Function
function generateRandomInputData(
  type: InputTypeOption,
  minSize: number,
  maxSize: number,
  minVal: number,
  maxVal: number,
): string {
  const getRandomInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const clampSize = (val: number) => Math.max(1, Math.min(100, val));
  const effectiveMinSize = clampSize(minSize);
  const effectiveMaxSize = clampSize(Math.max(effectiveMinSize, maxSize));
  const size = getRandomInt(effectiveMinSize, effectiveMaxSize);

  switch (type) {
    case "integer":
      return String(getRandomInt(minVal, maxVal));

    case "array": {
      const arr = Array.from({ length: size }, () => getRandomInt(minVal, maxVal));
      return `${size}\n${arr.join(" ")}`;
    }

    case "matrix": {
      const rows = size;
      const cols = getRandomInt(effectiveMinSize, effectiveMaxSize);
      const matrixLines: string[] = [`${rows} ${cols}`];
      for (let r = 0; r < rows; r++) {
        const row = Array.from({ length: cols }, () => getRandomInt(minVal, maxVal));
        matrixLines.push(row.join(" "));
      }
      return matrixLines.join("\n");
    }

    case "string": {
      const chars = "abcdefghijklmnopqrstuvwxyz";
      let str = "";
      for (let i = 0; i < size; i++) {
        str += chars.charAt(getRandomInt(0, chars.length - 1));
      }
      return str;
    }

    case "graph": {
      const numVertices = Math.max(2, size);
      const maxEdges = Math.min((numVertices * (numVertices - 1)) / 2, numVertices * 2);
      const numEdges = getRandomInt(
        numVertices - 1,
        Math.max(numVertices - 1, Math.floor(maxEdges)),
      );
      const edgeSet = new Set<string>();
      const lines: string[] = [`${numVertices} ${numEdges}`];

      while (edgeSet.size < numEdges) {
        const u = getRandomInt(1, numVertices);
        const v = getRandomInt(1, numVertices);
        if (u !== v) {
          const edge = u < v ? `${u} ${v}` : `${v} ${u}`;
          if (!edgeSet.has(edge)) {
            edgeSet.add(edge);
            lines.push(`${u} ${v}`);
          }
        }
      }
      return lines.join("\n");
    }

    case "tree": {
      const numNodes = Math.max(1, size);
      if (numNodes === 1) return "1\n";
      const lines: string[] = [`${numNodes}`];
      for (let i = 2; i <= numNodes; i++) {
        const parent = getRandomInt(1, i - 1);
        lines.push(`${parent} ${i}`);
      }
      return lines.join("\n");
    }

    default:
      return String(getRandomInt(minVal, maxVal));
  }
}

export function HiddenTestCaseManager({
  testCases,
  onChange,
  officialSolution,
  onOfficialSolutionChange,
}: HiddenTestCaseManagerProps) {
  const [activeTab, setActiveTab] = useState<"generator" | "manual" | "solution">("generator");
  const [searchQuery, setSearchQuery] = useState("");

  // Generator Settings State
  const [genType, setGenType] = useState<InputTypeOption>("array");
  const [genMinSize, setGenMinSize] = useState<number>(5);
  const [genMaxSize, setGenMaxSize] = useState<number>(10);
  const [genMinVal, setGenMinVal] = useState<number>(1);
  const [genMaxVal, setGenMaxVal] = useState<number>(100);
  const [genCount, setGenCount] = useState<number>(10);

  // Execution & Progress Dialog State
  const [isGeneratingOutputs, setIsGeneratingOutputs] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ completed: 0, total: 0 });
  const [generationSummary, setGenerationSummary] = useState<{
    total: number;
    successCount: number;
    failedCount: number;
    timeTakenSec: number;
  } | null>(null);
  const cancelGenerationRef = useRef(false);

  // File Upload Ref for Solution Code
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Official Solution File Upload
  const handleSolutionFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const ext = file.name.split(".").pop()?.toLowerCase();
      let lang = officialSolution.language;
      if (ext === "py") lang = "python";
      else if (ext === "cpp" || ext === "cc" || ext === "cxx") lang = "cpp";
      else if (ext === "java") lang = "java";
      else if (ext === "js" || ext === "ts") lang = "javascript";

      onOfficialSolutionChange({ language: lang, code: content });
      toast.success(`Loaded ${file.name} successfully!`);
    };
    reader.readAsText(file);
  };

  // Generate new test cases
  const handleGenerateInputs = () => {
    const newItems: HiddenTestCaseItem[] = [];
    const countToGenerate = Math.max(1, Math.min(1000, genCount));

    for (let i = 0; i < countToGenerate; i++) {
      const generatedInput = generateRandomInputData(
        genType,
        genMinSize,
        genMaxSize,
        genMinVal,
        genMaxVal,
      );

      newItems.push({
        id: "htc_" + Date.now() + "_" + i + "_" + Math.random().toString(36).substring(2, 6),
        inputType: genType,
        input: generatedInput,
        expectedOutput: "",
        status: "pending",
        isExpanded: false,
        isSelected: false,
      });
    }

    onChange([...testCases, ...newItems]);
    toast.success(`Generated ${countToGenerate} random hidden test cases!`);
  };

  // Automatic Output Generation using Judge0 in Batches
  const startOutputGeneration = async (targetCases?: HiddenTestCaseItem[]) => {
    if (!officialSolution.code?.trim()) {
      toast.error("Please provide an Official Solution first in the 'Official Solution' tab!");
      setActiveTab("solution");
      return;
    }

    const casesToRun = targetCases || testCases;
    if (casesToRun.length === 0) {
      toast.error("No test cases available to generate outputs for.");
      return;
    }

    setIsGeneratingOutputs(true);
    setGenerationSummary(null);
    setGenerationProgress({ completed: 0, total: casesToRun.length });
    cancelGenerationRef.current = false;

    const startTime = Date.now();
    let currentCasesList = [...testCases];
    const BATCH_SIZE = 15; // 15 parallel Judge0 requests per batch

    let successTotal = 0;
    let failedTotal = 0;

    for (let i = 0; i < casesToRun.length; i += BATCH_SIZE) {
      if (cancelGenerationRef.current) {
        toast.info("Output generation cancelled.");
        break;
      }

      const batch = casesToRun.slice(i, i + BATCH_SIZE);
      try {
        const res = await api.post<{
          success: boolean;
          summary: {
            total: number;
            successCount: number;
            failedCount: number;
            timeTakenSec: number;
          };
          results: Array<{
            id: string;
            expectedOutput: string;
            status: "success" | "failed";
            error?: string;
            generatedTime: string;
          }>;
        }>("/admin/generate-outputs", {
          code: officialSolution.code,
          language: officialSolution.language,
          testcases: batch.map((tc) => ({ id: tc.id, input: tc.input })),
          batchSize: BATCH_SIZE,
        });

        if (res.success && res.results) {
          const resultMap = new Map(res.results.map((r) => [r.id, r]));

          currentCasesList = currentCasesList.map((tc) => {
            if (resultMap.has(tc.id)) {
              const resItem = resultMap.get(tc.id)!;
              if (resItem.status === "success") successTotal++;
              else failedTotal++;

              return {
                ...tc,
                expectedOutput: resItem.expectedOutput || tc.expectedOutput,
                status: resItem.status,
                error: resItem.error,
                generatedTime: resItem.generatedTime,
              };
            }
            return tc;
          });

          onChange(currentCasesList);
          setGenerationProgress({
            completed: Math.min(i + batch.length, casesToRun.length),
            total: casesToRun.length,
          });
        }
      } catch (err: any) {
        toast.error("Batch Judge0 request error. Retrying next batch...");
      }
    }

    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    setIsGeneratingOutputs(false);
    setGenerationSummary({
      total: casesToRun.length,
      successCount: successTotal,
      failedCount: failedTotal,
      timeTakenSec: elapsedSec,
    });
  };

  // Retry Failed Test Cases Only
  const retryFailedTestCases = () => {
    const failedCases = testCases.filter((tc) => tc.status === "failed");
    if (failedCases.length === 0) {
      toast.info("No failed test cases to retry!");
      return;
    }
    startOutputGeneration(failedCases);
  };

  // Clear all hidden test cases
  const handleClearAll = () => {
    if (testCases.length === 0) return;
    if (window.confirm("Are you sure you want to clear all hidden test cases?")) {
      onChange([]);
    }
  };

  // Manual Add
  const addHiddenTestCase = () => {
    const newItem: HiddenTestCaseItem = {
      id: "htc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      inputType: genType,
      input: "// Enter input data\n",
      expectedOutput: "",
      status: "pending",
      isExpanded: true,
      isSelected: false,
    };
    onChange([...testCases, newItem]);
    setActiveTab("manual");
  };

  // Duplicate item
  const duplicateTestCase = (id: string) => {
    const index = testCases.findIndex((tc) => tc.id === id);
    if (index === -1) return;
    const target = testCases[index];
    const dup: HiddenTestCaseItem = {
      ...target,
      id: "htc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      isExpanded: true,
      isSelected: false,
    };
    const newList = [...testCases];
    newList.splice(index + 1, 0, dup);
    onChange(newList);
  };

  // Delete item
  const deleteTestCase = (id: string) => {
    onChange(testCases.filter((tc) => tc.id !== id));
  };

  // Toggle selection
  const toggleSelect = (id: string) => {
    onChange(testCases.map((tc) => (tc.id === id ? { ...tc, isSelected: !tc.isSelected } : tc)));
  };

  // Toggle expand
  const toggleExpand = (id: string) => {
    onChange(
      testCases.map((tc) => (tc.id === id ? { ...tc, isExpanded: !(tc.isExpanded ?? false) } : tc)),
    );
  };

  // Bulk Selection
  const selectedCount = testCases.filter((tc) => tc.isSelected).length;
  const failedCount = testCases.filter((tc) => tc.status === "failed").length;
  const successCount = testCases.filter((tc) => tc.status === "success").length;
  const allSelected = testCases.length > 0 && selectedCount === testCases.length;

  const toggleSelectAll = () => {
    onChange(testCases.map((tc) => ({ ...tc, isSelected: !allSelected })));
  };

  const deleteSelected = () => {
    if (selectedCount === 0) return;
    if (window.confirm(`Delete ${selectedCount} selected test cases?`)) {
      onChange(testCases.filter((tc) => !tc.isSelected));
    }
  };

  const regenerateSelected = () => {
    if (selectedCount === 0) return;
    onChange(
      testCases.map((tc) =>
        tc.isSelected
          ? {
              ...tc,
              input: generateRandomInputData(
                tc.inputType || genType,
                genMinSize,
                genMaxSize,
                genMinVal,
                genMaxVal,
              ),
              expectedOutput: "",
              status: "pending",
            }
          : tc,
      ),
    );
  };

  // Filtered test cases via search
  const filteredCases = testCases.filter(
    (tc, idx) =>
      `#${idx + 1}`.includes(searchQuery) ||
      tc.input.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tc.expectedOutput.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tc.inputType && tc.inputType.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      {/* Statistics Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display font-bold text-base flex items-center gap-2">
              Hidden Test Cases Suite
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                {testCases.length} Hidden Cases
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Automated generator, Official Solution runner & Judge0 evaluation suite.
            </p>
          </div>
        </div>

        {/* Stats Counters */}
        <div className="flex items-center gap-3 text-xs">
          <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-1.5 text-center">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">Total</div>
            <div className="font-display font-bold text-base text-amber-400">
              {testCases.length}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-1.5 text-center">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">Generated</div>
            <div className="font-display font-bold text-base text-emerald-400">{successCount}</div>
          </div>
          {failedCount > 0 && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-center">
              <div className="text-[10px] text-destructive uppercase font-bold">Failed</div>
              <div className="font-display font-bold text-base text-destructive">{failedCount}</div>
            </div>
          )}
        </div>
      </div>

      {/* Main Action Bar for Automatic Output Generation */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground flex items-center gap-2">
              Automatic Expected Output Generation (Judge0)
              {officialSolution.code ? (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                >
                  Official Solution Ready ({officialSolution.language})
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-destructive/10 text-destructive border-destructive/30"
                >
                  Missing Official Solution
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Executes official reference solution against all generated inputs in parallel batches.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {failedCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={retryFailedTestCases}
              disabled={isGeneratingOutputs}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Retry Failed ({failedCount})
            </Button>
          )}

          <Button
            type="button"
            className="ember-gradient text-primary-foreground border-0 text-xs gap-1.5 font-bold shadow-lg"
            onClick={() => startOutputGeneration()}
            disabled={isGeneratingOutputs || testCases.length === 0}
          >
            <Sparkles className="h-4 w-4" /> Generate Expected Outputs ({testCases.length})
          </Button>
        </div>
      </div>

      {/* Tabs: Random Generator, Manual Management, Official Solution */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "generator" | "manual" | "solution")}
      >
        <TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted/60 p-1">
          <TabsTrigger value="generator" className="gap-2 text-xs font-semibold">
            <Wand2 className="h-4 w-4 text-amber-400" /> Random Generator
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2 text-xs font-semibold">
            <List className="h-4 w-4 text-emerald-400" /> Manual Suite ({testCases.length})
          </TabsTrigger>
          <TabsTrigger value="solution" className="gap-2 text-xs font-semibold">
            <FileCode className="h-4 w-4 text-blue-400" /> Official Solution
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: RANDOM GENERATOR */}
        <TabsContent value="generator" className="space-y-6 pt-4">
          <div className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-display text-base font-bold flex items-center gap-2">
                <Sliders className="h-4 w-4 text-amber-400" /> Random Input Generator Controls
              </h3>
              <span className="text-xs text-muted-foreground">
                Supports 100, 250, 500, 1000 Test Cases
              </span>
            </div>

            {/* Generator Fields Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Input Type */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Input Type</Label>
                <Select value={genType} onValueChange={(val: InputTypeOption) => setGenType(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="integer">Integer (Single Number)</SelectItem>
                    <SelectItem value="array">Array (1D Sequence)</SelectItem>
                    <SelectItem value="matrix">Matrix (2D Grid)</SelectItem>
                    <SelectItem value="string">String (Random Letters)</SelectItem>
                    <SelectItem value="graph">Graph (Vertices & Edges)</SelectItem>
                    <SelectItem value="tree">Tree (Hierarchical Nodes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Min & Max Size */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Min Size</Label>
                  <Input
                    type="number"
                    value={genMinSize}
                    onChange={(e) => setGenMinSize(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Max Size</Label>
                  <Input
                    type="number"
                    value={genMaxSize}
                    onChange={(e) => setGenMaxSize(parseInt(e.target.value) || 10)}
                  />
                </div>
              </div>

              {/* Min & Max Value */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Min Value</Label>
                  <Input
                    type="number"
                    value={genMinVal}
                    onChange={(e) => setGenMinVal(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Max Value</Label>
                  <Input
                    type="number"
                    value={genMaxVal}
                    onChange={(e) => setGenMaxVal(parseInt(e.target.value) || 100)}
                  />
                </div>
              </div>

              {/* Number of Test Cases */}
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <Label className="text-xs font-semibold">Number of Test Cases to Generate</Label>
                <Input
                  type="number"
                  value={genCount}
                  onChange={(e) => setGenCount(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            {/* Generator Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 text-destructive hover:bg-destructive/10"
                onClick={handleClearAll}
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear All
              </Button>

              <Button
                type="button"
                className="ember-gradient text-primary-foreground border-0 text-xs gap-1.5 font-bold shadow-lg"
                onClick={handleGenerateInputs}
              >
                <Sparkles className="h-4 w-4" /> Generate {genCount} Hidden Test Inputs
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: MANUAL MANAGEMENT */}
        <TabsContent value="manual" className="space-y-4 pt-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <List className="h-4 w-4 text-emerald-400" /> Manual Test Case Suite
            </h3>
            <Button
              type="button"
              className="ember-gradient text-primary-foreground border-0 text-xs gap-1.5"
              onClick={addHiddenTestCase}
            >
              <Plus className="h-4 w-4" /> Add Hidden Test Case
            </Button>
          </div>
        </TabsContent>

        {/* TAB 3: OFFICIAL SOLUTION */}
        <TabsContent value="solution" className="space-y-6 pt-4">
          <div className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-display text-base font-bold flex items-center gap-2 text-blue-400">
                  <Code2 className="h-5 w-5 text-blue-400" /> Official Solution Code
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Write or upload reference solution code used to automatically generate expected
                  outputs via Judge0.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleSolutionFileUpload}
                  accept=".cpp,.cxx,.java,.py,.js,.ts"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" /> Upload File (.py, .cpp, .java, .js)
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <Label className="text-xs font-semibold">Solution Language</Label>
                <Select
                  value={officialSolution.language}
                  onValueChange={(val) =>
                    onOfficialSolutionChange({ ...officialSolution, language: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="python">Python (3.8.1)</SelectItem>
                    <SelectItem value="cpp">C++ (GCC 9.2.0)</SelectItem>
                    <SelectItem value="java">Java (OpenJDK 13)</SelectItem>
                    <SelectItem value="javascript">JavaScript (Node.js 12)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Monaco Code Editor for Official Solution */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <FileCode className="h-4 w-4 text-blue-400" /> Official Solution Code
              </Label>
              <div className="rounded-xl border border-border/80 bg-background/90 overflow-hidden shadow-inner">
                <Editor
                  height="260px"
                  language={officialSolution.language === "cpp" ? "cpp" : officialSolution.language}
                  theme="vs-dark"
                  value={officialSolution.code}
                  onChange={(val) =>
                    onOfficialSolutionChange({ ...officialSolution, code: val || "" })
                  }
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
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* SEARCH & BULK OPERATIONS TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search hidden test cases..."
            className="pl-9 h-8 text-xs bg-background/80"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Bulk Action Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={toggleSelectAll}
          >
            {allSelected ? (
              <CheckSquare className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            {allSelected ? "Deselect All" : "Select All"}
          </Button>

          {selectedCount > 0 && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={regenerateSelected}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate Selected ({selectedCount})
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={deleteSelected}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Selected ({selectedCount})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* GENERATED TEST CASES LIST (COLLAPSIBLE CARDS) */}
      <div className="space-y-3">
        {filteredCases.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/30 p-10 text-center space-y-2">
            <Lock className="h-8 w-8 text-muted-foreground mx-auto" />
            <div className="font-display font-bold text-sm">No Hidden Test Cases Found</div>
            <p className="text-xs text-muted-foreground">
              {searchQuery
                ? "No test cases match your search query."
                : 'Click "Generate" in the Random Generator or "Add Hidden Test Case".'}
            </p>
          </div>
        ) : (
          filteredCases.map((tc, idx) => {
            const isExpanded = tc.isExpanded ?? false;
            const isSuccess = tc.status === "success";
            const isFailed = tc.status === "failed";

            return (
              <div
                key={tc.id}
                className={`rounded-xl border transition-all duration-150 overflow-hidden ${
                  isFailed
                    ? "border-destructive/60 bg-destructive/5"
                    : isSuccess
                      ? "border-emerald-500/40 bg-card/80"
                      : tc.isSelected
                        ? "border-amber-500/80 bg-card/95 shadow-md"
                        : "border-border/70 bg-card/70 hover:border-border"
                }`}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between gap-3 bg-muted/30 px-4 py-2.5 border-b border-border/50 select-none">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={tc.isSelected ?? false}
                      onChange={() => toggleSelect(tc.id)}
                      className="h-4 w-4 rounded border-border text-amber-500 focus:ring-amber-500 cursor-pointer"
                    />

                    <span className="font-display font-bold text-xs flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-500/20 text-amber-400 text-[11px]">
                        #{idx + 1}
                      </span>
                      Hidden Test Case
                    </span>

                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1"
                    >
                      <Lock className="h-3 w-3" /> Hidden
                    </Badge>

                    {/* Status Badge */}
                    {isSuccess ? (
                      <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
                        <CheckCircle className="h-3 w-3" /> Output Generated
                      </Badge>
                    ) : isFailed ? (
                      <Badge className="text-[10px] bg-destructive/20 text-destructive border-destructive/30 gap-1">
                        <XCircle className="h-3 w-3" /> Execution Failed
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" /> Pending Output
                      </Badge>
                    )}

                    {tc.generatedTime && (
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        ({tc.generatedTime})
                      </span>
                    )}

                    {/* Inline snippet when collapsed */}
                    {!isExpanded && (
                      <span className="text-xs text-muted-foreground truncate max-w-sm font-mono bg-background/50 px-2 py-0.5 rounded border border-border/40">
                        {tc.input.replace(/\n/g, " ").substring(0, 30)}...
                      </span>
                    )}
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => duplicateTestCase(tc.id)}
                      title="Duplicate"
                    >
                      <Copy className="h-3.5 w-3.5" /> Duplicate
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteTestCase(tc.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>

                    <div className="h-4 w-px bg-border/60 mx-1" />

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => toggleExpand(tc.id)}
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Card Body (When Expanded) */}
                {isExpanded && (
                  <div className="p-4 space-y-4 bg-card/40">
                    {/* Error Banner */}
                    {isFailed && tc.error && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>Execution Error: {tc.error}</span>
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Input Monaco Editor */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold flex items-center gap-1.5 text-amber-400">
                          <Code2 className="h-3.5 w-3.5" /> Input Data
                        </Label>
                        <div className="rounded-lg border border-border/80 bg-background/90 overflow-hidden">
                          <Editor
                            height="130px"
                            defaultLanguage="text"
                            theme="vs-dark"
                            value={tc.input}
                            onChange={(val) => {
                              onChange(
                                testCases.map((item) =>
                                  item.id === tc.id ? { ...item, input: val || "" } : item,
                                ),
                              );
                            }}
                            options={{
                              minimap: { enabled: false },
                              lineNumbers: "on",
                              fontSize: 12,
                              scrollBeyondLastLine: false,
                              wordWrap: "on",
                            }}
                          />
                        </div>
                      </div>

                      {/* Expected Output Monaco Editor */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold flex items-center gap-1.5 text-emerald-400">
                            <Code2 className="h-3.5 w-3.5" /> Expected Output (Auto-Generated via
                            Judge0)
                          </Label>
                          {tc.generatedTime && (
                            <span className="text-[10px] text-muted-foreground">
                              {tc.generatedTime}
                            </span>
                          )}
                        </div>
                        <div className="rounded-lg border border-border/80 bg-background/90 overflow-hidden">
                          <Editor
                            height="130px"
                            defaultLanguage="text"
                            theme="vs-dark"
                            value={tc.expectedOutput}
                            onChange={(val) => {
                              onChange(
                                testCases.map((item) =>
                                  item.id === tc.id ? { ...item, expectedOutput: val || "" } : item,
                                ),
                              );
                            }}
                            options={{
                              minimap: { enabled: false },
                              lineNumbers: "on",
                              fontSize: 12,
                              scrollBeyondLastLine: false,
                              wordWrap: "on",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* PROGRESS DIALOG MODAL FOR AUTOMATIC OUTPUT GENERATION */}
      {isGeneratingOutputs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-display text-base font-bold flex items-center gap-2 text-amber-400">
                <Sparkles className="h-5 w-5 animate-spin text-amber-400" /> Generating Expected
                Outputs via Judge0...
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 p-1 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  cancelGenerationRef.current = true;
                  setIsGeneratingOutputs(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Batch Processing Progress</span>
                <span className="text-amber-400 font-mono">
                  {generationProgress.completed} / {generationProgress.total} Completed
                </span>
              </div>

              <Progress
                value={(generationProgress.completed / Math.max(1, generationProgress.total)) * 100}
                className="h-3 rounded-full bg-muted/80"
              />

              <p className="text-[11px] text-muted-foreground text-center">
                Executing Official Solution on parallel Judge0 sandbox workers in batches of 15.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => {
                  cancelGenerationRef.current = true;
                  setIsGeneratingOutputs(false);
                }}
              >
                Cancel Generation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* VERIFICATION SUMMARY MODAL */}
      {generationSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-display text-lg font-bold flex items-center gap-2 text-emerald-400">
                <CheckCircle className="h-5 w-5 text-emerald-400" /> Output Generation Complete
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setGenerationSummary(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="text-[10px] text-emerald-400 font-bold uppercase">Success</div>
                <div className="font-display text-xl font-bold text-emerald-400">
                  {generationSummary.successCount}
                </div>
              </div>
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                <div className="text-[10px] text-destructive font-bold uppercase">Failed</div>
                <div className="font-display text-xl font-bold text-destructive">
                  {generationSummary.failedCount}
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                <div className="text-[10px] text-muted-foreground font-bold uppercase">
                  Time Taken
                </div>
                <div className="font-display text-xl font-bold text-foreground">
                  {generationSummary.timeTakenSec}s
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              {generationSummary.failedCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                  onClick={() => {
                    setGenerationSummary(null);
                    retryFailedTestCases();
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Retry Failed (
                  {generationSummary.failedCount})
                </Button>
              )}

              <Button
                type="button"
                className="ember-gradient text-primary-foreground border-0 text-xs"
                onClick={() => setGenerationSummary(null)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
