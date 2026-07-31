import axios from "axios";
import vm from "vm";
import { IProblem } from "../models/problem.model";
import { ITestCase } from "../models/testcase.model";
import { logger } from "./logger";

export interface TestCaseExecutionResult {
    testCaseId: string;
    isHidden: boolean;
    status: "Accepted" | "Wrong Answer" | "Runtime Error" | "Time Limit Exceeded" | "Memory Limit Exceeded" | "Compilation Error" | "Output Limit Exceeded";
    runtime: number; // milliseconds
    memory: number; // kilobytes
    error_message?: string;
    input?: string;
    expected_output?: string;
    user_output?: string;
}

export interface JudgeReport {
    status: "Accepted" | "Wrong Answer" | "Runtime Error" | "Time Limit Exceeded" | "Memory Limit Exceeded" | "Compilation Error" | "Output Limit Exceeded";
    runtime: number;
    memory: number;
    results: TestCaseExecutionResult[];
}

const rawJudge0Url = process.env.JUDGE0_URL || (process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:2358");
const JUDGE0_URL = rawJudge0Url.replace(/\/$/, "");

const JUDGE0_LANG_IDS: Record<string, number> = {
    cpp: 54,        // C++ (GCC 9.2.0)
    c: 50,          // C (GCC 9.2.0)
    java: 62,       // Java (OpenJDK 13.0.1)
    python: 71,     // Python (3.8.1)
    javascript: 63, // JavaScript (Node.js 12.14.0)
    typescript: 74, // TypeScript (3.7.4)
    go: 60,         // Go (1.13.5)
    rust: 73,       // Rust (1.40.0)
    csharp: 51,     // C# (Mono 6.6.0.161)
    kotlin: 78,     // Kotlin (1.3.70)
};

interface CircuitBreakerState {
    failures: number;
    lastFailureTime: number;
    isOpen: boolean;
}

const circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
};

const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 30000;

function isCircuitOpen(): boolean {
    if (!circuitBreaker.isOpen) return false;
    if (Date.now() - circuitBreaker.lastFailureTime > RESET_TIMEOUT_MS) {
        circuitBreaker.isOpen = false;
        circuitBreaker.failures = 0;
        return false;
    }
    return true;
}

function recordSuccess() {
    circuitBreaker.failures = 0;
    circuitBreaker.isOpen = false;
}

function recordFailure() {
    circuitBreaker.failures += 1;
    circuitBreaker.lastFailureTime = Date.now();
    if (circuitBreaker.failures >= FAILURE_THRESHOLD) {
        circuitBreaker.isOpen = true;
        console.error(`[Circuit Breaker] Judge0 circuit OPENED after ${FAILURE_THRESHOLD} consecutive failures.`);
    }
}


export function formatNormalizedInput(rawInput: string): string {
    if (!rawInput) return "";
    const cleanInput = rawInput.trim();

    // 1. Try parsing JSON array directly, e.g. [[2,7,11,15], 9] or [ [3,2,4], 6 ]
    try {
        const parsed = JSON.parse(cleanInput);
        if (Array.isArray(parsed) && parsed.length >= 2) {
            let arr: number[] = [];
            let target: number | null = null;
            if (Array.isArray(parsed[0])) {
                arr = parsed[0].map(Number);
                target = Number(parsed[1]);
            } else if (typeof parsed[parsed.length - 1] === "number") {
                target = Number(parsed[parsed.length - 1]);
                arr = parsed.slice(0, parsed.length - 1).map(Number);
            }
            if (arr.length > 0 && target !== null && !isNaN(target)) {
                return `${arr.length}\n${arr.join(" ")}\n${target}\n${cleanInput}`;
            }
        }
    } catch {
        // Not JSON
    }

    // 2. Regex fallback for "nums = [2, 7, 11, 15]\ntarget = 9"
    const arrayMatch = cleanInput.match(/\[([\s\S]*?)\]/);
    if (arrayMatch) {
        const arrStr = arrayMatch[1];
        const arrTokens = arrStr.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
        const parsedArray: number[] = [];
        for (const t of arrTokens) {
            const num = Number(t);
            if (t !== "" && !isNaN(num)) parsedArray.push(num);
        }

        const outsideStr = cleanInput.replace(arrayMatch[0], "");
        const outsideTokens = outsideStr.split(/[\s=,\[\]]+/).map(s => s.trim()).filter(Boolean);
        const outsideNums: number[] = [];
        for (const t of outsideTokens) {
            const num = Number(t);
            if (t !== "" && !isNaN(num)) outsideNums.push(num);
        }

        if (parsedArray.length > 0 && outsideNums.length > 0) {
            return `${parsedArray.length}\n${parsedArray.join(" ")}\n${outsideNums.join("\n")}\n${cleanInput}`;
        }
    }

    return cleanInput;
}

