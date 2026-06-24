// Case-level action pills for the cockpit, driven by guidance.actions (server-
// defined). Recommended = pink; caution = amber; disabled shows a tooltip.
// Irreversible actions (send notice, supervisor approve) ask for an explicit
// Confirm / Cancel before firing — they never auto-revert.
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { CaseAction } from '../api/types'

const BRAND = '#FE017D'
// Actions that fire immediately on click get an explicit confirm step.
const CONFIRM_KINDS = new Set(['send_notice', 'supervisor_approve'])

function cls(a: CaseAction): string {
  const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  if (!a.enabled) return `${base} border border-gray-200 text-gray-400 bg-gray-50`
  if (a.style === 'primary') return `${base} text-white`
  if (a.style === 'caution') return `${base} border border-amber-300 text-amber-700 hover:bg-amber-50`
  return `${base} border border-gray-200 text-gray-700 hover:bg-gray-50`
}

export default function CockpitActionBar({ actions, onAct, busy }: {
  actions: CaseAction[]
  onAct: (a: CaseAction) => void
  busy?: boolean
}) {
  const [armed, setArmed] = useState<string | null>(null)
  if (!actions?.length) return null

  function click(a: CaseAction) {
    if (!a.enabled || busy) return
    if (CONFIRM_KINDS.has(a.kind)) { setArmed(a.kind); return }  // ask first
    onAct(a)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {actions.map((a) => {
        // Armed (awaiting confirm): show an explicit Confirm + Cancel, persistent.
        if (armed === a.kind) {
          return (
            <span key={a.kind} className="inline-flex items-center gap-1">
              <button
                onClick={() => { setArmed(null); onAct(a) }}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500 text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Confirm: {a.label}
              </button>
              <button onClick={() => setArmed(null)} className="text-xs text-gray-500 hover:text-gray-700 px-1.5">
                Cancel
              </button>
            </span>
          )
        }
        return (
          <button
            key={a.kind}
            onClick={() => click(a)}
            disabled={!a.enabled || busy}
            title={!a.enabled ? (a.disabled_reason ?? '') : a.label}
            className={cls(a)}
            style={a.enabled && a.style === 'primary' ? { backgroundColor: BRAND } : undefined}
          >
            {busy && a.recommended ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {a.label}
          </button>
        )
      })}
    </div>
  )
}
