// Assistant-native personal dashboard — stat tiles from /api/dashboard/me.
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import { api } from '../../api'
import { appUrl } from '../../config/appUrls'

function money(n?: number | null): string {
  if (n == null) return '$0'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-gray-200 rounded-xl px-4 py-3 min-w-[120px]">
      <p className="text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  )
}

interface Props {
  params?: { period?: 'week' | 'month' | 'quarter' }
}

export default function MyDashboardView({ params }: Props) {
  const period = params?.period ?? 'month'
  const { data, isLoading, error } = useQuery({
    queryKey: ['cockpit-my-dashboard', period],
    queryFn: () => api.myDashboard(period),
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-8 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading dashboard…
      </div>
    )
  }
  if (error || !data) {
    return <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">Failed to load dashboard.</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">This {period}</span>
        <a href={appUrl('payguard')} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#FE017D]">
          Open in PayGuard <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Tile label="Active cases" value={data.pipeline_total_active ?? 0} />
        <Tile label="Closed" value={data.cases_closed ?? 0} />
        <Tile label="Recovered" value={money(data.dollars_recovered)} />
        <Tile label="Written off" value={money(data.dollars_written_off)} />
        {data.avg_handle_time_days != null && (
          <Tile label="Avg handle" value={`${data.avg_handle_time_days.toFixed(1)}d`} />
        )}
      </div>

      {!!data.pipeline_snapshot?.length && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">Active pipeline</p>
          <div className="flex flex-wrap gap-1.5">
            {data.pipeline_snapshot.map((s) => (
              <span key={s.status} className="px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700">
                {s.status.replace(/_/g, ' ')} <strong>{s.count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