function executeLocalFallback(
    userCode: string,
    problem: IProblem,
    testCase: ITestCase,
    language: string = "javascript"
): TestCaseExecutionResult {
    const lang = (language || "javascript").toLowerCase();
    const startTime = Date.now();

    // ─────────────────────────────────────────────
    // C++ / C Local Execution Fallback (via g++)
    // ─────────────────────────────────────────────
    if (lang === "cpp" || lang === "c") {
        try {
            const { execSync } = require("child_process");
            const fs = require("fs");
            const path = require("path");
            const os = require("os");

            const fullCppCode = userCode;
            const baseTempDir = path.join(process.cwd(), "scratch");
            if (!fs.existsSync(baseTempDir)) {
                fs.mkdirSync(baseTempDir, { recursive: true });
            }
            const tempDir = fs.mkdtempSync(path.join(baseTempDir, "fc_cpp_"));
            const cppFile = path.join(tempDir, "main.cpp");
            const exeFile = path.join(tempDir, process.platform === "win32" ? "main.exe" : "main");

            fs.writeFileSync(cppFile, fullCppCode);

            try {
                execSync(`g++ -O2 "${cppFile}" -o "${exeFile}"`, { timeout: 12000, stdio: "pipe" });
            } catch (compileErr: any) {
                const stderr = compileErr.stderr ? compileErr.stderr.toString() : compileErr.message;
                fs.rmSync(tempDir, { recursive: true, force: true });
                return {
                    testCaseId: testCase._id ? testCase._id.toString() : String(testCase.executionOrder),
                    isHidden: testCase.isHidden,
                    status: "Compilation Error",
                    runtime: Date.now() - startTime,
                    memory: 0,
                    error_message: stderr || "C++ compilation failed.",
                    input: testCase.isHidden ? undefined : testCase.input,
                    expected_output: testCase.isHidden ? undefined : testCase.expectedOutput,
                    user_output: "",
                };
            }

            let userOutput = "";
            try {
                userOutput = execSync(`"${exeFile}"`, {
                    input: testCase.input,
                    timeout: 4000,
                    maxBuffer: 1024 * 1024,
                }).toString().trim();
            } catch (execErr: any) {
                const stderr = execErr.stderr ? execErr.stderr.toString() : execErr.message;
                fs.rmSync(tempDir, { recursive: true, force: true });
                return {
                    testCaseId: testCase._id ? testCase._id.toString() : String(testCase.executionOrder),
                    isHidden: testCase.isHidden,
                    status: "Runtime Error",
                    runtime: Date.now() - startTime,
                    memory: 0,
                    error_message: stderr || "Runtime Error during C++ execution.",
                    input: testCase.isHidden ? undefined : testCase.input,
                    expected_output: testCase.isHidden ? undefined : testCase.expectedOutput,
                    user_output: "",
                };
            }

            fs.rmSync(tempDir, { recursive: true, force: true });

            const runtime = Date.now() - startTime;
            const expectedOutput = (testCase.expectedOutput || "").trim();

            let isMatch = userOutput === expectedOutput;
            if (!isMatch) {
                try {
                    const uObj = JSON.parse(userOutput);
                    const eObj = JSON.parse(expectedOutput);
                    isMatch = JSON.stringify(uObj) === JSON.stringify(eObj);
                } catch {
                    isMatch = false;
                }
            }

            const result: TestCaseExecutionResult = {
                testCaseId: testCase._id ? testCase._id.toString() : String(testCase.executionOrder),
                isHidden: testCase.isHidden,
                status: isMatch ? "Accepted" : "Wrong Answer",
                runtime: Math.max(1, runtime),
                memory: 2048,
            };

            if (!testCase.isHidden) {
                result.input = testCase.input;
                result.expected_output = testCase.expectedOutput;
                result.user_output = userOutput;
            }

            return result;
        } catch (fallbackErr: any) {
            return {
                testCaseId: testCase._id ? testCase._id.toString() : String(testCase.executionOrder),
                isHidden: testCase.isHidden,
                status: "Compilation Error",
                runtime: Date.now() - startTime,
                memory: 0,
                error_message: `C++ execution fallback error: ${fallbackErr.message}`,
                input: testCase.isHidden ? undefined : testCase.input,
                expected_output: testCase.isHidden ? undefined : testCase.expectedOutput,
                user_output: "",
            };
        }
    }

    // ─────────────────────────────────────────────
    // Python Local Execution Fallback
    // ─────────────────────────────────────────────
    if (lang === "python") {
        try {
            const { execSync } = require("child_process");
            const fs = require("fs");
            const path = require("path");
            const os = require("os");

            const fullPyCode = userCode;
            const baseTempDir = path.join(process.cwd(), "scratch");
            if (!fs.existsSync(baseTempDir)) {
                fs.mkdirSync(baseTempDir, { recursive: true });
            }
            const tempDir = fs.mkdtempSync(path.join(baseTempDir, "fc_py_"));
            const pyFile = path.join(tempDir, "script.py");

            fs.writeFileSync(pyFile, fullPyCode);

            let userOutput = "";
            const pythonCmd = process.platform === "win32" ? "python" : "python3";
            try {
                userOutput = execSync(`"${pythonCmd}" "${pyFile}"`, {
                    input: testCase.input,
                    timeout: 4000,
                    maxBuffer: 1024 * 1024,
                }).toString().trim();
            } catch (execErr: any) {
                const stderr = execErr.stderr ? execErr.stderr.toString() : execErr.message;
                fs.rmSync(tempDir, { recursive: true, force: true });
                return {
                    testCaseId: testCase._id ? testCase._id.toString() : String(testCase.executionOrder),
                    isHidden: testCase.isHidden,
                    status: "Runtime Error",
                    runtime: Date.now() - startTime,
                    memory: 0,
                    error_message: stderr || "Runtime Error during Python execution.",
                    input: testCase.isHidden ? undefined : testCase.input,
                    expected_output: testCase.expectedOutput,
                    user_output: "",
                };
            }

            fs.rmSync(tempDir, { recursive: true, force: true });

            const runtime = Date.now() - startTime;
            const expectedOutput = (testCase.expectedOutput || "").trim();

            let isMatch = userOutput === expectedOutput;
            if (!isMatch) {
                try {
                    const uObj = JSON.parse(userOutput);
                    const eObj = JSON.parse(expectedOutput);
                    isMatch = JSON.stringify(uObj) === JSON.stringify(eObj);
                } catch {
                    isMatch = false;
                }
            }

            const result: TestCaseExecutionResult = {
                testCaseId: testCase._id ? testCase._id.toString() : String(testCase.executionOrder),
                isHidden: testCase.isHidden,
                status: isMatch ? "Accepted" : "Wrong Answer",
                runtime: Math.max(1, runtime),
                memory: 2048,
            };

            if (!testCase.isHidden) {
                result.input = testCase.input;
                result.expected_output = testCase.expectedOutput;
                result.user_output = userOutput;
            }

            return result;
        } catch (fallbackErr: any) {
            return {
                testCaseId: testCase._id ? testCase._id.toString() : String(testCase.executionOrder),
                isHidden: testCase.isHidden,
                status: "Compilation Error",
                runtime: Date.now() - startTime,
                memory: 0,
                error_message: `Python execution error: ${fallbackErr.message}`,
            };
        }
    }

    if (lang !== "javascript" && lang !== "typescript") {
        return {
            testCaseId: testCase._id ? testCase._id.toString() : String(testCase.executionOrder),
            isHidden: testCase.isHidden,
            status: "Compilation Error",
            runtime: Date.now() - startTime,
            memory: 0,
            error_message: "Local execution fallback does not support this language.",
        };
    }

    try {
        const { execSync } = require("child_process");
        const fs = require("fs");
        const path = require("path");

        const baseTempDir = path.join(process.cwd(), "scratch");
        if (!fs.existsSync(baseTempDir)) {
            fs.mkdirSync(baseTempDir, { recursive: true });
        }
        const tempDir = fs.mkdtempSync(path.join(baseTempDir, "fc_js_"));
        const jsFile = path.join(tempDir, "script.js");

        fs.writeFileSync(jsFile, userCode);

        let userOutput = "";
        try {
            userOutput = execSync('node "' + jsFile + '"', {
                input: testCase.input,
                timeout: 4000,
                maxBuffer: 1024 * 1024,
            }).toString().trim();
        } catch (execErr: any) {
            const stderr = execErr.stderr ? execErr.stderr.toString() : execErr.message;
            fs.rmSync(tempDir, { recursive: true, force: true });
            return {
                testCaseId: testCase._id ? testCase._id.toString() : String(testCase.executionOrder),
                isHidden: testCase.isHidden,
                status: "Runtime Error",
                runtime: Date.now() - startTime,
                memory: 0,
                error_message: stderr || "Runtime Error during JavaScript execution.",
                input: testCase.isHidden ? undefined : testCase.input,
                expected_output: testCase.expectedOutput,
                user_output: "",
            };
        }

        fs.rmSync(tempDir, { recursive: true, force: true });

        const runtime = Date.now() - startTime;
        const expectedOutput = (testCase.expectedOutput || "").trim();

        let isMatch = userOutput === expectedOutput;
        if (!isMatch) {
            try {
                const uObj = JSON.parse(userOutput);
                const eObj = JSON.parse(expectedOutput);
                isMatch = JSON.stringify(uObj) === JSON.stringify(eObj);
            } catch {
                isMatch = false;
            }
        }

        const result: TestCaseExecutionResult = {
            testCaseId: testCase._id ? testCase._id.toString() : String(testCase.executionOrder),
            isHidden: testCase.isHidden,
            status: isMatch ? "Accepted" : "Wrong Answer",
            runtime: Math.max(1, runtime),
            memory: 2048,
        };

        if (!testCase.isHidden) {
            result.input = testCase.input;
            result.expected_output = testCase.expectedOutput;
            result.user_output = userOutput;
        }

        return result;
    } catch (err: any) {
        return {
            testCaseId: testCase._id ? testCase._id.toString() : String(testCase.executionOrder),
            isHidden: testCase.isHidden,
            status: "Runtime Error",
            runtime: Date.now() - startTime,
            memory: 0,
            error_message: err.message || String(err),
            input: testCase.isHidden ? undefined : testCase.input,
            expected_output: testCase.expectedOutput,
            user_output: "",
        };
    }
}

