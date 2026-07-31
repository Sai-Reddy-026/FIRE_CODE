# FIRECODE — Platform Architecture & Technical Documentation

FIRECODE is a production-grade **Online Judge & Competitive Programming Platform** built on a modern full-stack architecture (React, Express, MongoDB, Redis, Judge0). The platform operates on a **Pure CodeChef / Codeforces execution model**, where every program submitted by a user is a complete, standalone executable reading from standard input (`stdin`) and writing to standard output (`stdout`).

---

## 1. System Architecture Overview

```mermaid
graph TD
    subgraph Frontend (firecode26)
        A[React App / Monaco Editor] -->|HTTPS REST API| B[TanStack Router & Query]
    end

    subgraph Backend API Server (server)
        B --> C[Express API Gateway]
        C --> D[JWT & Security Middleware]
        D --> E[ProblemController / Service]
        D --> F[AdminController / Service]
        D --> G[ContestController / Service]
        E --> H[Mongoose ODM]
        E --> I[Redis Cache]
        E --> J[Code Execution Engine]
    end

    subgraph Execution & Storage Layer
        H --> K[(MongoDB Database)]
        I --> L[(Redis In-Memory Cache)]
        J -->|Base64 REST API| M[Judge0 Sandbox CE Container]
        J -.->|Fallback Execution| N[Local Child Process Runner]
    end
```

---

## 2. Platform Core Architecture

### 2.1 Pure CodeChef Execution Engine
Unlike platforms that wrap user code inside function harnesses (e.g., `class Solution`), FIRECODE uses a **direct pass-through pipeline**:
1. **Monaco Editor**: Populates starter code containing complete executable main functions (e.g., `int main()` for C++, `sys.stdin` for Python, `public class Main` for Java).
2. **Untouched Payload Pass-Through**: User source code is Base64 encoded and sent **100% untouched** to the Judge0 sandbox REST API (`POST /submissions?base64_encoded=true&wait=true`).
3. **Verdict Comparison**: Judge0 executes the binary against Base64 encoded test case `stdin` and captures standard output (`stdout`), standard error (`stderr`), execution time, and peak memory usage.

### 2.2 Concurrency & Circuit Breaker Protection
- **Concurrency Pool**: Outbound Judge0 connections are capped at 10 simultaneous workers to prevent Cloudflare tunnel / HTTP socket saturation.
- **Circuit Breaker**: Detects Judge0 cluster unavailability after 5 consecutive failures and automatically fails over to isolated local sandbox runner scripts (`g++`, `python`, `node`).

---

## 3. Technology Stack

| Layer | Technology | Key Libraries / Utilities |
| :--- | :--- | :--- |
| **Frontend UI** | React 18, Vite | `@tanstack/react-router`, `@tanstack/react-query`, `@monaco-editor/react`, `lucide-react`, Tailwind CSS |
| **Backend Server** | Node.js, Express | TypeScript, `axios`, `express-rate-limit`, `helmet`, `dompurify` |
| **Database & ODM** | MongoDB | Mongoose 8.x |
| **Caching Layer** | Redis | `ioredis` |
| **Execution Engine** | Judge0 CE | Docker Sandbox Container (Port 2358) |

---

## 4. Frontend Route Architecture (`firecode26/src/routes/`)

| Route Path | Component Description | Primary Functionality |
| :--- | :--- | :--- |
| `/` | `IndexPage` | Hero section, featured problem catalog, telemetry stats, problem filtering. |
| `/problems/$id` | `ProblemView` | Main solving interface. Split view with problem description on left and Monaco Editor on right. Custom input runner, submit execution panel, hidden test result status, hints, editorial tab. |
| `/contests` | `ContestsPage` | Upcoming, active, and past contest listings. |
| `/contests/$slug` | `ContestWorkspace` | Real-time contest problem set, contest leaderboard, countdown timer, submission history. |
| `/admin/problems` | `AdminProblemsPage` | Admin problem catalog dashboard, publication workflow, points adjustment, telemetry analytics. |
| `/admin/add-problem` | `AddProblemPage` | New problem authoring form, Markdown description editor, hidden testcase generator, starter code config. |
| `/login` / `/register` | Auth Pages | JWT authentication, user registration, role assignment (`admin` / `user`). |
| `/profile` | `ProfilePage` | User profile statistics, solved problems list, submission graph. |

---

## 5. Backend REST API Endpoints (`server/routes/`)

### 5.1 Problem & Execution Endpoints (`/api/problem`)

```http
GET /api/problem
```
- **Description**: Returns all published problems with Redis caching (`problems:global`).
- **Response**: Array of problem summaries (Id, title, slug, difficulty, acceptance rate, tags).

```http
GET /api/problem/:id
```
- **Description**: Returns detailed problem data transformed via DTO for frontend consumption.
- **Response**: Description HTML, examples, starter code map per language.

```http
POST /api/problem/run/:id
```
- **Request Body**: `{ code: string, language: string, customInput: string }`
- **Description**: Executes user code directly against custom input on Judge0 without problem test cases.
- **Response**: `{ success: boolean, output: string, runtime: number, error?: string }`

