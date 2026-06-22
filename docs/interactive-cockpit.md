# OPA Assistant — Interactive Cockpit (design)

Status: **accepted, building**. Owner: assistant app. Backend changes land in the
unified OPA server (`overcoding/opa/server`); frontend changes land here.

## 1. Goal

Turn the assistant from a "chat that answers" into a **cockpit that acts**. On
login the user sees anticipatory action buttons tied to their real workload ("My
cases", "Pending my review", "Top priority"…). Requests that map to a known app
view render that view **inline** (with live data and real actions); open-ended
requests keep today's formatted prose answer.

## 2. Locked decisions

| Decision | Choice |
| --- | --- |
| Surface | Extend the existing standalone `/assistant` app (separate deploy, unified backend). |
| Render model | **Hybrid** — assistant-native views from the unified API by default; iframe escape hatch (later) for full-fidelity pages. |
| v1 app scope | PayGuard (post-pay). Directive schema carries `view`/`params` so ClaimGuard/SIU plug in later. |
| Actions | Full parity, but the **LLM never mutates** — it only *presents*; the human clicks the real control. v1 writes = deep-link to PayGuard. |
| Free-text | Agent classifies and may emit a render **directive** (`present_view`) or answer in prose. |
| Launchpad | Dynamic, role-aware, live counts (analyst + supervisor; admin = supervisor + IAM icon). |
| Case cockpit | Deterministic suggested actions from `_suggest_decision` + a short AI narrative (gated, graceful). Soft-keys: open full case + tab jumps. |
| Code sharing | Native views need data only. A shared `@penguin/ui` package (to reuse PayGuard's real action components) is a **follow-on track**, not a v1 blocker. |

## 3. The dual-mode render model

Every assistant turn resolves to one of two render types:

- **Surface mode** — the request maps to a known view. The agent calls the new
  `present_view(view, params, caption)` tool; the backend emits a
  `{"type":"directive", view, params, caption}` SSE event; the frontend mounts
  the mapped assistant-native view. Launchpad buttons fire the *same* directive
  **client-side** (no agent round-trip → instant, free).
- **Prose mode** — open-ended/analytical requests get today's Markdown/HTML
  answer, unchanged.

`present_view` mirrors the existing `ask_user` tool exactly (special, no
endpoint; special-cased in the agent loop), so streaming and prose survive.

### Views (v1)

| `view` | `params` | Data source |
| --- | --- | --- |
| `worklist` | `{scope: 'mine'\|'unassigned'\|'all', status?, priority?, overdue?}` | `GET /api/cases` (+ `/api/cases/status-counts` for badges) |
| `case` | `{case_id}` | `GET /api/cases/{id}` |
| `my_dashboard` | `{period?}` | `GET /api/dashboard/me` |

`scope` maps to the case API exactly as PayGuard's worklist does:
`mine → assignee_id=<actor>`, `unassigned → assignee_id=__unassigned__`,
`all → no assignee filter`.

## 4. Backend changes (unified OPA server)

`services/assistant/tools.py` — add `PRESENT_VIEW` tool (special, `method=""`),
registered in `TOOLS_BY_NAME` and appended by `tools_for_apps`.

`services/assistant/agent.py` — in the tool loop, after the `ask_user` check,
special-case `present_view`: emit a `directive` event, append a **synthetic
`tool_result`** for the call (so the message history stays valid for the next
turn — a dangling `tool_use` would otherwise break the next API call), then emit
`final` and stop.

`services/assistant/prompt.py` — instruct the model: navigational/"show me"
intents → `present_view`; analytical/explanatory intents → prose.

The non-streaming `/api/assistant/chat` route only returns terminal events, so
`directive` is a no-op there; the frontend uses `/chat/stream`.

## 5. Frontend (this app)

- `AssistantChat.tsx` — handle the `directive` event → `setActiveView`. Add a
  client-side `dispatchView(view, params, caption)` used by the launchpad and by
  in-view navigation (open a case). Layout: **Launchpad** (top) → **active view
  surface** → chat conversation → persistent prompt.
- `components/Launchpad.tsx` — role-aware buttons with live counts (counts via
  `GET /api/cases` `page_size=1` per button).
- `components/ViewSurface.tsx` — dispatches `view` → the right component.
- `components/views/WorklistMini.tsx` — compact case table; each row opens the
  case cockpit; "Open in PayGuard ↗" deep-links out.
- `components/views/CaseCockpit.tsx` — the **simplified** case view: plain
  summary, suggested actions (from `suggested_decision`), findings, and soft-keys
  (Open full case ↗, jump to a detail tab).
- `components/views/MyDashboardView.tsx` — stat tiles from `dashboard/me`.

Identity/auth reuse the existing `client.ts` (X-User-Id + demo-gate token).

## 6. Writes (full parity, LLM out of the mutation path)

v1: the cockpit's suggested actions and soft-keys **deep-link** to PayGuard's
real pages/modals (new tab), which own all validation, confirmation, and audit.
Later phases add an iframe escape-hatch (chromeless `?embed=1` + `postMessage`
token handoff) and, longer term, the shared `@penguin/ui` package so the real
action components render inline.

## 7. Phases

- **P0** — `present_view` channel end-to-end + launchpad scaffold.
- **P1** — native read views (worklist, case cockpit, my dashboard); free-text → directive.
- **P2** — writes via deep-link (incl. PayGuard `?tab=` deep-linking).
- **P3** — iframe escape hatch for full-fidelity pages.
- **Follow-on** — `@penguin/ui` shared components; `useAssistantChat` hook to de-dupe the panel/standalone chat logic.

## 8. Non-goals (v1)

ClaimGuard/SIU native views, LLM-executed mutations, iframe embedding, the shared
component package. All are designed-for, none are built in v1.
