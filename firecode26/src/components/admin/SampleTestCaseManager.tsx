import React, { useState } from "react";
import Editor from "@monaco-editor/react";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  Copy,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Download,
  Upload,
  CheckSquare,
  Square,
  Maximize2,
  Minimize2,
  FileCode,
  Check,
  X,
  Code2,
} from "lucide-react";

export interface SampleTestCaseItem {
  id: string;
  input: string;
  output: string;
  explanation: string;
  isExpanded?: boolean;
  isSelected?: boolean;
}

interface SampleTestCaseManagerProps {
  testCases: SampleTestCaseItem[];
  onChange: (testCases: SampleTestCaseItem[]) => void;
}

export function SampleTestCaseManager({ testCases, onChange }: SampleTestCaseManagerProps) {
  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Modals
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [importError, setImportError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  // Toggle single testcase expansion
  const toggleExpand = (id: string) => {
    onChange(
      testCases.map((tc) => (tc.id === id ? { ...tc, isExpanded: !(tc.isExpanded ?? true) } : tc)),
    );
  };

  // Toggle single testcase selection
  const toggleSelect = (id: string) => {
    onChange(testCases.map((tc) => (tc.id === id ? { ...tc, isSelected: !tc.isSelected } : tc)));
  };

  // Expand All / Collapse All
  const setAllExpanded = (expanded: boolean) => {
    onChange(testCases.map((tc) => ({ ...tc, isExpanded: expanded })));
  };

  // Select All / Deselect All
  const setAllSelected = (selected: boolean) => {
    onChange(testCases.map((tc) => ({ ...tc, isSelected: selected })));
  };

  // Add new testcase
  const addTestCase = () => {
    const newItem: SampleTestCaseItem = {
      id: "tc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      input: "// Input data\n",
      output: "// Expected output\n",
      explanation: "<p>Explanation of the result...</p>",
      isExpanded: true,
      isSelected: false,
    };
    onChange([...testCases, newItem]);
  };

  // Duplicate testcase
  const duplicateTestCase = (id: string) => {
    const index = testCases.findIndex((tc) => tc.id === id);
    if (index === -1) return;
    const target = testCases[index];
    const duplicated: SampleTestCaseItem = {
      ...target,
      id: "tc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      isExpanded: true,
      isSelected: false,
    };
    const newList = [...testCases];
    newList.splice(index + 1, 0, duplicated);
    onChange(newList);
  };

  // Delete single testcase
  const deleteTestCase = (id: string) => {
    onChange(testCases.filter((tc) => tc.id !== id));
  };

  // Delete selected testcases
  const deleteSelected = () => {
    const selectedCount = testCases.filter((tc) => tc.isSelected).length;
    if (selectedCount === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedCount} selected test case(s)?`)) {
      onChange(testCases.filter((tc) => !tc.isSelected));
    }
  };

  // Update item field
  const updateField = (id: string, field: keyof SampleTestCaseItem, value: any) => {
    onChange(testCases.map((tc) => (tc.id === id ? { ...tc, [field]: value } : tc)));
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newList = [...testCases];
    const [movedItem] = newList.splice(draggedIndex, 1);
    newList.splice(index, 0, movedItem);

    setDraggedIndex(null);
    setDragOverIndex(null);
    onChange(newList);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Flexible JSON parser supporting multiline strings, single quotes, trailing commas & single objects
  const handleImportJson = () => {
    setImportError("");
    const raw = importJsonText.trim();
    if (!raw) {
      setImportError("Please paste JSON text before clicking Import.");
      return;
    }

    try {
      let parsed: any;

      // 1. Strict parse attempt
      try {
        parsed = JSON.parse(raw);
      } catch {
        // 2. Sanitization fallback for raw multiline strings, smart quotes & trailing commas
        let cleaned = raw
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/,\s*([}\]])/g, "$1");

        let inString = false;
        let quoteChar = "";
        let buf = "";

        for (let i = 0; i < cleaned.length; i++) {
          const char = cleaned[i];
          const prevChar = i > 0 ? cleaned[i - 1] : "";

          if ((char === '"' || char === "'") && prevChar !== "\\") {
            if (!inString) {
              inString = true;
              quoteChar = char;
            } else if (quoteChar === char) {
              inString = false;
              quoteChar = "";
            }
          }

          if (inString && (char === "\n" || char === "\r")) {
            buf += char === "\r" ? "" : "\\n";
          } else {
            buf += char;
          }
        }
        parsed = JSON.parse(buf);
      }

      // Convert single object to array if needed
      if (!Array.isArray(parsed)) {
        if (typeof parsed === "object" && parsed !== null) {
          parsed = [parsed];
        } else {
          setImportError("Imported JSON must be an array of objects or a valid test case object.");
          return;
        }
      }

      const importedItems: SampleTestCaseItem[] = parsed.map((item: any, idx: number) => ({
        id: "tc_" + Date.now() + "_" + idx + "_" + Math.random().toString(36).substring(2, 6),
        input:
          typeof item.input === "string" ? item.input : JSON.stringify(item.input ?? "", null, 2),
        output:
          typeof item.output === "string" || typeof item.expectedOutput === "string"
            ? String(item.output ?? item.expectedOutput ?? "")
            : JSON.stringify(item.output ?? item.expectedOutput ?? "", null, 2),
        explanation:
          typeof item.explanation === "string"
            ? item.explanation
            : item.explanation
              ? String(item.explanation)
              : "",
        isExpanded: true,
        isSelected: false,
      }));

      onChange([...testCases, ...importedItems]);
      setIsImportOpen(false);
      setImportJsonText("");
    } catch (err: any) {
      setImportError(
        `Syntax Error: ${err?.message || "Invalid JSON syntax. Ensure quotes around keys and values match."}`,
      );
    }
  };

  // JSON Export payload string
  const exportPayload = JSON.stringify(
    testCases.map(({ input, output, explanation }) => ({
      input,
      output,
      explanation,
    })),
    null,
    2,
  );

  const copyExportJson = () => {
    navigator.clipboard.writeText(exportPayload);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const selectedCount = testCases.filter((tc) => tc.isSelected).length;
  const allSelected = testCases.length > 0 && selectedCount === testCases.length;

  return (
    <div className="space-y-6 relative pb-16">
      {/* Top Manager Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Badge className="ember-gradient text-primary-foreground text-xs font-semibold px-2.5 py-1">
            Total: {testCases.length} Sample Cases
          </Badge>
          {selectedCount > 0 && (
            <Badge
              variant="outline"
              className="border-amber-500/50 bg-amber-500/10 text-amber-400 text-xs"
            >
              {selectedCount} Selected
            </Badge>
          )}
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setAllSelected(!allSelected)}
          >
            {allSelected ? (
              <CheckSquare className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            {allSelected ? "Deselect All" : "Select All"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setAllExpanded(true)}
          >
            <Maximize2 className="h-3.5 w-3.5" /> Expand All
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setAllExpanded(false)}
          >
            <Minimize2 className="h-3.5 w-3.5" /> Collapse All
          </Button>

          {selectedCount > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={deleteSelected}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Selected ({selectedCount})
            </Button>
          )}

          <div className="h-4 w-px bg-border/80 mx-1" />

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setIsImportOpen(true)}
          >
            <Upload className="h-3.5 w-3.5" /> Import JSON
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setIsExportOpen(true)}
          >
            <Download className="h-3.5 w-3.5" /> Export JSON
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {testCases.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 p-12 text-center space-y-3">
          <FileCode className="h-10 w-10 text-muted-foreground mx-auto" />
          <h3 className="font-display text-base font-bold">No Sample Test Cases Added</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Click "Add Sample Test Case" below or "Import JSON" above to create sample test cases.
          </p>
          <Button
            type="button"
            className="ember-gradient text-primary-foreground border-0 gap-1.5 text-xs mt-2"
            onClick={addTestCase}
          >
            <Plus className="h-4 w-4" /> Add First Test Case
          </Button>
        </div>
      )}

      {/* Collapsible Test Case Cards List */}
      <div className="space-y-4">
        {testCases.map((tc, idx) => {
          const isExpanded = tc.isExpanded ?? true;
          const isDragging = draggedIndex === idx;
          const isDragOver = dragOverIndex === idx;

          return (
            <div
              key={tc.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isDragging
                  ? "opacity-40 border-amber-500 scale-[0.99]"
                  : isDragOver
                    ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40"
                    : tc.isSelected
                      ? "border-amber-500/80 bg-card/95 shadow-md"
                      : "border-border/80 bg-card/80 hover:border-border"
              }`}
            >
              {/* Card Header Bar */}
              <div className="flex items-center justify-between gap-3 bg-muted/30 px-4 py-3 border-b border-border/60 select-none">
                <div className="flex items-center gap-3">
                  {/* Drag Handle */}
                  <div
                    className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 rounded hover:bg-background/60"
                    title="Drag to reorder testcase"
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Selection Checkbox */}
                  <input
                    type="checkbox"
                    checked={tc.isSelected ?? false}
                    onChange={() => toggleSelect(tc.id)}
                    className="h-4 w-4 rounded border-border text-amber-500 focus:ring-amber-500 cursor-pointer"
                  />

                  {/* Number Badge */}
                  <span className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/20 text-amber-400 text-xs">
                      #{idx + 1}
                    </span>
                    Sample Case
                  </span>

                  {/* Preview summary when collapsed */}
                  {!isExpanded && (
                    <span className="text-xs text-muted-foreground truncate max-w-md font-mono bg-background/50 px-2 py-0.5 rounded border border-border/40">
                      Input: {tc.input.replace(/\n/g, " ").substring(0, 40)}...
                    </span>
                  )}
                </div>

                {/* Right Header Controls */}
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => duplicateTestCase(tc.id)}
                    title="Duplicate Test Case"
                  >
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteTestCase(tc.id)}
                    title="Delete Test Case"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
                <div className="p-5 space-y-6 bg-card/40">
                  {/* Inputs & Output Grid */}
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Monaco Code Editor for Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold flex items-center gap-1.5 text-amber-400">
                          <Code2 className="h-3.5 w-3.5" /> Input Data
                        </Label>
                        <span className="text-[10px] text-muted-foreground">
                          Code Editor (Monaco)
                        </span>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-background/90 overflow-hidden focus-within:ring-1 focus-within:ring-amber-500/50">
                        <Editor
                          height="140px"
                          defaultLanguage="text"
                          theme="vs-dark"
                          value={tc.input}
                          onChange={(val) => updateField(tc.id, "input", val || "")}
                          options={{
                            minimap: { enabled: false },
                            lineNumbers: "on",
                            fontSize: 12,
                            scrollBeyondLastLine: false,
                            wordWrap: "on",
                            padding: { top: 8, bottom: 8 },
                          }}
                        />
                      </div>
                    </div>

                    {/* Monaco Code Editor for Expected Output */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold flex items-center gap-1.5 text-emerald-400">
                          <Code2 className="h-3.5 w-3.5" /> Expected Output
                        </Label>
                        <span className="text-[10px] text-muted-foreground">
                          Code Editor (Monaco)
                        </span>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-background/90 overflow-hidden focus-within:ring-1 focus-within:ring-emerald-500/50">
                        <Editor
                          height="140px"
                          defaultLanguage="text"
                          theme="vs-dark"
                          value={tc.output}
                          onChange={(val) => updateField(tc.id, "output", val || "")}
                          options={{
                            minimap: { enabled: false },
                            lineNumbers: "on",
                            fontSize: 12,
                            scrollBeyondLastLine: false,
                            wordWrap: "on",
                            padding: { top: 8, bottom: 8 },
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Explanation TipTap Rich Text Editor */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Explanation (Rich Text)</Label>
                    <RichTextEditor
                      value={tc.explanation}
                      onChange={(html) => updateField(tc.id, "explanation", html)}
                      placeholder="Explain how input transforms to output for candidates..."
                      minHeight="100px"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Sticky "Add Sample Test Case" Button */}
      <div className="sticky bottom-6 flex justify-center z-10">
        <Button
          type="button"
          onClick={addTestCase}
          className="ember-gradient text-primary-foreground border-0 shadow-2xl rounded-full px-6 py-5 gap-2 text-xs font-bold hover:scale-105 transition-all ring-4 ring-background"
        >
          <Plus className="h-4 w-4" /> Add Sample Test Case
        </Button>
      </div>

      {/* IMPORT JSON MODAL */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-display text-lg font-bold flex items-center gap-2">
                <Upload className="h-5 w-5 text-amber-500" /> Import Sample Test Cases (JSON)
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setIsImportOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Paste a JSON array containing <code>input</code>, <code>output</code>, and optional{" "}
              <code>explanation</code> fields.
            </p>

            {importError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive">
                {importError}
              </div>
            )}

            <textarea
              rows={8}
              className="w-full rounded-xl border border-border bg-background p-3 text-xs font-mono outline-none focus:ring-1 focus:ring-amber-500"
              placeholder={`[\n  {\n    "input": "2\\n1 2",\n    "output": "3",\n    "explanation": "1 + 2 = 3"\n  }\n]`}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsImportOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="ember-gradient text-primary-foreground border-0 text-xs"
                onClick={handleImportJson}
              >
                Import Test Cases
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT JSON MODAL */}
      {isExportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-display text-lg font-bold flex items-center gap-2">
                <Download className="h-5 w-5 text-emerald-400" /> Export Sample Test Cases (JSON)
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setIsExportOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <pre className="max-h-80 overflow-y-auto rounded-xl border border-border bg-background p-4 text-xs font-mono text-emerald-400">
              {exportPayload}
            </pre>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                {testCases.length} items exported
              </span>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExportOpen(false)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  className="ember-gradient text-primary-foreground border-0 text-xs gap-1.5"
                  onClick={copyExportJson}
                >
                  {copySuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copySuccess ? "Copied!" : "Copy JSON"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
