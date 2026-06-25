import axios from 'axios'
import { API_BASE_URL } from '../config/appUrls'

// API base lives in config/appUrls (committed, switches by build mode).
export { API_BASE_URL }

export const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Include cookies in all requests
})

// On 401, reload to show login page (cookie was cleared server-side)
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err.config?.url ?? ''
    if (err.response?.status === 401 && !url.includes('/auth/')) {
      window.location.reload()
    }
    return Promise.reject(err)
  },
)
