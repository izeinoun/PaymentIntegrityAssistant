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
  disposition_status?: string | null
}
// Mirrors the parts of CaseDetail the cockpit renders. Findings live under
// claim.findings; provider is rendering_provider / provider_org_name.
export interface CaseDetailLite {
  id: number
  case_number: string
  status: string
  priority?: string | null
  amount_at_risk?: number | null
  assignee?: { id: string; full_name: string } | null
  claim?: {
    member?: { name?: string | null } | null
    rendering_provider?: { name?: string | null } | null
    provider_org_name?: string | null
    findings?: FindingLite[]
  } | null
  suggested_decision?: SuggestedDecision | null
  opened_at?: string | null
  deadline?: string | null
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
