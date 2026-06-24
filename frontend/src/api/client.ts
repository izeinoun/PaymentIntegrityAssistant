import axios from 'axios'
import { API_BASE_URL } from '../config/appUrls'

// API base lives in config/appUrls (committed, switches by build mode).
export { API_BASE_URL }

export const JWT_TOKEN_KEY = 'opa_jwt_token'

export const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token from localStorage to all requests
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(JWT_TOKEN_KEY)
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// On 401, clear token and reload to show login page
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err.config?.url ?? ''
    if (err.response?.status === 401 && !url.includes('/auth/')) {
      localStorage.removeItem(JWT_TOKEN_KEY)
      window.location.reload()
    }
    return Promise.reject(err)
  },
)
