import { IProblem } from "../models/problem.model";

export interface LegacyFrontendProblem {
    _id: any;
    main: {
        id: number;
        name: string;
        difficulty: "easy" | "medium" | "hard";
        like_count: number;
        dislike_count: number;
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

/**
 * Safely escapes HTML special characters so raw text stored in the database
 * is rendered as-is rather than interpreted as markup.
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Converts a plain-text string (with \n newlines) to a safe HTML block.
 * Preserves line breaks and prevents XSS.
 */
function plainTextToHtml(text: string): string {
    return escapeHtml(text)
        .split("\n")
        .map(line => line.trim())
        .join("<br>");
}

/**
 * Renders a labelled section block in the problem statement HTML.
 * Only emitted when the content is non-empty.
 */
function renderSection(label: string, content: string): string {
    const trimmed = content.trim();
    if (!trimmed) return "";
    return `
<div class="problem-section mt-6">
  <h3 class="problem-section-title text-sm font-bold uppercase tracking-wider text-foreground mb-2">${escapeHtml(label)}</h3>
  <div class="problem-section-body text-sm text-muted-foreground leading-relaxed">${plainTextToHtml(trimmed)}</div>
</div>`;
}

/**
 * Renders a code/monospace block (for sample input/output).
 */
function renderCodeBlock(label: string, content: string): string {
    const trimmed = content.trim();
    if (!trimmed) return "";
    return `
<div class="problem-section mt-4">
  <h4 class="text-xs font-semibold text-foreground mb-1">${escapeHtml(label)}</h4>
  <pre class="bg-background/80 border border-border/60 rounded-lg p-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">${escapeHtml(trimmed)}</pre>
</div>`;
}

/**
 * Transforms the new production database Problem document
 * into the legacy nested JSON structure expected by the frontend.
 *
 * IMPORTANT: The description_body field is ONLY the rendered problem statement
 * for the left panel. It is NEVER sent to the compiler.
 *
 * The code_body field is ONLY the starter code templates keyed by language.
 * It is NEVER the problem statement.
 */
export function toFrontendProblem(problem: IProblem, status?: string): LegacyFrontendProblem {
    const mainLanguage = problem.starterCode?.[0]?.language || "javascript";

    // Build starter code map — ONLY real starter code, never description text
    const codeBody: Record<string, string> = {};
    if (problem.starterCode && Array.isArray(problem.starterCode)) {
        for (const sc of problem.starterCode) {
            if (sc.language && sc.code) {
                codeBody[sc.language] = sc.code;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Build the problem statement HTML — structured like CodeChef/LeetCode.
    // This is ONLY for the left panel renderer. It must NEVER be placed in
    // code_body or sent to the execution engine.
    // ─────────────────────────────────────────────────────────────────────────

    let html = "";

    // Main description
    if (problem.description?.trim()) {
        html += `<div class="problem-description text-sm text-muted-foreground leading-relaxed">${plainTextToHtml(problem.description.trim())}</div>`;
    }

    // Input Format
    if (problem.inputFormat?.trim()) {
        html += renderSection("Input Format", problem.inputFormat);
    }

    // Output Format
    if (problem.outputFormat?.trim()) {
        html += renderSection("Output Format", problem.outputFormat);
    }

    // Constraints
    if (problem.constraints?.trim()) {
        html += renderSection("Constraints", problem.constraints);
    }

    // Examples / Sample Test Cases
    if (Array.isArray(problem.examples) && problem.examples.length > 0) {
        html += `<div class="mt-6 space-y-4">`;
        problem.examples.forEach((ex, i) => {
            html += `
<div class="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3 text-xs">
  <div class="font-bold text-sm text-foreground">Example ${i + 1}:</div>
  ${renderCodeBlock("Input:", ex.input)}
  ${renderCodeBlock("Output:", ex.output)}
  ${ex.explanation?.trim() ? `<div class="text-muted-foreground text-xs mt-2"><span class="font-semibold text-foreground">Explanation:</span> ${escapeHtml(ex.explanation.trim())}</div>` : ""}
</div>`;
        });
        html += `</div>`;
    }

    // Notes (optional)
    if ((problem as any).notes?.trim()) {
        html += renderSection("Notes", (problem as any).notes);
    }

    return {
        _id: problem._id,
        main: {
            id: problem.problemId,
            name: problem.slug, // legacy 'name' mapped to the unique kebab slug
            difficulty: problem.difficulty,
            like_count: (problem as any).likeCount || 0,
            dislike_count: (problem as any).dislikeCount || 0,
            description_body: html, // Structured HTML for the left panel ONLY
            accept_count: problem.successCount || 0,
            submission_count: problem.submissionCount || 0,
            acceptance_rate_count: problem.acceptanceRate || 0,
            discussion_count: 0,
            related_topics: problem.tags || [],
            similar_questions: [],
            solution_count: 0,
            code_default_language: mainLanguage,
            code_body: codeBody, // Starter code for editor ONLY — never description text
            status: status || undefined,
            hints: problem.hints || [],
        },
        editorial: {
            editorial_body: problem.editorial || "No editorial available.",
        },
        test: (problem.examples ?? []).map((ex) => {
            try {
                // If stored as serialised JSON, parse it
                const inputParsed = JSON.parse(ex.input);
                const outputParsed = JSON.parse(ex.output);
                if (Array.isArray(inputParsed)) {
                    return [...inputParsed, outputParsed];
                }
                return [inputParsed, outputParsed];
            } catch {
                return [ex.input, ex.output];
            }
        }),
    };
}
