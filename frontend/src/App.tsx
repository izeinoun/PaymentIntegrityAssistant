import { useEffect, useState } from 'react'
import { Bot, LogOut } from 'lucide-react'
import { logout, getCurrentUser, type User } from './services/authService'
import AppSwitcher from './components/AppSwitcher'
import AssistantChat from './components/AssistantChat'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    // Fetch current user on mount
    getCurrentUser().then(setUser)
  }, [])

  const handleLogout = async () => {
    console.log('[Logout] Button clicked')
    setIsLoggingOut(true)
    try {
      console.log('[Logout] Calling logout function')
      await logout()
      console.log('[Logout] Logout succeeded, redirecting...')
      // Force full page reload to clear all state
      window.location.href = '/'
    } catch (err) {
      console.error('[Logout] Logout failed:', err)
      // Even if logout fails, clear local state and redirect
      console.log('[Logout] Redirecting anyway after error')
      window.location.href = '/'
    }
  }

  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

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

        {/* Center environment label */}
        <div className={`flex-1 text-center text-sm font-semibold ${isDev ? 'text-green-600' : 'text-red-600'}`}>
          {isDev ? 'DEVELOPMENT' : 'PRODUCTION'}
        </div>

        <div className="flex items-center gap-3">
          <AppSwitcher />
          {user && (
            <div className="flex items-center gap-3 px-3 py-1 rounded-lg bg-gray-100">
              <span className="text-sm text-gray-700 font-medium">{user.full_name}</span>
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                {user.full_name.split(' ').map(n => n[0]).join('')}
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            title="Sign out"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden lg:inline">{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
          </button>
        </div>
      </header>

      <AssistantChat />
    </div>
  )
}
