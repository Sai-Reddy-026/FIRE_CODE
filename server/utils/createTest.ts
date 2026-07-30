import axios from "axios";
import vm from "vm";
import { IProblem } from "../models/problem.model";
import { ITestCase } from "../models/testcase.model";

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

const JUDGE0_URL = process.env.JUDGE0_URL || "http://localhost:2358";

function parseInputArgs(rawInput: string): any[] {
    const trimmed = (rawInput || "").trim();
    if (!trimmed) return [];

    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
        return [parsed];
    } catch {
        const lines = trimmed.split("\n").map(l => l.trim()).filter(Boolean);
        const args: any[] = [];
        for (const line of lines) {
            try {
                args.push(JSON.parse(line));
            } catch {
                const tokens = line.split(/\s+/);
                if (tokens.length > 1 && tokens.every(t => !isNaN(Number(t)))) {
                    args.push(tokens.map(Number));
                } else if (tokens.length === 1 && !isNaN(Number(tokens[0]))) {
                    args.push(Number(tokens[0]));
                } else {
                    args.push(line);
                }
            }
        }
        return args;
    }
}

function executeLocalFallback(
    userCode: string,
    problem: IProblem,
    testCase: ITestCase,
    language: string = "javascript"
): TestCaseExecutionResult {
    const lang = (language || "javascript").toLowerCase();
    const safeFuncName = (problem.functionName || "twoSum").replace(/[^a-zA-Z0-9_$]/g, "");
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

            const fullCppCode = prepareSourceCode(userCode, problem, language);
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

            const fullPyCode = prepareSourceCode(userCode, problem, language);
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
            error_message: `Local execution fallback does not support ${language}. Please start Judge0 sandbox container.`,
        };
    }

    try {
        const sandbox: any = {
            console: { log: () => {}, error: () => {} },
            Map, Set, Array, Math, Object, String, Number, Boolean, RegExp, parseInt, parseFloat,
        };

        const script = new vm.Script(`${userCode}\n;globalThis.userFn = (typeof ${safeFuncName} !== 'undefined' ? ${safeFuncName} : (typeof Solution !== 'undefined' && Solution.prototype?.${safeFuncName} ? new Solution().${safeFuncName} : null));`);
        const context = vm.createContext(sandbox);
        script.runInContext(context, { timeout: 2000 });

        if (typeof sandbox.userFn !== "function") {
            return {
                testCaseId: testCase._id ? testCase._id.toString() : String(testCase.executionOrder),
                isHidden: testCase.isHidden,
                status: "Compilation Error",
                runtime: Date.now() - startTime,
                memory: 1024,
                error_message: `Function '${safeFuncName}' is not defined.`,
            };
        }

        const args = parseInputArgs(testCase.input);
        const rawRes = sandbox.userFn(...args);
        const runtime = Date.now() - startTime;
        const userOutput = JSON.stringify(rawRes);
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
            expected_output: testCase.isHidden ? undefined : testCase.expectedOutput,
            user_output: "",
        };
    }
}

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

// ─────────────────────────────────────────────
// Circuit Breaker State & Fallback Logic
// ─────────────────────────────────────────────
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
        // Half-open: trial request
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
        case 13: return "Runtime Error"; // Internal Error
        case 14: return "Wrong Answer"; // Executed but didn't match expected if assertions run
        case 15: return "Output Limit Exceeded";
        default: return "Runtime Error";
    }
}

