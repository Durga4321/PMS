import SuperAdminModulePage from './SuperAdminModulePage'
import './Reports.css'

const headers = ['Report', 'Type', 'Created By', 'Status']

function Reports() {
  return <SuperAdminModulePage title="Reports" headers={headers} rows={[]} />
}

export default Reports
