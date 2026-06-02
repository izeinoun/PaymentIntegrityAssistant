// Shared-login gate for the demo deployment. When the unified backend reports
// the gate is enabled (DEMO_PASSWORD set) and no token is stored, show a
// password screen; on success store the token (the axios client attaches it).
// When the gate is disabled (local dev), render children immediately.
// Inline styles so it works regardless of the app's CSS/Tailwind setup.
import { useEffect, useState, type FormEvent, type ReactNode, type CSSProperties } from 'react'
import { Lock } from 'lucide-react'
import { client, DEMO_TOKEN_KEY } from './api/client'

const PINK = '#FE017D'

export default function DemoGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<'checking' | 'locked' | 'open'>('checking')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    client.get('/api/auth/status')
      .then((res) => {
        if (cancelled) return
        if (!res.data?.gate_enabled) { setPhase('open'); return }
        setPhase(localStorage.getItem(DEMO_TOKEN_KEY) ? 'open' : 'locked')
      })
      .catch(() => { if (!cancelled) setPhase('open') }) // fail open for dev/offline
    return () => { cancelled = true }
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true); setError('')
    try {
      const res = await client.post('/api/auth/login', { password })
      localStorage.setItem(DEMO_TOKEN_KEY, res.data.token)
      setPhase('open')
    } catch (err: any) {
      setError(err?.response?.status === 401 ? 'Incorrect password' : 'Login failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (phase === 'checking') {
    return <div style={center}><span style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</span></div>
  }
  if (phase === 'locked') {
    return (
      <div style={center}>
        <form onSubmit={submit} style={card}>
          <div style={iconWrap}><Lock size={20} color={PINK} /></div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>OPA Assistant — Demo</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4, marginBottom: 20 }}>Enter the demo password to continue.</p>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoFocus placeholder="Password" style={input}
          />
          {error && <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 12px' }}>{error}</p>}
          <button type="submit" disabled={submitting || !password}
            style={{ ...button, opacity: submitting || !password ? 0.4 : 1 }}>
            {submitting ? 'Entering…' : 'Enter'}
          </button>
        </form>
      </div>
    )
  }
  return <>{children}</>
}

const center: CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', padding: 16 }
const card: CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', padding: 32, width: '100%', maxWidth: 360 }
const iconWrap: CSSProperties = { width: 40, height: 40, borderRadius: 12, background: 'rgba(254,1,125,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', marginBottom: 12, outline: 'none' }
const button: CSSProperties = { width: '100%', background: PINK, color: '#fff', fontSize: 14, fontWeight: 500, border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer' }
