import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { DataProvider } from './context/DataContext'
import { DateProvider } from './context/DateContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DateProvider>
      <DataProvider>
        <App />
      </DataProvider>
    </DateProvider>
  </StrictMode>,
)
