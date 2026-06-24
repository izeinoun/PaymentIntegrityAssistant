// Anticipatory launchpad — role-aware action buttons with live counts. Each
// button dispatches a render directive client-side (no agent round-trip), the
// same directive the agent's present_view would emit. Counts come from
// /api/cases (page_size:1 → total).
import { useQuery } from '@tanstack/react-query'
import {
  ListChecks, Eye, AlertTriangle, Inbox, LayoutDashboard, ShieldCheck, Flame, Sparkles,
} from 'lucide-react'
import { api } from '../api'
import type { CaseQuery } from '../api'
import type { Directive } from '../api/types'
import { ACTOR_KEY } from '../api/client'

type Spec = {
  label: string
  icon: typeof ListChecks
  directive: Directive
  countQuery?: CaseQuery
}

const ANALYST: Spec[] = [
  { label: 'Daily Briefing', icon: Sparkles,
    directive: { view: 'briefing', caption: 'Daily Briefing' } },
  { label: 'My cases', icon: ListChecks, countQuery: { scope: 'mine' },
    directive: { view: 'worklist', params: { scope: 'mine' }, caption: 'Your assigned cases' } },
  { label: 'Pending my review', icon: Eye, countQuery: { scope: 'mine', status: 'in_review' },
    directive: { view: 'worklist', params: { scope: 'mine', status: 'in_review' }, caption: 'Your cases in review' } },
  { label: 'Jeopardy', icon: AlertTriangle, countQuery: { scope: 'mine', overdue: true },
    directive: { view: 'worklist', params: { scope: 'mine', overdue: true }, caption: 'Your overdue cases' } },
  { label: 'Unassigned hi-pri', icon: Inbox, countQuery: { scope: 'unassigned', priority: 'HIGH' },
    directive: { view: 'worklist', params: { scope: 'unassigned', priority: 'HIGH' }, caption: 'Unassigned high-priority cases' } },
  { label: 'My dashboard', icon: LayoutDashboard,
    directive: { view: 'my_dashboard', params: { period: 'month' }, caption: 'Your dashboard' } },
]

const SUPERVISOR: Spec[] = [
  { label: 'Approvals', icon: ShieldCheck, countQuery: { scope: 'all', status: 'pending_supervisor' },
    directive: { view: 'worklist', params: { scope: 'all', status: 'pending_supervisor' }, caption: 'Cases awaiting your approval' } },
  { label: 'Top priority', icon: Flame, countQuery: { scope: 'all', priority: 'HIGH' },
    directive: { view: 'worklist', params: { scope: 'all', priority: 'HIGH' }, caption: 'Top-priority cases across owners' } },
  { label: 'Unassigned hi-pri', icon: Inbox, countQuery: { scope: 'unassigned', priority: 'HIGH' },
    directive: { view: 'worklist', params: { scope: 'unassigned', priority: 'HIGH' }, caption: 'Unassigned high-priority cases' } },
  { label: 'My dashboard', icon: LayoutDashboard,
    directive: { view: 'my_dashboard', params: { period: 'month' }, caption: 'Your dashboard' } },
]

const ROLE_PRIORITY = ['admin', 'supervisor', 'siu_investigator', 'analyst', 'specialist', 'system']
function primaryRole(roles: string[] | undefined): string {
  if (!roles?.length) return 'analyst'
  for (const r of ROLE_PRIORITY) if (roles.includes(r)) return r
  return roles[0]
}

function LaunchButton({ spec, onOpen }: { spec: Spec; onOpen: (d: Directive) => void }) {
  const { data: count } = useQuery({
    queryKey: ['launch-count', spec.countQuery],
    queryFn: () => api.countCases(spec.countQuery!),
    enabled: !!spec.countQuery,
    staleTime: 30_000,
  })
  const Icon = spec.icon
  return (
    <button onClick={() => onOpen(spec.directive)}
      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:border-[#FE017D]/40 hover:bg-[#FE017D]/5 transition-colors text-sm">
      <Icon className="w-4 h-4 text-[#FE017D] flex-shrink-0" />
      <span className="text-gray-700 font-medium whitespace-nowrap">{spec.label}</span>
      {count !== undefined && (
        <span className="ml-0.5 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  )
}

interface Props {
  onOpen: (d: Directive) => void
}

export default function Launchpad({ onOpen }: Props) {
  const usersQ = useQuery({ queryKey: ['users'], queryFn: api.listUsers })
  const actorId = localStorage.getItem(ACTOR_KEY) ?? ''
  const me = usersQ.data?.find((u) => u.id === actorId)
  const role = primaryRole(me?.roles)
  const isSupervisor = role === 'supervisor' || role === 'admin'

  // Launchpad is PayGuard-scoped in v1; hide it for users without PayGuard.
  if (me && !me.apps?.includes('payguard')) return null

  const specs = isSupervisor ? SUPERVISOR : ANALYST
  const greeting = me?.name ? `Hi ${me.name.split(' ')[0]} —` : 'Quick actions'

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3.5">
      <p className="text-xs text-gray-500 mb-2.5">
        <span className="font-semibold text-gray-700">{greeting}</span> jump into your work, or ask below.
      </p>
      <div className="flex flex-wrap gap-2">
        {specs.map((s) => <LaunchButton key={s.label} spec={s} onOpen={onOpen} />)}
      </div>
    </div>
  )
}
