import { useEffect, useState } from 'react'
import { useToast } from '../../components/ToastProvider'
import { getExpiredInventory, getNearExpiryInventory, getNearExpiryInventoryDetails } from '../../config/api'
import AdminLayout from './AdminLayout'

function normalizeList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.items)) return response.data.items
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.inventory)) return response.inventory
  if (Array.isArray(response?.results)) return response.results
  return []
}

function getId(item, index) {
  return item?._id || item?.id || item?.batchId || `${item?.medicineName || 'expiry'}-${index}`
}

function ExpiryAlerts() {
  const { showToast } = useToast()
  const [mode, setMode] = useState('near')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  async function load(nextMode = mode) {
    setMode(nextMode)
    setLoading(true)
    try {
      const response = nextMode === 'expired'
        ? await getExpiredInventory()
        : nextMode === 'details'
          ? await getNearExpiryInventoryDetails()
          : await getNearExpiryInventory()
      setItems(normalizeList(response))
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load('near')
  }, [])

  return (
    <AdminLayout activeLabel="Expiry Alerts" title="Expiry Alerts" subtitle="Admin / Expiry Alerts">
      <section className="branch-panel">
        <div className="branch-panel-heading"><h2>Expiry Inventory</h2></div>
        <div className="inventory-tabs">
          <button className={mode === 'near' ? 'active' : ''} type="button" onClick={() => load('near')}>Near Expiry</button>
          <button className={mode === 'details' ? 'active' : ''} type="button" onClick={() => load('details')}>Near Expiry Details</button>
          <button className={mode === 'expired' ? 'active' : ''} type="button" onClick={() => load('expired')}>Expired</button>
        </div>
        {loading ? <p>Loading expiry alerts...</p> : null}
        <div className="branch-table-wrap">
          <table className="branch-table">
            <thead><tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Expiry Date</th><th>Days Left</th><th>Status</th></tr></thead>
            <tbody>
              {!loading && items.length ? items.map((item, index) => <tr key={getId(item, index)}><td>{item?.medicineName || item?.medicine?.name || item?.name || '-'}</td><td>{item?.batchNo || item?.batchNumber || item?.batchId || '-'}</td><td>{item?.quantity || item?.stock || item?.qty || 0}</td><td>{item?.expiryDate || item?.expiresAt || '-'}</td><td>{item?.daysLeft ?? '-'}</td><td><span className={`branch-status ${String(item?.status || mode).toLowerCase().replaceAll(' ', '-')}`}>{item?.status || mode}</span></td></tr>) : null}
              {!loading && !items.length ? <tr><td colSpan="6">No expiry data found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  )
}

export default ExpiryAlerts
