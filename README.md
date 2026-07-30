# 🚀 FireCode Platform

FireCode is a high-performance, LeetCode-style online judge and coding platform built with **React (Vite)**, **Express.js**, **MongoDB**, and a self-hosted **Judge0 Community Edition** execution engine.

---

## 🏗️ Project Architecture

```text
FIRE_CODE/
├── firecode26/                     # React + Vite Frontend (Monaco Editor UI)
├── server/                         # Express.js REST API Backend & MongoDB Models
├── judge0/                         # Self-hosted Judge0 CE Docker configuration
├── ORACLE_CLOUD_JUDGE0_DEPLOYMENT.md# Guide for Oracle Cloud Free Tier Judge0 deployment
├── README.md                       # Project documentation
└── .gitignore                      # Root Git ignores
```

---

## ⚡ Quick Start Guide

### 1. Start Local Judge0 CE (Docker)
Ensure Docker Desktop is running on your machine:

```powershell
cd judge0
docker compose up -d
```
Verify Judge0 health:
```powershell
curl http://localhost:2358/about
```

### 2. Start Express Backend
```powershell
cd server
npm install
npm run dev
```
Backend will start at `http://localhost:80`.

### 3. Start React Frontend
```powershell
cd firecode26
npm install
npm run dev
```
Frontend will start at `http://localhost:8080`.

---

## 🌐 Production Deployment Guide

- **Frontend (Vercel)**:
  - Framework Preset: Vite / TanStack Start
  - Root Directory: `firecode26`
  - Environment Variable: `VITE_API_BASE_URL=https://your-backend-domain.com/api`

- **Backend (Render / Railway / VPS)**:
  - Root Directory: `server`
  - Start Command: `npm run start`
  - Environment Variables:
    - `MONGODB_URI=your_mongodb_connection_string`
    - `JUDGE0_URL=http://<YOUR_JUDGE0_IP>:2358`