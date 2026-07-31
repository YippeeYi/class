import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from '@/app'
import { AuthProvider } from '@/features/auth/auth-context'
import '@/styles/tailwind.css'

const container = document.getElementById('root')
if (!container) throw new Error('React root element was not found.')

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
