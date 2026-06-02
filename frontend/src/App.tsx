import { useQuery } from '@tanstack/react-query'
import { Bot } from 'lucide-react'
import { api } from './api'
import ActorPicker from './components/ActorPicker'
import AppSwitcher from './components/AppSwitcher'
import AssistantChat from './components/AssistantChat'

export default function App() {
  const usersQ = useQuery({ queryKey: ['users'], queryFn: api.listUsers })

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#FE017D]/10 flex items-center justify-center">
            <Bot className="w-4.5 h-4.5 text-[#FE017D]" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-gray-900">OPA Assistant</p>
            <p className="text-[10px] text-gray-400">Read-only · answers from your data</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AppSwitcher />
          {usersQ.data && usersQ.data.length > 0 && <ActorPicker users={usersQ.data} />}
        </div>
      </header>

      <AssistantChat />
    </div>
  )
}
