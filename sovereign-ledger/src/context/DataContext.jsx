import { useEffect, useMemo, useState } from 'react'
import { seedCategories } from '../data/seedCategories'
import { normalizeLedgerData } from '../lib/normalizeLedgerData'
import { DataContext } from './DataContextObject'

export const SOVEREIGN_LEDGER_STORAGE_KEY = 'sovereignLedger_v1'
const STORAGE_KEY = SOVEREIGN_LEDGER_STORAGE_KEY

const defaultData = {
  version: 1,
  properties: [],
  units: [],
  tenants: [],
  transactions: [],
  categories: seedCategories,
  vendors: [],
  document_defaults: {
    payee_name: '',
    mailing_address: '',
  },
}

export function DataProvider({ children }) {
  const [data, setData] = useState(() => {
    const existing = localStorage.getItem(STORAGE_KEY)

    if (!existing) {
      return defaultData
    }

    try {
      const parsed = JSON.parse(existing)
      const normalized = normalizeLedgerData(parsed)
      if (normalized) {
        return normalized
      }
    } catch {
      return defaultData
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  const value = useMemo(
    () => ({
      data,
      setData,
      setProperties: (properties) =>
        setData((prev) => ({
          ...prev,
          properties,
        })),
      setUnits: (units) =>
        setData((prev) => ({
          ...prev,
          units,
        })),
      setTenants: (tenants) =>
        setData((prev) => ({
          ...prev,
          tenants,
        })),
      setTransactions: (transactions) =>
        setData((prev) => ({
          ...prev,
          transactions,
        })),
      setVendors: (vendors) =>
        setData((prev) => ({
          ...prev,
          vendors,
        })),
    }),
    [data],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
