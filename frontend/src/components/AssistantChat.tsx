// Full-page OPA Assistant chat. Streams from POST /api/assistant/chat/stream
// (SSE). Conversation history is kept client-side in Anthropic message format;
// the server is stateless. Ported from PayGuard's AssistantPanel, including the
// fix that hides raw tool-result JSON (only ask_user picks render as bubbles).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import DOMPurify from 'dompurify'
import { sanitizeAssistantOutput } from '../lib/sanitizeAssistantOutput'

// A message is an "HTML card" when it leads with a block-level HTML element.
// Such content is rendered as sanitized HTML (browsers parse it leniently),
// NOT through Markdown — whose blank-line-terminates-HTML-block rule otherwise
// makes big multi-section cards leak raw <div> source partway through.
const HTML_CARD = /<(div|table|section|article|figure|main|header|h[1-6])[\s/>]/i
import { Bot, Send, Wrench, AlertTriangle, Loader2 } from 'lucide-react'
import { api } from '../api'
import { API_BASE_URL } from '../config/appUrls'

import Launchpad from './Launchpad'
import ViewSurface from './ViewSurface'
import LeftNav from './LeftNav'
import type { Directive, CaseDetailLite } from '../api/types'
import type { CockpitActionReq } from '../lib/nextAction'

// ── Cockpit action helpers (amount/reason validation for chat-captured input) ──
function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function parseAmount(v: string): number { return Number(v.replace(/[$,\s]/g, '')) }
function validateAmount(v: string, max?: number | null): string | null {
  const n = parseAmount(v)
  if (!isFinite(n)) return 'Enter a number.'
  if (n <= 0) return 'Must be more than $0.'
  if (max != null && n >= max) return `Must be less than ${money(max)}.`
  return null
}
const nonEmpty = (v: string) => (v.trim() ? null : 'Please enter a value.')

// A cockpit action that needs free input — captured via the chat box.
type PendingInput = { prompt: string; validate: (v: string) => string | null; run: (v: string) => Promise<void> }

// ── Anthropic message types (minimal) ─────────────────────────────────────
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
type Message = { role: 'user' | 'assistant'; content: string | ContentBlock[] }

type StreamItem =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; id: string; name: string; status: 'running' | 'done' | 'error'; error?: string }

type Awaiting = { question: string; options: string[]; tool_use_id: string }
// A proposed write awaiting Confirm/Cancel (the write gate).
type Confirming = { summary: string; preview?: string; action: string; tool_use_id: string }

const SUGGESTIONS = [
  'How many high-priority open cases are there?',
  "How's the recovery pipeline doing?",
  'Which providers are riskiest and why?',
  'Show me pre-pay claims pending for cardiology',
]

