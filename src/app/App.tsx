import { BrowserRouter } from 'react-router-dom'
import { AuthGate } from '../components/AuthGate'
import { AppShell } from '../layouts/AppShell'
import { AppRoutes } from './AppRoutes'
import '../styles/mobile.css'

function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </AuthGate>
    </BrowserRouter>
  )
}

export default App
