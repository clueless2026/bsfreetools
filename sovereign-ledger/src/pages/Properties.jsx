import { useMemo, useState } from 'react'
import { useDataContext } from '../context/useDataContext'

const MAX_UNITS_PER_PROPERTY = 4

function parseUnitList(input) {
  const values = input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return Array.from(new Set(values))
}

function dollarsToCents(dollarsString) {
  const n = Number.parseFloat(String(dollarsString).replace(/,/g, '').trim())
  if (!Number.isFinite(n)) {
    return NaN
  }
  return Math.round(n * 100)
}

function centsToDollarsString(cents) {
  return ((cents ?? 0) / 100).toFixed(2)
}

function formatCurrency(cents) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const PROPERTY_TYPE_OPTIONS = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'mixed', label: 'Mixed' },
]

const blankFinancials = {
  propertyTax: '0.00',
  insurance: '0.00',
  monthlyDepreciation: '0.00',
  propertyType: 'mixed',
  payeeName: '',
  mailingAddress: '',
}

function Properties({ onOpenPropertyTenants }) {
  const { data, setData } = useDataContext()
  const properties = data.properties
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [unitListInput, setUnitListInput] = useState('1')
  const [financials, setFinancials] = useState(blankFinancials)
  const [editingPropertyId, setEditingPropertyId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editUnitListInput, setEditUnitListInput] = useState('')
  const [editFinancials, setEditFinancials] = useState(blankFinancials)

  const unitsByPropertyId = useMemo(() => {
    const map = new Map()
    for (const unit of data.units) {
      const list = map.get(unit.property_id) ?? []
      list.push(unit)
      map.set(unit.property_id, list)
    }
    for (const [propertyId, list] of map.entries()) {
      list.sort((a, b) =>
        String(a.unit_number).localeCompare(String(b.unit_number), undefined, {
          numeric: true,
        }),
      )
      map.set(propertyId, list)
    }
    return map
  }, [data.units])

  const parseFinancialsToCents = (state) => {
    const propertyTaxCents = dollarsToCents(state.propertyTax)
    const insuranceCents = dollarsToCents(state.insurance)
    const monthlyDepreciationCents = dollarsToCents(state.monthlyDepreciation)

    const all = [propertyTaxCents, insuranceCents, monthlyDepreciationCents]
    if (all.some((value) => !Number.isFinite(value) || value < 0)) {
      return null
    }

    return {
      property_tax_cents: propertyTaxCents,
      insurance_cents: insuranceCents,
      monthly_depreciation_cents: monthlyDepreciationCents,
      property_type: state.propertyType || 'mixed',
      payee_name: state.payeeName.trim(),
      mailing_address: state.mailingAddress.trim(),
    }
  }

  const handleAdd = (event) => {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedAddress = address.trim()
    if (!trimmedName || !trimmedAddress) {
      return
    }
    if (properties.length >= 2) {
      window.alert('Maximum of 2 properties allowed.')
      return
    }
    const duplicate = properties.some(
      (property) =>
        property.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        property.address.trim().toLowerCase() === trimmedAddress.toLowerCase(),
    )
    if (duplicate) {
      window.alert('A property with this name and address already exists.')
      return
    }

    const parsedUnits = parseUnitList(unitListInput)
    if (parsedUnits.length < 1 || parsedUnits.length > MAX_UNITS_PER_PROPERTY) {
      window.alert(
        `Provide between 1 and ${MAX_UNITS_PER_PROPERTY} unit labels (comma-separated).`,
      )
      return
    }

    const parsedFinancials = parseFinancialsToCents(financials)
    if (!parsedFinancials) {
      window.alert('Enter valid dollar values for property financials.')
      return
    }

    const propertyId = crypto.randomUUID()
    const newProperty = {
      id: propertyId,
      name: trimmedName,
      address: trimmedAddress,
      total_units: parsedUnits.length,
      ...parsedFinancials,
    }
    const newUnits = parsedUnits.map((label) => ({
      id: crypto.randomUUID(),
      property_id: propertyId,
      unit_number: label,
      description: '',
    }))

    setData((prev) => ({
      ...prev,
      properties: [...prev.properties, newProperty],
      units: [...prev.units, ...newUnits],
    }))

    setName('')
    setAddress('')
    setUnitListInput('1')
    setFinancials(blankFinancials)
  }

  const startEditing = (property) => {
    setEditingPropertyId(property.id)
    setEditName(property.name)
    setEditAddress(property.address)
    const labels =
      unitsByPropertyId
        .get(property.id)
        ?.map((unit) => unit.unit_number)
        .join(', ') ?? ''
    setEditUnitListInput(labels)
    setEditFinancials({
      propertyTax: centsToDollarsString(property.property_tax_cents),
      insurance: centsToDollarsString(property.insurance_cents),
      monthlyDepreciation: centsToDollarsString(property.monthly_depreciation_cents),
      propertyType: property.property_type ?? 'mixed',
      payeeName: property.payee_name ?? '',
      mailingAddress: property.mailing_address ?? '',
    })
  }

  const cancelEditing = () => {
    setEditingPropertyId(null)
    setEditName('')
    setEditAddress('')
    setEditUnitListInput('')
    setEditFinancials(blankFinancials)
  }

  const handleSaveEdit = (property) => {
    const trimmedName = editName.trim()
    const trimmedAddress = editAddress.trim()
    const parsedUnits = parseUnitList(editUnitListInput)
    if (!trimmedName || !trimmedAddress) {
      window.alert('Name and address are required.')
      return
    }
    const duplicate = properties.some(
      (candidate) =>
        candidate.id !== property.id &&
        candidate.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        candidate.address.trim().toLowerCase() === trimmedAddress.toLowerCase(),
    )
    if (duplicate) {
      window.alert('A property with this name and address already exists.')
      return
    }
    if (parsedUnits.length < 1 || parsedUnits.length > MAX_UNITS_PER_PROPERTY) {
      window.alert(
        `Provide between 1 and ${MAX_UNITS_PER_PROPERTY} unit labels (comma-separated).`,
      )
      return
    }

    const parsedFinancials = parseFinancialsToCents(editFinancials)
    if (!parsedFinancials) {
      window.alert('Enter valid dollar values for property financials.')
      return
    }

    const existingUnits = unitsByPropertyId.get(property.id) ?? []
    const updatedUnits = []
    const removedUnits = []

    for (let index = 0; index < parsedUnits.length; index += 1) {
      const existingUnit = existingUnits[index]
      if (existingUnit) {
        updatedUnits.push({
          ...existingUnit,
          unit_number: parsedUnits[index],
        })
      } else {
        updatedUnits.push({
          id: crypto.randomUUID(),
          property_id: property.id,
          unit_number: parsedUnits[index],
          description: '',
        })
      }
    }

    for (let index = parsedUnits.length; index < existingUnits.length; index += 1) {
      removedUnits.push(existingUnits[index])
    }

    const removedUnitIds = new Set(removedUnits.map((unit) => unit.id))
    const hasTenantsOnRemovedUnits = data.tenants.some((tenant) =>
      removedUnitIds.has(tenant.unit_id),
    )
    if (hasTenantsOnRemovedUnits) {
      window.alert(
        'Cannot remove units with assigned tenants. Reassign or delete those tenants first.',
      )
      return
    }

    setData((prev) => ({
      ...prev,
      properties: prev.properties.map((candidate) =>
        candidate.id === property.id
          ? {
              ...candidate,
              name: trimmedName,
              address: trimmedAddress,
              total_units: parsedUnits.length,
              ...parsedFinancials,
            }
          : candidate,
      ),
      units: [
        ...prev.units.filter((unit) => unit.property_id !== property.id),
        ...updatedUnits,
      ],
    }))

    cancelEditing()
  }

  const openRentRollPrint = (property) => {
    const units = (unitsByPropertyId.get(property.id) ?? []).slice()
    const rowsHtml = units
      .map((unit) => {
        const tenant = data.tenants.find((t) => t.unit_id === unit.id)
        const tenantName = tenant?.name ? escapeHtml(tenant.name) : 'Vacant'
        const lease =
          tenant?.lease_start && tenant?.lease_end
            ? `${escapeHtml(tenant.lease_start)} – ${escapeHtml(tenant.lease_end)}`
            : '—'
        const rent = tenant ? formatCurrency(tenant.current_rent_cents ?? 0) : '—'
        const petRent =
          tenant && (tenant.pet_rent_cents ?? 0) > 0
            ? formatCurrency(tenant.pet_rent_cents)
            : '—'
        const cam =
          tenant && (tenant.current_cam_cents ?? 0) > 0
            ? formatCurrency(tenant.current_cam_cents)
            : '—'
        const futureRent =
          tenant?.scheduled_increase?.new_rent_cents != null
            ? formatCurrency(tenant.scheduled_increase.new_rent_cents)
            : '—'
        const futureCam =
          tenant?.future_cam_cents != null ? formatCurrency(tenant.future_cam_cents) : '—'
        const rentAdj = tenant?.scheduled_increase?.effective_date
          ? escapeHtml(tenant.scheduled_increase.effective_date)
          : '—'
        const camAdj = tenant?.cam_effective_date ? escapeHtml(tenant.cam_effective_date) : '—'
        return `<tr>
          <td>${escapeHtml(String(unit.unit_number))}</td>
          <td>${tenantName}</td>
          <td>${lease}</td>
          <td class="num">${rent}</td>
          <td class="num">${petRent}</td>
          <td class="num">${cam}</td>
          <td class="num">${futureRent}</td>
          <td class="num">${futureCam}</td>
          <td>${rentAdj}</td>
          <td>${camAdj}</td>
        </tr>`
      })
      .join('')

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Rent Roll — ${escapeHtml(property.name)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 22px; margin: 0 0 4px; }
        .sub { color: #444; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #f3f4f6; font-weight: 700; }
        td.num { text-align: right; }
        @media print { body { padding: 12px; } }
      </style></head><body>
      <h1>Rent Roll</h1>
      <div class="sub">${escapeHtml(property.name)} · ${escapeHtml(property.address)} · Generated ${escapeHtml(new Date().toLocaleDateString())}</div>
      <table>
        <thead><tr>
          <th>Unit #</th><th>Tenant</th><th>Lease dates</th><th class="num">Rent</th>
          <th class="num">Pet rent</th><th class="num">CAM</th>
          <th class="num">Future rent</th><th class="num">Future CAM</th>
          <th>Rent adj. date</th><th>CAM adj. date</th>
        </tr></thead>
        <tbody>${rowsHtml || '<tr><td colspan="10">No units.</td></tr>'}</tbody>
      </table>
      <script>window.print();</script>
      </body></html>`
    const popup = window.open('', '_blank', 'width=1100,height=900')
    if (!popup) {
      window.alert('Please allow pop-ups to print the rent roll.')
      return
    }
    popup.document.write(html)
    popup.document.close()
  }

  const handleDelete = (property) => {
    const unitsForProperty = data.units.filter((u) => u.property_id === property.id)
    const unitIds = new Set(unitsForProperty.map((u) => u.id))
    const hasTenants = data.tenants.some((t) => unitIds.has(t.unit_id))
    if (hasTenants) {
      window.alert('Remove all tenants assigned to this property first.')
      return
    }
    const ok = window.confirm('Delete this property? This cannot be undone.')
    if (!ok) {
      return
    }
    setData((prev) => ({
      ...prev,
      properties: prev.properties.filter((p) => p.id !== property.id),
      units: prev.units.filter((u) => u.property_id !== property.id),
    }))
  }

  return (
    <section className="sovereign-page">
      <h1 className="sovereign-page-title">Properties</h1>

      <form className="sovereign-quick-add" onSubmit={handleAdd}>
        <h2 className="sovereign-section-heading">Quick add</h2>
        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="property-name">
            Name
          </label>
          <input
            id="property-name"
            className="sovereign-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Property name"
            autoComplete="off"
          />
        </div>
        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="property-address">
            Address
          </label>
          <input
            id="property-address"
            className="sovereign-input"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, city, state ZIP"
            autoComplete="street-address"
          />
        </div>
        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="property-unit-list">
            Units (comma-separated)
          </label>
          <input
            id="property-unit-list"
            className="sovereign-input"
            type="text"
            value={unitListInput}
            onChange={(e) => setUnitListInput(e.target.value)}
            placeholder="101, 2A, Coach House"
          />
          <p className="sovereign-hint">
            Define up to {MAX_UNITS_PER_PROPERTY} custom unit labels.
          </p>
        </div>

        <h2 className="sovereign-section-heading">Financials</h2>
        <div className="sovereign-form-row">
          <label className="sovereign-label">Monthly Property Tax (USD)</label>
          <input
            className="sovereign-input"
            type="text"
            inputMode="decimal"
            value={financials.propertyTax}
            onChange={(e) =>
              setFinancials((prev) => ({ ...prev, propertyTax: e.target.value }))
            }
          />
        </div>
        <div className="sovereign-form-row">
          <label className="sovereign-label">Monthly Insurance (USD)</label>
          <input
            className="sovereign-input"
            type="text"
            inputMode="decimal"
            value={financials.insurance}
            onChange={(e) =>
              setFinancials((prev) => ({ ...prev, insurance: e.target.value }))
            }
          />
        </div>
        <div className="sovereign-form-row">
          <label className="sovereign-label">Type</label>
          <select
            className="sovereign-input sovereign-select"
            value={financials.propertyType}
            onChange={(e) =>
              setFinancials((prev) => ({ ...prev, propertyType: e.target.value }))
            }
          >
            {PROPERTY_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="sovereign-hint">
            Commercial, residential, or mixed. Residential simplifies tenant CAM/sq ft. fields.
          </p>
        </div>
        <div className="sovereign-form-row">
          <label className="sovereign-label">Monthly Depreciation — fixed (USD)</label>
          <input
            className="sovereign-input"
            type="text"
            inputMode="decimal"
            value={financials.monthlyDepreciation}
            onChange={(e) =>
              setFinancials((prev) => ({ ...prev, monthlyDepreciation: e.target.value }))
            }
          />
          <p className="sovereign-hint">Stored in cents; used on the Profit and Loss report.</p>
        </div>

        <h2 className="sovereign-section-heading">Rent Letter Defaults (Property)</h2>
        <div className="sovereign-form-row">
          <label className="sovereign-label">Payee Name</label>
          <input
            className="sovereign-input"
            type="text"
            value={financials.payeeName}
            onChange={(e) =>
              setFinancials((prev) => ({ ...prev, payeeName: e.target.value }))
            }
          />
        </div>
        <div className="sovereign-form-row">
          <label className="sovereign-label">Mailing Address</label>
          <input
            className="sovereign-input"
            type="text"
            value={financials.mailingAddress}
            onChange={(e) =>
              setFinancials((prev) => ({ ...prev, mailingAddress: e.target.value }))
            }
          />
        </div>

        <button type="submit" className="sovereign-btn sovereign-btn-add">
          Add Property
        </button>
      </form>

      <div className="sovereign-list">
        {properties.length === 0 ? (
          <p className="sovereign-muted">No properties yet. Add one above.</p>
        ) : (
          <ul className="sovereign-property-list">
            {properties.map((property) => {
              const propertyUnits = unitsByPropertyId.get(property.id) ?? []
              const unitLabels = propertyUnits.map((unit) => unit.unit_number).join(', ')
              const isEditing = editingPropertyId === property.id

              return (
                <li key={property.id} className="sovereign-property-card">
                  <div className="sovereign-property-body">
                    {isEditing ? (
                      <>
                        <div className="sovereign-form-row">
                          <label className="sovereign-label">Name</label>
                          <input
                            className="sovereign-input"
                            type="text"
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                          />
                        </div>
                        <div className="sovereign-form-row">
                          <label className="sovereign-label">Address</label>
                          <input
                            className="sovereign-input"
                            type="text"
                            value={editAddress}
                            onChange={(event) => setEditAddress(event.target.value)}
                          />
                        </div>
                        <div className="sovereign-form-row">
                          <label className="sovereign-label">Units (comma-separated)</label>
                          <input
                            className="sovereign-input"
                            type="text"
                            value={editUnitListInput}
                            onChange={(event) => setEditUnitListInput(event.target.value)}
                          />
                        </div>
                        <div className="sovereign-form-row">
                          <label className="sovereign-label">Monthly Property Tax (USD)</label>
                          <input
                            className="sovereign-input"
                            type="text"
                            inputMode="decimal"
                            value={editFinancials.propertyTax}
                            onChange={(e) =>
                              setEditFinancials((prev) => ({
                                ...prev,
                                propertyTax: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="sovereign-form-row">
                          <label className="sovereign-label">Monthly Insurance (USD)</label>
                          <input
                            className="sovereign-input"
                            type="text"
                            inputMode="decimal"
                            value={editFinancials.insurance}
                            onChange={(e) =>
                              setEditFinancials((prev) => ({
                                ...prev,
                                insurance: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="sovereign-form-row">
                          <label className="sovereign-label">Type</label>
                          <select
                            className="sovereign-input sovereign-select"
                            value={editFinancials.propertyType}
                            onChange={(e) =>
                              setEditFinancials((prev) => ({
                                ...prev,
                                propertyType: e.target.value,
                              }))
                            }
                          >
                            {PROPERTY_TYPE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sovereign-form-row">
                          <label className="sovereign-label">Monthly Depreciation — fixed (USD)</label>
                          <input
                            className="sovereign-input"
                            type="text"
                            inputMode="decimal"
                            value={editFinancials.monthlyDepreciation}
                            onChange={(e) =>
                              setEditFinancials((prev) => ({
                                ...prev,
                                monthlyDepreciation: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="sovereign-form-row">
                          <label className="sovereign-label">Payee Name</label>
                          <input
                            className="sovereign-input"
                            type="text"
                            value={editFinancials.payeeName}
                            onChange={(e) =>
                              setEditFinancials((prev) => ({
                                ...prev,
                                payeeName: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="sovereign-form-row">
                          <label className="sovereign-label">Mailing Address</label>
                          <input
                            className="sovereign-input"
                            type="text"
                            value={editFinancials.mailingAddress}
                            onChange={(e) =>
                              setEditFinancials((prev) => ({
                                ...prev,
                                mailingAddress: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <strong className="sovereign-property-name">{property.name}</strong>
                        <span className="sovereign-property-address">{property.address}</span>
                        <span className="sovereign-muted">Units: {unitLabels || '—'}</span>
                        <span className="sovereign-muted">
                          Type:{' '}
                          {PROPERTY_TYPE_OPTIONS.find(
                            (o) => o.value === (property.property_type ?? 'mixed'),
                          )?.label ?? 'Mixed'}
                          {' · '}
                          Holding Costs:{' '}
                          {(
                            ((property.property_tax_cents ?? 0) +
                              (property.insurance_cents ?? 0)) /
                            100
                          ).toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD',
                          })}
                          {' · '}
                          Depreciation:{' '}
                          {((property.monthly_depreciation_cents ?? 0) / 100).toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD',
                          })}
                          /mo
                        </span>
                      </>
                    )}
                  </div>
                  <div className="sovereign-actions">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className="sovereign-btn sovereign-btn-add"
                          onClick={() => handleSaveEdit(property)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="sovereign-btn sovereign-btn-secondary"
                          onClick={cancelEditing}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="sovereign-btn sovereign-btn-secondary"
                          onClick={() => openRentRollPrint(property)}
                        >
                          Rent Roll
                        </button>
                        <button
                          type="button"
                          className="sovereign-btn sovereign-btn-secondary"
                          onClick={() => onOpenPropertyTenants?.(property.id)}
                        >
                          Tenants
                        </button>
                        <button
                          type="button"
                          className="sovereign-btn sovereign-btn-secondary"
                          onClick={() => startEditing(property)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="sovereign-btn sovereign-btn-danger"
                          onClick={() => handleDelete(property)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export default Properties