export default function AssistantChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [stream, setStream] = useState<StreamItem[]>([])
  const [awaiting, setAwaiting] = useState<Awaiting | null>(null)
  const [confirming, setConfirming] = useState<Confirming | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // The surfaced interactive view (launchpad pick or agent present_view), shown
  // in the left workflow column. Null = chat-only mode.
  const [activeView, setActiveView] = useState<Directive | null>(null)
  // A cockpit action needs free input (amount/reason) — captured via the chat box.
  const [pendingInput, setPendingInput] = useState<PendingInput | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const qc = useQueryClient()

  // What the user is looking at, so the agent resolves "this case" from the
  // first message and can act on it. Derived from the mounted view.
  const context = useMemo(() => {
    if (activeView?.view === 'case' && activeView.params?.case_id) {
      return { active_case_id: Number(activeView.params.case_id), active_view: 'case' }
    }
    if (activeView?.view) return { active_view: activeView.view }
    return {}
  }, [activeView])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, stream, awaiting, confirming, error, loading])

  // A cockpit action needs a typed amount/reason — bring the prompt + input into
  // view and focus it so it's clear the case is waiting on the chat box.
  useEffect(() => {
    if (pendingInput) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [pendingInput])

  function dispatchView(d: Directive) { setActiveView(d) }
  function openCase(caseId: number) {
    setActiveView({ view: 'case', params: { case_id: caseId }, caption: 'Case' })
  }

  async function send(next: Message[]) {
    setLoading(true); setError(''); setStream([]); setAwaiting(null); setConfirming(null); setPendingInput(null); setSuggestions([])
    setMessages(next)
    try {
      const res = await fetch(`${API_BASE_URL}/api/assistant/chat/stream`, {
        method: 'POST',
        credentials: 'include', // Send httpOnly cookies
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: next, context }),
      })
      if (!res.ok || !res.body) throw new Error((await res.text().catch(() => '')) || `HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const frame = buf.slice(0, idx); buf = buf.slice(idx + 2)
          for (const line of frame.split('\n')) {
            if (!line.startsWith('data: ')) continue
            try { handleEvent(JSON.parse(line.slice(6))) } catch { /* ignore */ }
          }
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Assistant error. Try again.')
      setStream([])
    } finally {
      setLoading(false)
    }
  }

  function handleEvent(evt: any) {
    switch (evt.type) {
      case 'assistant_text':
        setStream((s) => [...s, { kind: 'text', text: evt.text }])
        break
      case 'tool_start':
        setStream((s) => [...s, { kind: 'tool', id: evt.id, name: evt.name, status: 'running' }])
        break
      case 'tool_end':
        setStream((s) => s.map((i) =>
          i.kind === 'tool' && i.id === evt.id
            ? { ...i, status: evt.ok ? 'done' : 'error', error: evt.error }
            : i))
        break
      case 'final':
        setMessages(evt.messages); setStream([]); setAwaiting(null)
        setSuggestions(Array.isArray(evt.suggestions) ? evt.suggestions : [])
        // A write may have changed the case — refresh the cockpit.
        qc.invalidateQueries({ queryKey: ['cockpit-case'] })
        break
      case 'directive':
        // Agent asked us to mount an interactive view (right drawer).
        if (evt.view) setActiveView({ view: evt.view, params: evt.params || {}, caption: evt.caption })
        break
      case 'awaiting_user':
        setMessages(evt.messages); setStream([])
        setAwaiting({ question: evt.question, options: evt.options || [], tool_use_id: evt.tool_use_id })
        break
      case 'awaiting_confirmation':
        setMessages(evt.messages); setStream([])
        setConfirming({
          summary: evt.summary || 'Apply this change?',
          preview: evt.preview, action: evt.action, tool_use_id: evt.tool_use_id,
        })
        break
      case 'error':
        setError(evt.error || 'Assistant error.'); setStream([])
        break
    }
  }

  function submit() {
    const text = input.trim()
    if (!text || loading) return
    // If a cockpit action is waiting on an amount/reason, capture it here.
    if (pendingInput) {
      const err = pendingInput.validate(text)
      if (err) { setError(err); return }
      const pi = pendingInput
      setInput(''); setPendingInput(null); setError('')
      setMessages((m) => [...m, { role: 'user', content: text }])
      setLoading(true)
      pi.run(text)
        .catch((e: any) => setError(e?.response?.data?.detail || e?.message || 'Action failed'))
        .finally(() => setLoading(false))
      return
    }
    setInput('')
    send([...messages, { role: 'user', content: text }])
  }

  function pickOption(option: string) {
    if (!awaiting || loading) return
    const next: Message[] = [
      ...messages,
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: awaiting.tool_use_id, content: option }] },
    ]
    setAwaiting(null)
    send(next)
  }

  // Confirm / cancel a proposed write from the chat path (text-prompt commands).
  // The backend executes ONLY on CONFIRMED.
  function respondConfirm(okConfirm: boolean) {
    if (!confirming || loading) return
    const next: Message[] = [
      ...messages,
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: confirming.tool_use_id, content: okConfirm ? 'CONFIRMED' : 'CANCELLED' }] },
    ]
    setConfirming(null)
    send(next)
  }

  // Append a short assistant narration line (local, not an LLM call).
  function narrate(text: string) { setMessages((m) => [...m, { role: 'assistant', content: text }]) }
  function refreshCockpit() { qc.invalidateQueries({ queryKey: ['cockpit-case'] }) }

  // Execute a cockpit pill inline. Actions needing free input (amount/reason)
  // capture it via the chat box (pendingInput); the rest run immediately.
  async function runCockpitAction(req: CockpitActionReq) {
    if (loading) return
    setPendingInput(null)  // a new action supersedes any unanswered prompt
    const actorId = sessionStorage.getItem('assistant_user_id') ?? ''
    const exec = async (fn: () => Promise<void>, done: string) => {
      setError(''); setLoading(true)
      try { await fn(); narrate(done); refreshCockpit() }
      catch (e: any) { setError(e?.response?.data?.detail || e?.message || 'Action failed') }
      finally { setLoading(false) }
    }
    const ask = (prompt: string, validate: (v: string) => string | null, run: (v: string) => Promise<void>) =>
      setPendingInput({ prompt, validate, run })

    switch (req.kind) {
      case 'accept_finding':
        return exec(() => api.acceptFinding(req.findingId!), `✓ Approved ${req.label}.`)
      case 'reject_finding':
        return ask(`Why are you denying ${req.label}? Type a brief reason.`, nonEmpty,
          async (r) => { await api.rejectFinding(req.findingId!, r.trim()); narrate(`Denied ${req.label}.`); refreshCockpit() })
      case 'adjust_finding':
        return ask(
          `Enter the corrected amount for ${req.label}${req.claimTotal != null ? ` (between $0 and ${money(req.claimTotal)})` : ''}.`,
          (v) => validateAmount(v, req.claimTotal),
          async (v) => { const n = parseAmount(v); await api.adjustFinding(req.findingId!, n, `Amount corrected to ${money(n)} via assistant`); narrate(`Corrected ${req.label} to ${money(n)}.`); refreshCockpit() })
      case 'take_ownership':
        return exec(async () => { await api.assignCase(req.caseId, actorId) }, 'Took ownership of the case.')
      case 'start_review':
        return exec(async () => { await api.transitionCase(req.caseId, 'in_review') }, 'Review started.')
      case 'adjudicate_without_837':
        return exec(() => api.adjudicateWithout837(req.caseId), 'Adjudicated without the 837.')
      case 'approve_recoverable':
        return exec(async () => { await api.transitionCase(req.caseId, 'ready_for_notice') }, 'Approved as recoverable — ready to send the notice.')
      case 'set_not_recoverable':
        return ask('Why is this not recoverable? Type a reason.', nonEmpty,
          async (r) => { await api.transitionCase(req.caseId, 'closed_not_for_recoup', r.trim()); narrate('Closed — not for recoup.'); refreshCockpit() })
      case 'send_notice':
        return exec(async () => { await api.transitionCase(req.caseId, 'notice_sent') }, 'Recoupment notice sent.')
      case 'supervisor_approve':
        return exec(() => api.approveCase(req.caseId), 'Approved the held decision.')
      case 'supervisor_reject':
        return ask('Reason for rejecting the decision?', nonEmpty,
          async (r) => { await api.rejectCase(req.caseId, r.trim()); narrate('Rejected — returned to the analyst.'); refreshCockpit() })
      case 'escalate':
        return ask('Reason for escalating to a supervisor?', nonEmpty,
          async (r) => { await api.escalateCase(req.caseId, r.trim()); narrate('Escalated to a supervisor.'); refreshCockpit() })
      case 'send_to_siu':
        return ask('Reason for sending this to SIU (fraud investigation)?', nonEmpty,
          async (r) => { await api.siuEscalate(req.caseUuid ?? '', r.trim()); narrate('Sent to SIU — evidence is now frozen.'); refreshCockpit() })
      case 'reopen':
        return ask('Reason for reopening this case?', nonEmpty,
          async (r) => { await api.reopenCase(req.caseId, r.trim()); narrate('Case reopened.'); refreshCockpit() })
      case 'record_recovery':
        return narrate('Open the full case to record a recovery.')
      default:
        return
    }
  }

  // Quick-action chips shown above the prompt box when a case is open. Action
  // chips run inline (reading caseUuid/claimTotal from the cockpit's cache);
  // analytical chips just ask the agent.
  function sendPrompt(text: string) { if (!loading) send([...messages, { role: 'user', content: text }]) }

  // Handle left nav quick action navigation
  function handleNavAction(action: string) {
    const prompts: Record<string, string> = {
      'high-priority': 'Show me my high-priority cases',
      'pending-review': 'Show me cases pending my review',
      'my-cases': 'Show my cases',
    }
    if (prompts[action]) sendPrompt(prompts[action])
  }
  function caseActionReq(kind: string, label: string): CockpitActionReq {
    const caseId = Number(context.active_case_id)
    const c = qc.getQueryData<CaseDetailLite>(['cockpit-case', caseId])
    return { kind, caseId, caseUuid: c?.case_id, label, claimTotal: c?.claim?.total_billed }
  }
  // Build dynamic quick actions based on context
  const caseQuickActions = [
    { label: 'My Case List', run: () => dispatchView({ view: 'worklist', params: { scope: 'mine' }, caption: 'Your assigned cases' }) },
    { label: 'Contact Provider', run: () => sendPrompt('Help me draft a message to send to the provider about this case.') },
    { label: 'Escalate', run: () => runCockpitAction(caseActionReq('escalate', 'Escalate')) },
    { label: 'Show Working Case', run: () => { /* Scroll to case view */ scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) } },
  ]

  // Add "Member Record" button if we have an active case with a member
  const caseId = Number(context.active_case_id)
  const caseData = caseId ? qc.getQueryData<CaseDetailLite>(['cockpit-case', caseId]) : null
  const memberName = caseData?.claim?.member?.name
  const memberNumber = caseData?.claim?.member?.member_id

  if (memberName && memberNumber) {
    caseQuickActions.push({
      label: 'Member Record',
      run: () => sendPrompt(`Show me ${memberName}'s ClearLink record (demographics, active diagnoses, medications, recent visits). Use member ID: ${memberNumber}`),
    })
  }

  const empty = messages.length === 0 && stream.length === 0 && !loading && !error

  // Tool_result blocks that answer an ask_user prompt render as the user's
  // pick; tool_result blocks that are real tool-execution output are internal
  // context and must NOT be shown (this is what dumped raw JSON into the chat).
  const askUserIds = new Set<string>()
  for (const m of messages) {
    if (m.role === 'assistant' && Array.isArray(m.content)) {
      for (const b of m.content) {
        if (b.type === 'tool_use' && b.name === 'ask_user') askUserIds.add(b.id)
      }
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <LeftNav onNavigate={handleNavAction} />
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
          {/* Anticipatory launchpad — always available at the top. */}
          <Launchpad onOpen={dispatchView} />

          {/* Mounted case / view — inline, single vertical column. */}
          {activeView && (
            <ViewSurface
              directive={activeView}
              onOpenCase={openCase}
              onClose={() => setActiveView(null)}
              onAction={runCockpitAction}
              busy={loading}
            />
          )}

          {empty && !activeView && (
              <div className="text-center mt-6">
                <div className="w-12 h-12 rounded-2xl bg-[#FE017D]/10 flex items-center justify-center mx-auto mb-3">
                  <Bot className="w-6 h-6 text-[#FE017D]" />
                </div>
                <h1 className="text-lg font-semibold text-gray-900">OPA Assistant</h1>
                <p className="text-sm text-gray-500 mt-1">Jump in above, or ask anything about your payment-integrity data.</p>
                <div className="mt-5 grid sm:grid-cols-2 gap-2 max-w-xl mx-auto">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send([...messages, { role: 'user', content: s }])}
                      className="text-left text-xs px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:border-[#FE017D]/40 hover:bg-[#FE017D]/5 text-gray-600">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => <MessageView key={i} message={m} askUserIds={askUserIds} />)}

            {stream.map((item, i) =>
              item.kind === 'text'
                ? <AssistantBubble key={i} text={item.text} />
                : <ToolLine key={i} name={item.name} status={item.status} error={item.error} />
            )}

            {loading && stream.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
              </div>
            )}

            {awaiting && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                <p className="text-sm text-gray-800 mb-2">{awaiting.question}</p>
                <div className="flex flex-wrap gap-2">
                  {awaiting.options.map((o) => (
                    <button key={o} onClick={() => pickOption(o)}
                      className="text-xs px-3 py-1.5 rounded-full border border-sky-300 bg-white hover:bg-sky-100 text-sky-800">
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Write gate — Confirm / Cancel a proposed change. */}
            {confirming && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5" /> Confirm change
                </p>
                <p className="text-sm text-gray-900 mt-1.5 font-medium">{confirming.summary}</p>
                {confirming.preview && <p className="text-xs text-amber-800 mt-1">{confirming.preview}</p>}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => respondConfirm(true)} disabled={loading}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#FE017D] text-white hover:bg-[#d4016a] disabled:opacity-50">Confirm</button>
                  <button onClick={() => respondConfirm(false)} disabled={loading}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{error}</span>
              </div>
            )}

            {/* Suggested follow-ups (from the model, stripped server-side) */}
            {!loading && !awaiting && suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send([...messages, { role: 'user', content: s }])}
                    className="text-xs px-3 py-1.5 rounded-full border border-[#FE017D]/30 bg-[#FE017D]/5 text-[#be185d] hover:bg-[#FE017D]/10 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Cockpit asked for an amount/reason — capture it in the input below. */}
            {pendingInput && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                <p className="text-sm text-gray-800">{pendingInput.prompt}</p>
                <button onClick={() => { setPendingInput(null); setError('') }}
                  className="mt-2 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            )}
          </div>
        </div>

      {/* Input — floating above the bottom with elevated styling */}
      <div className="bg-gradient-to-b from-transparent via-white/80 to-white pb-4 pt-8">
        {/* Case quick-actions — shown above the prompt box while a case is open. */}
        {activeView?.view === 'case' && context.active_case_id && (
          <div className="max-w-2xl mx-auto px-4 mb-2 flex flex-wrap gap-1.5">
            {caseQuickActions.map((q) => (
              <button key={q.label} onClick={q.run} disabled={loading}
                className="text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-700 hover:border-[#FE017D]/40 hover:bg-[#FE017D]/5 disabled:opacity-40 transition-colors">
                {q.label}
              </button>
            ))}
          </div>
        )}
        <div className="max-w-2xl mx-auto px-4 flex items-end gap-2.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            placeholder={pendingInput ? 'Type your answer…' : 'Ask about cases, claims, providers, or metrics…'}
            rows={1}
            disabled={loading}
            className="flex-1 resize-none text-sm border border-gray-200 rounded-2xl px-4 py-3 max-h-40 focus:outline-none focus:ring-2 focus:ring-[#FE017D]/30 focus:border-[#FE017D] disabled:bg-gray-50 bg-white shadow-sm"
          />
          <button onClick={submit} disabled={loading || !input.trim()}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-[#FE017D] text-white disabled:opacity-40 hover:bg-[#d4016a] active:scale-95 transition-all shadow-md hover:shadow-lg flex items-center justify-center">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Rendering helpers ──────────────────────────────────────────────────────
function MessageView({ message, askUserIds }: { message: Message; askUserIds: Set<string> }) {
  if (message.role === 'user') {
    if (typeof message.content === 'string') return <UserBubble text={message.content} />
    // Only render a tool_result as the user's pick when it answers an ask_user
    // prompt. Real tool-execution output is internal — never paint it.
    const tr = message.content.find((b) => b.type === 'tool_result') as
      | Extract<ContentBlock, { type: 'tool_result' }> | undefined
    if (tr && askUserIds.has(tr.tool_use_id)) return <UserBubble text={tr.content} />
    return null
  }
  const blocks = Array.isArray(message.content) ? message.content : [{ type: 'text', text: message.content } as ContentBlock]
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === 'text' && b.text) return <AssistantBubble key={i} text={b.text} />
        if (b.type === 'tool_use') return <ToolLine key={i} name={b.name} status="done" />
        return null
      })}
    </>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] bg-[#FE017D] text-white text-sm rounded-2xl rounded-br-sm px-3 py-2 whitespace-pre-wrap">
        {text}
      </div>
    </div>
  )
}

