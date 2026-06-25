import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import LoginPage from './pages/LoginPage'
import { initAuth } from './services/authService'
import './index.css'

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: false },
  },
})

function Root() {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Check if user is already logged in via cookie on mount
    initAuth({
      onAuthChange: (user) => {
        setIsAuthenticated(!!user)
      },
    }).then((user) => {
      setIsAuthenticated(!!user)
      setIsLoading(false)
    })
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={qc}>
      {isAuthenticated ? (
        <App />
      ) : (
        <LoginPage onSuccess={() => setIsAuthenticated(true)} />
      )}
    </QueryClientProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
