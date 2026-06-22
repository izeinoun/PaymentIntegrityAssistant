// Mounts the assistant-native view named by a render directive (from a launchpad
// button or the agent's present_view). The surfaced view sits inline in the
// assistant shell; the prompt box stays available below.
import { X, LayoutGrid } from 'lucide-react'
import type { Directive } from '../api/types'
import WorklistMini from './views/WorklistMini'
import CaseCockpit from './views/CaseCockpit'
import MyDashboardView from './views/MyDashboardView'

interface Props {
  directive: Directive
  onOpenCase: (caseId: number) => void
  onClose: () => void
}

const TITLES: Record<string, string> = {
  worklist: 'Cases',
  case: 'Case',
  my_dashboard: 'My dashboard',
}

export default function ViewSurface({ directive, onOpenCase, onClose }: Props) {
  const { view, params = {}, caption } = directive
  const caseId = Number(params.case_id)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-2 min-w-0">
          <LayoutGrid className="w-4 h-4 text-[#FE017D] flex-shrink-0" />
          <p className="text-sm font-semibold text-gray-800 truncate">
            {caption || TITLES[view] || 'View'}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 flex-shrink-0" aria-label="Close view">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4">
        {view === 'worklist' && <WorklistMini params={params} onOpenCase={onOpenCase} />}
        {view === 'case' && (
          Number.isFinite(caseId)
            ? <CaseCockpit caseId={caseId} onOpenCase={onOpenCase} />
            : <p className="text-sm text-gray-400">No case id provided.</p>
        )}
        {view === 'my_dashboard' && <MyDashboardView params={params} />}
        {!['worklist', 'case', 'my_dashboard'].includes(view) && (
          <p className="text-sm text-gray-400">Unknown view: {String(view)}</p>
        )}
      </div>
    </div>
  )
}
