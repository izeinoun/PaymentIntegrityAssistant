import { Bot, LogOut } from 'lucide-react'
import { JWT_TOKEN_KEY } from './api/client'
import AppSwitcher from './components/AppSwitcher'
import AssistantChat from './components/AssistantChat'

export default function App() {

  const handleLogout = () => {
    localStorage.removeItem(JWT_TOKEN_KEY)
    localStorage.removeItem('assistant_user_id')
    window.location.reload()
  }

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
            <p className="text-[10px] text-gray-400">Answers + actions · confirms before changes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AppSwitcher />
          <button
            onClick={handleLogout}
            title="Sign out"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden lg:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <AssistantChat />
    </div>
  )
}
