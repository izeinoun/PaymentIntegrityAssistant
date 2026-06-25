import { AlertCircle, CheckCircle } from 'lucide-react'

export default function EnvironmentBanner() {
  const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
  const isProd = isProduction || import.meta.env.VITE_ENVIRONMENT === 'production'

  if (!isProd && import.meta.env.VITE_ENVIRONMENT !== 'production') {
    // Development
    return (
      <div className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-semibold">DEVELOPMENT</span>
        </div>
        <span className="text-xs opacity-90">localhost:{window.location.port || '5179'}</span>
      </div>
    )
  }

  // Production
  return (
    <div className="w-full bg-gradient-to-r from-red-700 to-red-800 text-white px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm font-bold">⚠️ PRODUCTION</span>
      </div>
      <span className="text-xs opacity-90">Be careful with your actions</span>
    </div>
  )
}
