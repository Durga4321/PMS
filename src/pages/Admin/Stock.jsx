import { useEffect, useState } from 'react'
import { useToast } from '../../components/ToastProvider'
import {
  addInventoryStock,
  adjustInventory,
  disposeInventoryBatch,
  getInventory,
  getInventoryBatch,
  getInventorySummary,
  getInventoryTransactions,
  getInventoryValuation,
  getMedicineBatches,
  getLowStockInventory,
  getMedicineStock,
  getNearExpiryInventory,
  getOutOfStockInventory,
  quarantineInventoryBatch,
  updateInventoryLevels,
} from '../../config/api'
import AdminLayout from './AdminLayout'

const stockFormDefaults = { medicineId: '', batchNo: '', quantity: '', expiryDate: '', costPrice: '', sellingPrice: '' }
const levelDefaults = { medicineId: '', minimumStock: '', maximumStock: '', reorderLevel: '' }
const adjustmentDefaults = { medicineId: '', batchId: '', quantity: '', type: 'increase', reason: '' }

function normalizeList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.inventory)) return response.data.inventory
  if (Array.isArray(response?.inventory)) return response.inventory
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.results)) return response.results
  if (Array.isArray(response?.transactions)) return response.transactions
  if (Array.isArray(response?.batches)) return response.batches
  return []
}

function getId(item) {
  return item?._id || item?.id || item?.medicineId || item?.batchId || item?.uuid
}

function getMedicineName(item) {
  return item?.medicineName || item?.medicine?.name || item?.name || '-'
}

