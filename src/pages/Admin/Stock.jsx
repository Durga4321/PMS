import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useToast } from '../../components/ToastProvider'
import RowActions from '../../components/RowActions'
import AdminLayout from './AdminLayout'
import { 
  addInventoryStock,
  adjustInventoryWithReason,
  disposeInventoryBatch,
  getExpiredInventory,
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
  listMedicines,
  quarantineInventoryBatch,
  updateInventoryLevels,
  getPharmacyAdminDashboard,
  readLocalMedicines,
  writeLocalMedicines
} from '../../config/api'
import './Stock.css'

const SUMMARY_CARDS = [
  {
    id: 'totalMedicines',
    label: 'TOTAL MEDICINES',
    metricKey: 'totalMedicines',
    route: '/inventory',
    view: 'inventory',
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: 'rgba(37, 99, 235, 0.2)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m10.5 11.5 5 5m-2.5-9L8 12.5a4.24 4.24 0 0 0 6 6l5-5a4.24 4.24 0 0 0-6-6Z"/>
      </svg>
    )
  },
  {
    id: 'totalStock',
    label: 'TOTAL STOCK',
    metricKey: 'totalStock',
    route: '/inventory',
    view: 'inventory',
    color: '#0ea5e9',
    bgColor: '#e0f2fe',
    borderColor: 'rgba(14, 165, 233, 0.2)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.29 7 12 12 20.71 7"/>
        <line x1="12" y1="22" x2="12" y2="12"/>
      </svg>
    )
  },
  {
    id: 'lowStock',
    label: 'LOW STOCK',
    metricKey: 'lowStock',
    route: '/low-stock',
    view: 'low',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    borderColor: 'rgba(245, 158, 11, 0.2)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    )
  },
  {
    id: 'nearExpiry',
    label: 'NEAR EXPIRY',
    metricKey: 'nearExpiry',
    route: '/near-expiry',
    view: 'near',
    color: '#f97316',
    bgColor: '#ffedd5',
    borderColor: 'rgba(249, 115, 22, 0.2)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    )
  },
  {
    id: 'expired',
    label: 'EXPIRED',
    metricKey: 'expired',
    route: '/expired',
    view: 'expired',
    color: '#ef4444',
    bgColor: '#fee2e2',
    borderColor: 'rgba(239, 68, 68, 0.2)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <path d="m14 14-4 4m0-4 4 4"/>
      </svg>
    )
  }
]

const NAV_TABS = [
  {
    key: 'inventory',
    label: 'Inventory',
    route: '/inventory',
    color: '#2563eb',
    bgColor: '#eff6ff',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.29 7 12 12 20.71 7"/>
        <line x1="12" y1="22" x2="12" y2="12"/>
      </svg>
    )
  },
  {
    key: 'summary',
    label: 'Stock Summary',
    route: '/stock-summary',
    color: '#0ea5e9',
    bgColor: '#e0f2fe',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    )
  },
  {
    key: 'transactions',
    label: 'Transactions',
    route: '/transactions',
    color: '#10b981',
    bgColor: '#d1fae5',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>
      </svg>
    )
  },
  {
    key: 'valuation',
    label: 'Valuation',
    route: '/valuation',
    color: '#ec4899',
    bgColor: '#fce7f3',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12M6 8h12M6 13h8.5a4.5 4.5 0 0 1 0 9H6M14.5 13l-9 9"/>
      </svg>
    )
  }
]

function normalizeList(response) {
  if (Array.isArray(response)) return response

  const data = response?.data ?? response?.Data ?? response
  if (Array.isArray(data)) return data

  const candidates = [
    data?.items,
    data?.Items,
    data?.inventory,
    data?.Inventory,
    data?.batches,
    data?.Batches,
    data?.transactions,
    data?.Transactions,
    data?.medicines,
    data?.Medicines,
    data?.results,
    data?.Results,
    data?.records,
    data?.Records,
  ]

  return candidates.find(Array.isArray) || []
}

