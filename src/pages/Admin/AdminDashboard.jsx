import { useEffect, useMemo, useState } from 'react'
import { getPharmacyAdminDashboard } from '../../config/api'
import AdminLayout from './AdminLayout'
import AdminTable from './AdminTable'

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
const pick = (source, keys, fallback = 0) => keys.map((key) => source?.[key]).find((value) => value !== undefined && value !== null && value !== '') ?? fallback
const list = (source, keys) => keys.map((key) => source?.[key]).find(Array.isArray) || []
const text = (source, keys, fallback = '-') => pick(source, keys, fallback)
const display = (value) => {
  if (Array.isArray(value)) return value.length
  if (value && typeof value === 'object') return value.total ?? value.count ?? value.value ?? value.amount ?? Object.keys(value).length
  return value
}

function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getPharmacyAdminDashboard()
      .then((response) => active && setDashboard(unwrap(response)))
      .catch(() => active && setDashboard({}))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const view = useMemo(() => {
    const source = dashboard?.summary || dashboard?.stats || dashboard || {}
    return {
      stats: [
        ['Today Sales', pick(source, ['todaySales', 'salesToday', 'dailySales'], 0), loading ? 'Loading...' : 'Live dashboard data'],
        ['Prescriptions', pick(source, ['prescriptions', 'totalPrescriptions', 'prescriptionsCount'], 0), loading ? 'Loading...' : 'Live dashboard data'],
        ['Low Stock', pick(source, ['lowStock', 'lowStockCount'], 0), loading ? 'Loading...' : 'Live dashboard data'],
        ['Expiry Alerts', pick(source, ['expiryAlerts', 'expiryAlertsCount', 'nearExpiryCount'], 0), loading ? 'Loading...' : 'Live dashboard data'],
      ],
      topMedicines: list(dashboard, ['topMedicines', 'topSelling', 'medicines']),
      recentStock: list(dashboard, ['stock', 'inventory', 'lowStockItems']),
      reports: list(dashboard, ['reports', 'recentReports', 'activities']),
    }
  }, [dashboard, loading])

  return (
    <AdminLayout activeLabel="Dashboard" title="Admin Dashboard" subtitle="Admin / Dashboard">
      <section className="branch-dashboard-title">
        <h1>Admin Dashboard</h1>
        <p>Branch-wise operations management for sales, prescriptions, stock, and alerts.</p>
      </section>
      <section className="branch-summary">
        {view.stats.map(([label, value, note]) => <article key={label}><p>{label}</p><strong>{display(value)}</strong><small>{note}</small></article>)}
      </section>
      <section className="branch-grid">
        <section className="branch-panel branch-chart-panel">
          <div className="branch-panel-heading"><h2>Sales Overview</h2></div>
          <div className="mini-chart"><p>No sales data available.</p></div>
        </section>
        <section className="branch-panel">
          <div className="branch-panel-heading"><h2>Top Medicines</h2></div>
          <div className="top-meds"><p>No medicine data available.</p></div>
        </section>
      </section>
      <section className="branch-grid three">
        <AdminTable {...dashboardTables.medicines} rows={view.topMedicines.map((item) => [
          text(item, ['name', 'medicineName']),
          text(item, ['category', 'categoryName']),
          text(item, ['strength']),
          text(item, ['unit', 'dosageForm']),
          text(item, ['status'], 'Active'),
        ])} />
        <AdminTable {...dashboardTables.stock} rows={view.recentStock.map((item) => [
          text(item, ['medicineName', 'name']),
          text(item, ['batchNo', 'batchNumber']),
          text(item, ['quantity', 'qty', 'currentStock'], 0),
          text(item, ['expiryDate', 'expiry']),
          text(item, ['status'], 'Active'),
        ])} />
        <AdminTable {...dashboardTables.reports} rows={view.reports.map((item) => [
          text(item, ['title', 'name', 'report']),
          text(item, ['type', 'category']),
          text(item, ['createdBy', 'userName']),
          text(item, ['status'], 'Ready'),
        ])} />
      </section>
    </AdminLayout>
  )
}

export default AdminDashboard
