/**
 * Which property `type` values show each category on the P&L.
 * If a category is missing, it is shown for residential, commercial, and mixed.
 */
export const CATEGORY_PROPERTY_TYPES = {
  'CAM / Reimbursements': ['commercial', 'mixed'],
  'CAM Reconciliation': ['commercial', 'mixed'],
  'Commissions / Leasing Fees': ['commercial', 'mixed'],
  // All other income/expense lines default to all types
}

export function categoryVisibleForPropertyType(categoryName, effectiveType) {
  const normalized = String(effectiveType || 'mixed').toLowerCase()
  const allowed = CATEGORY_PROPERTY_TYPES[categoryName]
  if (!allowed || allowed.length === 0) {
    return true
  }
  return allowed.includes(normalized)
}

export function resolveEffectivePropertyType(selectedPropertyId, properties) {
  if (!selectedPropertyId) {
    return 'mixed'
  }
  const property = properties.find((candidate) => candidate.id === selectedPropertyId)
  const raw = String(property?.property_type ?? 'mixed').toLowerCase()
  if (raw === 'residential' || raw === 'commercial') {
    return raw
  }
  return 'mixed'
}
