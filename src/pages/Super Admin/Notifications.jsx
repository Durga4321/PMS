import SuperAdminModulePage from './SuperAdminModulePage'
import './Notifications.css'

const headers = ['Title', 'Message', 'Date', 'Type', 'Status']

function Notifications() {
  return <SuperAdminModulePage title="Notifications" headers={headers} rows={[]} />
}

export default Notifications
