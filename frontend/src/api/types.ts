// Mirrors the User shape returned by the unified backend's /api/users.
export interface User {
  id: string
  name: string
  username: string | null
  email: string | null
  role: string
  is_active: boolean
  roles: string[]
  apps: string[]
}

// ── Interactive cockpit ─────────────────────────────────────────────────────

// A render directive: which assistant-native view to mount + its params. Emitted
// by the agent (present_view) or dispatched client-side by a launchpad button.
export type ViewName = 'worklist' | 'case' | 'my_dashboard'
export interface Directive {
  view: ViewName
  params?: Record<string, any>
  caption?: string
}

// Loose case shapes — only the fields the cockpit/worklist render. Optional
// chaining everywhere so unknown backend fields just don't show.
export interface CaseSummary {
  id: number
  case_number: string
  status: string
  priority?: string | null
  amount_at_risk?: number | null
  assignee?: { id: string; full_name: string } | null
  claim?: { member?: { name?: string | null } | null } | null
  opened_at?: string | null
  deadline?: string | null
  primary_detector_id?: string | null
}
export interface CaseListResponse {
  items: CaseSummary[]
  total: number
  page?: number
}

export interface SuggestedDecision {
  recommendation: string
  confidence: number
  reason: string
}
// Mirrors ClaimFindingRead.
export interface FindingLite {
  id?: string
  detector_code?: string | null
  finding_type?: string | null
  description?: string | null
  overpayment_amount?: number | null
  confidence_score?: number | null
  evidence_json?: string | null
  disposition_status?: string | null
}
export interface EraTxLite {
  id?: string
  era_number?: string
  payment_amount?: number | null
  claim_count?: number | null
  payment_date?: string | null
}
export interface DisputeLite {
  id?: string
  dispute_date?: string
  reason?: string
  outcome?: string | null
  response_due?: string | null
}
export interface NoticeLite {
  id?: string
  sent_date?: string
  amount_demanded?: number | null
  status?: string
  delivery_method?: string
}
export interface NoteLite {
  id?: string
  body: string
  created_at?: string
  author?: { full_name?: string | null } | null
}
export interface DocumentLite {
  id: string
  filename: string
  file_size_kb?: number | null
  kind?: string | null
  uploaded_at?: string | null
}

// Mirrors the parts of CaseDetail the cockpit renders. Findings live under
// claim.findings; provider is rendering_provider / provider_org_name.
export interface CaseDetailLite {
  id: number
  case_id?: string | null   // UUID — used for the documents lookup
  case_number: string
  status: string
  siu_frozen?: boolean | null
  priority?: string | null
  amount_at_risk?: number | null
  assignee?: { id: string; full_name: string } | null
  claim?: {
    id?: string
    total_billed?: number | null
    total_paid?: number | null
    member?: { name?: string | null } | null
    rendering_provider?: { name?: string | null } | null
    provider_org_name?: string | null
    findings?: FindingLite[]
    era_transactions?: EraTxLite[]
  } | null
  suggested_decision?: SuggestedDecision | null
  guidance?: CaseGuidance | null
  disputes?: DisputeLite[]
  notices?: NoticeLite[]
  case_notes?: NoteLite[]
  opened_at?: string | null
  deadline?: string | null
}

// ── Workflow guidance (mirror of server/app/schemas/guidance.py) ───────────
export type LifecycleStepState = 'completed' | 'current' | 'blocked' | 'upcoming' | 'skipped'
export interface LifecycleStep {
  key: string
  label: string
  state: LifecycleStepState
  detail?: string | null
  conditional?: boolean
}
export interface NextAction {
  kind: string
  label: string
  explanation: string
  actionable?: boolean
  target?: { view?: string; params?: Record<string, any> }
}
export interface Blocker { type: string; count: number; message: string }
export interface RoleContext { is_owner: boolean; role: string; supervisor_gate: boolean }
export type ActionStyle = 'primary' | 'default' | 'caution'
export interface CaseAction {
  kind: string
  label: string
  style: ActionStyle
  enabled: boolean
  disabled_reason?: string | null
  needs_input?: 'reason' | 'amount' | 'amount_reason' | null
  recommended: boolean
}
export interface CaseGuidance {
  lifecycle: LifecycleStep[]
  current_step?: string | null
  next_action?: NextAction | null
  actions: CaseAction[]
  blockers: Blocker[]
  remaining_summary: string
  role_context: RoleContext
}

export interface MyDashboard {
  cases_closed?: number
  dollars_recovered?: number
  dollars_written_off?: number
  avg_handle_time_days?: number | null
  pipeline_total_active?: number
  pipeline_snapshot?: { status: string; count: number }[]
  disposition_breakdown?: { disposition: string; count: number }[]
}
