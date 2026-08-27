import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './services/supabase/client'
import './styles/globals.css'
import App from './app/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
