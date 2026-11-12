import {
  getPharmacyAuditLogs,
  getPharmacyExpiryReport,
  getPharmacyPayments,
  getPharmacyPurchasesReport,
  getPharmacyStockMovementReport,
  getPharmacyStockSummaryReport,
  getPharmacyTopSellingReport,
} from '../../config/api'
import PharmacistApiScreen from './PharmacistApiScreen'

function getDefaultReportDateRange() {
  const now = new Date()
  const to = now.toISOString().split('T')[0]
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const from = firstOfMonth.toISOString().split('T')[0]
  return { from, to }
}

export default function Reports() {
  const dateRange = getDefaultReportDateRange()

  return (
    <PharmacistApiScreen
      activeLabel="Reports"
      title="Reports and Audit"
      subtitle="Pharmacist / Reports"
      load={getPharmacyAuditLogs}
      actions={[
        { label: 'Audit Logs', fn: () => getPharmacyAuditLogs() },
        { label: 'Payments', fn: () => getPharmacyPayments() },
        { label: 'Expiry', fn: () => getPharmacyExpiryReport({ days: 30 }) },
        { label: 'Purchases', fn: () => getPharmacyPurchasesReport({ from: dateRange.from, to: dateRange.to }) },
        { label: 'Stock Movement', fn: () => getPharmacyStockMovementReport({ from: dateRange.from, to: dateRange.to }) },
        { label: 'Stock Summary', fn: () => getPharmacyStockSummaryReport() },
        { label: 'Top Selling', fn: () => getPharmacyTopSellingReport({ from: dateRange.from, to: dateRange.to, take: 20 }) },
      ]}
    />
  )
}
