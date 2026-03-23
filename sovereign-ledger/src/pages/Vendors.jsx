import { useState } from 'react'
import { useDataContext } from '../context/useDataContext'

function Vendors() {
  const { data, setVendors } = useDataContext()
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [accountInfo, setAccountInfo] = useState('')
  const vendors = data.vendors ?? []

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      window.alert('Vendor name is required.')
      return
    }
    if (editingId) {
      setVendors(
        vendors.map((vendor) =>
          vendor.id === editingId
            ? {
                ...vendor,
                name: trimmedName,
                contact: contact.trim(),
                service_type: serviceType.trim(),
                account_info: accountInfo.trim(),
              }
            : vendor,
        ),
      )
      setEditingId(null)
    } else {
      setVendors([
        ...vendors,
        {
          id: crypto.randomUUID(),
          name: trimmedName,
          contact: contact.trim(),
          service_type: serviceType.trim(),
          account_info: accountInfo.trim(),
        },
      ])
    }
    setName('')
    setContact('')
    setServiceType('')
    setAccountInfo('')
  }

  const handleDelete = (vendor) => {
    if (!window.confirm('Delete this vendor? This cannot be undone.')) {
      return
    }
    setVendors(vendors.filter((candidate) => candidate.id !== vendor.id))
  }

  const handleEdit = (vendor) => {
    setEditingId(vendor.id)
    setName(vendor.name ?? '')
    setContact(vendor.contact ?? '')
    setServiceType(vendor.service_type ?? '')
    setAccountInfo(vendor.account_info ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setName('')
    setContact('')
    setServiceType('')
    setAccountInfo('')
  }

  return (
    <section className="sovereign-page sovereign-page--wide">
      <h1 className="sovereign-page-title">Vendors</h1>
      <form className="sovereign-quick-add" onSubmit={handleSubmit}>
        <h2 className="sovereign-section-heading">{editingId ? 'Edit Vendor' : 'Add Vendor'}</h2>
        <div className="sovereign-form-row">
          <label className="sovereign-label">Vendor Name</label>
          <input
            className="sovereign-input"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="sovereign-form-row">
          <label className="sovereign-label">Contact Info</label>
          <input
            className="sovereign-input"
            type="text"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
          />
        </div>
        <div className="sovereign-form-row">
          <label className="sovereign-label">Service Type</label>
          <input
            className="sovereign-input"
            type="text"
            value={serviceType}
            onChange={(event) => setServiceType(event.target.value)}
          />
        </div>
        <div className="sovereign-form-row">
          <label className="sovereign-label">Account Info</label>
          <input
            className="sovereign-input"
            type="text"
            value={accountInfo}
            onChange={(event) => setAccountInfo(event.target.value)}
            placeholder="Billing account #, vendor ID, etc."
          />
        </div>
        <div className="sovereign-actions">
          <button type="submit" className="sovereign-btn sovereign-btn-add">
            {editingId ? 'Save Vendor' : 'Add Vendor'}
          </button>
          {editingId && (
            <button type="button" className="sovereign-btn sovereign-btn-secondary" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="ledger-table-wrap">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Service Type</th>
              <th>Account Info</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => (
              <tr key={vendor.id}>
                <td>{vendor.name}</td>
                <td>{vendor.contact || '—'}</td>
                <td>{vendor.service_type || '—'}</td>
                <td>{vendor.account_info || '—'}</td>
                <td>
                  <button
                    type="button"
                    className="sovereign-btn sovereign-btn-secondary"
                    onClick={() => handleEdit(vendor)}
                  >
                    Edit
                  </button>{' '}
                  <button
                    type="button"
                    className="sovereign-btn sovereign-btn-danger"
                    onClick={() => handleDelete(vendor)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr>
                <td colSpan={5} className="sovereign-muted">
                  No vendors yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default Vendors