```http
POST /api/problem/submit/:id
```
- **Request Body**: `{ code: string, language: string }`
- **Description**: Loads hidden test cases from MongoDB, runs user code against each test case, compares stdout, and records submission.
- **Response**: `{ status: "Accepted" | "Wrong Answer" | ..., runtime: number, memory: number, results: [...] }`

---

### 5.2 Admin Endpoints (`/api/admin`)

```http
POST /api/admin/problems
```
- **Description**: Creates a new problem document and associated test cases. Requires `admin` role.

```http
PUT /api/admin/problems/:id
```
- **Description**: Updates problem statement, constraints, examples, hidden test cases, or publication status.

```http
DELETE /api/admin/problems/:id
```
- **Description**: Soft deletes a problem document (`isDeleted: true`).

---

## 6. Database Schema Design (`server/models/`)

### 6.1 `ProblemNew` Model ([problem.model.ts](file:///c:/Users/saidu/OneDrive/Desktop/THE_LAST/server/models/problem.model.ts))
```typescript
{
  problemId: { type: Number, required: true, unique: true },
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  difficulty: { type: String, enum: ["easy", "medium", "hard"] },
  category: { type: String },
  tags: [String],
  description: { type: String, required: true },
  inputFormat: String,
  outputFormat: String,
  constraints: String,
  examples: [{ input: String, output: String, explanation: String }],
  starterCode: [{ language: String, code: String }],
  timeLimit: { type: Number, default: 2000 },
  memoryLimit: { type: Number, default: 256 },
  points: { type: Number, default: 0 },
  acceptanceRate: { type: Number, default: 0 },
  status: { type: String, enum: ["draft", "pending_review", "published", "archived"] }
}
```

### 6.2 `TestCase` Model ([testcase.model.ts](file:///c:/Users/saidu/OneDrive/Desktop/THE_LAST/server/models/testcase.model.ts))
```typescript
{
  problemId: { type: Schema.Types.ObjectId, ref: "ProblemNew", required: true },
  input: { type: String, required: true },
  expectedOutput: { type: String, required: true },
  explanation: String,
  executionOrder: { type: Number, default: 0 },
  isHidden: { type: Boolean, default: false }
}
```

---

## 7. Supported Programming Languages

FIRECODE supports **10 competitive programming languages**. Default executable starter templates:

| Language | Language ID | Starter Template Pattern |
| :--- | :---: | :--- |
| **C++** | `54` | `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    return 0;\n}` |
| **C** | `50` | `#include <stdio.h>\n\nint main() {\n    return 0;\n}` |
| **Java** | `62` | `import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n    }\n}` |
| **Python** | `71` | `import sys\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()` |
| **JavaScript** | `63` | `const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8');` |
| **TypeScript** | `74` | `import * as fs from 'fs';\nconst input = fs.readFileSync(0, 'utf-8');` |
| **Go** | `60` | `package main\nimport "fmt"\n\nfunc main() {\n}` |
| **Rust** | `73` | `use std::io::{self, Read};\n\nfn main() {\n}` |
| **C#** | `51` | `using System;\n\nclass Program {\n    static void Main() {\n    }\n}` |
| **Kotlin** | `78` | `import java.util.Scanner\n\nfun main() {\n}` |

---

## 8. Security & Data Protection Features

1. **Hidden Testcase Shield**: Inputs, expected outputs, and execution details of test cases marked `isHidden: true` are filtered out during DTO transformation and **never exposed to the browser API payload**.
2. **HTML & XSS Sanitization**: Problem descriptions and user inputs pass through `DOMPurify` sanitization in [security.ts](file:///c:/Users/saidu/OneDrive/Desktop/THE_LAST/server/middlewares/security.ts) to prevent script injection.
3. **Execution Sandbox**: Judge0 executes user code in isolated Linux Docker containers with disabled network access, 5-second CPU time limits, and memory process caps.

---

## 9. Local Development Setup Guide

### Prerequisites
- Node.js (v18+)
- MongoDB (running locally on `mongodb://localhost:27017/firecode` or MongoDB Atlas)
- Redis (optional, fallback to in-memory cache)
- Judge0 CE Container (running on `http://127.0.0.1:2358`)

### Step-by-Step Instructions

1. **Clone & Install Dependencies**:
   ```bash
   # Install Server dependencies
   cd server
   npm install

   # Install Frontend dependencies
   cd ../firecode26
   npm install
   ```

2. **Configure Environment Variables**:
   Create `.env` inside `server/`:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/firecode
   REDIS_URL=redis://localhost:6379
   JUDGE0_URL=http://127.0.0.1:2358
   JWT_SECRET=your_super_secret_jwt_key
   ```

3. **Start Backend Server**:
   ```bash
   cd server
   npm run dev
   ```

4. **Start Frontend Dev Server**:
   ```bash
   cd firecode26
   npm run dev
   ```
