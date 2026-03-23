import { useState } from 'react'
import './index.css'
import Navbar from './components/layout/Navbar'
import Dashboard from './pages/Dashboard'
import Properties from './pages/Properties'
import Tenants from './pages/Tenants'
import Ledger from './pages/Ledger'
import Reports from './pages/Reports'
import Vendors from './pages/Vendors'

function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [tenantPropertyFilterId, setTenantPropertyFilterId] = useState('')

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#020617', color: '#e2e8f0' }}>
      <Navbar activeView={activeView} onNavigate={setActiveView} />

      <main>
        {activeView === 'dashboard' && <Dashboard />}
        {activeView === 'properties' && (
          <Properties
            onOpenPropertyTenants={(propertyId) => {
              setTenantPropertyFilterId(propertyId)
              setActiveView('tenants')
            }}
          />
        )}
        {activeView === 'tenants' && (
          <Tenants
            preselectedPropertyId={tenantPropertyFilterId}
            onClearPreselectedProperty={() => setTenantPropertyFilterId('')}
          />
        )}
        {activeView === 'ledger' && <Ledger />}
        {activeView === 'reports' && <Reports />}
        {activeView === 'vendors' && <Vendors />}
      </main>
    </div>
  )
}

export default App
