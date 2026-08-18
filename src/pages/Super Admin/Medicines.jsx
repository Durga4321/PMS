import SuperAdminModulePage from './SuperAdminModulePage'
import './Medicines.css'

const headers = ['Medicine Name', 'Brand', 'Category', 'SKU', 'Stock', 'Price (MRP)', 'Status', 'Actions']

function Medicines() {
  return <SuperAdminModulePage title="Medicines" headers={headers} rows={[]} />
}

export default Medicines
