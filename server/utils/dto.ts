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
    function_name: string;
}

/**
 * Transforms the new production database Problem document
 * into the legacy nested JSON structure expected by the frontend.
 */
export function toFrontendProblem(problem: IProblem, status?: string): LegacyFrontendProblem {
    const mainLanguage = problem.starterCode?.[0]?.language || "javascript";

    const codeBody: Record<string, string> = {};
    if (problem.starterCode) {
        for (const sc of problem.starterCode) {
            codeBody[sc.language] = sc.code;
        }
    }

    // Merge description with examples, constraints, inputFormat, and outputFormat
    let fullDescription = problem.description || "";

    if (Array.isArray(problem.examples) && problem.examples.length > 0) {
        fullDescription += `<div class="my-6 space-y-4">`;
        problem.examples.forEach((ex, i) => {
            fullDescription += `
                <div class="rounded-xl border border-border/60 bg-card/60 p-4 space-y-2 text-xs">
                    <div class="font-bold text-sm text-foreground">Example ${i + 1}:</div>
                    <div class="font-mono bg-background/80 p-2.5 rounded-lg"><strong>Input:</strong> ${ex.input}</div>
                    <div class="font-mono bg-background/80 p-2.5 rounded-lg"><strong>Output:</strong> ${ex.output}</div>
                    ${ex.explanation ? `<div class="text-muted-foreground mt-1 font-normal"><strong>Explanation:</strong> ${ex.explanation}</div>` : ""}
                </div>
            `;
        });
        fullDescription += `</div>`;
    }

    if (problem.constraints) {
        fullDescription += `<p>&nbsp;</p><p><strong class="text-foreground font-bold">Constraints:</strong></p><div class="text-muted-foreground mt-1">${problem.constraints}</div>`;
    }
    if (problem.inputFormat) {
        fullDescription += `<p>&nbsp;</p><p><strong class="text-foreground font-bold">Input Format:</strong></p><div class="text-muted-foreground mt-1">${problem.inputFormat}</div>`;
    }
    if (problem.outputFormat) {
        fullDescription += `<p>&nbsp;</p><p><strong class="text-foreground font-bold">Output Format:</strong></p><div class="text-muted-foreground mt-1">${problem.outputFormat}</div>`;
    }

    return {
        _id: problem._id,
        main: {
            id: problem.problemId,
            name: problem.slug, // legacy 'name' mapped to the unique kebab slug
            difficulty: problem.difficulty,
            like_count: (problem as any).likeCount || 0,
            dislike_count: (problem as any).dislikeCount || 0,
            description_body: fullDescription,
            accept_count: problem.successCount || 0,
            submission_count: problem.submissionCount || 0,
            acceptance_rate_count: problem.acceptanceRate || 0,
            discussion_count: 0,
            related_topics: problem.tags || [],
            similar_questions: [],
            solution_count: 0,
            code_default_language: mainLanguage,
            code_body: codeBody,
            status: status || undefined,
            hints: problem.hints || [],
        },
        editorial: {
            editorial_body: problem.editorial || "No editorial available.",
        },
        test: (problem.examples ?? []).map((ex) => {
            try {
                // If it is stored as serialised JSON (e.g. "[1, 2]" or "[[1, 2], 3]"), parse it
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
        function_name: problem.functionName || "",
    };
}