// Map Judge0 status IDs to our status names
function mapJudge0Status(statusId: number): TestCaseExecutionResult["status"] {
    switch (statusId) {
        case 3: return "Accepted";
        case 4: return "Wrong Answer";
        case 5: return "Time Limit Exceeded";
        case 6: return "Compilation Error";
        case 7:
        case 8:
        case 9:
        case 10:
        case 11:
        case 12: return "Runtime Error";
        case 13: return "Runtime Error";
        case 14: return "Wrong Answer";
        case 15: return "Output Limit Exceeded";
        default: return "Runtime Error";
    }
}

/**
 * Execute Judge0 API request with retry mechanism & circuit breaker protection.
 */
async function postJudge0WithRetry(url: string, payload: any, headers: any, retries = 2) {
    const isDev = process.env.NODE_ENV !== "production";

    if (isCircuitOpen()) {
        if (isDev && !url.includes("127.0.0.1:2358") && !url.includes("localhost:2358")) {
            const localUrl = url.replace(/https?:\/\/[^\/]+/, "http://127.0.0.1:2358");
            try {
                return await axios.post(localUrl, payload, { headers, timeout: 10000 });
            } catch {
                // Ignore fallback error
            }
        }
        throw new Error("Judge0 circuit breaker is OPEN. Service temporarily unavailable.");
    }

    let attempt = 0;
    while (attempt <= retries) {
        try {
            const response = await axios.post(url, payload, { headers, timeout: 12000 });
            recordSuccess();
            return response;
        } catch (err: any) {
            attempt++;
            if (isDev && !url.includes("127.0.0.1:2358") && !url.includes("localhost:2358")) {
                const localUrl = url.replace(/https?:\/\/[^\/]+/, "http://127.0.0.1:2358");
                try {
                    const localRes = await axios.post(localUrl, payload, { headers, timeout: 10000 });
                    recordSuccess();
                    return localRes;
                } catch {
                    // Ignore fallback error
                }
            }
            if (attempt > retries) {
                recordFailure();
                throw err;
            }
            const delay = Math.min(attempt * 1000, 3000);
            await new Promise(res => setTimeout(res, delay));
        }
    }
    throw new Error("Judge0 API request failed after retries.");
}

