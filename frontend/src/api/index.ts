import { client } from './client'
import type {
  User, CaseListResponse, CaseDetailLite, MyDashboard,
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
}