function Stock() {
  const { showToast } = useToast()
  const [view, setView] = useState('inventory')
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [stockForm, setStockForm] = useState(stockFormDefaults)
  const [levels, setLevels] = useState(levelDefaults)
  const [adjustment, setAdjustment] = useState(adjustmentDefaults)
  const [batchId, setBatchId] = useState('')
  const [batchMessage, setBatchMessage] = useState('')

  async function load(nextView = view) {
    setLoading(true)
    setView(nextView)
    try {
      const loaders = {
        inventory: getInventory,
        low: getLowStockInventory,
        near: getNearExpiryInventory,
        out: getOutOfStockInventory,
        summary: getInventorySummary,
        transactions: getInventoryTransactions,
        valuation: getInventoryValuation,
      }
      const response = await loaders[nextView]()
      if (nextView === 'summary' || nextView === 'valuation') setSummary(response?.data || response)
      else setItems(normalizeList(response))
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load('inventory')
  }, [])

  async function handleAddStock(event) {
    event.preventDefault()
    try {
      const response = await addInventoryStock({
        ...stockForm,
        quantity: Number(stockForm.quantity),
        costPrice: stockForm.costPrice ? Number(stockForm.costPrice) : undefined,
        sellingPrice: stockForm.sellingPrice ? Number(stockForm.sellingPrice) : undefined,
      })
      showToast(response?.message || 'Stock added successfully.')
      setStockForm(stockFormDefaults)
      await load('inventory')
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleLevels(event) {
    event.preventDefault()
    try {
      const response = await updateInventoryLevels(levels.medicineId, {
        minimumStock: Number(levels.minimumStock),
        maximumStock: Number(levels.maximumStock),
        reorderLevel: Number(levels.reorderLevel),
      })
      showToast(response?.message || 'Stock levels updated successfully.')
      setLevels(levelDefaults)
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleAdjustment(event) {
    event.preventDefault()
    try {
      const response = await adjustInventory({ ...adjustment, quantity: Number(adjustment.quantity) })
      showToast(response?.message || 'Inventory adjusted successfully.')
      setAdjustment(adjustmentDefaults)
      await load('inventory')
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleBatchAction(action) {
    if (!batchId) return showToast('Enter a batch ID first.', 'error')
    try {
      let response
      if (action === 'batch') response = await getInventoryBatch(batchId)
      if (action === 'dispose') response = await disposeInventoryBatch(batchId, { reason: 'Disposed from admin module' })
      if (action === 'quarantine') response = await quarantineInventoryBatch(batchId, { quarantined: true })
      setBatchMessage(JSON.stringify(response?.data || response))
      showToast(response?.message || 'Batch action completed.')
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function loadMedicineSpecific(kind) {
    const medicineId = levels.medicineId || adjustment.medicineId || stockForm.medicineId
    if (!medicineId) return showToast('Enter a medicine ID first.', 'error')
    try {
      const response = kind === 'batches' ? await getMedicineBatches(medicineId) : await getMedicineStock(medicineId)
      setItems(normalizeList(response))
      setView(kind)
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  return (
    <AdminLayout activeLabel="Stock" title="Stock Management" subtitle="Admin / Inventory">
      <section className="branch-panel inventory-tools">
        <div className="branch-panel-heading"><h2>Inventory</h2></div>
        <div className="inventory-tabs">
          {['inventory', 'low', 'near', 'out', 'summary', 'transactions', 'valuation'].map((item) => <button className={view === item ? 'active' : ''} type="button" onClick={() => load(item)} key={item}>{item}</button>)}
        </div>
        <div className="inventory-actions-line">
          <button type="button" onClick={() => loadMedicineSpecific('stock')}>Medicine Stock</button>
          <button type="button" onClick={() => loadMedicineSpecific('batches')}>Medicine Batches</button>
        </div>
        {loading ? <p>Loading inventory...</p> : null}
        {summary ? <pre className="inventory-json">{JSON.stringify(summary, null, 2)}</pre> : null}
        {!summary ? <div className="branch-table-wrap"><table className="branch-table"><thead><tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Expiry</th><th>Status</th></tr></thead><tbody>{items.length ? items.map((item, index) => <tr key={getId(item) || index}><td>{getMedicineName(item)}</td><td>{item?.batchNo || item?.batchNumber || '-'}</td><td>{item?.quantity || item?.stock || item?.qty || 0}</td><td>{item?.expiryDate || item?.expiresAt || '-'}</td><td><span className={`branch-status ${String(item?.status || 'active').toLowerCase().replaceAll(' ', '-')}`}>{item?.status || 'Active'}</span></td></tr>) : <tr><td colSpan="5">No inventory data found.</td></tr>}</tbody></table></div> : null}
      </section>

      <section className="inventory-form-grid">
        <form className="branch-panel inventory-mini-form" onSubmit={handleAddStock}><h2>Add Stock</h2>{Object.keys(stockForm).map((key) => <label key={key}>{key}<input type={key.includes('Date') ? 'date' : 'text'} value={stockForm[key]} onChange={(event) => setStockForm({ ...stockForm, [key]: event.target.value })} required={['medicineId', 'batchNo', 'quantity'].includes(key)} /></label>)}<button type="submit">Add Stock</button></form>
        <form className="branch-panel inventory-mini-form" onSubmit={handleLevels}><h2>Stock Levels</h2>{Object.keys(levels).map((key) => <label key={key}>{key}<input value={levels[key]} onChange={(event) => setLevels({ ...levels, [key]: event.target.value })} required /></label>)}<button type="submit">Update Levels</button></form>
        <form className="branch-panel inventory-mini-form" onSubmit={handleAdjustment}><h2>Adjustment</h2><label>medicineId<input value={adjustment.medicineId} onChange={(event) => setAdjustment({ ...adjustment, medicineId: event.target.value })} required /></label><label>batchId<input value={adjustment.batchId} onChange={(event) => setAdjustment({ ...adjustment, batchId: event.target.value })} /></label><label>type<select value={adjustment.type} onChange={(event) => setAdjustment({ ...adjustment, type: event.target.value })}><option>increase</option><option>decrease</option></select></label><label>quantity<input value={adjustment.quantity} onChange={(event) => setAdjustment({ ...adjustment, quantity: event.target.value })} required /></label><label>reason<input value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} required /></label><button type="submit">Adjust</button></form>
      </section>

      <section className="branch-panel inventory-batch-tools"><h2>Batch Actions</h2><input value={batchId} onChange={(event) => setBatchId(event.target.value)} placeholder="Batch ID" /><button type="button" onClick={() => handleBatchAction('batch')}>Get Batch</button><button type="button" onClick={() => handleBatchAction('dispose')}>Dispose</button><button type="button" onClick={() => handleBatchAction('quarantine')}>Quarantine</button>{batchMessage ? <pre className="inventory-json">{batchMessage}</pre> : null}</section>
    </AdminLayout>
  )
}

export default Stock