function encodeB64(str?: string | null): string {
    if (!str) return "";
    return Buffer.from(str, "utf-8").toString("base64");
}

function decodeB64(str?: string | null): string {
    if (!str) return "";
    try {
        return Buffer.from(str, "base64").toString("utf-8");
    } catch {
        return str;
    }
}

/**
 * Run a single test case on Judge0.
 */
async function executeSingleTestCase(
    userCode: string,
    sourceCode: string,
    languageId: number,
    testCase: ITestCase,
    defaultTimeLimit: number,
    defaultMemoryLimit: number,
    problem: IProblem,
    language: string
): Promise<TestCaseExecutionResult> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    const rawCpu = (testCase.timeLimit || defaultTimeLimit || 2000) / 1000;
    const cpuLimit = Math.max(0.5, Math.min(10, rawCpu));
    const wallTimeLimit = Math.min(15, cpuLimit * 2);

    const rawMem = (testCase.memoryLimit || defaultMemoryLimit || 256) * 1024;
    const memLimit = Math.max(16384, Math.min(524288, rawMem));

    try {
        const formattedInput = formatNormalizedInput(testCase.input);

        const response = await postJudge0WithRetry(
            `${JUDGE0_URL}/submissions?base64_encoded=true&wait=true`,
            {
                source_code: encodeB64(sourceCode),
                language_id: languageId,
                stdin: encodeB64(formattedInput),
                cpu_time_limit: cpuLimit,
                wall_time_limit: wallTimeLimit,
                memory_limit: memLimit,
                max_processes_and_or_lightweight_tasks: 30,
                enable_network: false,
            },
            headers
        );

        const data = response.data;
        if (!data || typeof data !== "object") {
            throw new Error("Invalid response format received from Judge0.");
        }

        const decodedStdout = decodeB64(data.stdout);
        const decodedStderr = decodeB64(data.stderr);
        const decodedCompileOutput = decodeB64(data.compile_output);

        const status = mapJudge0Status(data.status?.id || 3);
        const runtime = Math.round((data.time ? parseFloat(data.time) : 0) * 1000);
        const memory = data.memory || 0;

        let finalStatus = status;
        let errorMessage = decodedCompileOutput || decodedStderr || undefined;

        let userOutput = decodedStdout ? decodedStdout.trim() : "";
        const expectedOutput = testCase.expectedOutput.trim();

        if (status === "Accepted") {
            if (userOutput !== expectedOutput) {
                try {
                    const userObj = JSON.parse(userOutput);
                    const expObj = JSON.parse(expectedOutput);
                    if (JSON.stringify(userObj) !== JSON.stringify(expObj)) {
                        finalStatus = "Wrong Answer";
                    }
                } catch {
                    const normalizeArr = (s: string) => {
                        const nums = s.replace(/[^0-9-]/g, " ").trim().split(/\s+/).filter(Boolean);
                        return nums.join(",");
                    };
                    if (normalizeArr(userOutput) !== normalizeArr(expectedOutput)) {
                        finalStatus = "Wrong Answer";
                    }
                }
            }
        }

        const result: TestCaseExecutionResult = {
            testCaseId: testCase._id ? testCase._id.toString() : String(testCase.executionOrder),
            isHidden: testCase.isHidden,
            status: finalStatus,
            runtime,
            memory,
            error_message: errorMessage,
        };

        if (!testCase.isHidden) {
            result.input = testCase.input;
            result.expected_output = testCase.expectedOutput;
            result.user_output = userOutput;
        }

        return result;
    } catch (e: any) {
        const msg = e?.response?.data?.message || e?.message || String(e);
        logger.error(`[Judge0 Error] Service execution failed: ${msg}`, { problemId: problem._id, testCaseId: testCase._id });

        return {
            testCaseId: testCase._id ? testCase._id.toString() : String(testCase.executionOrder),
            isHidden: testCase.isHidden,
            status: "Runtime Error",
            runtime: 0,
            memory: 0,
            error_message: `Judge0 execution service unavailable: ${msg}`,
        };
    }
}

