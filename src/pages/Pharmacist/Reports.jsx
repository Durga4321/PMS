import { getPharmacyAuditLogs, getPharmacyExpiryReport, getPharmacyPayments, getPharmacyPurchasesReport, getPharmacySalesReport, getPharmacyStockMovementReport, getPharmacyStockSummaryReport, getPharmacyTopSellingReport } from '../../config/api'
import PharmacistApiScreen from './PharmacistApiScreen'

export default function Reports() {
  return <PharmacistApiScreen activeLabel="Reports" title="Reports and Audit" subtitle="Pharmacist / Reports" load={getPharmacySalesReport} actions={[{ label: 'Audit Logs', fn: () => getPharmacyAuditLogs() }, { label: 'Payments', fn: () => getPharmacyPayments() }, { label: 'Expiry', fn: () => getPharmacyExpiryReport() }, { label: 'Purchases', fn: () => getPharmacyPurchasesReport() }, { label: 'Stock Movement', fn: () => getPharmacyStockMovementReport() }, { label: 'Stock Summary', fn: () => getPharmacyStockSummaryReport() }, { label: 'Top Selling', fn: () => getPharmacyTopSellingReport() }]} />
}
