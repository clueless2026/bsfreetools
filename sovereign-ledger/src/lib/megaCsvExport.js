import { centsToDollarCsvString, escapeCsvCell } from './csvExport'

function rowToCsv(values) {
  return values.map(escapeCsvCell).join(',')
}

export function propertiesToCsv(properties) {
  const header = [
    'id',
    'name',
    'address',
    'total_units',
    'property_type',
    'Property tax ($)',
    'Insurance ($)',
    'Monthly depreciation ($)',
    'payee_name',
    'mailing_address',
  ]
  const lines = [rowToCsv(header)]
  for (const p of properties) {
    lines.push(
      rowToCsv([
        p.id,
        p.name,
        p.address,
        p.total_units ?? '',
        p.property_type ?? 'mixed',
        centsToDollarCsvString(p.property_tax_cents ?? 0),
        centsToDollarCsvString(p.insurance_cents ?? 0),
        centsToDollarCsvString(p.monthly_depreciation_cents ?? 0),
        p.payee_name ?? '',
        p.mailing_address ?? '',
      ]),
    )
  }
  return lines.join('\r\n')
}

export function tenantsToCsv(tenants, units, properties) {
  const header = [
    'id',
    'unit_id',
    'property_name',
    'unit_number',
    'name',
    'email',
    'phone',
    'Deposit ($)',
    'lease_start',
    'lease_end',
    'Current rent ($)',
    'Current CAM ($)',
    'Future CAM ($)',
    'cam_effective_date',
    'scheduled_increase_effective_date',
    'Scheduled increase new rent ($)',
    'square_footage',
    'Pet rent ($)',
    'Pet deposit ($)',
    'landlord_note',
  ]
  const lines = [rowToCsv(header)]
  for (const t of tenants) {
    const unit = units.find((u) => u.id === t.unit_id)
    const property = unit ? properties.find((p) => p.id === unit.property_id) : null
    const futureCam =
      t.future_cam_cents !== null && t.future_cam_cents !== undefined
        ? centsToDollarCsvString(t.future_cam_cents)
        : ''
    const schedRent =
      t.scheduled_increase?.new_rent_cents != null
        ? centsToDollarCsvString(t.scheduled_increase.new_rent_cents)
        : ''
    lines.push(
      rowToCsv([
        t.id,
        t.unit_id,
        property?.name ?? '',
        unit?.unit_number ?? '',
        t.name,
        t.email ?? '',
        t.phone ?? '',
        centsToDollarCsvString(t.deposit_cents ?? 0),
        t.lease_start ?? '',
        t.lease_end ?? '',
        centsToDollarCsvString(t.current_rent_cents ?? 0),
        centsToDollarCsvString(t.current_cam_cents ?? 0),
        futureCam,
        t.cam_effective_date ?? '',
        t.scheduled_increase?.effective_date ?? '',
        schedRent,
        t.square_footage ?? '',
        centsToDollarCsvString(t.pet_rent_cents ?? 0),
        centsToDollarCsvString(t.pet_deposit_cents ?? 0),
        t.landlord_note ?? '',
      ]),
    )
  }
  return lines.join('\r\n')
}

export function ledgerToCsv(transactions, properties, tenants) {
  const header = [
    'id',
    'date',
    'transaction_type',
    'category_name',
    'Amount ($)',
    'property_name',
    'tenant_name',
    'vendor_name',
    'check_number',
    'notes',
    'unit_id',
    'group_id',
  ]
  const lines = [rowToCsv(header)]
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  for (const tx of sorted) {
    const prop = properties.find((p) => p.id === tx.property_id)
    const tenant = tx.tenant_id ? tenants.find((x) => x.id === tx.tenant_id) : null
    lines.push(
      rowToCsv([
        tx.id,
        tx.date,
        tx.transaction_type,
        tx.category_name,
        centsToDollarCsvString(tx.amount_cents ?? 0),
        prop?.name ?? '',
        tenant?.name ?? '',
        tx.vendor_name ?? '',
        tx.check_number ?? '',
        tx.notes ?? '',
        tx.unit_id ?? '',
        tx.group_id ?? '',
      ]),
    )
  }
  return lines.join('\r\n')
}
