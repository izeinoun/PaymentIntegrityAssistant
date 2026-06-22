// Assistant-native case cockpit — the SIMPLIFIED case view. Plain-language
// summary, the deterministic suggested decision/actions, the findings (rules
// triggered), and soft-keys that deep-link into PayGuard's full case page +
// individual detail tabs. The assistant never mutates; actions open the real
// PayGuard controls in a new tab.
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Loader2, ArrowRight } from 'lucide-react'
import { api } from '../../api'
import type { CaseDetailLite } from '../../api/types'
import { appUrl } from '../../config/appUrls'

const BRAND = '#FE017D'

function money(n?: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// PayGuard case-detail tabs (must match CaseDetailPage TAB_DEFS keys).
const TABS: { key: string; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'notes', label: 'Notes' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'disputes', label: 'Disputes' },
  { key: 'era', label: '835/ERA' },
  { key: 'output', label: 'Output' },
]

// Build a plain-language summary deterministically from the case data. (The
// short AI narrative from generate_claim_summary is a later, gated enhancement.)
function summarize(c: CaseDetailLite): string {
  const provider = c.claim?.rendering_provider?.name ?? c.claim?.provider_org_name
  const member = c.claim?.member?.name
  const findings = c.claim?.findings ?? []
  const detectors = Array.from(
    new Set(findings.map((f) => f.detector_code || f.finding_type).filter(Boolean)),
  ) as string[]
  const amount = c.amount_at_risk
  const who = [provider && `provider ${provider}`, member && `member ${member}`].filter(Boolean).join(', ')
  const parts: string[] = []
  parts.push(`Case ${c.case_number}${who ? ` — ${who}` : ''}.`)
  if (findings.length) {
    parts.push(`${findings.length} issue${findings.length === 1 ? '' : 's'} flagged${detectors.length ? ` (${detectors.join(', ')})` : ''}${amount != null ? `, ${money(amount)} at risk` : ''}.`)
  } else {
    parts.push('No detector findings on record.')
  }
  return parts.join(' ')
}

const REC_LABEL: Record<string, string> = {
  recoup: 'Recoup — send notice',
  not_for_recoup: 'Close — not for recoup',
  review: 'Needs analyst review',
}

interface Props {
  caseId: number
  onOpenCase?: (caseId: number) => void
}

export default function CaseCockpit({ caseId }: Props) {
  const { data: c, isLoading, error } = useQuery({
    queryKey: ['cockpit-case', caseId],
    queryFn: () => api.getCase(caseId),
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-8 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading case…
      </div>
    )
  }
  if (error || !c) {
    return <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">Failed to load case {caseId}.</div>
  }

  const caseHref = appUrl('payguard', `cases/${c.id}`)
  const sd = c.suggested_decision
  const findings = c.claim?.findings ?? []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-mono font-bold text-gray-900">{c.case_number}</h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
              {c.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{summarize(c)}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">At risk</p>
          <p className="text-lg font-bold text-gray-900">{money(c.amount_at_risk)}</p>
        </div>
      </div>

      {/* Suggested action */}
      {sd && (
        <div className="rounded-xl border border-[#FE017D]/20 bg-[#FE017D]/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: BRAND }}>Suggested next step</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {REC_LABEL[sd.recommendation] ?? sd.recommendation}
                {typeof sd.confidence === 'number' && <span className="text-gray-400 font-normal"> · {Math.round(sd.confidence * 100)}% confidence</span>}
              </p>
              {sd.reason && <p className="text-xs text-gray-600 mt-0.5">{sd.reason}</p>}
            </div>
            <a href={caseHref} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs font-semibold whitespace-nowrap"
              style={{ backgroundColor: BRAND }}>
              Act on case <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Findings (rules triggered) */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">Findings ({findings.length})</p>
        {!findings.length ? (
          <p className="text-sm text-gray-400">No findings.</p>
        ) : (
          <ul className="space-y-1.5">
            {findings.map((f, i) => (
              <li key={f.id ?? i} className="flex items-start gap-2 text-sm">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 font-mono flex-shrink-0 mt-0.5">
                  {f.detector_code || f.finding_type || '—'}
                </span>
                <span className="text-gray-700">
                  {f.description || f.finding_type || '—'}
                  {f.overpayment_amount != null && <span className="text-gray-500"> · {money(f.overpayment_amount)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Soft-keys: open full case + jump to a tab */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100">
        <a href={caseHref} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 hover:border-[#FE017D]/40 hover:text-[#FE017D]">
          Open full case <ExternalLink className="w-3 h-3" />
        </a>
        {TABS.map((t) => (
          <a key={t.key} href={appUrl('payguard', `cases/${c.id}?tab=${t.key}`)} target="_blank" rel="noreferrer"
            className="px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800">
            {t.label}
          </a>
        ))}
      </div>
    </div>
  )
}
