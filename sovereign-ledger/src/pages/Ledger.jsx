import { useMemo, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useDataContext } from '../context/useDataContext'
import { useDateContext } from '../context/useDateContext'
import { centsToDollarCsvString, downloadTextFile, escapeCsvCell } from '../lib/csvExport'

function dollarsToCents(value) {
  const n = Number.parseFloat(String(value).replace(/,/g, '').trim())
  if (!Number.isFinite(n)) {
    return NaN
  }
  return Math.round(n * 100)
}

function formatCurrency(cents) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function ymFromDate(value) {
  return value ? value.slice(0, 7) : null
}

function expectedTenantAmount(tenant, monthKey) {
  const rent =
    tenant.scheduled_increase?.effective_date &&
    ymFromDate(tenant.scheduled_increase.effective_date) <= monthKey
      ? tenant.scheduled_increase.new_rent_cents
      : tenant.current_rent_cents ?? 0
  const cam =
    tenant.cam_effective_date &&
    tenant.future_cam_cents !== null &&
    tenant.future_cam_cents !== undefined &&
    ymFromDate(tenant.cam_effective_date) <= monthKey
      ? tenant.future_cam_cents
      : tenant.current_cam_cents ?? 0
  return rent + cam
}

function Ledger() {
  const { data, setTransactions } = useDataContext()
  const { month, year } = useDateContext()

  const [editingId, setEditingId] = useState(null)
  const [txType, setTxType] = useState('income')
  const [categoryId, setCategoryId] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [checkNumber, setCheckNumber] = useState('')
  const [amountDollars, setAmountDollars] = useState('')
  const [date, setDate] = useState(todayIsoDate())
  const [notes, setNotes] = useState('')

  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  const categoriesForType = useMemo(() => {
    if (txType === 'income') {
      return data.categories.filter((category) => category.transaction_type === 'Income')
    }
    return data.categories.filter((category) =>
      ['PAndL', 'CashFlowOnly'].includes(category.transaction_type),
    )
  }, [data.categories, txType])

  const tenantsForProperty = useMemo(() => {
    if (!propertyId) {
      return []
    }
    const unitIds = new Set(
      data.units.filter((u) => u.property_id === propertyId).map((u) => u.id),
    )
    return data.tenants.filter((t) => unitIds.has(t.unit_id))
  }, [data.tenants, data.units, propertyId])

  const monthTransactions = useMemo(() => {
    return data.transactions
      .filter((t) => t.date.startsWith(monthKey))
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [data.transactions, monthKey])

  const downloadLedgerCsv = () => {
    const header = [
      'Date',
      'Type',
      'Category',
      'Property',
      'Tenant',
      'Vendor',
      'Check #',
      'Amount (USD)',
      'Notes',
    ]
    const lines = [header.map(escapeCsvCell).join(',')]
    for (const t of monthTransactions) {
      const prop = data.properties.find((p) => p.id === t.property_id)
      const tenant = t.tenant_id ? data.tenants.find((x) => x.id === t.tenant_id) : null
      const row = [
        t.date,
        t.transaction_type === 'Income' ? 'Income' : 'Expense',
        t.category_name,
        prop?.name ?? '',
        tenant?.name ?? '',
        t.vendor_name ?? '',
        t.check_number ?? '',
        centsToDollarCsvString(t.amount_cents ?? 0),
        t.notes ?? '',
      ]
      lines.push(row.map(escapeCsvCell).join(','))
    }
    downloadTextFile(`ledger-${monthKey}.csv`, lines.join('\r\n'))
  }

  const resetForm = () => {
    setEditingId(null)
    setTxType('income')
    setCategoryId('')
    setPropertyId('')
    setTenantId('')
    setVendorId('')
    setCheckNumber('')
    setAmountDollars('')
    setDate(todayIsoDate())
    setNotes('')
  }

  const startEdit = (transaction) => {
    setEditingId(transaction.id)
    setTxType(transaction.transaction_type === 'Income' ? 'income' : 'expense')
    setCategoryId(transaction.category_id ?? '')
    setPropertyId(transaction.property_id ?? '')
    setTenantId(transaction.tenant_id ?? '')
    setVendorId(transaction.vendor_id ?? '')
    setCheckNumber(transaction.check_number ?? '')
    setAmountDollars(((transaction.amount_cents ?? 0) / 100).toFixed(2))
    setDate(transaction.date)
    setNotes(transaction.notes ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = (transaction) => {
    if (!window.confirm('Delete this transaction? This cannot be undone.')) {
      return
    }
    setTransactions(data.transactions.filter((candidate) => candidate.id !== transaction.id))
    if (editingId === transaction.id) {
      resetForm()
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!propertyId) {
      window.alert('Select a property.')
      return
    }
    if (!categoryId) {
      window.alert('Select a category.')
      return
    }
    const category = data.categories.find((c) => c.id === categoryId)
    if (!category) {
      window.alert('Invalid category.')
      return
    }

    const amountCents = dollarsToCents(amountDollars)
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      window.alert('Enter a valid amount in dollars.')
      return
    }

    const tenant = tenantId ? data.tenants.find((t) => t.id === tenantId) : null
    if (tenantId && !tenant) {
      window.alert('Invalid tenant.')
      return
    }

    const transaction_type =
      txType === 'income' ? 'Income' : category.transaction_type
    if (txType === 'income' && category.transaction_type !== 'Income') {
      window.alert('Category does not match transaction type.')
      return
    }
    if (
      txType === 'expense' &&
      !['PAndL', 'CashFlowOnly'].includes(category.transaction_type)
    ) {
      window.alert('Category does not match transaction type.')
      return
    }

    const newTx = {
      id: editingId ?? crypto.randomUUID(),
      group_id: null,
      date,
      property_id: propertyId,
      unit_id: tenant ? tenant.unit_id : null,
      tenant_id: tenant ? tenant.id : null,
      category_id: category.id,
      category_name: category.name,
      amount_cents: amountCents,
      notes: notes.trim(),
      transaction_type,
      vendor_id: vendorId || null,
      vendor_name:
        vendorId && txType === 'expense'
          ? data.vendors?.find((vendor) => vendor.id === vendorId)?.name ?? null
          : null,
      check_number: txType === 'expense' ? checkNumber.trim() || null : null,
    }

    if (editingId) {
      setTransactions(
        data.transactions.map((transaction) =>
          transaction.id === editingId ? newTx : transaction,
        ),
      )
      resetForm()
      return
    }

    setTransactions([...data.transactions, newTx])
    resetForm()
  }

  return (
    <section className="sovereign-page">
      <h1 className="sovereign-page-title">Ledger</h1>
      <p className="sovereign-muted" style={{ marginBottom: '1rem' }}>
        Showing {month}/{year}. Click any transaction row to edit.
      </p>

      <form className="sovereign-quick-add" onSubmit={handleSubmit}>
        <h2 className="sovereign-section-heading">Add transaction</h2>

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="ledger-type">
            Type
          </label>
          <select
            id="ledger-type"
            className="sovereign-input sovereign-select"
            value={txType}
            onChange={(e) => {
              setTxType(e.target.value)
              setCategoryId('')
            }}
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="ledger-category">
            Category
          </label>
          <select
            id="ledger-category"
            className="sovereign-input sovereign-select"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Select category</option>
            {categoriesForType.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="ledger-property">
            Property
          </label>
          <select
            id="ledger-property"
            className="sovereign-input sovereign-select"
            value={propertyId}
            onChange={(e) => {
              setPropertyId(e.target.value)
              setTenantId('')
            }}
          >
            <option value="">Select property</option>
            {data.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="ledger-tenant">
            Tenant (optional)
          </label>
          <select
            id="ledger-tenant"
            className="sovereign-input sovereign-select"
            value={tenantId}
            onChange={(e) => {
              const nextTenantId = e.target.value
              setTenantId(nextTenantId)
              if (txType === 'income' && nextTenantId) {
                const tenant = data.tenants.find((candidate) => candidate.id === nextTenantId)
                if (tenant) {
                  const amount = expectedTenantAmount(tenant, monthKey)
                  setAmountDollars((amount / 100).toFixed(2))
                  const rentCategory = data.categories.find(
                    (category) =>
                      category.transaction_type === 'Income' &&
                      category.name === 'Rental Income',
                  )
                  if (rentCategory) {
                    setCategoryId(rentCategory.id)
                  }
                }
              }
            }}
            disabled={!propertyId || tenantsForProperty.length === 0}
          >
            <option value="">
              {!propertyId
                ? 'Select a property first'
                : tenantsForProperty.length === 0
                  ? 'No tenants for this property'
                  : 'Property-level (no tenant)'}
            </option>
            {tenantsForProperty.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="ledger-amount">
            Amount (USD)
          </label>
          <input
            id="ledger-amount"
            className="sovereign-input"
            type="text"
            inputMode="decimal"
            value={amountDollars}
            onChange={(e) => setAmountDollars(e.target.value)}
            placeholder="0.00"
          />
        </div>

        {txType === 'expense' && (
          <>
            <div className="sovereign-form-row">
              <label className="sovereign-label" htmlFor="ledger-vendor">
                Vendor
              </label>
              <select
                id="ledger-vendor"
                className="sovereign-input sovereign-select"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
              >
                <option value="">No vendor</option>
                {(data.vendors ?? []).map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sovereign-form-row">
              <label className="sovereign-label" htmlFor="ledger-check-number">
                Check Number
              </label>
              <input
                id="ledger-check-number"
                className="sovereign-input"
                type="text"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="ledger-date">
            Date
          </label>
          <input
            id="ledger-date"
            className="sovereign-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="ledger-notes">
            Notes (optional)
          </label>
          <input
            id="ledger-notes"
            className="sovereign-input"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Memo"
          />
        </div>

        <div className="sovereign-actions">
          <button type="submit" className="sovereign-btn sovereign-btn-add">
            {editingId ? 'Save transaction' : 'Add transaction'}
          </button>
          {editingId && (
            <button
              type="button"
              className="sovereign-btn sovereign-btn-secondary"
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="sovereign-list" style={{ marginTop: '1.5rem' }}>
        <div className="sovereign-actions sovereign-actions--between" style={{ marginBottom: '0.75rem' }}>
          <h2 className="sovereign-section-heading" style={{ marginBottom: 0 }}>
            This month ({monthKey})
          </h2>
          <button
            type="button"
            className="sovereign-btn sovereign-btn-secondary"
            onClick={downloadLedgerCsv}
            disabled={monthTransactions.length === 0}
          >
            Download CSV
          </button>
        </div>
        {monthTransactions.length === 0 ? (
          <p className="sovereign-muted">No transactions this month.</p>
        ) : (
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Property / Tenant</th>
                  <th>Vendor / Check</th>
                  <th className="ledger-th-amount">Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {monthTransactions.map((t) => {
                  const prop = data.properties.find((p) => p.id === t.property_id)
                  const tenant = t.tenant_id
                    ? data.tenants.find((x) => x.id === t.tenant_id)
                    : null
                  const isIncome = t.transaction_type === 'Income'
                  return (
                    <tr
                      key={t.id}
                      className={isIncome ? 'ledger-row-income' : 'ledger-row-expense'}
                      onClick={() => startEdit(t)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{t.date}</td>
                      <td>
                        <span className="ledger-type-cell">
                          {isIncome ? (
                            <TrendingUp size={14} className="ledger-icon-income" />
                          ) : (
                            <TrendingDown size={14} className="ledger-icon-expense" />
                          )}
                          {isIncome ? 'Income' : 'Expense'}
                        </span>
                      </td>
                      <td>{t.category_name}</td>
                      <td>
                        {prop?.name ?? '—'}
                        {tenant ? ` · ${tenant.name}` : ''}
                      </td>
                      <td>
                        {t.vendor_name || '—'}
                        {t.check_number ? ` · Check #${t.check_number}` : ''}
                      </td>
                      <td className="ledger-td-amount">{formatCurrency(t.amount_cents)}</td>
                      <td>
                        <button
                          type="button"
                          className="sovereign-btn sovereign-btn-secondary"
                          onClick={(event) => {
                            event.stopPropagation()
                            startEdit(t)
                          }}
                        >
                          Edit
                        </button>{' '}
                        <button
                          type="button"
                          className="sovereign-btn sovereign-btn-danger"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDelete(t)
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

export default Ledger
