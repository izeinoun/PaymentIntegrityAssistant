import { useState } from 'react'
import { Menu, X, Clock, Flame, ListChecks, Eye } from 'lucide-react'

const BRAND = '#FE017D'

interface Props {
  onNavigate?: (action: string) => void
}

export default function LeftNav({ onNavigate }: Props) {
  const [open, setOpen] = useState(true)

  const quickLinks = [
    { icon: Flame, label: 'My High-Priority', action: 'high-priority' },
    { icon: Eye, label: 'Pending Review', action: 'pending-review' },
    { icon: ListChecks, label: 'My Cases', action: 'my-cases' },
  ]

  return (
    <>
      {/* Toggle button — always visible, below top bar */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed left-4 top-24 z-50 p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        title={open ? 'Hide sidebar' : 'Show sidebar'}
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <nav
        className={`fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 shadow-lg transition-transform duration-300 ease-in-out z-40 overflow-y-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 pt-16">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Navigation</h2>
            <div className="w-12 h-1 rounded-full" style={{ backgroundColor: BRAND }} />
          </div>

          {/* Quick Links */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => {
                const Icon = link.icon
                return (
                  <li key={link.action}>
                    <button
                      onClick={() => {
                        onNavigate?.(link.action)
                        setOpen(false)
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent text-gray-700 hover:border-[#FE017D]/30 hover:bg-[#FE017D]/5 transition-colors text-sm"
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: BRAND }} />
                      <span>{link.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Chat History — Placeholder */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Chat History</h3>
            <div className="px-3 py-4 rounded-lg border border-gray-200 bg-gray-50 text-center">
              <Clock className="w-5 h-5 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Coming soon</p>
              <p className="text-[11px] text-gray-300 mt-1">Save and restore chat sessions</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-6" />

          {/* Footer info */}
          <div className="text-[11px] text-gray-400 space-y-2">
            <p>Tip: Use quick actions to jump to common tasks.</p>
          </div>
        </div>
      </nav>

      {/* Overlay — closes sidebar on mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  )
}
