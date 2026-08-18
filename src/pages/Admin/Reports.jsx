import { getDailySalesReport, getPharmacyAlerts, getPharmacyAuditLogs, getPharmacyDashboard, getPharmacyExpiryReport, getPharmacyPayments, getPharmacyPurchasesReport, getPharmacySalesReport, getPharmacyStockMovementReport, getPharmacyStockSummaryReport, getPharmacyTopSellingReport } from '../../config/api'
import AdminApiScreen from './AdminApiScreen'

export default function Reports() {
  return <AdminApiScreen activeLabel="Reports" title="Dashboard, Reports and Audit" subtitle="Admin / Reports" load={getPharmacyDashboard} actions={[{ label: 'Alerts', fn: () => getPharmacyAlerts() }, { label: 'Audit Logs', fn: () => getPharmacyAuditLogs() }, { label: 'Payments', fn: () => getPharmacyPayments() }, { label: 'Daily Sales', fn: () => getDailySalesReport() }, { label: 'Expiry', fn: () => getPharmacyExpiryReport() }, { label: 'Purchases', fn: () => getPharmacyPurchasesReport() }, { label: 'Sales', fn: () => getPharmacySalesReport() }, { label: 'Stock Movement', fn: () => getPharmacyStockMovementReport() }, { label: 'Stock Summary', fn: () => getPharmacyStockSummaryReport() }, { label: 'Top Selling', fn: () => getPharmacyTopSellingReport() }]} />
}
