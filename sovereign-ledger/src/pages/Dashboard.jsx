import { AlertTriangle, BarChart3, Coins, Settings2, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { ProprietaryFooter } from '../components/ProprietaryFooter'
import { useDisableContextMenu } from '../hooks/useDisableContextMenu'
import { useDataContext } from '../context/useDataContext'
import { useDateContext } from '../context/useDateContext'
import { downloadTextFile } from '../lib/csvExport'
import {
  ledgerToCsv,
  propertiesToCsv,
  tenantsToCsv,
} from '../lib/megaCsvExport'
import { normalizeLedgerData } from '../lib/normalizeLedgerData'
import { computePAndL } from '../lib/businessLogic'

function formatCurrency(cents) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

function ymFromDate(value) {
  return value ? value.slice(0, 7) : null
}

function getExpectedRent(tenant, monthKey) {
  if (
    tenant.scheduled_increase?.effective_date &&
    ymFromDate(tenant.scheduled_increase.effective_date) <= monthKey
  ) {
    return tenant.scheduled_increase.new_rent_cents
  }
  return tenant.current_rent_cents ?? 0
}

function getExpectedCam(tenant, monthKey) {
  if (
    tenant.cam_effective_date &&
    tenant.future_cam_cents !== null &&
    tenant.future_cam_cents !== undefined &&
    ymFromDate(tenant.cam_effective_date) <= monthKey
  ) {
    return tenant.future_cam_cents
  }
  return tenant.current_cam_cents ?? 0
}

function Dashboard() {
  useDisableContextMenu(true)
  const { data, setData } = useDataContext()
  const { month, year } = useDateContext()
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [adminOpen, setAdminOpen] = useState(false)
  const importInputRef = useRef(null)
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const scopedTransactions = useMemo(
    () =>
      data.transactions.filter((transaction) =>
        selectedPropertyId ? transaction.property_id === selectedPropertyId : true,
      ),
    [data.transactions, selectedPropertyId],
  )
  const baseTotals = computePAndL(scopedTransactions, month, year)
  const scopedProperties = selectedPropertyId
    ? data.properties.filter((property) => property.id === selectedPropertyId)
    : data.properties
  const scopedPropertyIds = new Set(scopedProperties.map((property) => property.id))
  const scopedTenantRows = data.tenants
    .map((tenant) => {
      const unit = data.units.find((candidate) => candidate.id === tenant.unit_id)
      const property = unit
        ? data.properties.find((candidate) => candidate.id === unit.property_id)
        : null
      return { tenant, unit, property }
    })
    .filter(({ property }) => property && scopedPropertyIds.has(property.id))

  const expectedCamTotal = scopedTenantRows.reduce(
    (sum, row) => sum + getExpectedCam(row.tenant, monthKey),
    0,
  )
  const fixedHoldingCosts = scopedProperties.reduce(
    (sum, property) =>
      sum +
      (property.property_tax_cents ?? 0) +
      (property.insurance_cents ?? 0),
    0,
  )
  const totals = {
    income: baseTotals.income + expectedCamTotal,
    expenses: baseTotals.expenses,
    pandl: baseTotals.pandl + expectedCamTotal,
    cashFlow: baseTotals.cashFlow + expectedCamTotal - fixedHoldingCosts,
  }
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() + 45)
  const cutoffIso = cutoff.toISOString().slice(0, 10)

  const leaseAlerts = data.tenants
    .filter((tenant) => {
      if (!tenant.lease_end || tenant.lease_end < todayIso || tenant.lease_end > cutoffIso) {
        return false
      }
      const unit = data.units.find((candidate) => candidate.id === tenant.unit_id)
      return unit ? scopedPropertyIds.has(unit.property_id) : false
    })
    .map((tenant) => {
      const unit = data.units.find((candidate) => candidate.id === tenant.unit_id)
      const property = unit
        ? data.properties.find((candidate) => candidate.id === unit.property_id)
        : null
      const daysLeft = Math.ceil(
        (new Date(`${tenant.lease_end}T00:00:00`).getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24),
      )
      return {
        ...tenant,
        propertyName: property?.name ?? 'Unknown Property',
        unitLabel: unit?.unit_number ?? '—',
        daysLeft,
      }
    })
    .sort((a, b) => a.lease_end.localeCompare(b.lease_end))

  const unpaidOrUnderpaid = scopedTenantRows
    .map(({ tenant, property, unit }) => {
      const expectedTotal =
        getExpectedRent(tenant, monthKey) + getExpectedCam(tenant, monthKey)
      const paid = scopedTransactions
        .filter(
          (transaction) =>
            transaction.tenant_id === tenant.id &&
            transaction.transaction_type === 'Income' &&
            transaction.date.startsWith(monthKey),
        )
        .reduce((sum, transaction) => sum + transaction.amount_cents, 0)
      const shortfall = Math.max(0, expectedTotal - paid)

      if (shortfall <= 0) {
        return null
      }

      return {
        id: tenant.id,
        name: tenant.name,
        propertyName: property.name,
        unitLabel: unit.unit_number,
        expectedTotal,
        paid,
        shortfall,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.shortfall - a.shortfall)

  /** Full backup: keep raw integer cents — do not format for CSV here (import relies on exact values). */
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `sovereign-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const downloadMegaCsvs = () => {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadTextFile(`sovereign-properties-${stamp}.csv`, propertiesToCsv(data.properties))
    downloadTextFile(`sovereign-tenants-${stamp}.csv`, tenantsToCsv(data.tenants, data.units, data.properties))
    downloadTextFile(
      `sovereign-ledger-${stamp}.csv`,
      ledgerToCsv(data.transactions, data.properties, data.tenants),
    )
  }

  const onImportFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        const normalized = normalizeLedgerData(parsed)
        if (!normalized) {
          window.alert('Invalid backup file.')
          return
        }
        if (
          !window.confirm(
            'Replace all data in this browser with the imported file? This cannot be undone.',
          )
        ) {
          return
        }
        setData(normalized)
        window.alert('Import complete.')
      } catch {
        window.alert('Could not read JSON. Please choose a valid backup file.')
      }
      event.target.value = ''
    }
    reader.readAsText(file, 'utf-8')
  }

  return (
    <section className="sovereign-page">
      <h1 className="sovereign-page-title">Sovereign Ledger</h1>
      <p className="sovereign-muted" style={{ marginTop: 0 }}>
        Dashboard summary for {month}/{year}.
      </p>
      <div className="sovereign-form-row" style={{ maxWidth: '420px' }}>
        <label className="sovereign-label">Property Scope</label>
        <select
          className="sovereign-input sovereign-select"
          value={selectedPropertyId}
          onChange={(event) => setSelectedPropertyId(event.target.value)}
        >
          <option value="">Portfolio (All Properties)</option>
          {data.properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </div>

      <div className="sovereign-dashboard-grid" style={{ marginTop: '1rem' }}>
        <article className="sovereign-summary-card sovereign-summary-income">
          <div className="sovereign-summary-card-head">
            <TrendingUp className="ledger-icon-income" size={20} aria-hidden />
            <span>Total Income</span>
          </div>
          <strong className="sovereign-summary-amount sovereign-text-income">
            {formatCurrency(totals.income)}
          </strong>
          <p className="sovereign-summary-sub">Sum of Income transactions this month</p>
        </article>

        <article className="sovereign-summary-card sovereign-summary-expense">
          <div className="sovereign-summary-card-head">
            <TrendingDown className="ledger-icon-expense" size={20} aria-hidden />
            <span>Total Expenses</span>
          </div>
          <strong className="sovereign-summary-amount sovereign-text-expense">
            {formatCurrency(totals.expenses)}
          </strong>
          <p className="sovereign-summary-sub">Sum of P&amp;L expense transactions this month</p>
        </article>

        <article className="sovereign-summary-card sovereign-summary-pandl">
          <div className="sovereign-summary-card-head">
            <BarChart3 size={20} aria-hidden />
            <span>Net P&amp;L</span>
          </div>
          <strong className="sovereign-summary-amount sovereign-summary-pandl-value">
            {formatCurrency(totals.pandl)}
          </strong>
          <p className="sovereign-summary-sub">Income minus expenses (same month)</p>
        </article>

        <article className="sovereign-summary-card sovereign-summary-cash">
          <div className="sovereign-summary-card-head">
            <Coins size={20} aria-hidden />
            <span>Cash Flow</span>
          </div>
          <strong className="sovereign-summary-amount sovereign-text-cashflow">
            {formatCurrency(totals.cashFlow)}
          </strong>
          <p className="sovereign-summary-sub">P&amp;L minus cash-only items (e.g. mortgage principal)</p>
        </article>
      </div>

      <section className="sovereign-quick-add" style={{ marginTop: '1rem' }}>
        <button
          type="button"
          className="sovereign-btn sovereign-btn-secondary sovereign-admin-toggle"
          onClick={() => setAdminOpen((open) => !open)}
        >
          <Settings2 size={18} aria-hidden style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Admin
        </button>
        {adminOpen && (
          <div className="sovereign-admin-panel">
            <h3 className="sovereign-admin-heading">Admin</h3>
            <p className="sovereign-muted" style={{ marginTop: 0 }}>
              Full backup and CSV exports (all years). Data persists in this browser&apos;s
              LocalStorage.
            </p>
            <div className="sovereign-actions">
              <button type="button" className="sovereign-btn sovereign-btn-add" onClick={exportJson}>
                Export JSON (full system)
              </button>
              <button
                type="button"
                className="sovereign-btn sovereign-btn-secondary"
                onClick={() => importInputRef.current?.click()}
              >
                Import Data (JSON)
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="sovereign-file-input-hidden"
                onChange={onImportFile}
              />
            </div>
            <p className="sovereign-muted" style={{ marginBottom: '0.5rem' }}>
              CSV mega-dump (3 files: properties, tenants, ledger transactions).
            </p>
            <div className="sovereign-actions">
              <button
                type="button"
                className="sovereign-btn sovereign-btn-secondary"
                onClick={downloadMegaCsvs}
              >
                Download all CSVs
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="sovereign-quick-add" style={{ marginTop: '0.5rem' }}>
        <h2 className="sovereign-section-heading">Priority Alerts: Unpaid / Underpayment</h2>
        {unpaidOrUnderpaid.length === 0 ? (
          <p className="sovereign-muted">No arrears detected for the selected month.</p>
        ) : (
          <ul className="sovereign-tenant-list">
            {unpaidOrUnderpaid.map((item) => (
              <li key={item.id} className="sovereign-tenant-card">
                <strong className="sovereign-property-name">
                  <AlertTriangle className="ledger-icon-expense" size={16} /> {item.name}
                </strong>
                <span className="sovereign-property-address">
                  {item.propertyName} · Unit {item.unitLabel}
                </span>
                <span className="sovereign-muted">
                  Expected: {formatCurrency(item.expectedTotal)} · Paid:{' '}
                  {formatCurrency(item.paid)} · Short:{' '}
                  <span className="sovereign-text-expense">{formatCurrency(item.shortfall)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sovereign-quick-add" style={{ marginTop: '1rem' }}>
        <h2 className="sovereign-section-heading">Priority Alerts: Lease Expiration (45 Days)</h2>
        {leaseAlerts.length === 0 ? (
          <p className="sovereign-muted">No lease endings within 45 days.</p>
        ) : (
          <ul className="sovereign-tenant-list">
            {leaseAlerts.map((tenant) => (
              <li key={tenant.id} className="sovereign-tenant-card">
                <strong className="sovereign-property-name">{tenant.name}</strong>
                <span className="sovereign-property-address">
                  {tenant.propertyName} · Unit {tenant.unitLabel}
                </span>
                <span className="sovereign-muted">
                  Lease ends: {tenant.lease_end} ({tenant.daysLeft} day
                  {tenant.daysLeft === 1 ? '' : 's'} left)
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProprietaryFooter />
    </section>
  )
}

export default Dashboard
