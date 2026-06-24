import { client } from './client'
import type {
  User, CaseListResponse, CaseDetailLite, MyDashboard, DocumentLite, NoteLite, EvidenceFinding,
} from './types'

// Worklist scope → the unified /api/cases assignee filter (same mapping PayGuard
// uses). 'mine' needs the current actor id (X-User-Id), read from localStorage.
import { ACTOR_KEY } from './client'

export interface CaseQuery {
  scope?: 'mine' | 'unassigned' | 'all'
  status?: string
  priority?: string
  overdue?: boolean
  page_size?: number
}

function caseParams(q: CaseQuery): Record<string, any> {
  const p: Record<string, any> = { page_size: q.page_size ?? 50 }
  // Closed statuses shouldn't be hidden when the caller explicitly asks for one.
  if (q.status && q.status.startsWith('closed')) p.closed_only = true
  else p.exclude_closed = true
  if (q.status) p.status = q.status
  if (q.priority) p.priority = q.priority
  if (q.overdue) p.overdue_only = true
  if (q.scope === 'mine') {
    const me = localStorage.getItem(ACTOR_KEY)
    if (me) p.assignee_id = me
  } else if (q.scope === 'unassigned') {
    p.assignee_id = '__unassigned__'
  }
  return p
}

export const api = {
  async listUsers(): Promise<User[]> {
    const { data } = await client.get<User[]>('/api/users')
    return data
  },

  async listCases(q: CaseQuery): Promise<CaseListResponse> {
    const { data } = await client.get<CaseListResponse>('/api/cases', { params: caseParams(q) })
    return data
  },

  // Just the total for a query — powers launchpad button counts.
  async countCases(q: CaseQuery): Promise<number> {
    const { data } = await client.get<CaseListResponse>('/api/cases', {
      params: { ...caseParams(q), page_size: 1 },
    })
    return data.total ?? 0
  },

  async getCase(caseId: number): Promise<CaseDetailLite> {
    const { data } = await client.get<CaseDetailLite>(`/api/cases/${caseId}`)
    return data
  },

  async myDashboard(period: 'week' | 'month' | 'quarter' = 'month'): Promise<MyDashboard> {
    const { data } = await client.get<MyDashboard>('/api/dashboard/me', { params: { period } })
    return data
  },

  // Case-level documents (Evidence tab). caseUuid is CaseDetail.case_id.
  async caseDocuments(caseUuid: string): Promise<DocumentLite[]> {
    const { data } = await client.get<DocumentLite[]>('/api/documents', { params: { case_id: caseUuid } })
    return data
  },

  // Evidence findings from document analysis. claimId is CaseDetail.claim.id.
  async caseEvidenceFindings(claimId: string): Promise<EvidenceFinding[]> {
    const { data } = await client.get<EvidenceFinding[]>(`/api/claims/${claimId}/evidence-findings`)
    return data
  },

  // ── Inline write actions (the human clicks; the LLM never mutates) ──────
  async addCaseNote(caseId: number, body: string): Promise<NoteLite> {
    const { data } = await client.post<NoteLite>(`/api/cases/${caseId}/notes`, { body })
    return data
  },
  async assignCase(caseId: number, analystId: string | null): Promise<CaseDetailLite> {
    const { data } = await client.patch<CaseDetailLite>(`/api/cases/${caseId}/assign`, { analyst_id: analystId })
    return data
  },
  async transitionCase(caseId: number, toStatus: string, reason?: string): Promise<CaseDetailLite> {
    const { data } = await client.post<CaseDetailLite>(`/api/cases/${caseId}/transition`, { to_status: toStatus, reason })
    return data
  },
  async escalateCase(caseId: number, reason: string): Promise<void> {
    await client.post(`/api/cases/${caseId}/escalate`, { reason })
  },
  async rerunDetectors(caseId: number): Promise<void> {
    await client.post(`/api/cases/${caseId}/rerun-detectors`)
  },

  // ── Finding dispositions ────────────────────────────────────────────────
  async acceptFinding(findingId: string): Promise<void> {
    await client.post(`/api/findings/${findingId}/accept`, {})
  },
  async rejectFinding(findingId: string, reason: string): Promise<void> {
    await client.post(`/api/findings/${findingId}/reject`, { reason })
  },
  async adjustFinding(findingId: string, adjustedAmount: number, reason: string): Promise<void> {
    await client.post(`/api/findings/${findingId}/adjust`, { adjusted_amount: adjustedAmount, reason })
  },

  // ── Case decisions / supervisor / SIU ───────────────────────────────────
  async approveCase(caseId: number): Promise<void> {
    await client.post(`/api/cases/${caseId}/approve`, {})
  },
  async rejectCase(caseId: number, reason: string): Promise<void> {
    await client.post(`/api/cases/${caseId}/reject`, { reason })
  },
  async reopenCase(caseId: number, reason: string): Promise<void> {
    await client.post(`/api/cases/${caseId}/reopen`, { reason })
  },
  async adjudicateWithout837(caseId: number): Promise<void> {
    await client.post(`/api/cases/${caseId}/adjudicate-without-claim`, {})
  },
  async siuEscalate(caseUuid: string, reason: string): Promise<void> {
    await client.post('/api/siu/escalate', { case_id: caseUuid, escalation_reason: reason })
  },
}

// Direct download URL for a document (opens the backend stream in a new tab).
export function documentDownloadUrl(docId: string): string {
  return `${client.defaults.baseURL}/api/documents/${docId}/download`
}
