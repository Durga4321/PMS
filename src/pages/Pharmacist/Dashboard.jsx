import { getPharmacyAlerts, getPharmacyDashboard } from '../../config/api'
import PharmacistApiScreen from './PharmacistApiScreen'

export default function Dashboard() {
  return <PharmacistApiScreen activeLabel="Dashboard" title="Pharmacist Dashboard" subtitle="Pharmacist / Dashboard" load={getPharmacyDashboard} actions={[{ label: 'Alerts', fn: () => getPharmacyAlerts() }]} />
}
