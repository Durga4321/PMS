import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Clean up stale mock/cached business data from local and session storage
// so the application reads and writes exclusively from the backend database.
;(function purgeLocalBusinessData() {
  try {
    const keysToPurge = [
      'pms_pharmacy_sub_branches',
      'pms_sub_branches',
      'pms_pharmacy_pharmacists',
      'pms_pharmacists',
      'pms_pharmacy_medicines',
      'pms_medicines',
      'pms_imported_medicines',
      'pms_admin_pharmacies_list',
      'pms_admin_branches',
      'pms_all_pharmacist_permissions',
      'pms_all_admin_permissions',
      'pms_purchase_orders',
      'pms_stock_transfers',
    ]
    for (const key of keysToPurge) {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    }

    const prefixesToPurge = [
      'pms_pharmacist_permissions_',
      'pms_admin_permissions_',
      'pms_pharmacy_pharmacists_',
      'pms_pharmacy_medicines_',
      'pms_pharmacy_sub_branches_',
      'pms_sub_branches_',
      'pms_admin_role_',
      'pms_pharmacist_custom_',
      'pms_medicine_cache_',
      'pms_branches_',
      'pms_medicines_',
    ]

    const allKeys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k) allKeys.push(k)
    }
    for (const k of allKeys) {
      if (prefixesToPurge.some((prefix) => k.startsWith(prefix))) {
        localStorage.removeItem(k)
      }
    }
  } catch {}
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
