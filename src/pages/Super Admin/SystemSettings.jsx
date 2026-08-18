import SuperAdminModulePage from './SuperAdminModulePage'
import './SystemSettings.css'

const headers = ['Setting', 'Scope', 'Value', 'Status']

function SystemSettings() {
  return <SuperAdminModulePage title="System Settings" headers={headers} rows={[]} />
}

export default SystemSettings
