import { seedCategories } from '../data/seedCategories'
import { DEPRECIATION_CATEGORY_NAME } from './plReport'

/**
 * Normalize raw parsed JSON from localStorage or import so UI always has required fields.
 */
export function normalizeLedgerData(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const rawUnits = parsed.units ?? []
  const rawProperties = parsed.properties ?? []
  const rawTenants = parsed.tenants ?? []

  const properties = rawProperties.map((property) => ({
    ...property,
    total_units:
      typeof property.total_units === 'number'
        ? property.total_units
        : rawUnits.filter((unit) => unit.property_id === property.id).length,
    mortgage_interest_cents: property.mortgage_interest_cents ?? 0,
    mortgage_principal_cents: property.mortgage_principal_cents ?? 0,
    property_tax_cents: property.property_tax_cents ?? 0,
    insurance_cents: property.insurance_cents ?? 0,
    payee_name: property.payee_name ?? '',
    mailing_address: property.mailing_address ?? '',
    property_type: property.property_type ?? 'mixed',
    monthly_depreciation_cents: property.monthly_depreciation_cents ?? 0,
  }))

  const tenants = rawTenants.map((tenant) => ({
    ...tenant,
    phone: tenant.phone ?? '',
    email: tenant.email ?? '',
    deposit_cents: tenant.deposit_cents ?? 0,
    current_cam_cents: tenant.current_cam_cents ?? 0,
    future_cam_cents: tenant.future_cam_cents ?? null,
    cam_effective_date:
      tenant.cam_effective_date ??
      tenant.scheduled_increase?.effective_date ??
      tenant.lease_end ??
      null,
  }))

  let parsedCategories = parsed.categories?.length ? parsed.categories : seedCategories
  const hasCamRecon = parsedCategories.some((category) => category.name === 'CAM Reconciliation')
  if (!hasCamRecon) {
    parsedCategories = [
      ...parsedCategories,
      {
        id: crypto.randomUUID(),
        name: 'CAM Reconciliation',
        transaction_type: 'Income',
      },
    ]
  }
  const hasDepreciation = parsedCategories.some(
    (category) => category.name === DEPRECIATION_CATEGORY_NAME,
  )
  const categories = hasDepreciation
    ? parsedCategories
    : [
        ...parsedCategories,
        {
          id: crypto.randomUUID(),
          name: DEPRECIATION_CATEGORY_NAME,
          transaction_type: 'PAndL',
        },
      ]

  const vendors = (parsed.vendors ?? []).map((vendor) => ({
    ...vendor,
    account_info: vendor.account_info ?? '',
  }))

  return {
    version: parsed.version ?? 1,
    properties,
    units: rawUnits,
    tenants,
    transactions: parsed.transactions ?? [],
    categories,
    vendors,
    document_defaults: {
      payee_name: parsed.document_defaults?.payee_name ?? '',
      mailing_address: parsed.document_defaults?.mailing_address ?? '',
    },
  }
}
