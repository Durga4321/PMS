import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  getInventory, 
  getPharmacyAdminDashboard, 
  listMedicines, 
  listBills, 
  getDailySalesReport, 
  getPharmacyPayments,
  readLocalMedicines
} from '../../config/api'
import AdminLayout from './AdminLayout'
import AdminTable from './AdminTable'
import DashboardGreeting from '../../components/DashboardGreeting'

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

const dashboardTables = {
  medicines: {
    title: 'Medicines',
    action: '+ Add Medicine',
    headers: ['Name', 'Category', 'Strength', 'Unit', 'Action'],
    rows: [],
  },
  stock: {
    title: 'Stock Management',
    action: '+ Stock In',
    headers: ['Medicine', 'Batch No.', 'Qty', 'Expiry Date', 'Status'],
    rows: [],
  },
  reports: {
    title: 'Reports',
    action: 'Generate',
    headers: ['Report', 'Type', 'Created By', 'Status'],
    rows: [],
  },
}

const unwrap = (response) => response?.data?.dashboard || response?.data || response?.dashboard || response || {}
const unwrapArray = (response) => {
  if (Array.isArray(response)) return response
  const data = response?.data ?? response?.Data ?? response
  if (Array.isArray(data)) return data
  return (
    [
      data?.medicines,
      data?.Medicines,
      data?.inventory,
      data?.Inventory,
      data?.items,
      data?.Items,
      data?.results,
      data?.Results,
      data?.records,
      data?.Records,
      response?.medicines,
      response?.items,
      response?.results,
    ].find(Array.isArray) || []
  )
}
const pick = (source, keys, fallback = 0) => keys.map((key) => source?.[key]).find((value) => value !== undefined && value !== null && value !== '') ?? fallback
const list = (source, keys) => keys.map((key) => source?.[key]).find(Array.isArray) || []
const text = (source, keys, fallback = '-') => pick(source, keys, fallback)

function getItemStock(item) {
  const val = pick(item, ['stock', 'stockQuantity', 'initialStockCount', 'currentStock', 'totalStock', 'availableStock', 'quantity', 'qty'], null)
  if (val !== null && !isNaN(Number(val)) && Number(val) > 0) return Number(val)
  const unitMatch = String(item?.unit || '').trim().match(/^(\d+)\s*(units?|tablets?|capsules?|strips?|bottles?|vials?|packs?)?$/i)
  if (unitMatch && Number(unitMatch[1]) > 0) return Number(unitMatch[1])
  return Number(val) || 0
}

