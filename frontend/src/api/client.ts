import axios from 'axios'
import { API_BASE_URL } from '../config/appUrls'

// API base lives in config/appUrls (committed, switches by build mode).
export { API_BASE_URL }

export const ACTOR_KEY = 'assistant.currentUserId'
export const DEMO_TOKEN_KEY = 'opa_demo_token'

export const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// The unified backend's RBAC deps read X-User-Id. We persist the chosen actor
// in localStorage so the choice survives reloads.
client.interceptors.request.use((config) => {
  const userId = localStorage.getItem(ACTOR_KEY)
  if (userId) config.headers['X-User-Id'] = userId
  // Demo gate: attach the login token when present (no-op when gate disabled).
  const token = localStorage.getItem(DEMO_TOKEN_KEY)
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

// Gate rejected us (expired/missing token) — drop it and return to login.
// Skip /auth/* so a wrong-password 401 can surface its message.
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err.config?.url ?? ''
    if (err.response?.status === 401 && !url.includes('/auth/')) {
      localStorage.removeItem(DEMO_TOKEN_KEY)
      window.location.reload()
    }
    return Promise.reject(err)
  },
)