/**
 * Run a set of test cases concurrently.
 */
export async function executeTestCases(
    problem: IProblem,
    testCases: ITestCase[],
    userCode: string,
    language: string
): Promise<JudgeReport> {
    const langId = JUDGE0_LANG_IDS[language.toLowerCase()];
    if (!langId) {
        return {
            status: "Compilation Error",
            runtime: 0,
            memory: 0,
            results: testCases.map(tc => ({
                testCaseId: tc._id ? tc._id.toString() : String(tc.executionOrder),
                isHidden: tc.isHidden,
                status: "Compilation Error",
                runtime: 0,
                memory: 0,
                error_message: `Unsupported language: ${language}`,
            })),
        };
    }

    const sourceCode = userCode;

    // Concurrency-limited execution: cap at 10 simultaneous Judge0 calls.
    // Promise.all() on 50+ test cases overwhelms the Cloudflare tunnel and causes timeouts.
    // This rolling pool keeps throughput high while preventing connection saturation.
    const MAX_CONCURRENT = Math.min(10, testCases.length);
    const results: TestCaseExecutionResult[] = new Array(testCases.length);
    let nextIndex = 0;

    async function runNext(): Promise<void> {
        while (nextIndex < testCases.length) {
            const idx = nextIndex++;
            const tc = testCases[idx];
            results[idx] = await executeSingleTestCase(
                userCode, sourceCode, langId, tc,
                problem.timeLimit, problem.memoryLimit, problem, language
            );
        }
    }

    // Launch MAX_CONCURRENT workers that each consume from the queue
    await Promise.all(Array.from({ length: MAX_CONCURRENT }, runNext));


    const statusPriority: TestCaseExecutionResult["status"][] = [
        "Compilation Error",
        "Runtime Error",
        "Time Limit Exceeded",
        "Memory Limit Exceeded",
        "Output Limit Exceeded",
        "Wrong Answer",
        "Accepted"
    ];

    let overallStatus: TestCaseExecutionResult["status"] = "Accepted";
    for (const priorityStatus of statusPriority) {
        if (results.some(r => r.status === priorityStatus)) {
            overallStatus = priorityStatus;
            break;
        }
    }

    const maxRuntime = results.reduce((max, r) => Math.max(max, r.runtime), 0);
    const maxMemory = results.reduce((max, r) => Math.max(max, r.memory), 0);

    return {
        status: overallStatus,
        runtime: maxRuntime,
        memory: maxMemory,
        results,
    };
}