function AssistantBubble({ text }: { text: string }) {
  // Remove markup that shouldn't be visible to users
  const cleanedText = sanitizeAssistantOutput(text)

  return (
    <div className="max-w-[92%] bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-gray-800 prose prose-sm max-w-none prose-p:my-1 prose-headings:my-1.5 prose-ul:my-1 prose-li:my-0">
      {HTML_CARD.test(cleanedText)
        ? <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cleanedText) }} />
        : (
          /* remark-gfm → GFM tables/strikethrough; rehype-raw → inline HTML like <br> */
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{cleanedText}</ReactMarkdown>
        )}
    </div>
  )
}

function ToolLine({ name, status, error }: { name: string; status: 'running' | 'done' | 'error'; error?: string }) {
  // Determine label and styling
  const isError = status === 'error'
  const isRunning = status === 'running'
  const label = isRunning ? 'Calling' : isError ? 'Failed to contact' : 'Called'

  return (
    <div className="flex items-center gap-2 text-[11px] text-gray-400 pl-1" title={error || ''}>
      {isRunning
        ? <Loader2 className="w-3 h-3 animate-spin" />
        : <Wrench className={`w-3 h-3 ${isError ? 'text-red-400' : ''}`} />}
      <span className={isError ? 'text-red-400' : ''}>
        {label} <span className="font-mono">{name}</span>
      </span>
    </div>
  )
}
