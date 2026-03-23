import {
  categoryVisibleForPropertyType,
  resolveEffectivePropertyType,
} from '../data/categoryPropertyTypes'
import { seedCategories } from '../data/seedCategories'
import { centsToDollarCsvString, escapeCsvCell } from './csvExport'

export const CAPEX_CATEGORY_NAME = 'Capital Expenditures (CapEx)'
export const MORTGAGE_PRINCIPAL_NAME = 'Mortgage Principal'
export const DEPRECIATION_CATEGORY_NAME = 'Depreciation'

const INCOME_ORDER_FIRST = 'Rental Income'

function monthNameShort(month1to12) {
  return new Date(2000, month1to12 - 1, 1).toLocaleString('en-US', { month: 'short' })
}

function emptyMonths() {
  return Array.from({ length: 12 }, () => 0)
}

function sumArray(values) {
  return values.reduce((a, b) => a + b, 0)
}

/**
 * @param {object} params
 * @param {number} params.selectedMonth - 1–12; used when reportPeriod === 'monthly'
 */
export function buildProfitAndLossReport({
  transactions,
  properties,
  yearStr,
  selectedPropertyId,
  reportPeriod,
  selectedMonth,
}) {
  const effectiveType = resolveEffectivePropertyType(selectedPropertyId, properties)
  const monthIdx = Math.min(12, Math.max(1, Number(selectedMonth) || 1)) - 1

  const scopedProperties = selectedPropertyId
    ? properties.filter((p) => p.id === selectedPropertyId)
    : properties

  const scopedPropertyIds = new Set(scopedProperties.map((p) => p.id))

  const yearPrefix = `${yearStr}-`
  const scopedTx = transactions.filter(
    (t) =>
      t.date.startsWith(yearPrefix) &&
      (!selectedPropertyId || scopedPropertyIds.has(t.property_id)),
  )

  const monthIndexFromDate = (dateStr) => Number.parseInt(dateStr.slice(5, 7), 10) - 1

  /** @type {Map<string, number[]>} */
  const incomeByCategory = new Map()
  /** @type {Map<string, number[]>} */
  const pandlByCategory = new Map()
  /** @type {number[]} */
  const mortgagePrincipalByMonth = emptyMonths()
  /** @type {number[]} */
  const capexByMonth = emptyMonths()
  /** @type {number[]} */
  const depreciationLedgerByMonth = emptyMonths()

  for (const tx of scopedTx) {
    const mi = monthIndexFromDate(tx.date)
    if (mi < 0 || mi > 11) {
      continue
    }

    if (tx.transaction_type === 'Income') {
      if (!categoryVisibleForPropertyType(tx.category_name, effectiveType)) {
        continue
      }
      if (!incomeByCategory.has(tx.category_name)) {
        incomeByCategory.set(tx.category_name, emptyMonths())
      }
      incomeByCategory.get(tx.category_name)[mi] += tx.amount_cents
      continue
    }

    if (tx.transaction_type === 'PAndL') {
      if (tx.category_name === CAPEX_CATEGORY_NAME) {
        capexByMonth[mi] += tx.amount_cents
        continue
      }
      if (tx.category_name === DEPRECIATION_CATEGORY_NAME) {
        depreciationLedgerByMonth[mi] += tx.amount_cents
        continue
      }
      if (!categoryVisibleForPropertyType(tx.category_name, effectiveType)) {
        continue
      }
      if (!pandlByCategory.has(tx.category_name)) {
        pandlByCategory.set(tx.category_name, emptyMonths())
      }
      pandlByCategory.get(tx.category_name)[mi] += tx.amount_cents
      continue
    }

    if (tx.transaction_type === 'CashFlowOnly' && tx.category_name === MORTGAGE_PRINCIPAL_NAME) {
      mortgagePrincipalByMonth[mi] += tx.amount_cents
    }
  }

  for (const category of seedCategories) {
    if (category.transaction_type === 'Income') {
      if (!categoryVisibleForPropertyType(category.name, effectiveType)) {
        continue
      }
      if (!incomeByCategory.has(category.name)) {
        incomeByCategory.set(category.name, emptyMonths())
      }
      continue
    }
    if (category.transaction_type === 'PAndL' && category.name === CAPEX_CATEGORY_NAME) {
      continue
    }
    if (category.transaction_type === 'PAndL' && category.name === DEPRECIATION_CATEGORY_NAME) {
      continue
    }
    if (category.transaction_type === 'PAndL') {
      if (!categoryVisibleForPropertyType(category.name, effectiveType)) {
        continue
      }
      if (!pandlByCategory.has(category.name)) {
        pandlByCategory.set(category.name, emptyMonths())
      }
    }
  }

  const incomeCategoryNames = Array.from(incomeByCategory.keys()).sort((a, b) => {
    if (a === INCOME_ORDER_FIRST) {
      return -1
    }
    if (b === INCOME_ORDER_FIRST) {
      return 1
    }
    return a.localeCompare(b)
  })

  const opexCategoryNames = Array.from(pandlByCategory.keys()).sort((a, b) =>
    a.localeCompare(b),
  )

  const totalRevenueByMonth = emptyMonths()
  for (const name of incomeCategoryNames) {
    const row = incomeByCategory.get(name)
    for (let i = 0; i < 12; i += 1) {
      totalRevenueByMonth[i] += row[i]
    }
  }

  const totalOpExByMonth = emptyMonths()
  for (const name of opexCategoryNames) {
    const row = pandlByCategory.get(name)
    for (let i = 0; i < 12; i += 1) {
      totalOpExByMonth[i] += row[i]
    }
  }

  const profileDepreciationByMonth = emptyMonths()
  for (let i = 0; i < 12; i += 1) {
    let sum = 0
    for (const property of scopedProperties) {
      sum += property.monthly_depreciation_cents ?? 0
    }
    profileDepreciationByMonth[i] = sum
  }

  /** Combined depreciation (ledger + profile) for post–NIBTAD line */
  const totalDepreciationChargeByMonth = emptyMonths()
  for (let i = 0; i < 12; i += 1) {
    totalDepreciationChargeByMonth[i] =
      profileDepreciationByMonth[i] + depreciationLedgerByMonth[i]
  }

  const nibtadByMonth = emptyMonths()
  const taxableByMonth = emptyMonths()
  const cashFlowByMonth = emptyMonths()

  for (let i = 0; i < 12; i += 1) {
    nibtadByMonth[i] = totalRevenueByMonth[i] - totalOpExByMonth[i]
    taxableByMonth[i] = nibtadByMonth[i] - totalDepreciationChargeByMonth[i]
    cashFlowByMonth[i] =
      taxableByMonth[i] +
      totalDepreciationChargeByMonth[i] -
      mortgagePrincipalByMonth[i] -
      capexByMonth[i]
  }

  const isAnnual = reportPeriod === 'annual'
  const layoutMode = isAnnual ? 'landscape' : 'portrait'

  const packRowAnnual = (amounts12) => {
    const withTotal = [...amounts12, sumArray(amounts12)]
    return withTotal
  }

  const packRowMonthly = (amounts12) => {
    return [amounts12[monthIdx]]
  }

  const packRow = isAnnual ? packRowAnnual : packRowMonthly

  const columnLabels = isAnnual
    ? Array.from({ length: 12 }, (_, idx) => monthNameShort(idx + 1))
    : [`${monthNameShort(monthIdx + 1)} ${yearStr}`]

  const rows = []

  rows.push({ kind: 'section', label: 'Revenue', amounts: null, bold: true })

  for (const name of incomeCategoryNames) {
    const amounts = incomeByCategory.get(name)
    rows.push({
      kind: 'line',
      label: name,
      amounts: packRow(amounts),
      bold: false,
    })
  }

  rows.push({
    kind: 'subtotal',
    label: 'Total Revenue',
    amounts: packRow(totalRevenueByMonth),
    bold: true,
  })

  rows.push({ kind: 'section', label: 'Operating Expenses', amounts: null, bold: true })

  for (const name of opexCategoryNames) {
    const amounts = pandlByCategory.get(name)
    rows.push({
      kind: 'line',
      label: name,
      amounts: packRow(amounts),
      bold: false,
    })
  }

  rows.push({
    kind: 'subtotal',
    label: 'Total Operating Expenses',
    amounts: packRow(totalOpExByMonth),
    bold: true,
  })

  rows.push({
    kind: 'computed',
    label: 'Net Income Before Tax & Depreciation',
    amounts: packRow(nibtadByMonth),
    bold: true,
  })

  rows.push({
    kind: 'line',
    label: 'Depreciation',
    amounts: packRow(totalDepreciationChargeByMonth.map((v) => -v)),
    bold: false,
  })

  rows.push({
    kind: 'computed',
    label: 'Taxable Net Income',
    amounts: packRow(taxableByMonth),
    bold: true,
  })

  rows.push({ kind: 'section', label: 'Cash Outflows', amounts: null, bold: true })

  rows.push({
    kind: 'line',
    label: 'Mortgage Principal',
    amounts: packRow(mortgagePrincipalByMonth.map((v) => -v)),
    bold: false,
  })

  rows.push({
    kind: 'line',
    label: 'Capital Expenditures (CapEx)',
    amounts: packRow(capexByMonth.map((v) => -v)),
    bold: false,
  })

  rows.push({
    kind: 'computed',
    label: 'Cash Flow',
    amounts: packRow(cashFlowByMonth),
    bold: true,
  })

  /** Annual: vertical totals = sum of detail line amounts per column (+ total column) */
  if (isAnnual) {
    const lineRows = rows.filter((r) => r.kind === 'line' && r.amounts?.length)
    const colCount = lineRows[0]?.amounts?.length ?? 13
    const columnSums = Array.from({ length: colCount }, (_, col) =>
      lineRows.reduce((sum, r) => sum + (r.amounts[col] ?? 0), 0),
    )
    rows.push({
      kind: 'columnSum',
      label: 'Column totals (detail lines)',
      amounts: columnSums,
      bold: true,
    })
  }

  const totalColumnLabel = 'Total'

  return {
    effectivePropertyType: effectiveType,
    reportPeriod,
    yearStr,
    selectedMonth: monthIdx + 1,
    layoutMode,
    columnLabels,
    totalColumnLabel,
    /** Annual: includes Total column at end; monthly: single period column */
    plColumns: isAnnual ? [...columnLabels, totalColumnLabel] : columnLabels,
    rows,
  }
}

export function plMatrixToCsv({ columnLabels, totalColumnLabel, rows, reportPeriod, plColumns }) {
  const isAnnual = reportPeriod === 'annual'
  const headerParts = ['Line Item', ...(plColumns ?? (isAnnual ? [...columnLabels, totalColumnLabel] : columnLabels))]
  const lines = [headerParts.map(escapeCsvCell).join(',')]

  for (const row of rows) {
    if (row.kind === 'section') {
      lines.push(`${escapeCsvCell(row.label)},`)
      continue
    }
    const amounts = row.amounts ?? []
    const formatted = amounts.map((c) => centsToDollarCsvString(c ?? 0))
    lines.push([row.label, ...formatted].map(escapeCsvCell).join(','))
  }

  return lines.join('\r\n')
}
