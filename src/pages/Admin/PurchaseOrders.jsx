import { changePurchaseOrderStatus, createPurchaseOrder, getPurchaseOrder, listPendingPurchaseOrders, listPurchaseOrders, receivePurchaseOrder } from '../../config/api'
import AdminApiScreen from './AdminApiScreen'

export default function PurchaseOrders() {
  return <AdminApiScreen activeLabel="Purchase Orders" title="Purchase Orders" subtitle="Admin / Purchase Orders" load={listPurchaseOrders} actions={[{ label: 'Create', fn: (_, body) => createPurchaseOrder(body) }, { label: 'Get', fn: (id) => getPurchaseOrder(id) }, { label: 'Receive', fn: (id, body) => receivePurchaseOrder(id, body) }, { label: 'Status', fn: (id, body) => changePurchaseOrderStatus(id, body) }, { label: 'Pending', fn: () => listPendingPurchaseOrders() }]} />
}
