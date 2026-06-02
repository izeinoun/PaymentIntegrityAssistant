import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import DemoGate from './DemoGate'
import './index.css'

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: false },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <DemoGate>
        <App />
      </DemoGate>
    </QueryClientProvider>
  </React.StrictMode>,
)
