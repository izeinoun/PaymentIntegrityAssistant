import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Loader2, AlertCircle } from 'lucide-react'
import { api } from '../../api'
import type { DailyBriefing } from '../../api/types'

const BRAND = '#FE017D'

function money(n?: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function trend(value: number): { label: string; color: string; icon: React.ReactNode } {
  if (value > 5) return { label: `↑ ${value.toFixed(1)}%`, color: 'text-green-600', icon: <TrendingUp className="w-4 h-4" /> }
  if (value < -5) return { label: `↓ ${Math.abs(value).toFixed(1)}%`, color: 'text-red-600', icon: <TrendingDown className="w-4 h-4" /> }
  return { label: `→ ${Math.abs(value).toFixed(1)}%`, color: 'text-gray-500', icon: null }
}

export default function BriefingLandingPage() {
  const { data: briefing, isLoading, error } = useQuery({
    queryKey: ['daily-briefing'],
    queryFn: () => api.dailyBriefing('day'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500">Loading your daily briefing…</p>
        </div>
      </div>
    )
  }

  if (error || !briefing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="max-w-md w-full mx-auto">
          <div className="flex gap-3 items-start bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-red-900">Unable to load briefing</h3>
              <p className="text-xs text-red-700 mt-1">{error instanceof Error ? error.message : 'An error occurred'}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { personal_stats, trends, team_comparison, high_value_cases } = briefing
  const casesClosed = trend(trends.cases_closed_vs_previous.percent_change)
  const recoveredTrend = trend(trends.dollars_recovered_vs_previous.percent_change)
  const handleTimeTrend = trend(trends.handle_time_vs_previous.percent_change)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Good morning</h1>
          <p className="text-gray-600 mt-2">Here's your daily briefing</p>
        </div>

        {/* Personal Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Cases closed</p>
            <div className="flex items-baseline gap-3">
              <p className="text-3xl font-bold text-gray-900">{personal_stats.cases_closed}</p>
              <div className={`flex items-center gap-1 text-sm font-semibold ${casesClosed.color}`}>
                {casesClosed.icon}
                {casesClosed.label}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">vs yesterday: {trends.cases_closed_vs_previous.previous}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Recovered</p>
            <div className="flex items-baseline gap-3">
              <p className="text-3xl font-bold text-gray-900">{money(personal_stats.dollars_recovered)}</p>
              <div className={`flex items-center gap-1 text-sm font-semibold ${recoveredTrend.color}`}>
                {recoveredTrend.icon}
                {recoveredTrend.label}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">vs yesterday: {money(trends.dollars_recovered_vs_previous.previous)}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Current workload</p>
            <p className="text-3xl font-bold text-gray-900">{personal_stats.current_workload_count}</p>
            <p className="text-xs text-gray-500 mt-3">active cases assigned</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Avg handle time</p>
            <div className="flex items-baseline gap-3">
              <p className="text-3xl font-bold text-gray-900">{personal_stats.avg_handle_time_days?.toFixed(1) ?? '—'}</p>
              <span className="text-xs text-gray-500">days</span>
            </div>
            <div className={`flex items-center gap-1 text-sm font-semibold mt-3 ${handleTimeTrend.color}`}>
              {handleTimeTrend.icon}
              {handleTimeTrend.label}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Team Comparison */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">You vs Team</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-gray-600">Cases closed</p>
                  <span className="text-sm font-semibold text-gray-900">{personal_stats.cases_closed} / {team_comparison.team_avg_cases_closed.toFixed(1)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (personal_stats.cases_closed / Math.max(personal_stats.cases_closed, team_comparison.team_avg_cases_closed)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-gray-600">Recovery amount</p>
                  <span className="text-sm font-semibold text-gray-900">{money(personal_stats.dollars_recovered)} / {money(team_comparison.team_avg_dollars_recovered)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (personal_stats.dollars_recovered / Math.max(personal_stats.dollars_recovered, team_comparison.team_avg_dollars_recovered)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-gray-600">Avg handle time</p>
                  <span className="text-sm font-semibold text-gray-900">{personal_stats.avg_handle_time_days?.toFixed(1) ?? '—'} / {team_comparison.team_avg_handle_time.toFixed(1)} days</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, ((team_comparison.team_avg_handle_time - (personal_stats.avg_handle_time_days ?? 0)) / team_comparison.team_avg_handle_time) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">{personal_stats.avg_handle_time_days && personal_stats.avg_handle_time_days < team_comparison.team_avg_handle_time ? 'Faster than team average' : 'Slower than team average'}</p>
              </div>
            </div>
          </div>

          {/* High-Value Cases */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Priority work queue</h2>
            {!high_value_cases.length ? (
              <p className="text-sm text-gray-500">No high-priority cases right now</p>
            ) : (
              <ul className="space-y-3">
                {high_value_cases.map((c, i) => (
                  <li key={c.case_id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-700">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <p className="font-mono font-semibold text-gray-900">{c.case_number}</p>
                        <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">Priority: {c.priority_score.toFixed(1)}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {c.claim?.rendering_provider?.name || 'Unknown provider'}
                        {c.claim?.member?.name && ` · ${c.claim.member.name}`}
                      </p>
                      {c.amount_at_risk != null && <p className="text-sm font-semibold text-gray-900 mt-2">{money(c.amount_at_risk)} at risk</p>}
                      <p className="text-xs text-gray-500 mt-2">{c.status.replace(/_/g, ' ')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
