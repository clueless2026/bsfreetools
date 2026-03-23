import { useMemo, useState } from 'react'
import { useDataContext } from '../context/useDataContext'

function dollarsToCents(dollarsString) {
  const n = Number.parseFloat(String(dollarsString).replace(/,/g, '').trim())
  if (!Number.isFinite(n)) {
    return NaN
  }
  return Math.round(n * 100)
}

function Tenants({ preselectedPropertyId, onClearPreselectedProperty }) {
  const { data, setTenants } = useDataContext()
  const { properties, units, tenants } = data

  const [editingTenantId, setEditingTenantId] = useState(null)
  const [name, setName] = useState('')
  const [propertyId, setPropertyId] = useState(preselectedPropertyId ?? '')
  const [unitId, setUnitId] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [depositDollars, setDepositDollars] = useState('')
  const [leaseStart, setLeaseStart] = useState('')
  const [leaseEnd, setLeaseEnd] = useState('')
  const [currentRentDollars, setCurrentRentDollars] = useState('')
  const [currentCamDollars, setCurrentCamDollars] = useState('')
  const [newRentDollars, setNewRentDollars] = useState('')
  const [futureCamDollars, setFutureCamDollars] = useState('')
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)
  const [squareFootage, setSquareFootage] = useState('')
  const [petRentDollars, setPetRentDollars] = useState('')
  const [petDepositDollars, setPetDepositDollars] = useState('')
  const [landlordNote, setLandlordNote] = useState('')

  const occupiedUnitIds = useMemo(
    () =>
      new Set(
        tenants
          .filter((tenant) => tenant.id !== editingTenantId)
          .map((tenant) => tenant.unit_id),
      ),
    [tenants, editingTenantId],
  )

  const unitsForProperty = useMemo(() => {
    if (!propertyId) {
      return []
    }
    return units
      .filter((u) => u.property_id === propertyId)
      .filter((u) => !occupiedUnitIds.has(u.id))
      .sort((a, b) => String(a.unit_number).localeCompare(String(b.unit_number), undefined, { numeric: true }))
  }, [propertyId, units, occupiedUnitIds])

  const unitsOnProperty = useMemo(() => {
    if (!propertyId) {
      return []
    }
    return units.filter((u) => u.property_id === propertyId)
  }, [propertyId, units])

  const selectedPropertyType = useMemo(() => {
    if (!propertyId) {
      return null
    }
    return properties.find((p) => p.id === propertyId)?.property_type ?? 'mixed'
  }, [propertyId, properties])

  const isResidentialProperty = selectedPropertyType === 'residential'

  const unitSelectPlaceholder = useMemo(() => {
    if (!propertyId) {
      return 'Select a property first'
    }
    if (unitsOnProperty.length === 0) {
      return 'No units — set Total units on Properties'
    }
    if (unitsForProperty.length === 0) {
      return 'All units occupied'
    }
    return 'Select a unit'
  }, [propertyId, unitsOnProperty.length, unitsForProperty.length])

  const visibleTenants = useMemo(() => {
    if (!propertyId) {
      return tenants
    }
    const propertyUnitIds = new Set(
      units.filter((unit) => unit.property_id === propertyId).map((unit) => unit.id),
    )
    return tenants.filter((tenant) => propertyUnitIds.has(tenant.unit_id))
  }, [propertyId, tenants, units])

  const resetForm = () => {
    setName('')
    setPropertyId('')
    setUnitId('')
    setPhone('')
    setEmail('')
    setDepositDollars('')
    setLeaseStart('')
    setLeaseEnd('')
    setCurrentRentDollars('')
    setCurrentCamDollars('')
    setNewRentDollars('')
    setFutureCamDollars('')
    setShowAdvancedFields(false)
    setSquareFootage('')
    setPetRentDollars('')
    setPetDepositDollars('')
    setLandlordNote('')
    setEditingTenantId(null)
    onClearPreselectedProperty?.()
  }

  const startEditing = (tenant) => {
    setEditingTenantId(tenant.id)
    setName(tenant.name ?? '')
    setUnitId(tenant.unit_id ?? '')
    const unit = units.find((candidate) => candidate.id === tenant.unit_id)
    setPropertyId(unit?.property_id ?? '')
    setPhone(tenant.phone ?? '')
    setEmail(tenant.email ?? '')
    setDepositDollars(((tenant.deposit_cents ?? 0) / 100).toFixed(2))
    setLeaseStart(tenant.lease_start ?? '')
    setLeaseEnd(tenant.lease_end ?? '')
    setCurrentRentDollars(((tenant.current_rent_cents ?? 0) / 100).toFixed(2))
    setCurrentCamDollars(((tenant.current_cam_cents ?? 0) / 100).toFixed(2))
    if (tenant.scheduled_increase?.new_rent_cents) {
      setNewRentDollars((tenant.scheduled_increase.new_rent_cents / 100).toFixed(2))
    } else {
      setNewRentDollars('')
    }
    if (tenant.future_cam_cents !== null && tenant.future_cam_cents !== undefined) {
      setFutureCamDollars((tenant.future_cam_cents / 100).toFixed(2))
    } else {
      setFutureCamDollars('')
    }
    setSquareFootage(String(tenant.square_footage ?? ''))
    setPetRentDollars(((tenant.pet_rent_cents ?? 0) / 100).toFixed(2))
    setPetDepositDollars(((tenant.pet_deposit_cents ?? 0) / 100).toFixed(2))
    setLandlordNote(tenant.landlord_note ?? '')
    setShowAdvancedFields(
      Boolean(tenant.square_footage || tenant.pet_rent_cents || tenant.pet_deposit_cents),
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = (tenant) => {
    const ok = window.confirm('Delete this tenant? This cannot be undone.')
    if (!ok) {
      return
    }
    setTenants(tenants.filter((candidate) => candidate.id !== tenant.id))
    if (editingTenantId === tenant.id) {
      resetForm()
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      window.alert('Name is required.')
      return
    }
    if (!propertyId) {
      window.alert('Select a property.')
      return
    }
    if (!unitId) {
      window.alert('Select a vacant unit for this property.')
      return
    }

    const depositCents = dollarsToCents(depositDollars || '0')
    if (!Number.isFinite(depositCents) || depositCents < 0) {
      window.alert('Enter a valid security deposit amount in dollars.')
      return
    }

    const currentRentCents = dollarsToCents(currentRentDollars)
    if (!Number.isFinite(currentRentCents) || currentRentCents <= 0) {
      window.alert('Enter a valid current rent amount in dollars.')
      return
    }

    const currentCamCents = isResidentialProperty
      ? 0
      : dollarsToCents(currentCamDollars || '0')
    const petRentCents = dollarsToCents(petRentDollars || '0')
    const petDepositCents = dollarsToCents(petDepositDollars || '0')
    if (
      !Number.isFinite(petRentCents) ||
      petRentCents < 0 ||
      !Number.isFinite(petDepositCents) ||
      petDepositCents < 0
    ) {
      window.alert('Enter valid pet rent and pet deposit values.')
      return
    }
    const squareFootageValue =
      isResidentialProperty || squareFootage.trim() === ''
        ? null
        : Number.parseInt(squareFootage.trim(), 10)
    if (
      !isResidentialProperty &&
      squareFootage.trim() !== '' &&
      (!Number.isFinite(squareFootageValue) || squareFootageValue <= 0)
    ) {
      window.alert('Square footage must be a positive number.')
      return
    }

    if (!isResidentialProperty && (!Number.isFinite(currentCamCents) || currentCamCents < 0)) {
      window.alert('Enter a valid current CAM amount in dollars.')
      return
    }

    const hasNewRent = newRentDollars.trim() !== ''
    if (!leaseStart || !leaseEnd) {
      window.alert('Lease start and lease end are required.')
      return
    }
    if (leaseStart > leaseEnd) {
      window.alert('Lease end must be on or after lease start.')
      return
    }

    let scheduled_increase = null
    let futureCamCents = null
    if (hasNewRent) {
      const newRentCents = dollarsToCents(newRentDollars)
      if (!Number.isFinite(newRentCents) || newRentCents <= 0) {
        window.alert('Enter a valid new rent amount in dollars.')
        return
      }
      scheduled_increase = {
        effective_date: leaseEnd,
        new_rent_cents: newRentCents,
      }
    }

    if (!isResidentialProperty && futureCamDollars.trim() !== '') {
      futureCamCents = dollarsToCents(futureCamDollars)
      if (!Number.isFinite(futureCamCents) || futureCamCents < 0) {
        window.alert('Enter a valid future CAM amount in dollars.')
        return
      }
    }

    if (editingTenantId) {
      setTenants(
        tenants.map((tenant) =>
          tenant.id === editingTenantId
            ? {
                ...tenant,
                unit_id: unitId,
                name: trimmedName,
                email: email.trim(),
                phone: phone.trim(),
                deposit_cents: depositCents,
                lease_start: leaseStart,
                lease_end: leaseEnd,
                current_rent_cents: currentRentCents,
                current_cam_cents: currentCamCents,
                future_cam_cents: isResidentialProperty ? null : futureCamCents,
                cam_effective_date: isResidentialProperty ? null : leaseEnd,
                scheduled_increase,
                square_footage: isResidentialProperty ? null : squareFootageValue,
                pet_rent_cents: petRentCents,
                pet_deposit_cents: petDepositCents,
                landlord_note: landlordNote.trim(),
              }
            : tenant,
        ),
      )
      resetForm()
      return
    }

    setTenants([
      ...tenants,
      {
        id: crypto.randomUUID(),
        unit_id: unitId,
        name: trimmedName,
        email: email.trim(),
        phone: phone.trim(),
        deposit_cents: depositCents,
        lease_start: leaseStart,
        lease_end: leaseEnd,
        current_rent_cents: currentRentCents,
        current_cam_cents: currentCamCents,
        future_cam_cents: isResidentialProperty ? null : futureCamCents,
        cam_effective_date: isResidentialProperty ? null : leaseEnd,
        scheduled_increase,
        square_footage: isResidentialProperty ? null : squareFootageValue,
        pet_rent_cents: petRentCents,
        pet_deposit_cents: petDepositCents,
        landlord_note: landlordNote.trim(),
      },
    ])
    resetForm()
  }

  return (
    <section className="sovereign-page">
      <h1 className="sovereign-page-title">Tenants</h1>

      <form className="sovereign-quick-add" onSubmit={handleSubmit}>
        <h2 className="sovereign-section-heading">
          {editingTenantId ? 'Edit tenant' : 'New tenant'}
        </h2>

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="tenant-name">
            Name
          </label>
          <input
            id="tenant-name"
            className="sovereign-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tenant name"
            autoComplete="name"
          />
        </div>

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="tenant-property">
            Property
          </label>
          <select
            id="tenant-property"
            className="sovereign-input sovereign-select"
            value={propertyId}
            onChange={(e) => {
              setPropertyId(e.target.value)
              setUnitId('')
            }}
          >
            <option value="">Select a property</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="tenant-unit">
            Unit (vacant)
          </label>
          <select
            id="tenant-unit"
            className="sovereign-input sovereign-select"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            disabled={!propertyId}
          >
            <option value="">{unitSelectPlaceholder}</option>
            {unitsForProperty.map((u) => (
              <option key={u.id} value={u.id}>
                Unit {u.unit_number}
              </option>
            ))}
          </select>
        </div>

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="tenant-rent">
            Current rent (USD)
          </label>
          <input
            id="tenant-rent"
            className="sovereign-input"
            type="text"
            inputMode="decimal"
            value={currentRentDollars}
            onChange={(e) => setCurrentRentDollars(e.target.value)}
            placeholder="e.g. 1500.00"
          />
        </div>

        {!isResidentialProperty && (
          <div className="sovereign-form-row">
            <label className="sovereign-label" htmlFor="tenant-current-cam">
              Current CAM (USD)
            </label>
            <input
              id="tenant-current-cam"
              className="sovereign-input"
              type="text"
              inputMode="decimal"
              value={currentCamDollars}
              onChange={(e) => setCurrentCamDollars(e.target.value)}
              placeholder="e.g. 125.00"
            />
          </div>
        )}

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="tenant-phone">
            Phone
          </label>
          <input
            id="tenant-phone"
            className="sovereign-input"
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="555-1234"
          />
        </div>

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="tenant-email">
            Email
          </label>
          <input
            id="tenant-email"
            className="sovereign-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tenant@example.com"
          />
        </div>

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="tenant-deposit">
            Security deposit (USD)
          </label>
          <input
            id="tenant-deposit"
            className="sovereign-input"
            type="text"
            inputMode="decimal"
            value={depositDollars}
            onChange={(e) => setDepositDollars(e.target.value)}
            placeholder="e.g. 1200.00"
          />
        </div>

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="tenant-lease-start">
            Lease start
          </label>
          <input
            id="tenant-lease-start"
            className="sovereign-input"
            type="date"
            value={leaseStart}
            onChange={(e) => setLeaseStart(e.target.value)}
          />
        </div>

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="tenant-lease-end">
            Lease end
          </label>
          <input
            id="tenant-lease-end"
            className="sovereign-input"
            type="date"
            value={leaseEnd}
            onChange={(e) => setLeaseEnd(e.target.value)}
          />
        </div>

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="tenant-new-rent">
            New rent amount after lease end (USD, optional)
          </label>
          <input
            id="tenant-new-rent"
            className="sovereign-input"
            type="text"
            inputMode="decimal"
            value={newRentDollars}
            onChange={(e) => setNewRentDollars(e.target.value)}
            placeholder="e.g. 1600.00"
          />
        </div>

        {!isResidentialProperty && (
          <div className="sovereign-form-row">
            <label className="sovereign-label" htmlFor="tenant-future-cam">
              Future/Budgeted CAM after lease end (USD, optional)
            </label>
            <input
              id="tenant-future-cam"
              className="sovereign-input"
              type="text"
              inputMode="decimal"
              value={futureCamDollars}
              onChange={(e) => setFutureCamDollars(e.target.value)}
              placeholder="e.g. 150.00"
            />
          </div>
        )}

        <div className="sovereign-form-row">
          <label className="sovereign-label" htmlFor="tenant-landlord-note">
            Note (Internal)
          </label>
          <textarea
            id="tenant-landlord-note"
            className="sovereign-input"
            rows={3}
            value={landlordNote}
            onChange={(e) => setLandlordNote(e.target.value)}
            placeholder="Landlord-only notes"
          />
        </div>

        {showAdvancedFields && (
          <>
            {!isResidentialProperty && (
              <div className="sovereign-form-row">
                <label className="sovereign-label" htmlFor="tenant-square-footage">
                  Square Footage
                </label>
                <input
                  id="tenant-square-footage"
                  className="sovereign-input"
                  type="number"
                  min="0"
                  value={squareFootage}
                  onChange={(e) => setSquareFootage(e.target.value)}
                />
              </div>
            )}
            <div className="sovereign-form-row">
              <label className="sovereign-label" htmlFor="tenant-pet-rent">
                Pet Rent (USD)
              </label>
              <input
                id="tenant-pet-rent"
                className="sovereign-input"
                type="text"
                inputMode="decimal"
                value={petRentDollars}
                onChange={(e) => setPetRentDollars(e.target.value)}
              />
            </div>
            <div className="sovereign-form-row">
              <label className="sovereign-label" htmlFor="tenant-pet-deposit">
                Pet Deposit (USD)
              </label>
              <input
                id="tenant-pet-deposit"
                className="sovereign-input"
                type="text"
                inputMode="decimal"
                value={petDepositDollars}
                onChange={(e) => setPetDepositDollars(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="sovereign-actions">
          <button type="submit" className="sovereign-btn sovereign-btn-add">
            {editingTenantId ? 'Save tenant' : 'Add tenant'}
          </button>
          {editingTenantId && (
            <button
              type="button"
              className="sovereign-btn sovereign-btn-secondary"
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
        </div>

        <div className="sovereign-actions" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="sovereign-btn sovereign-btn-secondary"
            onClick={() => setShowAdvancedFields((prev) => !prev)}
          >
            {showAdvancedFields ? 'Hide Optional Fields' : '+ Optional Fields'}
          </button>
        </div>
      </form>

      <div className="sovereign-list">
        <div className="sovereign-actions">
          <h2 className="sovereign-section-heading">Current tenants</h2>
          {propertyId && (
            <button
              type="button"
              className="sovereign-btn sovereign-btn-secondary"
              onClick={() => setPropertyId('')}
            >
              Show All Properties
            </button>
          )}
        </div>
        {visibleTenants.length === 0 ? (
          <p className="sovereign-muted">No tenants yet.</p>
        ) : (
          <ul className="sovereign-tenant-list">
            {visibleTenants.map((tenant) => {
              const unit = units.find((u) => u.id === tenant.unit_id)
              const property = unit ? properties.find((p) => p.id === unit.property_id) : null
              return (
                <li key={tenant.id} className="sovereign-tenant-card">
                  <strong className="sovereign-property-name">{tenant.name}</strong>
                  <span className="sovereign-property-address">
                    {property ? property.name : '—'}
                    {unit ? ` · Unit ${unit.unit_number}` : ''}
                  </span>
                  <span className="sovereign-muted">
                    Rent:{' '}
                    {(tenant.current_rent_cents / 100).toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    })}
                  </span>
                  <span className="sovereign-muted">
                    Current CAM:{' '}
                    {((tenant.current_cam_cents ?? 0) / 100).toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    })}
                  </span>
                  <span className="sovereign-muted">
                    Future rent:{' '}
                    {tenant.scheduled_increase?.new_rent_cents != null
                      ? (tenant.scheduled_increase.new_rent_cents / 100).toLocaleString('en-US', {
                          style: 'currency',
                          currency: 'USD',
                        })
                      : '—'}
                  </span>
                  <span className="sovereign-muted">
                    Future CAM:{' '}
                    {tenant.future_cam_cents != null
                      ? (tenant.future_cam_cents / 100).toLocaleString('en-US', {
                          style: 'currency',
                          currency: 'USD',
                        })
                      : '—'}
                  </span>
                  <span className="sovereign-muted">
                    Rent adjustment date: {tenant.scheduled_increase?.effective_date || '—'}
                  </span>
                  <span className="sovereign-muted">
                    CAM adjustment date: {tenant.cam_effective_date || '—'}
                  </span>
                  <span className="sovereign-muted">
                    Deposit:{' '}
                    {((tenant.deposit_cents ?? 0) / 100).toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    })}
                  </span>
                  <span className="sovereign-muted">
                    Lease: {tenant.lease_start || '—'} to {tenant.lease_end || '—'}
                  </span>
                  <span className="sovereign-muted">
                    Contact: {tenant.phone || '—'} | {tenant.email || '—'}
                  </span>
                  <span className="sovereign-muted">
                    Note: {tenant.landlord_note?.trim() || '—'}
                  </span>
                  <span className="sovereign-muted">
                    Optional:{' '}
                    {tenant.square_footage != null ? `${tenant.square_footage} sqft` : '—'} · Pet
                    Rent{' '}
                    {((tenant.pet_rent_cents ?? 0) / 100).toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    })}{' '}
                    · Pet Deposit{' '}
                    {((tenant.pet_deposit_cents ?? 0) / 100).toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    })}
                  </span>
                  <div className="sovereign-actions">
                    <button
                      type="button"
                      className="sovereign-btn sovereign-btn-secondary"
                      onClick={() => startEditing(tenant)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="sovereign-btn sovereign-btn-danger"
                      onClick={() => handleDelete(tenant)}
                    >
                      Delete
                    </button>
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

export default Tenants
