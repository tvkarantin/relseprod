import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/geist/cyrillic-400.css'
import '@fontsource/geist/cyrillic-500.css'
import '@fontsource/geist/cyrillic-600.css'
import '@fontsource/geist/cyrillic-700.css'
import '@fontsource/geist/latin-400.css'
import '@fontsource/geist/latin-500.css'
import '@fontsource/geist/latin-600.css'
import '@fontsource/geist/latin-700.css'

import { App } from './App'
import { installLandingHeroPointer } from './landingHeroPointer'
import { createQueryClient } from './queryClient'
import './styles.css'
import './styles/monitoring.css'
import './styles/landing.css'
import './styles/library-fixes.css'
import './styles/realsflow-theme.css'
import './styles/ui-cleanups.css'
import './styles/archive-one-theme.css'
import './styles/landing-motion-fixes.css'
import './styles/landing-v2.css'
import './styles/product-scale.css'
import './styles/landing-v3.css'
import './styles/landing-v4.css'

import { ToastProvider } from '@/components/feedback/ToastProvider'
import { NotificationProvider } from '@/components/notifications/NotificationProvider'

const container = document.getElementById('root')
if (!container) throw new Error('Root container #root not found')

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <BrowserRouter>
        <NotificationProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </NotificationProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)

installLandingHeroPointer()
