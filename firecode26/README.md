# FireCode — Online Coding Platform

A premium online judge and developer platform featuring curated algorithm problems, live rated contests, real-time code execution, and telemetry.

## Features

- **Curated Problem Library**: Filterable algorithm problems by difficulty, topic, and status.
- **Interactive Code Workspace**: Multilingual code editor with instant test case runner.
- **Live Contests**: Rated competition rounds, time penalty calculations, and real-time leaderboards.
- **User Dashboard & Analytics**: Streak tracking, reward points, and submission metrics.
- **Admin Control Panel**: Problem CRUD management, contest freeze, user role administration, and audit logs.

## Development Setup

Requirements: Node.js (v20+) and npm.

```sh
# Install dependencies
npm install

# Start local dev server
npm run dev

# Type check
npx tsc --noEmit

# Production build
npm run build
```

## Tech Stack

- **Frontend**: TanStack Start, React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Radix UI.
- **Backend API**: Node.js, Express, TypeScript, MongoDB (Mongoose), Redis distributed rate limiting, BullMQ submission queue, Judge0 sandbox.
