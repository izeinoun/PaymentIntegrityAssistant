// Mirrors the User shape returned by the unified backend's /api/users.
export interface User {
  id: string
  name: string
  username: string | null
  email: string | null
  role: string
  is_active: boolean
  roles: string[]
  apps: string[]
}
