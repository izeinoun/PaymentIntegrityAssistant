import { client } from './client'
import type { User } from './types'

export const api = {
  async listUsers(): Promise<User[]> {
    const { data } = await client.get<User[]>('/api/users')
    return data
  },
}
