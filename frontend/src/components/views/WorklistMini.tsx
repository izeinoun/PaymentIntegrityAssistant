// Assistant-native worklist surface. Renders a compact case table from the
// unified /api/cases endpoint. Each row opens the in-assistant case cockpit;
// a soft-key deep-links to the full PayGuard worklist.
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import { api } from '../../api'
import type { CaseQuery } from '../../api'
import { appUrl } from '../../config/appUrls'

const BRAND = '#FE017D'

function money(n?: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function Pill({ value }: { value?: string | null }) {
  if (!value) return <span className="text-gray-400">—</span>
  const v = value.toUpperCase()
  const cls =
    v === 'HIGH' || v === 'CRITICAL' ? 'bg-red-100 text-red-700'
    : v === 'MEDIUM' || v === 'WARNING' ? 'bg-amber-100 text-amber-700'
    : 'bg-slate-100 text-slate-600'
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${cls}`}>{v}</span>
}

interface Props {
  params: { scope?: 'mine' | 'unassigned' | 'all'; status?: string; priority?: string; overdue?: boolean }
  onOpenCase: (caseId: number) => void
}

export default function WorklistMini({ params, onOpenCase }: Props) {
  const q: CaseQuery = {
    scope: params.scope ?? 'mine',
    status: params.status,
    priority: params.priority,
    overdue: params.overdue,
    page_size: 50,
  }
  const { data, isLoading, error } = useQuery({
    queryKey: ['cockpit-cases', q],
    queryFn: () => api.listCases(q),
  })

  const items = data?.items ?? []
  // Deep-link to the matching PayGuard worklist stage where it maps cleanly.
  const payguardHref = appUrl('payguard', params.scope === 'all' ? 'worklist?stage=all' : 'worklist')

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">
          {isLoading ? 'Loading…' : `${data?.total ?? 0} case${(data?.total ?? 0) === 1 ? '' : 's'}`}
        </span>
        <a href={payguardHref} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#FE017D]">
          Open in PayGuard <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">Failed to load cases.</div>}

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading cases…
        </div>
      ) : !items.length ? (
        <div className="text-center text-sm text-gray-400 py-8">No cases match.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Case #', 'Priority', 'Status', 'Member', 'At Risk', ''].map((h, i) => (
                  <th key={h} className={`px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((c) => (
                <tr key={c.id} onClick={() => onOpenCase(c.id)}
                  className="cursor-pointer bg-white hover:bg-[#FE017D]/5 transition-colors">
                  <td className="px-3 py-2 font-mono font-semibold text-gray-900 whitespace-nowrap">{c.case_number}</td>
                  <td className="px-3 py-2"><Pill value={c.priority} /></td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.status.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2 text-gray-700">{c.claim?.member?.name ?? <span className="text-gray-400">—</span>}</td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">{money(c.amount_at_risk)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={(e) => { e.stopPropagation(); onOpenCase(c.id) }}
                      className="text-xs font-semibold" style={{ color: BRAND }}>Open →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
