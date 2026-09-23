import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import '../services/supabase/client'
import '../styles/globals.css'
import './globalAdmin.css'
import '../features/admin/admin.css'
import { GlobalAdminApp } from './GlobalAdminApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalAdminApp />
  </StrictMode>,
)
