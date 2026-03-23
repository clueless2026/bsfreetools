import { useMemo, useState } from 'react'
import { ProprietaryFooter } from '../components/ProprietaryFooter'
import { useDataContext } from '../context/useDataContext'
import { useDisableContextMenu } from '../hooks/useDisableContextMenu'
import { useDateContext } from '../context/useDateContext'
import { buildProfitAndLossReport, plMatrixToCsv } from '../lib/plReport'
import { downloadTextFile } from '../lib/csvExport'

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

function monthName(month) {
  return new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'short' })
}

function Reports() {
  useDisableContextMenu(true)
  const { data } = useDataContext()
  const { month, year } = useDateContext()
  const [reportMonth, setReportMonth] = useState(month)
  const [reportYear, setReportYear] = useState(year)
  const monthKey = `${reportYear}-${String(reportMonth).padStart(2, '0')}`
  const [reportPeriod, setReportPeriod] = useState('annual')
  const [selectedPropertyId, setSelectedPropertyId] = useState('')

  const plReport = useMemo(
    () =>
      buildProfitAndLossReport({
        transactions: data.transactions,
        properties: data.properties,
        yearStr: String(reportYear),
        selectedPropertyId,
        reportPeriod,
        selectedMonth: reportMonth,
      }),
    [
      data.transactions,
      data.properties,
      reportYear,
      selectedPropertyId,
      reportPeriod,
      reportMonth,
    ],
  )

  const rentRollRows = useMemo(() => {
    return data.tenants
      .map((tenant) => {
        const unit = data.units.find((candidate) => candidate.id === tenant.unit_id)
        const property = unit
          ? data.properties.find((candidate) => candidate.id === unit.property_id)
          : null
        if (!property || !unit) {
          return null
        }
        if (selectedPropertyId && property.id !== selectedPropertyId) {
          return null
        }
        return {
          tenant,
          unit,
          property,
          expectedRent: getExpectedRent(tenant, monthKey),
          expectedCam: getExpectedCam(tenant, monthKey),
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const propertyCmp = a.property.name.localeCompare(b.property.name)
        if (propertyCmp !== 0) {
          return propertyCmp
        }
        return String(a.unit.unit_number).localeCompare(String(b.unit.unit_number), undefined, {
          numeric: true,
        })
      })
  }, [data.properties, data.tenants, data.units, monthKey, selectedPropertyId])

  const rentRollByProperty = useMemo(() => {
    const grouped = new Map()
    for (const row of rentRollRows) {
      const bucket = grouped.get(row.property.id) ?? {
        property: row.property,
        rows: [],
      }
      bucket.rows.push(row)
      grouped.set(row.property.id, bucket)
    }
    return Array.from(grouped.values()).sort((a, b) =>
      a.property.name.localeCompare(b.property.name),
    )
  }, [rentRollRows])

  const generateReminderLetter = (row) => {
    const payeeName = (row.property.payee_name || '').trim()
    const mailingAddress = (row.property.mailing_address || '').trim()
    const camAmount = row.expectedCam
    const nextMonthDate = new Date(reportYear, reportMonth, 1)
    const nextMonthDue = `1 ${nextMonthDate.toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    })}`
    const totalDue = row.expectedRent + camAmount

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Rent Reminder</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 32px; }
      .sheet { max-width: 850px; margin: 0 auto; }
      h1 { font-size: 24px; margin: 0 0 8px; }
      p { line-height: 1.5; margin: 0 0 12px; }
      @media print { body { padding: 0; } .sheet { max-width: 100%; padding: 24px; } }
    </style>
  </head>
  <body>
    <div class="sheet">
      <h1>Rent Reminder</h1>
      <p>Date: ${new Date().toLocaleDateString()}</p>
      <p>Dear ${row.tenant.name},</p>
      <p>
        Friendly reminder that your total payment of <strong>${formatCurrency(totalDue)}</strong>
        is due on <strong>${nextMonthDue}</strong>.
      </p>
      ${
        camAmount > 0
          ? `<p>This total includes CAM charges of ${formatCurrency(camAmount)}.</p>`
          : ''
      }
      <p>
        Property: ${row.property.name}, Unit ${row.unit.unit_number}<br />
        Payee: ${payeeName || 'N/A'}<br />
        Mail to: ${mailingAddress || 'N/A'}
      </p>
      <p>Thank you.</p>
    </div>
    <script>window.print();</script>
  </body>
</html>`

    const popup = window.open('', '_blank', 'width=900,height=1000')
    if (!popup) {
      window.alert('Please allow pop-ups to generate letters.')
      return
    }
    popup.document.write(html)
    popup.document.close()
  }

  const downloadPlCsv = () => {
    const csv = plMatrixToCsv({
      columnLabels: plReport.columnLabels,
      totalColumnLabel: plReport.totalColumnLabel,
      rows: plReport.rows,
      reportPeriod: plReport.reportPeriod,
      plColumns: plReport.plColumns,
    })
    downloadTextFile(
      `profit-and-loss-${reportYear}-${plReport.reportPeriod}-${reportMonth}.csv`,
      csv,
    )
  }

  const printProfitAndLoss = () => {
    const cols = plReport.plColumns
    const header = cols.map((label) => `<th>${label}</th>`).join('')
    const pageSize = plReport.layoutMode === 'landscape' ? 'landscape' : 'portrait'
    const body = plReport.rows
      .map((row) => {
        if (row.kind === 'section') {
          return `<tr class="pl-section"><td colspan="${cols.length + 1}">${row.label}</td></tr>`
        }
        const weight = row.bold ? 'font-weight:700' : ''
        const cells = (row.amounts ?? []).map(
          (c) => `<td style="${weight}">${formatCurrency(c)}</td>`,
        )
        return `<tr><td style="text-align:left;${weight}">${row.label}</td>${cells.join('')}</tr>`
      })
      .join('')

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Profit and Loss</title><style>
      body{font-family:Arial,sans-serif;padding:16px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #d1d5db;padding:6px;text-align:right}
      th:first-child,td:first-child{text-align:left}
      th{background:#f3f4f6}
      .pl-section td{background:#e5e7eb;font-weight:700;text-align:left}
      @page{size:${pageSize}}
    </style></head><body>
    <h1>Profit and Loss (${reportYear})</h1>
    <p style="font-size:12px">${plReport.reportPeriod === 'annual' ? 'Annual (12 months + totals)' : `Month: ${monthName(reportMonth)} ${reportYear}`} · Property: ${selectedPropertyId ? data.properties.find((p) => p.id === selectedPropertyId)?.name ?? '—' : 'All properties'} · Type: ${plReport.effectivePropertyType}</p>
    <table><thead><tr><th>Line item</th>${header}</tr></thead><tbody>${body}</tbody></table>
    <script>window.print();</script></body></html>`
    const popup = window.open('', '_blank', 'width=1400,height=1000')
    if (!popup) {
      return
    }
    popup.document.write(html)
    popup.document.close()
  }

  const generateVendorDetailReport = () => {
    const grouped = new Map()
    for (const transaction of data.transactions) {
      if (
        !transaction.vendor_name ||
        !transaction.date.startsWith(`${reportYear}-${String(reportMonth).padStart(2, '0')}`)
      ) {
        continue
      }
      const list = grouped.get(transaction.vendor_name) ?? []
      list.push(transaction)
      grouped.set(transaction.vendor_name, list)
    }
    const sections = Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([vendorName, transactions]) => {
        const rows = transactions
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(
            (transaction) =>
              `<tr><td>${transaction.date}</td><td>${transaction.category_name}</td><td>${transaction.check_number ?? '—'}</td><td>${formatCurrency(transaction.amount_cents)}</td></tr>`,
          )
          .join('')
        return `<h2>${vendorName}</h2><table><thead><tr><th>Date</th><th>Category</th><th>Check #</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>`
      })
      .join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Vendor Detail Report</title><style>body{font-family:Arial,sans-serif;padding:16px}h2{margin-top:20px}table{width:100%;border-collapse:collapse;margin-bottom:16px}th,td{border:1px solid #d1d5db;padding:8px;text-align:left}th{background:#f3f4f6}</style></head><body><h1>Vendor Detail Report (${monthName(reportMonth)} ${reportYear})</h1>${sections || '<p>No vendor transactions in this period.</p>'}<script>window.print();</script></body></html>`
    const popup = window.open('', '_blank', 'width=1100,height=900')
    if (!popup) {
      return
    }
    popup.document.write(html)
    popup.document.close()
  }

  const scopeClass =
    plReport.layoutMode === 'portrait'
      ? 'sovereign-pl-scope sovereign-pl-scope--portrait'
      : 'sovereign-pl-scope sovereign-pl-scope--landscape'

  return (
    <section className={`sovereign-page sovereign-page--wide ${scopeClass}`}>
      <h1 className="sovereign-page-title">Profit and Loss</h1>
      <p className="sovereign-muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
        Rent roll snapshot, vendor detail, and rent reminder letters. Edit payee and mailing address
        on each property under <strong>Properties</strong>.
      </p>

      <div className="sovereign-quick-add">
        <h2 className="sovereign-section-heading">Report controls</h2>
        <div className="sovereign-actions sovereign-actions--wrap sovereign-report-controls">
          <div className="sovereign-form-row" style={{ minWidth: '150px' }}>
            <label className="sovereign-label">Month</label>
            <select
              className="sovereign-input sovereign-select"
              value={reportMonth}
              onChange={(event) => setReportMonth(Number(event.target.value))}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {monthName(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="sovereign-form-row" style={{ minWidth: '120px' }}>
            <label className="sovereign-label">Year</label>
            <input
              className="sovereign-input"
              type="number"
              value={reportYear}
              onChange={(event) => setReportYear(Number(event.target.value))}
            />
          </div>
          <div className="sovereign-form-row" style={{ minWidth: '160px' }}>
            <label className="sovereign-label">Report Period</label>
            <select
              className="sovereign-input sovereign-select"
              value={reportPeriod}
              onChange={(event) => setReportPeriod(event.target.value)}
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div className="sovereign-form-row" style={{ minWidth: '220px', flex: 1 }}>
            <label className="sovereign-label">Property filter</label>
            <select
              className="sovereign-input sovereign-select"
              value={selectedPropertyId}
              onChange={(event) => setSelectedPropertyId(event.target.value)}
            >
              <option value="">All Properties (Portfolio)</option>
              {data.properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="sovereign-muted" style={{ marginBottom: '0.75rem' }}>
          <strong>Annual</strong> shows all twelve months in landscape with row totals and column
          totals (detail lines). <strong>Monthly</strong> shows portrait layout for the selected month
          only.
        </p>
      </div>

      <div className="sovereign-quick-add pl-report-card">
        <div className="sovereign-actions sovereign-actions--between" style={{ flexWrap: 'wrap' }}>
          <p className="sovereign-muted" style={{ margin: 0 }}>
            P&amp;L type scope: <strong>{plReport.effectivePropertyType}</strong>
            {!selectedPropertyId && ' (portfolio = mixed lines)'}
          </p>
          <div className="sovereign-actions">
            <button
              type="button"
              className="sovereign-btn sovereign-btn-secondary"
              onClick={downloadPlCsv}
            >
              Download CSV
            </button>
            <button
              type="button"
              className="sovereign-btn sovereign-btn-secondary"
              onClick={printProfitAndLoss}
            >
              Print
            </button>
          </div>
        </div>

        <div className="pl-report-wrap">
          <table className="pl-report-table ledger-table">
            <thead>
              <tr>
                <th className="pl-report-line-col">Line item</th>
                {plReport.plColumns.map((label) => (
                  <th key={label} className="pl-report-num-col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plReport.rows.map((row, idx) => {
                if (row.kind === 'section') {
                  return (
                    <tr key={`s-${idx}`} className="pl-report-section-row">
                      <td colSpan={plReport.plColumns.length + 1}>{row.label}</td>
                    </tr>
                  )
                }
                const boldClass = row.bold ? 'pl-report-bold' : ''
                return (
                  <tr key={`r-${idx}`} className={boldClass}>
                    <td className={`pl-report-line-col ${boldClass}`.trim()}>{row.label}</td>
                    {(row.amounts ?? []).map((c, i) => (
                      <td key={i} className={`pl-report-num-col ${boldClass}`.trim()}>
                        {formatCurrency(c)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sovereign-quick-add">
        <h2 className="sovereign-section-heading">Rent roll &amp; letters</h2>
        <p className="sovereign-muted">
          Uses the month, year, and property filter from <strong>Report controls</strong> above.
        </p>
        <div className="sovereign-actions">
          <button
            type="button"
            className="sovereign-btn sovereign-btn-secondary"
            onClick={generateVendorDetailReport}
          >
            Vendor Detail Report
          </button>
        </div>
      </div>

      {rentRollByProperty.map((group) => (
        <section key={group.property.id} className="sovereign-quick-add">
          <h2 className="sovereign-section-heading">Rent Roll — {group.property.name}</h2>
          <p className="sovereign-muted">
            As of {monthName(reportMonth)} {reportYear} (expected rent / CAM for letters).
          </p>
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Tenant Name</th>
                  <th>Unit</th>
                  <th>Lease Start</th>
                  <th>Lease End</th>
                  <th>Security Deposit</th>
                  <th>Future Rent</th>
                  <th>Future CAM</th>
                  <th>Rent adj. date</th>
                  <th>CAM adj. date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.tenant.id}>
                    <td>{row.tenant.name}</td>
                    <td>{row.unit.unit_number}</td>
                    <td>{row.tenant.lease_start || '—'}</td>
                    <td>{row.tenant.lease_end || '—'}</td>
                    <td>{formatCurrency(row.tenant.deposit_cents ?? 0)}</td>
                    <td className="sovereign-text-income">
                      {row.tenant.scheduled_increase?.new_rent_cents != null
                        ? formatCurrency(row.tenant.scheduled_increase.new_rent_cents)
                        : '—'}
                    </td>
                    <td className="sovereign-text-income">
                      {row.tenant.future_cam_cents != null
                        ? formatCurrency(row.tenant.future_cam_cents)
                        : '—'}
                    </td>
                    <td>{row.tenant.scheduled_increase?.effective_date || '—'}</td>
                    <td>{row.tenant.cam_effective_date || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="sovereign-btn sovereign-btn-secondary"
                        onClick={() => generateReminderLetter(row)}
                      >
                        Rent Reminder Letter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {rentRollByProperty.length === 0 && (
        <p className="sovereign-muted">No tenants to show for the selected filter.</p>
      )}

      <ProprietaryFooter />
    </section>
  )
}

export default Reports
