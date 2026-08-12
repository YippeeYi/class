import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import { App } from '@/app'
import { AuthProvider } from '@/features/auth/auth-context'
import { installRecordJumpGuard } from '@/lib/record-navigation'
import '@/styles/tailwind.css'

const container = document.getElementById('root')
if (!container) throw new Error('React root element was not found.')

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

installRecordJumpGuard()

createRoot(container).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
