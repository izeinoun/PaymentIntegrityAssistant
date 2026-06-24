// Self-contained case cockpit. Each tab renders its critical content INLINE
// (no PayGuard round-trip) — only "Open full case" leaves the assistant. A small
// action bar performs safe writes against the existing endpoints; the human
// clicks, the LLM never mutates. Heavier flows (send notice, close, approve)
// still live on the full PayGuard page.
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Loader2, Download, Send, ChevronDown, Check } from 'lucide-react'
import { api, documentDownloadUrl } from '../../api'
import type { CaseDetailLite, CaseAction, FindingLite } from '../../api/types'
import { appUrl } from '../../config/appUrls'
import { ACTOR_KEY } from '../../api/client'
import CaseLifecycleRail from '../CaseLifecycleRail'
import CockpitActionBar from '../CockpitActionBar'
import type { CockpitActionReq } from '../../lib/nextAction'

const BRAND = '#FE017D'

function money(n?: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function date(s?: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(+d) ? String(s) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type TabKey = 'overview' | 'notes' | 'evidence' | 'disputes' | 'era' | 'output'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'notes', label: 'Notes' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'disputes', label: 'Disputes' },
  { key: 'era', label: '835/ERA' },
  { key: 'output', label: 'Output' },
]

function summarize(c: CaseDetailLite): string {
  const provider = c.claim?.rendering_provider?.name ?? c.claim?.provider_org_name
  const member = c.claim?.member?.name
  const findings = c.claim?.findings ?? []
  const detectors = Array.from(
    new Set(findings.map((f) => f.detector_code || f.finding_type).filter(Boolean)),
  ) as string[]
  const who = [provider && `provider ${provider}`, member && `member ${member}`].filter(Boolean).join(', ')
  const parts = [`Case ${c.case_number}${who ? ` — ${who}` : ''}.`]
  parts.push(findings.length
    ? `${findings.length} issue${findings.length === 1 ? '' : 's'} flagged${detectors.length ? ` (${detectors.join(', ')})` : ''}${c.amount_at_risk != null ? `, ${money(c.amount_at_risk)} at risk` : ''}.`
    : 'No detector findings on record.')
  return parts.join(' ')
}

interface Props {
  caseId: number
  onOpenCase?: (caseId: number) => void
  // A pill click dispatched up to AssistantChat, which executes it inline
  // (collecting any amount/reason via the chat). See workflow-guidance-plan.md.
  onAction?: (req: CockpitActionReq) => void
  busy?: boolean
}

export default function CaseCockpit({ caseId, onAction, busy }: Props) {
  const actorId = localStorage.getItem(ACTOR_KEY) ?? ''
  const [tab, setTab] = useState<TabKey>('overview')

  const { data: c, isLoading, error } = useQuery({
    queryKey: ['cockpit-case', caseId],
    queryFn: () => api.getCase(caseId),
  })

  if (isLoading) {
    return <div className="flex items-center gap-2 text-xs text-gray-400 py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading case…</div>
  }
  if (error || !c) {
    return <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">Failed to load case {caseId}.</div>
  }

  const caseHref = appUrl('payguard', `cases/${c.id}`)
  const isOwner = !!c.assignee && c.assignee.id === actorId
  const actions = c.guidance?.actions ?? []
  // Findings can only be re-dispositioned while the case is open for review —
  // not once it's closed, frozen, or locked awaiting a supervisor.
  const findingsLocked = c.status.startsWith('closed') || c.status === 'pending_supervisor' || !!c.siu_frozen

  // Map a case-level pill to a dispatched action request.
  const dispatch = (a: CaseAction) => onAction?.({
    kind: a.kind, caseId, caseUuid: c.case_id, label: a.label, claimTotal: c.claim?.total_billed,
  })

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-mono font-bold text-gray-900">{c.case_number}</h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">{c.status.replace(/_/g, ' ')}</span>
            <span className="text-xs text-gray-400">{c.assignee ? `· ${c.assignee.full_name}${isOwner ? ' (you)' : ''}` : '· Unassigned'}</span>
            <a href={caseHref} target="_blank" rel="noreferrer" title="Open full case"
              className="text-gray-300 hover:text-[#FE017D]"><ExternalLink className="w-3.5 h-3.5" /></a>
          </div>
          <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{summarize(c)}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">At risk</p>
          <p className="text-lg font-bold text-gray-900">{money(c.amount_at_risk)}</p>
        </div>
      </div>

      {/* Workflow lifecycle */}
      {c.guidance && c.guidance.lifecycle.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <CaseLifecycleRail steps={c.guidance.lifecycle} orientation="horizontal" />
          {c.guidance.remaining_summary && (
            <p className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500">{c.guidance.remaining_summary}</p>
          )}
        </div>
      )}

      {/* Action pills (case-level) */}
      {actions.length > 0 && <CockpitActionBar actions={actions} onAct={dispatch} busy={busy} />}

      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-sm -mb-px border-b-2 transition-colors ${active ? 'border-[#FE017D] text-[#FE017D] font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="pt-1">
        {tab === 'overview' && <OverviewTab c={c} caseId={caseId} actionable={!findingsLocked} onAction={onAction} />}
        {tab === 'notes' && <NotesTab caseId={caseId} notes={c.case_notes ?? []} />}
        {tab === 'evidence' && <EvidenceTab c={c} />}
        {tab === 'disputes' && <DisputesTab c={c} />}
        {tab === 'era' && <EraTab c={c} />}
        {tab === 'output' && <OutputTab c={c} />}
      </div>
    </div>
  )
}

