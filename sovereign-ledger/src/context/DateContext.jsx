import { useMemo, useState } from 'react'
import { DateContext } from './DateContextObject'

const now = new Date()

export function DateProvider({ children }) {
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const value = useMemo(
    () => ({
      month,
      year,
      setMonth,
      setYear,
    }),
    [month, year],
  )

  return <DateContext.Provider value={value}>{children}</DateContext.Provider>
}
