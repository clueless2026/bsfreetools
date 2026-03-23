import { Building, FileText, LayoutDashboard, Receipt, Store, Users } from 'lucide-react'
import { useDateContext } from '../../context/useDateContext'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'properties', label: 'Properties', icon: Building },
  { id: 'tenants', label: 'Tenants', icon: Users },
  { id: 'ledger', label: 'Ledger', icon: Receipt },
  { id: 'reports', label: 'Profit & Loss', icon: FileText },
  { id: 'vendors', label: 'Vendors', icon: Store },
]

function Navbar({ activeView, onNavigate }) {
  const { month, year, setMonth, setYear } = useDateContext()

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #2f3c4f',
        backgroundColor: '#0f172a',
      }}
    >
      <nav style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                border: `1px solid ${isActive ? '#2563eb' : '#334155'}`,
                backgroundColor: isActive ? '#1e3a8a' : '#111827',
                color: '#e2e8f0',
                cursor: 'pointer',
              }}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          color: '#e2e8f0',
        }}
      >
        <label>
          Month{' '}
          <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((monthValue) => (
              <option key={monthValue} value={monthValue}>
                {monthValue}
              </option>
            ))}
          </select>
        </label>

        <label>
          Year{' '}
          <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {Array.from({ length: 11 }, (_, index) => year - 5 + index).map((yearValue) => (
              <option key={yearValue} value={yearValue}>
                {yearValue}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  )
}

export default Navbar