// ── Overview: interactive findings (pill per rule → Approve/Deny/Edit) ──────
const DISP: Record<string, { label: string; cls: string }> = {
  accepted:     { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  rejected:     { label: 'Denied',   cls: 'bg-gray-100 text-gray-500' },
  adjusted:     { label: 'Corrected', cls: 'bg-blue-100 text-blue-700' },
  needs_review: { label: 'Needs review', cls: 'bg-amber-100 text-amber-700' },
}

function OverviewTab({ c, caseId, actionable, onAction }: {
  c: CaseDetailLite; caseId: number; actionable: boolean; onAction?: (req: CockpitActionReq) => void
}) {
  const findings = c.claim?.findings ?? []
  // Walk needs_review first; auto-open the first one to guide the analyst.
  const firstNeedsReview = actionable ? findings.find((f) => f.disposition_status === 'needs_review')?.id : undefined
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">Findings ({findings.length})</p>
      {!findings.length ? <p className="text-sm text-gray-400">No findings.</p> : (
        <ul className="space-y-1.5">
          {findings.map((f, i) => (
            <FindingRow
              key={f.id ?? i} f={f} caseId={caseId} claimTotal={c.claim?.total_billed}
              actionable={actionable} defaultOpen={!!f.id && f.id === firstNeedsReview} onAction={onAction}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function FindingRow({ f, caseId, claimTotal, actionable, defaultOpen, onAction }: {
  f: FindingLite; caseId: number; claimTotal?: number | null; actionable: boolean; defaultOpen?: boolean
  onAction?: (req: CockpitActionReq) => void
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  const det = f.detector_code || f.finding_type || '—'
  const disp = f.disposition_status || undefined
  const tag = disp ? DISP[disp] : undefined
  const needs = disp === 'needs_review'
  const act = (kind: string) => {
    if (!f.id) return
    onAction?.({ kind, caseId, findingId: f.id, label: det, claimTotal })
  }
  const Row = (
    <div className="w-full flex items-start gap-2 text-left p-2.5">
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 font-mono flex-shrink-0 mt-0.5">{det}</span>
      <span className="flex-1 text-sm text-gray-700">
        {f.description || f.finding_type || '—'}
        {f.overpayment_amount != null && <span className="text-gray-500"> · {money(f.overpayment_amount)}</span>}
      </span>
      {tag && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${tag.cls}`}>{tag.label}</span>}
      {actionable && <ChevronDown className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />}
    </div>
  )
  // Read-only once the case is closed / locked — show the disposition, no pills.
  if (!actionable) {
    return <li className="border border-gray-100 rounded-lg">{Row}</li>
  }
  return (
    <li className={`border rounded-lg ${needs ? 'border-amber-300 bg-amber-50/40' : 'border-gray-100'}`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full">{Row}</button>
      {open && (
        <div className="flex flex-wrap gap-1.5 px-2.5 pb-2.5">
          <FindingPill label="Approve" primary onClick={() => act('accept_finding')} />
          <FindingPill label="Deny" caution onClick={() => act('reject_finding')} />
          <FindingPill label="Edit amount" onClick={() => act('adjust_finding')} />
        </div>
      )}
    </li>
  )
}

function FindingPill({ label, onClick, primary, caution }: { label: string; onClick: () => void; primary?: boolean; caution?: boolean }) {
  const base = 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors'
  const cls = primary ? `${base} text-white`
    : caution ? `${base} border border-amber-300 text-amber-700 hover:bg-amber-50`
    : `${base} border border-gray-200 text-gray-700 hover:bg-gray-50`
  return (
    <button onClick={onClick} className={cls} style={primary ? { backgroundColor: BRAND } : undefined}>
      {primary && <Check className="w-3 h-3" />}{label}
    </button>
  )
}

function NotesTab({ caseId, notes }: { caseId: number; notes: { id?: string; body: string; created_at?: string; author?: { full_name?: string | null } | null }[] }) {
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const addMut = useMutation({
    mutationFn: () => api.addCaseNote(caseId, body.trim()),
    onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: ['cockpit-case', caseId] }) },
  })
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2}
          placeholder="Add a note to this case…"
          className="flex-1 resize-none text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FE017D]/30 focus:border-[#FE017D]/40" />
        <button onClick={() => body.trim() && addMut.mutate()} disabled={!body.trim() || addMut.isPending}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-white text-xs font-semibold disabled:opacity-40" style={{ backgroundColor: BRAND }}>
          {addMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Add
        </button>
      </div>
      {addMut.isError && <p className="text-xs text-red-600">Failed to add note.</p>}
      {!notes.length ? <p className="text-sm text-gray-400">No notes yet.</p> : (
        <ul className="space-y-2">
          {notes.map((n, i) => (
            <li key={n.id ?? i} className="text-sm border border-gray-100 rounded-lg p-2.5 bg-gray-50/60">
              <p className="text-gray-800 whitespace-pre-wrap">{n.body}</p>
              <p className="text-[11px] text-gray-400 mt-1">{n.author?.full_name ?? 'Unknown'} · {date(n.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}


function EvidenceTab({ c }: { c: CaseDetailLite }) {
  const caseUuid = c.case_id ?? null
  const claimId = c.claim?.id ?? null
  const { data: docs, isLoading: docsLoading, error: docsError } = useQuery({
    queryKey: ['cockpit-docs', caseUuid],
    queryFn: () => api.caseDocuments(caseUuid as string),
    enabled: !!caseUuid,
  })
  const { data: findings, isLoading: findingsLoading, error: findingsError } = useQuery({
    queryKey: ['cockpit-evidence-findings', claimId],
    queryFn: () => api.caseEvidenceFindings(claimId as string),
    enabled: !!claimId,
  })
  const documents = docs ?? []
  const evidenceFindings = findings ?? []

  const SEVERITY_STYLES: Record<string, string> = {
    critical: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    ok: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  }

  return (
    <div className="space-y-4">
      {/* AI evidence findings */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">Evidence findings ({evidenceFindings.length})</p>
        {findingsLoading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : findingsError ? (
          <p className="text-sm text-red-600">Failed to load evidence findings.</p>
        ) : evidenceFindings.length === 0 ? (
          <p className="text-sm text-gray-400">{documents.length === 0 ? 'Attach documents to see evidence findings.' : 'No evidence findings found.'}</p>
        ) : (
          <ul className="space-y-2">
            {evidenceFindings.map((f) => (
              <li key={f.id} className="border border-gray-100 rounded-lg p-2.5">
                <div className="flex items-start gap-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide flex-shrink-0 ${SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.warning}`}>
                    {f.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{f.title ?? 'Evidence finding'}</span>
                      {f.code && <span className="text-xs text-gray-500 font-mono">{f.code}</span>}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{f.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Attached documents */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">Attached documents</p>
        {docsLoading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : docsError ? (
          <p className="text-sm text-red-600">Failed to load documents.</p>
        ) : !documents.length ? (
          <p className="text-sm text-gray-400">No documents attached.</p>
        ) : (
          <ul className="space-y-1.5">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 text-sm border border-gray-100 rounded-lg px-2.5 py-2">
                <span className="min-w-0">
                  <span className="text-gray-800 truncate">{d.filename}</span>
                  {d.kind && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{d.kind}</span>}
                  {d.file_size_kb != null && <span className="ml-2 text-[11px] text-gray-400">{Math.round(d.file_size_kb)} KB</span>}
                </span>
                <a href={documentDownloadUrl(d.id)} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold flex-shrink-0" style={{ color: BRAND }}>
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function DisputesTab({ c }: { c: CaseDetailLite }) {
  const disputes = c.disputes ?? []
  if (!disputes.length) return <p className="text-sm text-gray-400">No disputes on this case.</p>
  return (
    <ul className="space-y-2">
      {disputes.map((d, i) => (
        <li key={d.id ?? i} className="text-sm border border-gray-100 rounded-lg p-2.5">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-800">{date(d.dispute_date)}</span>
            {d.outcome && <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{d.outcome}</span>}
          </div>
          <p className="text-gray-600 mt-0.5">{d.reason}</p>
          {d.response_due && <p className="text-[11px] text-gray-400 mt-0.5">Response due {date(d.response_due)}</p>}
        </li>
      ))}
    </ul>
  )
}

function EraTab({ c }: { c: CaseDetailLite }) {
  const eras = c.claim?.era_transactions ?? []
  if (!eras.length) return <p className="text-sm text-gray-400">No 835/remittance linked.</p>
  return (
    <ul className="space-y-2">
      {eras.map((e, i) => (
        <li key={e.id ?? i} className="text-sm border border-gray-100 rounded-lg p-2.5 flex items-center justify-between">
          <span className="font-mono text-gray-800">{e.era_number ?? 'ERA'}</span>
          <span className="text-gray-600">{e.claim_count != null ? `${e.claim_count} claim(s) · ` : ''}{money(e.payment_amount)} · {date(e.payment_date)}</span>
        </li>
      ))}
    </ul>
  )
}

function OutputTab({ c }: { c: CaseDetailLite }) {
  const notices = c.notices ?? []
  if (!notices.length) return <p className="text-sm text-gray-400">No letters generated yet. Use “Open full case” to generate a recoupment notice.</p>
  return (
    <ul className="space-y-2">
      {notices.map((n, i) => (
        <li key={n.id ?? i} className="text-sm border border-gray-100 rounded-lg p-2.5 flex items-center justify-between">
          <span>
            <span className="font-medium text-gray-800">Recoupment notice</span>
            <span className="text-gray-500"> · {n.delivery_method ?? 'mail'} · {date(n.sent_date)}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{money(n.amount_demanded)}</span>
            {n.status && <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{n.status}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
