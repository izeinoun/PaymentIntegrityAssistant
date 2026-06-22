// Self-contained case cockpit. Each tab renders its critical content INLINE
// (no PayGuard round-trip) — only "Open full case" leaves the assistant. A small
// action bar performs safe writes against the existing endpoints; the human
// clicks, the LLM never mutates. Heavier flows (send notice, close, approve)
// still live on the full PayGuard page.
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ExternalLink, Loader2, ArrowRight, Download, UserPlus, Play, RefreshCw,
  ArrowUpCircle, MessageSquarePlus, Send,
} from 'lucide-react'
import { api, documentDownloadUrl } from '../../api'
import type { CaseDetailLite } from '../../api/types'
import { appUrl } from '../../config/appUrls'
import { ACTOR_KEY } from '../../api/client'

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
  const qc = useQueryClient()
  const actorId = localStorage.getItem(ACTOR_KEY) ?? ''
  const [tab, setTab] = useState<TabKey>('overview')
  const [actionErr, setActionErr] = useState<string | null>(null)

  const { data: c, isLoading, error } = useQuery({
    queryKey: ['cockpit-case', caseId],
    queryFn: () => api.getCase(caseId),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cockpit-case', caseId] })
  const onErr = (e: any) => setActionErr(e?.response?.data?.detail || e?.message || 'Action failed')
  const ok = () => { setActionErr(null); invalidate() }

  const assignMut = useMutation({ mutationFn: () => api.assignCase(caseId, actorId), onSuccess: ok, onError: onErr })
  const reviewMut = useMutation({ mutationFn: () => api.transitionCase(caseId, 'in_review'), onSuccess: ok, onError: onErr })
  const rerunMut = useMutation({ mutationFn: () => api.rerunDetectors(caseId), onSuccess: ok, onError: onErr })
  const escalateMut = useMutation({ mutationFn: (reason: string) => api.escalateCase(caseId, reason), onSuccess: () => setActionErr(null), onError: onErr })

  if (isLoading) {
    return <div className="flex items-center gap-2 text-xs text-gray-400 py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading case…</div>
  }
  if (error || !c) {
    return <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">Failed to load case {caseId}.</div>
  }

  const caseHref = appUrl('payguard', `cases/${c.id}`)
  const isOwner = !!c.assignee && c.assignee.id === actorId
  const canReview = c.status === 'new' || c.status === 'assigned'
  const busy = assignMut.isPending || reviewMut.isPending || rerunMut.isPending || escalateMut.isPending

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-mono font-bold text-gray-900">{c.case_number}</h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">{c.status.replace(/_/g, ' ')}</span>
            <span className="text-xs text-gray-400">{c.assignee ? `· ${c.assignee.full_name}${isOwner ? ' (you)' : ''}` : '· Unassigned'}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{summarize(c)}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">At risk</p>
          <p className="text-lg font-bold text-gray-900">{money(c.amount_at_risk)}</p>
        </div>
      </div>

      {/* Action bar — safe inline writes */}
      <div className="flex flex-wrap items-center gap-1.5">
        {!isOwner && <ActionBtn icon={UserPlus} label="Take ownership" onClick={() => assignMut.mutate()} busy={assignMut.isPending} disabled={busy} primary />}
        {canReview && <ActionBtn icon={Play} label="Start review" onClick={() => reviewMut.mutate()} busy={reviewMut.isPending} disabled={busy} />}
        <ActionBtn icon={MessageSquarePlus} label="Add note" onClick={() => setTab('notes')} />
        <ActionBtn icon={RefreshCw} label="Re-run detectors" onClick={() => rerunMut.mutate()} busy={rerunMut.isPending} disabled={busy} />
        {c.status !== 'pending_supervisor' && (
          <ActionBtn icon={ArrowUpCircle} label="Escalate" onClick={() => {
            const reason = window.prompt('Reason for escalation:')
            if (reason && reason.trim()) escalateMut.mutate(reason.trim())
          }} busy={escalateMut.isPending} disabled={busy} />
        )}
        <a href={caseHref} target="_blank" rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 hover:border-[#FE017D]/40 hover:text-[#FE017D]">
          Open full case <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      {actionErr && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">{actionErr}</div>}
      {escalateMut.isSuccess && <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">Escalated to supervisor.</div>}

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
        {tab === 'overview' && <OverviewTab c={c} />}
        {tab === 'notes' && <NotesTab caseId={caseId} notes={c.case_notes ?? []} />}
        {tab === 'evidence' && <EvidenceTab c={c} />}
        {tab === 'disputes' && <DisputesTab c={c} />}
        {tab === 'era' && <EraTab c={c} />}
        {tab === 'output' && <OutputTab c={c} />}
      </div>
    </div>
  )
}

// ── Action button ──────────────────────────────────────────────────────────
function ActionBtn({ icon: Icon, label, onClick, busy, disabled, primary }: {
  icon: any; label: string; onClick: () => void; busy?: boolean; disabled?: boolean; primary?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled || busy}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
        primary ? 'text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
      style={primary ? { backgroundColor: BRAND } : undefined}>
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  )
}

// ── Tabs ────────────────────────────────────────────────────────────────────
function OverviewTab({ c }: { c: CaseDetailLite }) {
  const sd = c.suggested_decision
  const findings = c.claim?.findings ?? []
  return (
    <div className="space-y-3">
      {sd && (
        <div className="rounded-xl border border-[#FE017D]/20 bg-[#FE017D]/5 p-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: BRAND }}>Suggested next step</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {REC_LABEL[sd.recommendation] ?? sd.recommendation}
              {typeof sd.confidence === 'number' && <span className="text-gray-400 font-normal"> · {Math.round(sd.confidence * 100)}% confidence</span>}
            </p>
            {sd.reason && <p className="text-xs text-gray-600 mt-0.5">{sd.reason}</p>}
          </div>
          <ArrowRight className="w-4 h-4 text-[#FE017D] flex-shrink-0" />
        </div>
      )}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">Findings ({findings.length})</p>
        {!findings.length ? <p className="text-sm text-gray-400">No findings.</p> : (
          <ul className="space-y-1.5">
            {findings.map((f, i) => (
              <li key={f.id ?? i} className="flex items-start gap-2 text-sm">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 font-mono flex-shrink-0 mt-0.5">{f.detector_code || f.finding_type || '—'}</span>
                <span className="text-gray-700">
                  {f.description || f.finding_type || '—'}
                  {f.overpayment_amount != null && <span className="text-gray-500"> · {money(f.overpayment_amount)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
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

// Compact, generic renderer for a finding's evidence_json — surfaces the key
// components (codes, amounts, dates) without assuming a per-detector schema.
function fmtEvidenceVal(v: any): string {
  if (v == null) return ''
  if (Array.isArray(v)) {
    return v.map((it) => {
      if (it && typeof it === 'object') {
        if (it.code) return it.reason ? `${it.code} (${it.reason})` : String(it.code)
        if (it.line_number != null) return `line ${it.line_number}`
        const scalars = Object.values(it).filter((x) => x != null && typeof x !== 'object')
        return scalars.slice(0, 2).map(String).join(' ')
      }
      return String(it)
    }).filter(Boolean).join('; ')
  }
  if (typeof v === 'object') return Object.keys(v).slice(0, 4).join(', ')
  return String(v)
}
function evidencePairs(json?: string | null): { key: string; value: string }[] {
  if (!json) return []
  let d: any
  try { d = JSON.parse(json) } catch { return [] }
  if (!d || typeof d !== 'object') return []
  const out: { key: string; value: string }[] = []
  for (const [k, v] of Object.entries(d)) {
    if (v == null || (Array.isArray(v) && v.length === 0)) continue
    const val = fmtEvidenceVal(v)
    if (!val) continue
    out.push({ key: k.replace(/_/g, ' '), value: val.length > 140 ? val.slice(0, 140) + '…' : val })
  }
  return out
}

function EvidenceTab({ c }: { c: CaseDetailLite }) {
  const caseUuid = c.case_id ?? null
  const findings = c.claim?.findings ?? []
  const { data, isLoading, error } = useQuery({
    queryKey: ['cockpit-docs', caseUuid],
    queryFn: () => api.caseDocuments(caseUuid as string),
    enabled: !!caseUuid,
  })
  const docs = data ?? []

  return (
    <div className="space-y-4">
      {/* Findings + their key evidence */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">Evidence findings ({findings.length})</p>
        {!findings.length ? <p className="text-sm text-gray-400">No findings.</p> : (
          <ul className="space-y-2">
            {findings.map((f, i) => {
              const pairs = evidencePairs(f.evidence_json)
              return (
                <li key={f.id ?? i} className="border border-gray-100 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 font-mono">{f.detector_code || f.finding_type || '—'}</span>
                    {f.confidence_score != null && <span className="text-[11px] text-gray-400">{Math.round(f.confidence_score * 100)}% conf</span>}
                    {f.overpayment_amount != null && f.overpayment_amount > 0 && <span className="text-[11px] font-semibold text-gray-700">{money(f.overpayment_amount)}</span>}
                  </div>
                  {f.description && <p className="text-sm text-gray-700 mt-1">{f.description}</p>}
                  {!!pairs.length && (
                    <dl className="mt-1.5 grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5">
                      {pairs.map((p) => (
                        <div key={p.key} className="contents">
                          <dt className="text-[11px] text-gray-400 capitalize">{p.key}</dt>
                          <dd className="text-[11px] text-gray-700 font-mono break-words">{p.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Attached documents */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">Attached documents</p>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : error ? (
          <p className="text-sm text-red-600">Failed to load documents.</p>
        ) : !docs.length ? (
          <p className="text-sm text-gray-400">No documents attached.</p>
        ) : (
          <ul className="space-y-1.5">
            {docs.map((d) => (
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