/**
 * Execute official solution code on Judge0 for automatic output generation.
 */
export async function runOfficialSolutionOnInput(
    sourceCode: string,
    language: string,
    input: string,
    timeLimit = 2000,
    memoryLimit = 256
): Promise<{ success: boolean; output: string; error?: string; runtime?: number }> {
    const langId = JUDGE0_LANG_IDS[language.toLowerCase()];
    if (!langId) {
        return { success: false, output: "", error: `Unsupported language: ${language}` };
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const cpuLimit = Math.max(0.5, Math.min(10, timeLimit / 1000));
    const wallTimeLimit = Math.min(15, cpuLimit * 2);
    const memLimit = Math.max(16384, Math.min(524288, memoryLimit * 1024));

    try {
        const response = await postJudge0WithRetry(
            `${JUDGE0_URL}/submissions?base64_encoded=true&wait=true`,
            {
                source_code: encodeB64(sourceCode),
                language_id: langId,
                stdin: encodeB64(input),
                cpu_time_limit: cpuLimit,
                wall_time_limit: wallTimeLimit,
                memory_limit: memLimit,
                max_processes_and_or_lightweight_tasks: 30,
                enable_network: false,
            },
            headers
        );

        const data = response.data;
        if (!data || typeof data !== "object") {
            return { success: false, output: "", error: "Invalid response from Judge0" };
        }

        const decodedStdout = decodeB64(data.stdout);
        const decodedStderr = decodeB64(data.stderr);
        const decodedCompileOutput = decodeB64(data.compile_output);

        const statusId = data.status?.id || 3;
        const stdout = decodedStdout ? decodedStdout.trim() : "";
        const stderr = decodedCompileOutput || decodedStderr || undefined;
        const runtime = Math.round((data.time ? parseFloat(data.time) : 0) * 1000);

        if (statusId === 3) {
            return { success: true, output: stdout, runtime };
        } else {
            return {
                success: false,
                output: stdout,
                error: stderr || `Execution status ${data.status?.description || statusId}`,
            };
        }
    } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || String(err);
        console.warn(`[Judge0 Fallback] Official solution execution on Judge0 failed (${msg}). Returning failure for output generation.`);

        // Return failure so the admin UI marks the case as "failed" and shows a Retry button.
        // Do NOT silently return a fake "0" — that would pollute hidden test case expected outputs.
        return { success: false, output: "", error: `Judge0 unreachable: ${msg}` };
    }
}

/**
 * Execute direct submission on local Judge0 CE without problem context.
 */
export async function executeDirectSubmission(
    source_code: string,
    language_id: number,
    stdin: string = ""
) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const response = await postJudge0WithRetry(
        `${JUDGE0_URL}/submissions?base64_encoded=true&wait=true`,
        {
            source_code: encodeB64(source_code),
            language_id,
            stdin: encodeB64(stdin),
            cpu_time_limit: 5,
            wall_time_limit: 10,
            max_processes_and_or_lightweight_tasks: 30,
            enable_network: false,
        },
        headers
    );

    const data = response.data;
    return {
        stdout: decodeB64(data.stdout),
        stderr: decodeB64(data.stderr),
        compile_output: decodeB64(data.compile_output),
        status: data.status,
        time: data.time,
        memory: data.memory,
        token: data.token,
    };
}