function AdminDashboard() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [medicinesList, setMedicinesList] = useState([])
  const [inventoryList, setInventoryList] = useState([])
  const [billsList, setBillsList] = useState([])
  const [dailySalesData, setDailySalesData] = useState(null)
  const [paymentsList, setPaymentsList] = useState([])
  const [loading, setLoading] = useState(true)
  const [salesFilter, setSalesFilter] = useState('7d')

  function loadDashboardData() {
    Promise.allSettled([
      getPharmacyAdminDashboard(),
      listMedicines(),
      getInventory(),
      listBills(),
      getDailySalesReport(),
      getPharmacyPayments(),
    ])
      .then(([dashRes, medRes, invRes, billsRes, dailyRes, payRes]) => {
        setDashboard(dashRes.status === 'fulfilled' ? unwrap(dashRes.value) : {})
        setMedicinesList(medRes.status === 'fulfilled' ? unwrapArray(medRes.value) : [])
        setInventoryList(invRes.status === 'fulfilled' ? unwrapArray(invRes.value) : [])
        setBillsList(billsRes.status === 'fulfilled' ? unwrapArray(billsRes.value) : [])
        setDailySalesData(dailyRes.status === 'fulfilled' ? unwrap(dailyRes.value) : null)
        setPaymentsList(payRes.status === 'fulfilled' ? unwrapArray(payRes.value) : [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadDashboardData()

    function handleDashboardSync() {
      loadDashboardData()
    }
    window.addEventListener('pms:medicines-updated', handleDashboardSync)
    window.addEventListener('pms:stock-updated', handleDashboardSync)
    window.addEventListener('pms:purchase-orders-updated', handleDashboardSync)
    window.addEventListener('storage', handleDashboardSync)
    return () => {
      window.removeEventListener('pms:medicines-updated', handleDashboardSync)
      window.removeEventListener('pms:stock-updated', handleDashboardSync)
      window.removeEventListener('pms:purchase-orders-updated', handleDashboardSync)
      window.removeEventListener('storage', handleDashboardSync)
    }
  }, [])

  const view = useMemo(() => {
    const source = dashboard?.summary || dashboard?.stats || dashboard || {}
    const dashMedicines = list(dashboard, ['topMedicines', 'topSelling', 'medicines'])
    const dashStock = list(dashboard, ['stock', 'inventory', 'lowStockItems'])

    // Pool all available medicines across backend and local storage
    const localMeds = readLocalMedicines()
    const allItemsMap = new Map()
    medicinesList.forEach(m => {
      const k = String(m?.id || m?._id || m?.code || m?.name || '').trim().toLowerCase()
      if (k) allItemsMap.set(k, m)
    })
    localMeds.forEach(m => {
      const k = String(m?.id || m?._id || m?.code || m?.name || '').trim().toLowerCase()
      if (k) {
        const existing = allItemsMap.get(k) || {}
        allItemsMap.set(k, { ...existing, ...m })
      }
    })
    inventoryList.forEach(inv => {
      const k = String(inv?.id || inv?._id || inv?.batchNo || inv?.batchNumber || inv?.medicineName || '').trim().toLowerCase()
      if (k && !allItemsMap.has(k)) allItemsMap.set(k, inv)
    })
    const pooledStock = Array.from(allItemsMap.values())

    const effectiveMedicines = pooledStock.length ? pooledStock : (dashMedicines.length ? dashMedicines : medicinesList)
    const effectiveStock = pooledStock.length ? pooledStock : (dashStock.length ? dashStock : medicinesList)

    const computedLowStock = effectiveMedicines.filter((m) => {
      const qty = getItemStock(m)
      const reorder = Number(pick(m, ['reorderLevel', 'reorderStockLevel', 'minStock', 'minimumStock'], 5))
      return qty <= reorder
    }).length

    const now = Date.now()
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000
    const computedExpiryAlerts = effectiveStock.filter((item) => {
      if (item?.daysLeft !== undefined && item?.daysLeft !== null && item?.daysLeft !== '') {
        return Number(item.daysLeft) <= 90
      }
      const rawDate = item?.expiryDate || item?.ExpiryDate || item?.expiry || item?.expiresAt || item?.batch?.expiryDate
      if (!rawDate || rawDate === '-') return false
      const expDate = parseFlexibleDate(rawDate)
      if (!expDate) return false
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      expDate.setHours(0, 0, 0, 0)
      const daysDiff = Math.round((expDate.getTime() - today.getTime()) / 86400000)
      return daysDiff <= 90
    }).length

    // Calculate total sales from pharmacist billing, dispensing, and daily reports
    const dashSalesNum = Number(pick(source, ['todaySales', 'salesToday', 'dailySales', 'totalSales', 'totalRevenue', 'todayRevenue', 'revenue', 'sales'], 0)) || 0
    const billsTotal = billsList.reduce((acc, b) => {
      const amt = Number(b?.totalAmount || b?.total || b?.amount || b?.grandTotal || b?.paidAmount || 0)
      return acc + (!isNaN(amt) && amt > 0 ? amt : 0)
    }, 0)
    const paymentsTotal = paymentsList.reduce((acc, p) => {
      const amt = Number(p?.paidAmount || p?.amount || p?.total || 0)
      return acc + (!isNaN(amt) && amt > 0 ? amt : 0)
    }, 0)
    const dailyTotal = Number(dailySalesData?.totalSales || dailySalesData?.totalRevenue || dailySalesData?.total || dailySalesData?.sales || 0) || 0
    let localSales = 0
    try {
      const storedBills = JSON.parse(localStorage.getItem('pms_bills') || sessionStorage.getItem('pms_bills') || '[]')
      if (Array.isArray(storedBills)) {
        localSales = storedBills.reduce((acc, b) => acc + (Number(b?.totalAmount || b?.amount || 0) || 0), 0)
      }
    } catch {}

    const totalSalesValue = Math.max(dashSalesNum, billsTotal, paymentsTotal, dailyTotal, localSales)

    const rawLowStock = Number(pick(source, ['lowStock', 'lowStockCount', 'lowStockMedicines'], 0)) || 0
    const rawExpiryAlerts = Number(pick(source, ['expiryAlerts', 'expiryAlertsCount', 'nearExpiryCount'], 0)) || 0
    const lowStock = Math.max(rawLowStock, computedLowStock)
    const expiryAlerts = Math.max(rawExpiryAlerts, computedExpiryAlerts)

    return {
      source,
      totalSalesValue,
      billsCount: billsList.length,
      stats: [
        {
          id: 'sales',
          label: 'Total Sales',
          val: `₹${Number(totalSalesValue || 0).toLocaleString('en-IN')}`,
          subText: 'From pharmacist sales',
          badgeText: '+0% today',
          route: '/admin/dispensing',
          color: '#0878e8',
          bgColor: '#eaf4ff',
          borderColor: 'rgba(8, 120, 232, 0.2)',
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          )
        },
        {
          id: 'lowStock',
          label: 'Low Stock',
          val: lowStock,
          subText: 'Needs attention',
          badgeText: 'Alert',
          route: '/low-stock',
          color: '#f59e0b',
          bgColor: '#fff7e6',
          borderColor: 'rgba(245, 158, 11, 0.2)',
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )
        },
        {
          id: 'expiryAlerts',
          label: 'Expiry Alerts',
          val: expiryAlerts,
          subText: 'Requires review',
          badgeText: 'Near Expiry',
          route: '/admin/expiry-alerts',
          color: '#ef4444',
          bgColor: '#fff0f0',
          borderColor: 'rgba(239, 68, 68, 0.2)',
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          )
        }
      ],
      topMedicines: effectiveMedicines,
      recentStock: effectiveStock,
      reports: list(dashboard, ['reports', 'recentReports', 'activities']),
    }
  }, [dashboard, inventoryList, medicinesList, billsList, dailySalesData, paymentsList])

  return (
    <AdminLayout activeLabel="Dashboard" title="Admin Dashboard" subtitle="Admin / Dashboard">
      {/* Dashboard Page Header */}
      {/* Dashboard Page Header */}
      <section className="branch-dashboard-header-redesign reference-heading-card">
        <div className="reference-heading-accent" />
        <div className="admin-heading-text-wrap">
          <DashboardGreeting role="Admin" subtitle="Branch-wise operations management for sales, stock, and alerts." live />
        </div>
      </section>

      {/* Top 4 Equal-Sized Statistic Cards */}
      <section className="branch-summary-4grid">
        {view.stats.map((card) => (
          <div
            key={card.id}
            className={`stat-card-redesign stat-card-${card.id}`}
            onClick={() => navigate(card.route)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate(card.route)}
            aria-label={`Navigate to ${card.label}`}
          >
            <div className="stat-card-icon-wrap" style={{ background: card.bgColor, color: card.color }}>
              {card.icon}
            </div>
            <div className="stat-card-body">
              <strong className="stat-card-val">{loading ? '...' : card.val}</strong>
              <label>{card.label}</label>
            </div>
          </div>
        ))}
      </section>

      {/* Analytics & Ranking Section */}
      <section className="branch-grid">
        <section className="branch-panel branch-chart-panel">
          <div className="branch-panel-heading">
            <h2>Sales Overview</h2>
            <div className="chart-filter-pills">
              <button
                type="button"
                className={salesFilter === 'today' ? 'active' : ''}
                onClick={() => setSalesFilter('today')}
              >
                Today
              </button>
              <button
                type="button"
                className={salesFilter === '7d' ? 'active' : ''}
                onClick={() => setSalesFilter('7d')}
              >
                7 Days
              </button>
              <button
                type="button"
                className={salesFilter === '30d' ? 'active' : ''}
                onClick={() => setSalesFilter('30d')}
              >
                30 Days
              </button>
            </div>
          </div>
          <div className="analytics-card-body">
            {view.totalSalesValue > 0 || billsList.length > 0 ? (
              <div style={{ padding: '20px 8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pharmacist Revenue</span>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a' }}>₹{Number(view.totalSalesValue || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <span className="live-status-pill" style={{ background: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' }}>
                    <i className="pulse-dot-green" /> {billsList.length || 1} Transactions
                  </span>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
                    <span>Dispensed / Paid Orders</span>
                    <strong>{billsList.length || 1} completed</strong>
                  </div>
                  <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #2563eb, #3b82f6)', borderRadius: '4px' }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="analytics-empty-state">
                <div className="analytics-empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <h3>No sales activity recorded yet</h3>
                <p>Sales transactions from pharmacist dispensing will appear here in real time.</p>
              </div>
            )}
          </div>
        </section>

        <section className="branch-panel">
          <div className="branch-panel-heading">
            <h2>Top Medicines</h2>
          </div>
          <div className="top-meds-card-body">
            {view.topMedicines.length ? (
              <div className="top-meds-list">
                {view.topMedicines.slice(0, 5).map((med, idx) => (
                  <div className="top-med-item" key={getId(med, idx)}>
                    <span className="med-rank">0{idx + 1}</span>
                    <div className="med-details">
                      <strong>{text(med, ['name', 'medicineName', 'genericName'])}</strong>
                      <small>{text(med, ['category', 'categoryName'])}</small>
                    </div>
                    <div className="med-qty-badge">
                      <span>
                        {med?.quantitySold !== undefined || med?.sold !== undefined
                          ? `${text(med, ['quantitySold', 'sold'], 0)} sold`
                          : `${getItemStock(med)} in stock`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="analytics-empty-state">
                <div className="analytics-empty-icon" style={{ background: '#ecfcff', color: '#06b6d4' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m10.5 11.5 5 5m-2.5-9L8 12.5a4.24 4.24 0 0 0 6 6l5-5a4.24 4.24 0 0 0-6-6Z" />
                  </svg>
                </div>
                <h3>No medicine rankings</h3>
                <p>Top fast-moving products will be ranked here.</p>
              </div>
            )}
          </div>
        </section>
      </section>

      {/* Lower Dashboard Tables Grid */}
      <section className="branch-grid three">
        <AdminTable
          {...dashboardTables.medicines}
          rows={view.topMedicines.map((item) => {
            const qty = getItemStock(item)
            const statusText = String(text(item, ['status'], 'Active')).toLowerCase().includes('inactive')
              ? 'Inactive'
              : qty > 0
                ? 'Active'
                : 'Out of Stock'
            return [
              text(item, ['name', 'medicineName', 'genericName']),
              text(item, ['category', 'categoryName']),
              text(item, ['strength']),
              text(item, ['unit', 'dosageForm']),
              statusText,
            ]
          })}
          onActionClick={() => navigate('/admin/medicines')}
        />
        <AdminTable
          {...dashboardTables.stock}
          rows={view.recentStock.map((item) => {
            const qty = getItemStock(item)
            const rawExpiry = text(item, ['expiryDate', 'expiry', 'expiresAt'], '-')
            const expiryText = typeof rawExpiry === 'string' && rawExpiry.includes('T') ? rawExpiry.split('T')[0] : rawExpiry
            return [
              text(item, ['medicineName', 'name', 'genericName']),
              text(item, ['batchNo', 'batchNumber', 'code', 'medicineCode'], 'BATCH-01'),
              qty,
              expiryText,
              qty > 0 ? text(item, ['status'], 'In Stock') : 'Out of Stock',
            ]
          })}
          onActionClick={() => navigate('/inventory')}
        />
        <AdminTable
          {...dashboardTables.reports}
          rows={view.reports.map((item) => [
            text(item, ['title', 'name', 'report']),
            text(item, ['type', 'category']),
            text(item, ['createdBy', 'userName']),
            text(item, ['status'], 'Ready'),
          ])}
          onActionClick={() => navigate('/admin/reports')}
        />
      </section>
    </AdminLayout>
  )
}

function getId(item, index) {
  return item?._id || item?.id || item?.uuid || `${index}`
}

export default AdminDashboard
