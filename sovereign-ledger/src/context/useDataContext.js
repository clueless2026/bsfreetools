import { useContext } from 'react'
import { DataContext } from './DataContextObject'

export function useDataContext() {
  const context = useContext(DataContext)

  if (!context) {
    throw new Error('useDataContext must be used within a DataProvider.')
  }

  return context
}