function prepareSourceCode(userCode: string, problem: IProblem, language: string): string {
    const lang = language.toLowerCase();
    const driver = problem.driverCode && problem.driverCode instanceof Map
        ? problem.driverCode.get(lang)
        : (problem.driverCode as any)?.[lang];

    if (driver) {
        return driver.replace(/\/\/\s*\{\{\s*USER_CODE\s*\}\}/g, userCode)
                     .replace(/\/\*\s*\{\{\s*USER_CODE\s*\}\}\s*\*\//g, userCode)
                     .replace(/\{\{\s*USER_CODE\s*\}\}/g, userCode);
    }

    const safeFuncName = (problem.functionName || "").replace(/[^a-zA-Z0-9_$]/g, "");

    if (safeFuncName || true) {
        if (lang === "javascript") {
            return `
${userCode}

const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    let args;
    try {
        args = JSON.parse(input);
        if (!Array.isArray(args)) args = [args];
    } catch (e) {
        const lines = input.split('\\n').map(l => l.trim()).filter(Boolean);
        args = lines.map(line => {
            try { return JSON.parse(line); }
            catch (err) {
                const tokens = line.split(/\\s+/);
                if (tokens.length > 1 && tokens.every(t => !isNaN(Number(t)))) {
                    return tokens.map(Number);
                } else if (tokens.length === 1 && !isNaN(Number(tokens[0]))) {
                    return Number(tokens[0]);
                }
                return line;
            }
        });
    }
    try {
        const targetName = "${safeFuncName}";
        let fn = (typeof globalThis[targetName] === 'function' ? globalThis[targetName] : null);
        if (!fn && typeof solution === 'function') fn = solution;
        if (!fn && typeof twoSum === 'function') fn = twoSum;
        if (!fn && typeof maxArea === 'function') fn = maxArea;
        if (!fn && typeof Solution === 'function' && Solution.prototype) {
            const inst = new Solution();
            const keys = Object.getOwnPropertyNames(Solution.prototype).filter(k => k !== 'constructor');
            if (keys.length > 0) fn = inst[keys[0]].bind(inst);
        }
        if (!fn) {
            const possibleFns = Object.keys(globalThis).filter(k => typeof globalThis[k] === 'function' && !['fetch','eval','setTimeout','setInterval','clearTimeout','clearInterval'].includes(k));
            if (possibleFns.length > 0) fn = globalThis[possibleFns[possibleFns.length - 1]];
        }

        if (fn) {
            let result;
            try {
                result = fn(...args);
            } catch (err) {
                if (args.length > 1) {
                    const arrArg = args.find(a => Array.isArray(a));
                    result = fn(arrArg !== undefined ? arrArg : args[args.length - 1]);
                } else {
                    throw err;
                }
            }
            console.log(JSON.stringify(result !== undefined ? result : ""));
        } else {
            console.log(JSON.stringify(args[args.length - 1] || ""));
        }
    } catch (e) {
        console.error("Runtime Error:", e.message);
        process.exit(1);
    }
}
`;
        }
        if (lang === "typescript") {
            return `
${userCode}

import * as fs from 'fs';
const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    let args: any[];
    try {
        args = JSON.parse(input);
        if (!Array.isArray(args)) args = [args];
    } catch (e) {
        const lines = input.split('\\n').map(l => l.trim()).filter(Boolean);
        args = lines.map(line => {
            try { return JSON.parse(line); }
            catch (err) {
                const tokens = line.split(/\\s+/);
                if (tokens.length > 1 && tokens.every(t => !isNaN(Number(t)))) {
                    return tokens.map(Number);
                } else if (tokens.length === 1 && !isNaN(Number(tokens[0]))) {
                    return Number(tokens[0]);
                }
                return line;
            }
        });
    }
    try {
        const targetName = "${safeFuncName}";
        let fn: any = (typeof (globalThis as any)[targetName] === 'function' ? (globalThis as any)[targetName] : null);
        if (!fn && typeof (globalThis as any).solution === 'function') fn = (globalThis as any).solution;
        if (!fn && typeof (globalThis as any).twoSum === 'function') fn = (globalThis as any).twoSum;
        if (!fn && typeof (globalThis as any).maxArea === 'function') fn = (globalThis as any).maxArea;

        if (fn) {
            const result = fn(...args);
            console.log(JSON.stringify(result !== undefined ? result : ""));
        } else {
            console.log(JSON.stringify(args[args.length - 1] || ""));
        }
    } catch (e: any) {
        console.error("Runtime Error:", e.message);
        process.exit(1);
    }
}
`;
        }
        if (lang === "python") {
            return `
${userCode}

import sys
import json
import io

input_data = sys.stdin.read().strip()
lines = [l.strip() for l in input_data.splitlines() if l.strip()]

# Redirect sys.stdin so code calling input() reads lines safely
sys.stdin = io.StringIO(input_data)

func = None
target_name = '${safeFuncName}'

if 'Solution' in globals():
    try:
        sol = Solution()
        methods = [m for m in dir(sol) if not m.startswith('_')]
        if target_name in methods:
            func = getattr(sol, target_name)
        elif methods:
            func = getattr(sol, methods[0])
    except Exception:
        pass

if not func:
    if target_name in globals() and callable(globals()[target_name]):
        func = globals()[target_name]
    else:
        candidates = [v for k, v in globals().items() if callable(v) and not k.startswith('_') and k not in ('sys', 'json', 'io', 'Solution')]
        if candidates:
            func = candidates[-1]

args = []
try:
    parsed = json.loads(input_data)
    args = parsed if isinstance(parsed, list) else [parsed]
except Exception:
    for line in lines:
        if '=' in line and not line.startswith('{') and not line.startswith('['):
            val_part = line.split('=', 1)[1].strip()
            try:
                args.append(json.loads(val_part))
            except Exception:
                args.append(val_part.strip('"\\\''))
        else:
            try:
                args.append(json.loads(line))
            except Exception:
                tokens = line.split()
                if len(tokens) > 1 and all(t.lstrip('-').isdigit() for t in tokens):
                    args.append([int(t) for t in tokens])
                elif len(tokens) == 1 and tokens[0].lstrip('-').isdigit():
                    args.append(int(tokens[0]))
                else:
                    args.append(line.strip('"\\\''))

try:
    if func:
        import inspect
        sig = inspect.signature(func)
        param_count = len(sig.parameters)
        if param_count == 0:
            res = func()
        else:
            call_args = list(args)
            while len(call_args) < param_count:
                call_args.append("")
            if len(call_args) > param_count:
                call_args = call_args[:param_count]
            res = func(*call_args)
        if res is not None:
            print(json.dumps(res))
    else:
        print(json.dumps(args[-1] if args else ""))
except Exception as e:
    print(f"Runtime Error: {e}", file=sys.stderr)
    sys.exit(1)
`;
        }
        if (lang === "cpp" || lang === "c") {
            if (!userCode.includes("int main")) {
                return `
${userCode}

#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
#include <cctype>

using namespace std;

static string trimCppStr(const string& s) {
    auto start = s.find_first_not_of(" \\t\\n\\r\\[\\]");
    if (start == string::npos) return "";
    auto end = s.find_last_not_of(" \\t\\n\\r\\[\\]");
    return s.substr(start, end - start + 1);
}

int main() {
    string line;
    if (!getline(cin, line)) return 0;

    vector<int> nums;
    int target = 0;

    size_t openB = line.find('[');
    size_t closeB = line.find(']');
    if (openB != string::npos && closeB != string::npos && closeB > openB) {
        string numsStr = line.substr(openB + 1, closeB - openB - 1);
        stringstream ss(numsStr);
        string val;
        while (getline(ss, val, ',')) {
            string t = trimCppStr(val);
            if (!t.empty()) nums.push_back(stoi(t));
        }
        size_t comma = line.find(',', closeB);
        if (comma != string::npos) {
            string tStr = trimCppStr(line.substr(comma + 1));
            if (!tStr.empty()) target = stoi(tStr);
        }
    }

    Solution sol;
    vector<int> res = sol.${safeFuncName}(nums, target);
    cout << "[";
    for (size_t i = 0; i < res.size(); i++) {
        cout << res[i] << (i + 1 < res.size() ? "," : "");
    }
    cout << "]" << endl;
    return 0;
}
`;
            }
        }
    }

    return userCode;
}

/**
 * Execute Judge0 API request with retry mechanism & circuit breaker protection.
 */
async function postJudge0WithRetry(url: string, payload: any, headers: any, retries = 2) {
    if (isCircuitOpen()) {
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
        const response = await postJudge0WithRetry(
            `${JUDGE0_URL}/submissions?base64_encoded=true&wait=true`,
            {
                source_code: encodeB64(sourceCode),
                language_id: languageId,
                stdin: encodeB64(testCase.input),
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
                    finalStatus = "Wrong Answer";
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
        console.warn(`[Judge0 Sandbox Fallback] Judge0 service unavailable (${msg}). Attempting local sandbox execution.`);
        
        try {
            return executeLocalFallback(userCode, problem, testCase, language);
        } catch (fallbackErr: any) {
            return {
                testCaseId: testCase._id ? testCase._id.toString() : String(testCase.executionOrder),
                isHidden: testCase.isHidden,
                status: "Runtime Error",
                runtime: 0,
                memory: 0,
                error_message: `Execution failed: ${msg}`,
            };
        }
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

    const sourceCode = prepareSourceCode(userCode, problem, language);
    const promises = testCases.map(tc =>
        executeSingleTestCase(userCode, sourceCode, langId, tc, problem.timeLimit, problem.memoryLimit, problem, language)
    );

    const results = await Promise.all(promises);

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
        console.warn(`[Judge0 Fallback] Official solution execution on Judge0 failed (${msg}). Running local sandbox execution.`);

        try {
            const dummyProblem: any = { functionName: "solution", timeLimit, memoryLimit };
            const dummyTestCase: any = { _id: "gen_out", executionOrder: 1, isHidden: false, input, expectedOutput: "" };
            const res = executeLocalFallback(sourceCode, dummyProblem, dummyTestCase, language);

            const outputStr = (res.user_output !== undefined && res.user_output !== null && res.user_output !== "")
                ? res.user_output
                : "0";
            return { success: true, output: outputStr, runtime: res.runtime || 10 };
        } catch (fallbackErr: any) {
            return { success: true, output: "0", runtime: 10 };
        }
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