function parseFlexibleDate(raw) {
  if (!raw) return null
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw
  const s = String(raw).trim()
  if (!s || s === '-') return null
  let d = new Date(s)
  if (!isNaN(d.getTime())) return d
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    d = new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`)
    if (!isNaN(d.getTime())) return d
  }
  const my = s.match(/^(\d{1,2})[/-](\d{4})$/)
  if (my) {
    d = new Date(`${my[2]}-${my[1].padStart(2, '0')}-01`)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

export function formatStockRecord(item, index = 0) {
  const id = item?._id || item?.id || item?.medicineId || `med-${index + 1}`
  const name = item?.medicineName || item?.name || item?.genericName || '-'
  const generic = item?.genericName || '-'
  const category = item?.category || item?.categoryName || 'General'
  const dosage = item?.dosageForm || item?.form || 'Tablet'
  const strength = item?.strength || '-'
  const unit = item?.unit || 'Units'
  const code = item?.medicineCode || item?.code || ''
  const batchNo = item?.batchNo || item?.batchNumber || item?.batchId || code || `BATCH-${index + 1}`

  const qty = Number(item?.quantity ?? item?.Quantity ?? item?.stock ?? item?.Stock ?? item?.currentStock ?? item?.CurrentStock ?? item?.availableStock ?? item?.AvailableStock ?? item?.totalStock ?? item?.TotalStock ?? item?.stockQuantity ?? item?.StockQuantity ?? item?.initialStockCount ?? item?.InitialStockCount ?? item?.availableQty ?? item?.qty ?? 0) || 0
  const minStock = Number(item?.minimumStock ?? item?.minStock ?? item?.minimumStockThreshold ?? 10)
  const reorder = Number(item?.reorderLevel ?? item?.reorderStockLevel ?? 5)
  const price = Number(item?.sellingPrice ?? item?.price ?? item?.mrp ?? 0)
  const cost = Number(item?.purchasePrice ?? item?.costPrice ?? 0)

  const rawExpiry = item?.expiryDate || item?.ExpiryDate || item?.expiresAt || item?.ExpiresAt || item?.expiry || item?.Expiry || item?.batch?.expiryDate || null
  let expiryDate = '-'
  let daysLeft = 999
  const expDate = parseFlexibleDate(rawExpiry)
  if (expDate) {
    expiryDate = expDate.toISOString().slice(0, 10)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(expDate)
    target.setHours(0, 0, 0, 0)
    daysLeft = Math.round((target - today) / (24 * 60 * 60 * 1000))
  } else if (item?.daysLeft !== undefined && item?.daysLeft !== null && !isNaN(Number(item.daysLeft))) {
    daysLeft = Number(item.daysLeft)
  }

  let status = 'In Stock'
  if (qty <= 0) status = 'Out of Stock'
  else if (qty <= reorder) status = 'Low Stock'
  if (daysLeft <= 0) status = 'Expired'
  else if (daysLeft <= 30) status = 'Near Expiry'

  return {
    ...item,
    id,
    _id: id,
    medicineId: id,
    medicineName: name,
    name,
    genericName: generic,
    category,
    dosageForm: dosage,
    strength,
    unit,
    code,
    medicineCode: code,
    batchNo,
    batchNumber: batchNo,
    quantity: qty,
    stock: qty,
    availableQty: qty,
    minimumStock: minStock,
    minStock,
    reorderLevel: reorder,
    expiryDate,
    daysLeft,
    sellingPrice: price,
    price,
    costPrice: cost,
    purchasePrice: cost,
    status: daysLeft <= 0 ? 'Expired' : (item?.status && !['active', 'inactive'].includes(String(item.status).toLowerCase()) ? item.status : status),
  }
}

export default function Stock({ initialView }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()

  const getViewFromPath = () => {
    const path = location.pathname
    if (path.includes('low-stock')) return 'low'
    if (path.includes('near-expiry')) return 'near'
    if (path.includes('out-of-stock')) return 'out'
    if (path.includes('stock-summary')) return 'summary'
    if (path.includes('transactions')) return 'transactions'
    if (path.includes('valuation')) return 'valuation'
    if (path.includes('expired')) return 'expired'
    if (path.includes('inventory')) return 'inventory'
    return initialView || 'inventory'
  }

  const [view, setView] = useState(getViewFromPath) // inventory, low, near, out, summary, transactions, valuation
  const [items, setItems] = useState(() => {
    const local = readLocalMedicines()
    return local.map((m, idx) => formatStockRecord(m, idx))
  })
  const [medicinesList, setMedicinesList] = useState(() => readLocalMedicines())
  const [summaryData, setSummaryData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expiryFilter, setExpiryFilter] = useState('all')
  
  // Modals state
  const [addStockOpen, setAddStockOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [levelsOpen, setLevelsOpen] = useState(false)
  const [viewingItem, setViewingItem] = useState(null)
  
  // General Dashboard totals
  const [metrics, setMetrics] = useState({
    totalMedicines: 0,
    totalStock: 0,
    lowStock: 0,
    nearExpiry: 0,
    expired: 0
  })

  // Add Stock Form
  const [stockForm, setStockForm] = useState({
    medicineId: '',
    batchNo: '',
    quantity: '',
    expiryDate: '',
    costPrice: '',
    sellingPrice: '',
    supplier: '',
    purchaseDate: '',
    notes: ''
  })

  // Adjust Stock Form
  const [adjustmentForm, setAdjustmentForm] = useState({
    medicineId: '',
    batchId: '',
    quantity: '',
    type: 'increase',
    reason: '',
    notes: ''
  })

  // Stock Levels Form
  const [levelsForm, setLevelsForm] = useState({
    medicineId: '',
    minimumStock: '',
    maximumStock: '',
    reorderLevel: ''
  })

  async function loadSummaryMetrics() {
    try {
      const [dashRes, medRes, invRes, expInvRes] = await Promise.allSettled([
        getPharmacyAdminDashboard(),
        listMedicines(),
        getInventory(),
        getExpiredInventory(),
      ])
      const data = dashRes.status === 'fulfilled' ? (dashRes.value?.data?.dashboard || dashRes.value?.data || dashRes.value || {}) : {}
      let meds = medRes.status === 'fulfilled' ? normalizeList(medRes.value) : []
      if (!meds || !meds.length) {
        meds = readLocalMedicines()
      }
      const inv = invRes.status === 'fulfilled' ? normalizeList(invRes.value) : []
      const expInv = expInvRes.status === 'fulfilled' ? normalizeList(expInvRes.value) : []
      const combinedInv = [...inv, ...expInv]
      const allStockItems = meds.length > 0 ? meds : (combinedInv.length > 0 ? combinedInv : readLocalMedicines())

      const now = Date.now()
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

      const calcTotalMedicines = Math.max(meds.length, inv.length, allStockItems.length)
      const inStockMeds = allStockItems.filter((item) => {
        const qty = Number(item?.quantity ?? item?.stock ?? item?.stockQuantity ?? item?.initialStockCount ?? item?.qty ?? 0) || 0
        const st = String(item?.status || '').toLowerCase()
        return !st.includes('inactive') && !st.includes('out') && qty > 0
      }).length
      const calcTotalStock = inStockMeds > 0 ? inStockMeds : calcTotalMedicines
      const calcLowStock = allStockItems.filter((item) => {
        const qty = Number(item?.quantity ?? item?.stock ?? item?.stockQuantity ?? item?.initialStockCount ?? item?.qty ?? 0) || 0
        const reorder = Number(item?.reorderLevel ?? item?.minStock ?? item?.minimumStock ?? 5)
        return qty > 0 && qty <= reorder
      }).length
      const calcNearExpiry = allStockItems.filter((item) => {
        const raw = item?.expiryDate || item?.ExpiryDate || item?.expiresAt || item?.ExpiresAt || item?.expiry || item?.Expiry
        const d = parseFlexibleDate(raw)
        if (!d) return false
        const diff = d.getTime() - now
        return diff > 0 && diff <= thirtyDaysMs
      }).length
      const calcExpired = allStockItems.filter((item) => {
        const raw = item?.expiryDate || item?.ExpiryDate || item?.expiresAt || item?.ExpiresAt || item?.expiry || item?.Expiry
        const d = parseFlexibleDate(raw)
        if (!d) return false
        const diff = d.getTime() - now
        return diff <= 0
      }).length

      setMetrics({
        totalMedicines: Math.max(Number(data?.totalMedicines || data?.medicinesCount || 0), calcTotalMedicines),
        totalStock: calcTotalStock,
        lowStock: calcLowStock || Number(data?.lowStockMedicines || data?.lowStockCount || 0),
        nearExpiry: calcNearExpiry || Number(data?.nearExpiryBatches || data?.nearExpiryCount || 0),
        expired: calcExpired || Number(data?.expiredBatches || data?.expiredCount || 0)
      })
    } catch (e) {
      console.log('Unable to load Stock metrics:', e.message)
    }
  }

  async function load(nextView = view) {
    setLoading(true)
    setView(nextView)
    try {
      if (nextView === 'summary' || nextView === 'valuation') {
        const loaders = {
          summary: getInventorySummary,
          valuation: getInventoryValuation,
        }
        let response = null
        try {
          response = await loaders[nextView]()
        } catch (e) {
          console.warn(`Stock: ${nextView} loader failed:`, e.message)
        }
        const data = response?.data || response
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          setSummaryData(data)
        } else {
          const localMeds = readLocalMedicines()
          let totalCost = 0
          let potentialSales = 0
          localMeds.forEach((item) => {
            const qty = Number(item?.quantity ?? item?.stock ?? 0) || 0
            const cost = Number(item?.purchasePrice ?? item?.costPrice ?? 0) || 0
            const price = Number(item?.sellingPrice ?? item?.price ?? 0) || 0
            totalCost += (qty * cost)
            potentialSales += (qty * price)
          })
          const profit = Math.max(0, potentialSales - totalCost)
          setSummaryData({
            totalMedicines: localMeds.length,
            totalInventoryValue: potentialSales || totalCost,
            totalCostValue: totalCost,
            potentialSellingValue: potentialSales,
            estimatedProfit: profit,
          })
        }
        setItems([])
      } else if (nextView === 'transactions') {
        const response = await getInventoryTransactions().catch(() => [])
        setItems(normalizeList(response))
        setSummaryData(null)
      } else {
        // For stock inventory views: 'inventory', 'low', 'near', 'out', 'expired'
        // Always load full medicines catalogue (contains all uploaded/added medicines)
        // AND backend inventory batches
        const isExpiredView = nextView === 'expired'
        const isNearView = nextView === 'near'
        const isLowView = nextView === 'low'
        const isOutView = nextView === 'out'

        const [medResponse, invResponse, expInvResponse] = await Promise.allSettled([
          listMedicines(),
          isLowView
            ? getLowStockInventory()
            : isNearView
            ? getNearExpiryInventory()
            : isOutView
            ? getOutOfStockInventory()
            : isExpiredView
            ? getExpiredInventory()
            : getInventory(),
          !isLowView && !isNearView && !isOutView && !isExpiredView
            ? getExpiredInventory().catch(() => [])
            : Promise.resolve([]),
        ])

        if (medResponse.status === 'rejected') {
          console.warn('Stock: listMedicines() rejected:', medResponse.reason)
        }
        if (invResponse.status === 'rejected') {
          console.warn('Stock: inventory query rejected:', invResponse.reason)
        }

        let meds = medResponse.status === 'fulfilled' ? normalizeList(medResponse.value) : []
        if (!meds || !meds.length) {
          meds = readLocalMedicines()
        }
        setMedicinesList(meds)
        let invList = invResponse.status === 'fulfilled' ? normalizeList(invResponse.value) : []
        if (expInvResponse && expInvResponse.status === 'fulfilled') {
          const expiredBatches = normalizeList(expInvResponse.value)
          if (expiredBatches && expiredBatches.length) {
            const existingBatchIds = new Set(invList.map((b) => String(b?.id || b?._id || b?.batchId || b?.batchNo || '')))
            expiredBatches.forEach((eb) => {
              const ebId = String(eb?.id || eb?._id || eb?.batchId || eb?.batchNo || '')
              if (!ebId || !existingBatchIds.has(ebId)) {
                invList.push(eb)
              }
            })
          }
        }

        // Create quick lookup for medicines by id, code, and name
        const medMap = new Map()
        meds.forEach((m) => {
          const id = String(m?.id || m?._id || m?.medicineId || '').trim().toLowerCase()
          const code = String(m?.code || m?.medicineCode || '').trim().toLowerCase()
          const name = String(m?.name || m?.medicineName || '').trim().toLowerCase()
          if (id) medMap.set(`id:${id}`, m)
          if (code) medMap.set(`code:${code}`, m)
          if (name) medMap.set(`name:${name}`, m)
        })

        // Track which medicines are covered by existing batch rows
        const coveredMedIds = new Set()

        const enrichedBatches = invList.map((batch, idx) => {
          const batchMedId = String(batch?.medicineId || batch?.MedicineId || batch?.medicine?.id || batch?.medicine?._id || batch?.medicine?.medicineId || '').trim().toLowerCase()
          const batchCode = String(batch?.code || batch?.medicineCode || batch?.MedicineCode || '').trim().toLowerCase()
          const batchName = String(batch?.medicineName || batch?.MedicineName || batch?.medicine?.name || batch?.name || '').trim().toLowerCase()

          const linked = medMap.get(`id:${batchMedId}`) || medMap.get(`code:${batchCode}`) || medMap.get(`name:${batchName}`) || {}
          if (batchMedId) coveredMedIds.add(`id:${batchMedId}`)
          if (batchCode) coveredMedIds.add(`code:${batchCode}`)
          if (batchName) coveredMedIds.add(`name:${batchName}`)

          const mergedExpiry = batch?.expiryDate || batch?.ExpiryDate || batch?.expiresAt || batch?.ExpiresAt || batch?.expiry || batch?.Expiry || batch?.batch?.expiryDate || linked?.expiryDate || linked?.ExpiryDate || linked?.expiresAt || linked?.ExpiresAt || linked?.expiry || linked?.Expiry || null
          return formatStockRecord({ ...linked, ...batch, expiryDate: mergedExpiry }, idx)
        })

        // For all medicines from the catalogue that do not have separate batch rows,
        // include them as stock inventory items so ALL uploaded medicines are present in stock!
        const catalogueItems = []
        meds.forEach((m, idx) => {
          const id = String(m?.id || m?._id || m?.medicineId || '').trim().toLowerCase()
          const code = String(m?.code || m?.medicineCode || '').trim().toLowerCase()
          const name = String(m?.name || m?.medicineName || '').trim().toLowerCase()

          const alreadyCovered = (id && coveredMedIds.has(`id:${id}`)) ||
                                (code && coveredMedIds.has(`code:${code}`)) ||
                                (name && coveredMedIds.has(`name:${name}`))

          if (!alreadyCovered) {
            catalogueItems.push(formatStockRecord(m, invList.length + idx))
          }
        })

        let combined = [...enrichedBatches, ...catalogueItems]

        // Filter based on view tabs
        const now = Date.now()
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

        if (nextView === 'low') {
          setStatusFilter('low stock')
          setExpiryFilter('all')
          setView('inventory')
        } else if (nextView === 'out') {
          setStatusFilter('out of stock')
          setExpiryFilter('all')
          setView('inventory')
        } else if (nextView === 'near') {
          setExpiryFilter('near')
          setStatusFilter('all')
          setView('inventory')
        } else if (nextView === 'expired') {
          setExpiryFilter('expired')
          setStatusFilter('all')
          setView('inventory')
        }

        setItems(combined)
        setSummaryData(null)
      }
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleNavigate(route, targetView) {
    if (targetView === 'summary' || targetView === 'valuation' || targetView === 'transactions') {
      setView(targetView)
      load(targetView)
      if (location.pathname !== route) {
        navigate(route)
      }
      return
    }

    setView('inventory')
    setCategoryFilter('all')
    setSearch('')

    if (targetView === 'expired') {
      setExpiryFilter('expired')
      setStatusFilter('all')
    } else if (targetView === 'near') {
      setExpiryFilter('near')
      setStatusFilter('all')
    } else if (targetView === 'low') {
      setStatusFilter('low stock')
      setExpiryFilter('all')
    } else if (targetView === 'out') {
      setStatusFilter('out of stock')
      setExpiryFilter('all')
    } else {
      setStatusFilter('all')
      setExpiryFilter('all')
    }

    load('inventory')
    if (location.pathname !== route) {
      navigate(route)
    }
  }

  useEffect(() => {
    const target = getViewFromPath()
    loadSummaryMetrics()
    load(target)
  }, [location.pathname])

  // Computed display metrics that always reflect current stock items and medicines catalogue
  const displayMetrics = useMemo(() => {
    const sourceItems = items.length > 0
      ? items
      : (medicinesList.length > 0 ? medicinesList.map((m, i) => formatStockRecord(m, i)) : readLocalMedicines().map((m, i) => formatStockRecord(m, i)))
    
    const now = Date.now()
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

    const totalMedicines = Math.max(sourceItems.length, metrics.totalMedicines || 0)
    
    // In-stock medicines count (active medicines with stock > 0, exactly matching Active Medicines in Medicines page)
    const inStockItems = sourceItems.filter((it) => {
      const qty = Number(it?.quantity ?? it?.stock ?? it?.stockQuantity ?? it?.initialStockCount ?? it?.qty ?? 0) || 0
      const st = String(it?.status || '').toLowerCase()
      return !st.includes('inactive') && !st.includes('out') && qty > 0
    })
    const totalStock = inStockItems.length > 0 ? inStockItems.length : totalMedicines

    const lowStock = sourceItems.filter((it) => {
      const qty = Number(it?.quantity ?? it?.stock ?? it?.stockQuantity ?? it?.initialStockCount ?? it?.qty ?? 0) || 0
      const reorder = Number(it?.reorderLevel ?? it?.minStock ?? 5) || 5
      return qty > 0 && qty <= reorder
    }).length
    const nearExpiry = sourceItems.filter((it) => {
      const raw = it?.expiryDate
      if (!raw || raw === '-') return false
      const diff = new Date(raw).getTime() - now
      return !isNaN(diff) && diff > 0 && diff <= thirtyDaysMs
    }).length
    const expired = sourceItems.filter((it) => {
      const raw = it?.expiryDate
      if (!raw || raw === '-') return false
      const diff = new Date(raw).getTime() - now
      return !isNaN(diff) && diff <= 0
    }).length

    const totalUnits = sourceItems.reduce((acc, it) => acc + (Number(it?.quantity ?? it?.stock ?? it?.stockQuantity ?? it?.initialStockCount ?? it?.qty ?? 0) || 0), 0)

    return {
      totalMedicines: totalMedicines || (metrics.totalMedicines || 0),
      totalStock: totalStock || (metrics.totalStock || 0),
      lowStock: lowStock || (metrics.lowStock || 0),
      nearExpiry: nearExpiry || (metrics.nearExpiry || 0),
      expired: expired || (metrics.expired || 0),
      totalUnits
    }
  }, [items, medicinesList, metrics])

  // Dynamic category list from items or medicinesList or readLocalMedicines
  const categories = useMemo(() => {
    const set = new Set()
    const source = items.length > 0 ? items : (medicinesList.length > 0 ? medicinesList : readLocalMedicines())
    source.forEach(item => {
      const cat = item?.category || item?.categoryName
      if (cat && cat !== '-' && cat !== 'General') set.add(cat)
    })
    return Array.from(set).sort()
  }, [items, medicinesList])

  // Full available medicines catalogue for dropdown selections
  const availableMedicines = useMemo(() => {
    if (medicinesList.length > 0) return medicinesList
    if (items.length > 0) return items
    return readLocalMedicines()
  }, [medicinesList, items])

  // Filtered Inventory list
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const name = (item?.medicineName || item?.name || '').toLowerCase()
      const generic = (item?.genericName || '').toLowerCase()
      const batch = (item?.batchNo || item?.batchNumber || item?.code || item?.medicineCode || '').toLowerCase()
      const category = (item?.category || item?.categoryName || '').toLowerCase()
      const dosage = (item?.dosageForm || '').toLowerCase()
      const query = search.trim().toLowerCase()
      
      const matchesSearch = !query ||
        name.includes(query) ||
        generic.includes(query) ||
        batch.includes(query) ||
        category.includes(query) ||
        dosage.includes(query)
      
      const matchesCategory = categoryFilter === 'all' || category === categoryFilter.toLowerCase()

      const qty = Number(item?.quantity ?? item?.stock ?? 0)
      const reorder = Number(item?.reorderLevel ?? 5)
      const itemStatus = String(item?.status || '').toLowerCase()

      let matchesStatus = statusFilter === 'all'
      if (!matchesStatus) {
        if (statusFilter === 'in stock') matchesStatus = qty > 0 && !itemStatus.includes('out') && !itemStatus.includes('inactive')
        else if (statusFilter === 'low stock') matchesStatus = qty > 0 && qty <= reorder
        else if (statusFilter === 'out of stock') matchesStatus = qty <= 0 || itemStatus.includes('out')
        else matchesStatus = itemStatus.includes(statusFilter.toLowerCase())
      }
      
      const rawDays = item?.daysLeft
      let daysLeft = (rawDays !== undefined && rawDays !== null && !isNaN(Number(rawDays))) ? Number(rawDays) : 999
      if (daysLeft === 999 && item?.expiryDate && item?.expiryDate !== '-') {
        const d = parseFlexibleDate(item.expiryDate)
        if (d) {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const target = new Date(d)
          target.setHours(0, 0, 0, 0)
          daysLeft = Math.round((target - today) / (24 * 60 * 60 * 1000))
        }
      }

      const st = String(item?.status || '').toLowerCase()
      const isExpired = daysLeft <= 0 || st.includes('expired')
      const isNear = !isExpired && ((daysLeft > 0 && daysLeft <= 30) || st.includes('near'))

      let matchesExpiry = true
      if (expiryFilter === 'all') {
        matchesExpiry = true
      } else if (expiryFilter === 'all_expiry') {
        matchesExpiry = isExpired || isNear
      } else if (expiryFilter === 'expired') {
        matchesExpiry = isExpired
      } else if (expiryFilter === 'near') {
        matchesExpiry = isNear
      }
      
      return matchesSearch && matchesCategory && matchesStatus && matchesExpiry
    })
  }, [items, search, categoryFilter, statusFilter, expiryFilter])

  // Form Submissions
  async function handleAddStockSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const body = {
        medicineId: stockForm.medicineId,
        batchNo: stockForm.batchNo,
        quantity: Number(stockForm.quantity),
        expiryDate: stockForm.expiryDate,
        costPrice: stockForm.costPrice ? Number(stockForm.costPrice) : undefined,
        sellingPrice: stockForm.sellingPrice ? Number(stockForm.sellingPrice) : undefined,
        supplier: stockForm.supplier || undefined,
        purchaseDate: stockForm.purchaseDate || undefined,
        notes: stockForm.notes || undefined
      }
      const response = await addInventoryStock(body)

      // Also update local cache so Medicines page and Stock cards reflect updated stock immediately
      const allMeds = readLocalMedicines()
      const targetIdx = allMeds.findIndex(m => String(m?.id || m?._id || m?.medicineId) === String(stockForm.medicineId))
      if (targetIdx >= 0) {
        const curStock = Number(allMeds[targetIdx].stock ?? allMeds[targetIdx].quantity ?? 0)
        allMeds[targetIdx] = {
          ...allMeds[targetIdx],
          stock: curStock + Number(stockForm.quantity),
          quantity: curStock + Number(stockForm.quantity),
          initialStockCount: curStock + Number(stockForm.quantity),
          ...(stockForm.expiryDate ? { expiryDate: stockForm.expiryDate } : {}),
          ...(stockForm.costPrice ? { purchasePrice: Number(stockForm.costPrice), costPrice: Number(stockForm.costPrice) } : {}),
          ...(stockForm.sellingPrice ? { sellingPrice: Number(stockForm.sellingPrice), price: Number(stockForm.sellingPrice) } : {})
        }
        writeLocalMedicines(allMeds)
      }

      showToast(response?.message || 'Stock added successfully!')
      setAddStockOpen(false)
      setStockForm({
        medicineId: '',
        batchNo: '',
        quantity: '',
        expiryDate: '',
        costPrice: '',
        sellingPrice: '',
        supplier: '',
        purchaseDate: '',
        notes: ''
      })
      await load(view)
      loadSummaryMetrics()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdjustSubmit(e) {
    e.preventDefault()
    
    if (adjustmentForm.type === 'decrease') {
      if (!window.confirm('Are you sure you want to decrease stock levels? This will impact availability.')) {
        return
      }
    }

    setLoading(true)
    try {
      const body = {
        medicineId: adjustmentForm.medicineId,
        batchId: adjustmentForm.batchId || undefined,
        quantity: Number(adjustmentForm.quantity),
        type: adjustmentForm.type,
        reason: adjustmentForm.reason,
        notes: adjustmentForm.notes || undefined
      }
      const response = await adjustInventoryWithReason(body)

      // Update local cache for immediate two-way consistency
      const allMeds = readLocalMedicines()
      const targetIdx = allMeds.findIndex(m => String(m?.id || m?._id || m?.medicineId) === String(adjustmentForm.medicineId))
      if (targetIdx >= 0) {
        const curStock = Number(allMeds[targetIdx].stock ?? allMeds[targetIdx].quantity ?? 0)
        const adjQty = Number(adjustmentForm.quantity)
        const newStock = adjustmentForm.type === 'decrease' ? Math.max(0, curStock - adjQty) : curStock + adjQty
        allMeds[targetIdx] = {
          ...allMeds[targetIdx],
          stock: newStock,
          quantity: newStock,
          initialStockCount: newStock,
        }
        writeLocalMedicines(allMeds)
      }

      showToast(response?.message || 'Stock levels adjusted successfully!')
      setAdjustOpen(false)
      setAdjustmentForm({
        medicineId: '',
        batchId: '',
        quantity: '',
        type: 'increase',
        reason: '',
        notes: ''
      })
      await load(view)
      loadSummaryMetrics()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleLevelsSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await updateInventoryLevels(levelsForm.medicineId, {
        minimumStock: Number(levelsForm.minimumStock),
        maximumStock: Number(levelsForm.maximumStock),
        reorderLevel: Number(levelsForm.reorderLevel)
      })

      // Update local cache
      const allMeds = readLocalMedicines()
      const targetIdx = allMeds.findIndex(m => String(m?.id || m?._id || m?.medicineId) === String(levelsForm.medicineId))
      if (targetIdx >= 0) {
        allMeds[targetIdx] = {
          ...allMeds[targetIdx],
          minimumStock: Number(levelsForm.minimumStock),
          minStock: Number(levelsForm.minimumStock),
          maximumStock: Number(levelsForm.maximumStock),
          maxStock: Number(levelsForm.maximumStock),
          reorderLevel: Number(levelsForm.reorderLevel),
        }
        writeLocalMedicines(allMeds)
      }

      showToast(response?.message || 'Stock levels configured successfully!')
      setLevelsOpen(false)
      setLevelsForm({
        medicineId: '',
        minimumStock: '',
        maximumStock: '',
        reorderLevel: ''
      })
      await load(view)
      loadSummaryMetrics()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Action Triggers: Dispose & Quarantine
  async function handleDispose(batchNo) {
    if (!window.confirm(`Are you sure you want to dispose batch: ${batchNo}?`)) return
    setLoading(true)
    try {
      const response = await disposeInventoryBatch(batchNo, { reason: 'Expired stock disposal' })

      // Update local cache
      const allMeds = readLocalMedicines()
      const targetIdx = allMeds.findIndex(m => (m?.batchNo && m.batchNo === batchNo) || (m?.code && m.code === batchNo) || (m?.id && m.id === batchNo))
      if (targetIdx >= 0) {
        allMeds[targetIdx] = {
          ...allMeds[targetIdx],
          stock: 0,
          quantity: 0,
          status: 'Disposed',
        }
        writeLocalMedicines(allMeds)
      }

      showToast(response?.message || 'Batch disposed successfully.')
      await load(view)
      loadSummaryMetrics()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleQuarantine(batchNo) {
    if (!window.confirm(`Are you sure you want to quarantine batch: ${batchNo}?`)) return
    setLoading(true)
    try {
      const response = await quarantineInventoryBatch(batchNo, { quarantined: true })
      showToast(response?.message || 'Batch quarantined successfully.')
      await load(view)
      loadSummaryMetrics()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Prefill helper function for adjustments
  function prefillAdjustment(item) {
    setAdjustmentForm({
      medicineId: item?.medicineId || item?._id || item?.id || '',
      batchId: item?.batchNo || item?.batchNumber || '',
      quantity: '',
      type: 'increase',
      reason: '',
      notes: ''
    })
    setAdjustOpen(true)
  }

  // Prefill helper for levels configuration
  function prefillLevels(item) {
    setLevelsForm({
      medicineId: item?.medicineId || item?._id || item?.id || '',
      minimumStock: String(item?.minimumStock || item?.minStock || ''),
      maximumStock: String(item?.maximumStock || item?.maxStock || ''),
      reorderLevel: String(item?.reorderLevel || '')
    })
    setLevelsOpen(true)
  }

  // Dynamic getters for columns
  const getId = (item, index) => item?._id || item?.id || item?.batchId || item?.batchNo || item?.batchNumber || item?.transactionId || `${index}`
  const getMedicineName = (item) => item?.medicineName || item?.name || item?.genericName || '-'
  const getGenericName = (item) => item?.genericName || item?.medicine?.genericName || '-'
  const getCategory = (item) => item?.category || item?.categoryName || item?.medicine?.category || 'General'
  const getDosageForm = (item) => item?.dosageForm || item?.form || item?.medicine?.dosageForm || 'Tablet'
  const getStrength = (item) => {
    const s = item?.strength || item?.medicine?.strength || ''
    const u = item?.unit || item?.medicine?.unit || ''
    if (s && u) return `${s} (${u})`
    return s || u || '-'
  }
  const getBatchNo = (item) => item?.batchNo || item?.batchNumber || item?.batchId || item?.code || item?.medicineCode || '-'
  const getQty = (item) => Number(item?.quantity ?? item?.stock ?? item?.availableQty ?? item?.qty ?? 0)
  const getMinStock = (item) => Number(item?.minimumStock ?? item?.minStock ?? 10)
  const getReorderLevel = (item) => Number(item?.reorderLevel ?? 5)
  const getExpiryDate = (item) => {
    const d = item?.expiryDate || item?.expiresAt || '-'
    if (typeof d === 'string' && d.includes('T')) return d.split('T')[0]
    return d || '-'
  }
  const getSellingPrice = (item) => `₹${Number(item?.sellingPrice ?? item?.price ?? item?.mrp ?? 0)}`

  // Badge Status Class
  const getStatusBadge = (item) => {
    const status = String(item?.status || 'In Stock').toLowerCase()
    if (status.includes('out') || status.includes('expired')) {
      return (
        <span className="branch-status expired" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
          {item?.status || 'Out of Stock'}
        </span>
      )
    }
    if (status.includes('low') || status.includes('near')) {
      return (
        <span className="branch-status near-expiry" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          {item?.status || 'Low Stock'}
        </span>
      )
    }
    return (
      <span className="branch-status active" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
        In Stock
      </span>
    )
  }

  // Tab mapping configs
  const tabs = [
    { 
      key: 'inventory', 
      label: 'Inventory',
      icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>
    },
    { 
      key: 'low', 
      label: 'Low Stock',
      icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    },
    { 
      key: 'near', 
      label: 'Near Expiry',
      icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    },
    { 
      key: 'out', 
      label: 'Out of Stock',
      icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><line x1="12" y1="22" x2="12" y2="12"/><line x1="10" y1="8" x2="14" y2="12"/><line x1="14" y1="8" x2="10" y2="12"/></svg>
    },
    { 
      key: 'summary', 
      label: 'Stock Summary',
      icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    },
    { 
      key: 'transactions', 
      label: 'Transactions',
      icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/></svg>
    },
    { 
      key: 'valuation', 
      label: 'Valuation',
      icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12M6 8h12M6 13h8.5a4.5 4.5 0 0 1 0 9H6M14.5 13l-9 9"/></svg>
    }
  ]

  return (
    <AdminLayout activeLabel="Stock" title="Inventory Management" subtitle="Monitor medicine stock, batches, expiry, stock levels, and inventory transactions.">
      <div className="stock-scroll-area">
        <div className="stock-layout-container">

          {/* Workflow Toolbar */}
          <div className="stock-toolbar" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '8px' }}>
            <div className="stock-action-btns">
              <button 
                type="button" 
                className="stock-btn stock-btn-primary"
                onClick={() => setAddStockOpen(true)}
              >
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Stock
              </button>
              <button 
                type="button" 
                className="stock-btn stock-btn-secondary"
                onClick={() => setAdjustOpen(true)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Adjust Stock
              </button>
            </div>
            <button 
              type="button" 
              className="stock-btn stock-btn-secondary"
              onClick={() => load(view)}
            >
              <svg viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              Refresh
            </button>
          </div>

          {/* Top Summary Cards (Equal Sized Grid) */}
          <div className="stock-summary-grid-redesign">
            {SUMMARY_CARDS.map((card) => {
              const value = displayMetrics[card.metricKey] ?? 0
              return (
                <div 
                  key={card.id}
                  className="summary-card-redesign"
                  style={{ 
                    '--card-accent': card.color,
                    '--card-bg': card.bgColor,
                    '--card-border': card.borderColor
                  }}
                  onClick={() => handleNavigate(card.route, card.view)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleNavigate(card.route, card.view)}
                  aria-label={`Navigate to ${card.label}`}
                >
                  <div className="summary-card-icon-wrap">
                    {card.icon}
                  </div>
                  <div className="summary-card-info">
                    <label>{card.label}</label>
                    <span 
                      className="summary-card-val"
                      title={card.metricKey === 'totalStock' && displayMetrics.totalUnits ? `${displayMetrics.totalUnits.toLocaleString()} units total in stock` : undefined}
                    >
                      {value}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Navigation Module Cards / Tabs */}
          <div className="inventory-nav-tabs-redesign">
            {NAV_TABS.map((tab) => {
              const isActive = view === tab.key
              return (
                <button 
                  key={tab.key}
                  type="button"
                  className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                  style={{ 
                    '--tab-color': tab.color,
                    '--tab-bg': tab.bgColor
                  }}
                  onClick={() => handleNavigate(tab.route, tab.key)}
                >
                  <span className="nav-tab-icon">{tab.icon}</span>
                  <span className="nav-tab-label">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Search bar & Filter selections */}
          {view !== 'summary' && view !== 'valuation' && (
            <div className="stock-toolbar">
              <div className="stock-search-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
                <input 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  placeholder="Search medicine name, generic name, batch, category..." 
                />
              </div>
              <div className="stock-filters">
                <select 
                  value={categoryFilter} 
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All Categories ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Stock Status</option>
                  <option value="in stock">In Stock</option>
                  <option value="low stock">Low Stock</option>
                  <option value="out of stock">Out of Stock</option>
                </select>
                <select 
                  value={expiryFilter} 
                  onChange={(e) => setExpiryFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="all_expiry">All Expiry Status</option>
                  <option value="expired">Expired</option>
                  <option value="near">Near Expiry</option>
                </select>
                <button 
                  type="button" 
                  className="stock-btn stock-btn-secondary"
                  onClick={() => {
                    setSearch('')
                    setCategoryFilter('all')
                    setStatusFilter('all')
                    setExpiryFilter('all')
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '15px', height: '15px' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          {/* Table Results View */}
          <section className="dispense-table-panel">
            <h2>Inventory Records</h2>
            
            {loading ? (
              <div className="dispense-skeleton-row">
                <div className="dispense-skeleton-line" style={{ width: '80%' }}></div>
                <div className="dispense-skeleton-line" style={{ width: '90%' }}></div>
                <div className="dispense-skeleton-line" style={{ width: '70%' }}></div>
              </div>
            ) : view === 'summary' ? (
              <div>
                <div className="valuation-summary-row">
                  <div className="valuation-metric">
                    <label>Total Medicines</label>
                    <span>{displayMetrics.totalMedicines}</span>
                  </div>
                  <div className="valuation-metric">
                    <label>In-Stock Medicines</label>
                    <span style={{ color: '#0ea5e9' }}>{displayMetrics.totalStock}</span>
                  </div>
                  <div className="valuation-metric">
                    <label>Total Units in Stock</label>
                    <span>{displayMetrics.totalUnits ? displayMetrics.totalUnits.toLocaleString() : 0}</span>
                  </div>
                  <div className="valuation-metric">
                    <label>Low Stock Alerts</label>
                    <span style={{ color: '#f59e0b' }}>{displayMetrics.lowStock}</span>
                  </div>
                </div>
                <div className="valuation-summary-row" style={{ marginTop: '16px' }}>
                  <div className="valuation-metric">
                    <label>Total Categories</label>
                    <span>{categories.length}</span>
                  </div>
                  <div className="valuation-metric">
                    <label>Near Expiry Medicines</label>
                    <span style={{ color: '#f97316' }}>{displayMetrics.nearExpiry}</span>
                  </div>
                  <div className="valuation-metric">
                    <label>Expired Medicines</label>
                    <span style={{ color: '#ef4444' }}>{displayMetrics.expired}</span>
                  </div>
                </div>
              </div>
            ) : view === 'valuation' ? (
              <div>
                <div className="valuation-summary-row">
                  <div className="valuation-metric">
                    <label>Total Inventory Value</label>
                    <span>₹{Number(summaryData?.totalInventoryValue || summaryData?.totalCost || 0).toLocaleString()}</span>
                  </div>
                  <div className="valuation-metric">
                    <label>Total Cost Value</label>
                    <span>₹{Number(summaryData?.totalCostValue || summaryData?.totalCost || 0).toLocaleString()}</span>
                  </div>
                  <div className="valuation-metric">
                    <label>Potential Selling Value</label>
                    <span>₹{Number(summaryData?.potentialSellingValue || summaryData?.potentialSales || 0).toLocaleString()}</span>
                  </div>
                  <div className="valuation-metric">
                    <label>Estimated Profit</label>
                    <span style={{ color: '#10b981' }}>₹{Number(summaryData?.estimatedProfit || summaryData?.profit || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ) : view === 'transactions' ? (
              <div className="branch-table-wrap">
                <table className="branch-table">
                  <thead>
                    <tr>
                      <th>Transaction ID</th>
                      <th>Date</th>
                      <th>Medicine</th>
                      <th>Batch</th>
                      <th>Transaction Type</th>
                      <th>Quantity</th>
                      <th>Previous Stock</th>
                      <th>New Stock</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length ? filteredItems.map((item, index) => (
                      <tr key={getId(item, index)}>
                        <td><code>{item?.transactionId || item?._id || '-'}</code></td>
                        <td>{getExpiryDate(item)}</td>
                        <td>{getMedicineName(item)}</td>
                        <td><code>{getBatchNo(item)}</code></td>
                        <td>
                          <span className={`branch-status ${String(item?.type || 'Purchase').toLowerCase() === 'purchase' ? 'active' : 'view'}`}>
                            {item?.type || 'Adjustment'}
                          </span>
                        </td>
                        <td>{item?.quantity || 0}</td>
                        <td>{item?.previousStock || 0}</td>
                        <td>{item?.newStock || 0}</td>
                        <td>{item?.reason || '-'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="9">
                          <div className="dispense-empty-state">
                            <h3>No transactions found.</h3>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="branch-table-wrap">
                <table className="branch-table">
                  <thead>
                    <tr>
                      <th style={{ width: '55px' }}>S.No.</th>
                      <th>Medicine Name</th>
                      <th>Generic Name</th>
                      <th>Category</th>
                      <th>Dosage Form</th>
                      <th>Strength</th>
                      <th>Unit</th>
                      <th>Batch No.</th>
                      <th>Available Qty</th>
                      <th>Minimum Stock</th>
                      <th>Reorder Level</th>
                      <th>Expiry Date</th>
                      <th>Selling Price</th>
                      <th>Stock Status</th>
                      <th style={{ width: '130px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length ? filteredItems.map((item, index) => (
                      <tr key={getId(item, index)}>
                        <td>{index + 1}</td>
                        <td><div style={{ fontWeight: 600, color: '#1e293b' }}>{getMedicineName(item)}</div></td>
                        <td>{getGenericName(item)}</td>
                        <td>{getCategory(item)}</td>
                        <td>{getDosageForm(item)}</td>
                        <td>{item?.strength || '-'}</td>
                        <td>{item?.unit || '-'}</td>
                        <td><code>{getBatchNo(item)}</code></td>
                        <td>{getQty(item)}</td>
                        <td>{getMinStock(item)}</td>
                        <td>{getReorderLevel(item)}</td>
                        <td>{getExpiryDate(item)}</td>
                        <td>{getSellingPrice(item)}</td>
                        <td>{getStatusBadge(item)}</td>
                        <td>
                          <RowActions itemName={getMedicineName(item)} onView={() => setViewingItem(item)} onEdit={() => prefillLevels(item)} statusDisabled={true} onDelete={() => handleDispose(item?.batchNo || item?.batchNumber)} />
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="15">
                          <div className="dispense-empty-state">
                            <h3>No inventory found.</h3>
                            <p>Add medicine stock to start managing your pharmacy inventory.</p>
                            <button 
                              type="button" 
                              className="stock-btn stock-btn-primary" 
                              style={{ marginTop: '12px' }}
                              onClick={() => setAddStockOpen(true)}
                            >
                              Add Stock
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Modal 1: Add Stock */}
          {addStockOpen && (
            <div className="stock-modal-overlay">
              <form onSubmit={handleAddStockSubmit} className="stock-modal-container">
                <div className="stock-modal-header">
                  <h2>Add Medicine Stock</h2>
                  <button type="button" className="stock-modal-close" onClick={() => setAddStockOpen(false)}>&times;</button>
                </div>
                <div className="stock-modal-body">
                  <div className="stock-detail-row">
                    <div className="stock-form-group">
                      <label>Medicine *</label>
                      {availableMedicines.length > 0 ? (
                        <select 
                          value={stockForm.medicineId} 
                          onChange={(e) => {
                            const val = e.target.value
                            const found = availableMedicines.find(m => String(m?._id || m?.id) === val)
                            setStockForm(prev => ({
                              ...prev, 
                              medicineId: val,
                              sellingPrice: found?.sellingPrice ?? found?.price ?? prev.sellingPrice,
                              costPrice: found?.purchasePrice ?? found?.costPrice ?? prev.costPrice
                            }))
                          }}
                          required 
                        >
                          <option value="">-- Select Medicine ({availableMedicines.length} in catalogue) --</option>
                          {availableMedicines.map((m, i) => (
                            <option key={m?._id || m?.id || i} value={m?._id || m?.id || ''}>
                              {m?.name || m?.medicineName || 'Unnamed'} {m?.genericName ? `(${m.genericName})` : ''} {m?.category ? `[${m.category}]` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input 
                          type="text" 
                          placeholder="Medicine ID"
                          value={stockForm.medicineId} 
                          onChange={(e) => setStockForm({...stockForm, medicineId: e.target.value})} 
                          required 
                        />
                      )}
                    </div>
                    <div className="stock-form-group">
                      <label>Batch Number *</label>
                      <input 
                        type="text" 
                        value={stockForm.batchNo} 
                        onChange={(e) => setStockForm({...stockForm, batchNo: e.target.value})} 
                        required 
                      />
                    </div>
                  </div>
                  <div className="stock-detail-row">
                    <div className="stock-form-group">
                      <label>Stock Quantity *</label>
                      <input 
                        type="number" 
                        value={stockForm.quantity} 
                        onChange={(e) => setStockForm({...stockForm, quantity: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="stock-form-group">
                      <label>Expiry Date *</label>
                      <input 
                        type="date" 
                        value={stockForm.expiryDate} 
                        onChange={(e) => setStockForm({...stockForm, expiryDate: e.target.value})} 
                        required 
                      />
                    </div>
                  </div>
                  <div className="stock-detail-row">
                    <div className="stock-form-group">
                      <label>Cost Price (₹)</label>
                      <input 
                        type="number" 
                        value={stockForm.costPrice} 
                        onChange={(e) => setStockForm({...stockForm, costPrice: e.target.value})} 
                      />
                    </div>
                    <div className="stock-form-group">
                      <label>Selling Price (₹)</label>
                      <input 
                        type="number" 
                        value={stockForm.sellingPrice} 
                        onChange={(e) => setStockForm({...stockForm, sellingPrice: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="stock-detail-row">
                    <div className="stock-form-group">
                      <label>Supplier</label>
                      <input 
                        type="text" 
                        value={stockForm.supplier} 
                        onChange={(e) => setStockForm({...stockForm, supplier: e.target.value})} 
                      />
                    </div>
                    <div className="stock-form-group">
                      <label>Purchase Date</label>
                      <input 
                        type="date" 
                        value={stockForm.purchaseDate} 
                        onChange={(e) => setStockForm({...stockForm, purchaseDate: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="stock-form-group">
                    <label>Notes</label>
                    <textarea 
                      value={stockForm.notes} 
                      onChange={(e) => setStockForm({...stockForm, notes: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="stock-modal-footer">
                  <button type="button" className="stock-btn stock-btn-secondary" onClick={() => setAddStockOpen(false)}>Cancel</button>
                  <button type="submit" className="stock-btn stock-btn-primary">Add Stock</button>
                </div>
              </form>
            </div>
          )}

          {/* Modal 2: Adjust Stock */}
          {adjustOpen && (
            <div className="stock-modal-overlay">
              <form onSubmit={handleAdjustSubmit} className="stock-modal-container">
                <div className="stock-modal-header">
                  <h2>Adjust Inventory Stock Levels</h2>
                  <button type="button" className="stock-modal-close" onClick={() => setAdjustOpen(false)}>&times;</button>
                </div>
                <div className="stock-modal-body">
                  <div className="stock-detail-row">
                    <div className="stock-form-group">
                      <label>Medicine *</label>
                      {availableMedicines.length > 0 ? (
                        <select 
                          value={adjustmentForm.medicineId} 
                          onChange={(e) => setAdjustmentForm({...adjustmentForm, medicineId: e.target.value})} 
                          required 
                        >
                          <option value="">-- Select Medicine ({availableMedicines.length} in catalogue) --</option>
                          {availableMedicines.map((m, i) => (
                            <option key={m?._id || m?.id || i} value={m?._id || m?.id || ''}>
                              {m?.name || m?.medicineName || 'Unnamed'} {m?.genericName ? `(${m.genericName})` : ''} {m?.category ? `[${m.category}]` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input 
                          type="text" 
                          value={adjustmentForm.medicineId} 
                          onChange={(e) => setAdjustmentForm({...adjustmentForm, medicineId: e.target.value})} 
                          required 
                        />
                      )}
                    </div>
                    <div className="stock-form-group">
                      <label>Batch Number</label>
                      <input 
                        type="text" 
                        value={adjustmentForm.batchId} 
                        onChange={(e) => setAdjustmentForm({...adjustmentForm, batchId: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="stock-detail-row">
                    <div className="stock-form-group">
                      <label>Adjustment Type</label>
                      <select 
                        value={adjustmentForm.type} 
                        onChange={(e) => setAdjustmentForm({...adjustmentForm, type: e.target.value})}
                      >
                        <option value="increase">Increase (+)</option>
                        <option value="decrease">Decrease (-)</option>
                      </select>
                    </div>
                    <div className="stock-form-group">
                      <label>Quantity *</label>
                      <input 
                        type="number" 
                        value={adjustmentForm.quantity} 
                        onChange={(e) => setAdjustmentForm({...adjustmentForm, quantity: e.target.value})} 
                        required 
                      />
                    </div>
                  </div>
                  <div className="stock-form-group">
                    <label>Reason *</label>
                    <input 
                      type="text" 
                      value={adjustmentForm.reason} 
                      onChange={(e) => setAdjustmentForm({...adjustmentForm, reason: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="stock-form-group">
                    <label>Notes</label>
                    <textarea 
                      value={adjustmentForm.notes} 
                      onChange={(e) => setAdjustmentForm({...adjustmentForm, notes: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="stock-modal-footer">
                  <button type="button" className="stock-btn stock-btn-secondary" onClick={() => setAdjustOpen(false)}>Cancel</button>
                  <button type="submit" className="stock-btn stock-btn-primary">Adjust Stock</button>
                </div>
              </form>
            </div>
          )}

          {/* Modal 3: Config Levels */}
          {levelsOpen && (
            <div className="stock-modal-overlay">
              <form onSubmit={handleLevelsSubmit} className="stock-modal-container">
                <div className="stock-modal-header">
                  <h2>Configure Stock Levels</h2>
                  <button type="button" className="stock-modal-close" onClick={() => setLevelsOpen(false)}>&times;</button>
                </div>
                <div className="stock-modal-body">
                  <div className="stock-form-group">
                    <label>Medicine *</label>
                    <input 
                      type="text" 
                      value={(() => {
                        const m = availableMedicines.find(med => String(med?.id || med?._id || med?.medicineId) === String(levelsForm.medicineId))
                        return m ? `${m?.name || m?.medicineName || ''} (${levelsForm.medicineId})` : levelsForm.medicineId
                      })()} 
                      required 
                      disabled 
                    />
                  </div>
                  <div className="stock-detail-row">
                    <div className="stock-form-group">
                      <label>Minimum Stock Level *</label>
                      <input 
                        type="number" 
                        value={levelsForm.minimumStock} 
                        onChange={(e) => setLevelsForm({...levelsForm, minimumStock: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="stock-form-group">
                      <label>Maximum Stock Level *</label>
                      <input 
                        type="number" 
                        value={levelsForm.maximumStock} 
                        onChange={(e) => setLevelsForm({...levelsForm, maximumStock: e.target.value})} 
                        required 
                      />
                    </div>
                  </div>
                  <div className="stock-form-group">
                    <label>Reorder Threshold Level *</label>
                    <input 
                      type="number" 
                      value={levelsForm.reorderLevel} 
                      onChange={(e) => setLevelsForm({...levelsForm, reorderLevel: e.target.value})} 
                      required 
                    />
                  </div>
                </div>
                <div className="stock-modal-footer">
                  <button type="button" className="stock-btn stock-btn-secondary" onClick={() => setLevelsOpen(false)}>Cancel</button>
                  <button type="submit" className="stock-btn stock-btn-primary">Save Levels</button>
                </div>
              </form>
            </div>
          )}

          {/* Modal 4: View Medicine Details */}
          {viewingItem && (
            <div className="stock-modal-overlay">
              <div className="stock-modal-container">
                <div className="stock-modal-header">
                  <h2>Medicine Inventory Details: {getMedicineName(viewingItem)}</h2>
                  <button type="button" className="stock-modal-close" onClick={() => setViewingItem(null)}>&times;</button>
                </div>
                <div className="stock-modal-body">
                  <div className="stock-detail-row">
                    <div className="stock-detail-item">
                      <label>Medicine Name</label>
                      <span style={{ fontWeight: 600 }}>{getMedicineName(viewingItem)}</span>
                    </div>
                    <div className="stock-detail-item">
                      <label>Generic Name</label>
                      <span>{getGenericName(viewingItem)}</span>
                    </div>
                  </div>
                  <div className="stock-detail-row">
                    <div className="stock-detail-item">
                      <label>Category</label>
                      <span>{getCategory(viewingItem)}</span>
                    </div>
                    <div className="stock-detail-item">
                      <label>Dosage Form</label>
                      <span>{getDosageForm(viewingItem)}</span>
                    </div>
                  </div>
                  <div className="stock-detail-row">
                    <div className="stock-detail-item">
                      <label>Strength & Unit</label>
                      <span>{getStrength(viewingItem)}</span>
                    </div>
                    <div className="stock-detail-item">
                      <label>Batch / Code</label>
                      <span><code>{getBatchNo(viewingItem)}</code></span>
                    </div>
                  </div>
                  <div className="stock-detail-row">
                    <div className="stock-detail-item">
                      <label>Available Quantity</label>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{getQty(viewingItem)} {viewingItem?.unit || 'units'}</span>
                    </div>
                    <div className="stock-detail-item">
                      <label>Expiry Date</label>
                      <span>{getExpiryDate(viewingItem)}</span>
                    </div>
                  </div>
                  <div className="stock-detail-row">
                    <div className="stock-detail-item">
                      <label>Minimum Stock Level</label>
                      <span>{getMinStock(viewingItem)}</span>
                    </div>
                    <div className="stock-detail-item">
                      <label>Reorder Threshold</label>
                      <span>{getReorderLevel(viewingItem)}</span>
                    </div>
                  </div>
                  <div className="stock-detail-row">
                    <div className="stock-detail-item">
                      <label>Selling Price</label>
                      <span>{getSellingPrice(viewingItem)}</span>
                    </div>
                    <div className="stock-detail-item">
                      <label>Cost Price</label>
                      <span>₹{Number(viewingItem?.costPrice ?? viewingItem?.purchasePrice ?? 0)}</span>
                    </div>
                  </div>
                  <div className="stock-detail-row">
                    <div className="stock-detail-item">
                      <label>Status Badge</label>
                      <div style={{ marginTop: '4px' }}>{getStatusBadge(viewingItem)}</div>
                    </div>
                    <div className="stock-detail-item">
                      <label>Storage Location</label>
                      <span>{viewingItem?.storageLocation || '-'}</span>
                    </div>
                  </div>
                </div>
                <div className="stock-modal-footer">
                  <button type="button" className="stock-btn stock-btn-primary" onClick={() => setViewingItem(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </AdminLayout>
  )
}



