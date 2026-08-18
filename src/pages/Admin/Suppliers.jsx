import { changeSupplierStatus, createSupplier, deleteSupplier, getSupplier, getSupplierPurchaseHistory, listSuppliers, updateSupplier } from '../../config/api'
import AdminApiScreen from './AdminApiScreen'

export default function Suppliers() {
  return <AdminApiScreen activeLabel="Suppliers" title="Suppliers" subtitle="Admin / Suppliers" load={listSuppliers} actions={[{ label: 'Create', fn: (_, body) => createSupplier(body) }, { label: 'Get', fn: (id) => getSupplier(id) }, { label: 'Update', fn: (id, body) => updateSupplier(id, body) }, { label: 'Delete', fn: (id) => deleteSupplier(id) }, { label: 'Purchase History', fn: (id) => getSupplierPurchaseHistory(id) }, { label: 'Status', fn: (id, body) => changeSupplierStatus(id, body) }]} />
}
