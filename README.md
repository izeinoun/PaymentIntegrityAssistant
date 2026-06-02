# OPA Assistant — standalone app

Full-page, read-only chat over the OPA payment-integrity platform. It talks to
the unified backend's `/api/assistant/chat/stream` (the same server-side Claude
tool-use agent that powers the in-app PayGuard panel), so it needs **no backend
of its own** — just this frontend, deployed at its own URL.

- Stack: Vite + React + TS + Tailwind (mirrors the SIU/ClaimGuard/IAM apps).
- Dev port: **5179**. Prod: **assistant.penguinai.studio**.
- Auth: shared-login demo gate (`DemoGate`) + an actor picker that sets
  `X-User-Id`. RBAC on the backend scopes answers to the selected user's apps.

## Config — no env vars

URLs live in [`frontend/src/config/appUrls.ts`](frontend/src/config/appUrls.ts),
committed, switched by Vite build mode (`import.meta.env.PROD`). `npm run dev` →
localhost, `npm run build` → `*.penguinai.studio`. There are **no** `VITE_*`
variables to set in any dashboard. To change a URL, edit that file and redeploy.

## Develop

```bash
cd frontend
npm install
npm run dev        # http://localhost:5179  (expects the backend on :8001)
```

## Build / deploy (Railway)

```bash
cd frontend
npm run build      # tsc + vite build → dist/
npm run start      # serve -s dist
```

Railway: new service from this repo, root `frontend/`, build `npm run build`,
start `npm run start` (see [`frontend/railway.json`](frontend/railway.json)).
Add a domain `assistant.penguinai.studio`. The backend already allows this
origin (CORS `_PROD_CORS_ORIGINS`).
