import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import LoginPage from './pages/LoginPage'
import { JWT_TOKEN_KEY } from './api/client'
import './index.css'

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: false },
  },
})

function Root() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem(JWT_TOKEN_KEY))

  useEffect(() => {
    // Update auth state if token changes (e.g., logout on 401)
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem(JWT_TOKEN_KEY))
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

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
