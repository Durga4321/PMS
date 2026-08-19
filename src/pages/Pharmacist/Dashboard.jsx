import { getPharmacistDashboard, getPharmacistInventory, getPharmacistInventoryAlerts, getPharmacistInventoryBatches, getPharmacyAlerts, getPharmacyDashboard } from '../../config/api'
import PharmacistApiScreen from './PharmacistApiScreen'

export default function Dashboard() {
  return <PharmacistApiScreen activeLabel="Dashboard" title="Pharmacist Dashboard" subtitle="Pharmacist / Dashboard" load={getPharmacistDashboard} actions={[{ label: 'Pharmacy Dashboard', fn: () => getPharmacyDashboard() }, { label: 'Alerts', fn: () => getPharmacyAlerts() }, { label: 'Inventory', fn: () => getPharmacistInventory() }, { label: 'Inventory Alerts', fn: () => getPharmacistInventoryAlerts() }, { label: 'Inventory Batches', fn: (id) => getPharmacistInventoryBatches(id) }]} />
}
