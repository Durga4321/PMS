import { useEffect, useState } from 'react'
import { useToast } from '../../components/ToastProvider'
import AdminLayout from './AdminLayout'

const normalizeList = (response) => {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.results)) return response.results
  if (Array.isArray(response?.suppliers)) return response.suppliers
  if (Array.isArray(response?.orders)) return response.orders
  if (Array.isArray(response?.transfers)) return response.transfers
  return []
}

function AdminApiScreen({ activeLabel, title, subtitle, load, actions = [] }) {
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [payload, setPayload] = useState('{}')
  const [id, setId] = useState('')
  const [message, setMessage] = useState('')

  async function refresh() {
    try {
      const response = await load()
      setItems(normalizeList(response))
      setMessage(JSON.stringify(response?.data && !Array.isArray(response.data) ? response.data : '', null, 2))
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  useEffect(() => { refresh() }, [])

  async function run(action) {
    try {
      const body = payload.trim() ? JSON.parse(payload) : {}
      const response = await action.fn(id, body)
      setMessage(JSON.stringify(response?.data || response, null, 2))
      showToast(response?.message || `${action.label} completed.`)
      await refresh()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  const keys = [...new Set(items.flatMap((item) => Object.keys(item || {})))].slice(0, 7)

  return <AdminLayout activeLabel={activeLabel} title={title} subtitle={subtitle}><section className="branch-panel"><div className="branch-panel-heading"><h2>{title}</h2><button type="button" onClick={refresh}>Refresh</button></div><div className="medicine-filters"><input value={id} onChange={(event) => setId(event.target.value)} placeholder="Record ID" /><input value={payload} onChange={(event) => setPayload(event.target.value)} placeholder="JSON payload" /></div><div className="pharmacist-actions">{actions.map((action) => <button type="button" onClick={() => run(action)} key={action.label}>{action.label}</button>)}</div><div className="branch-table-wrap"><table className="branch-table"><thead><tr>{keys.length ? keys.map((key) => <th key={key}>{key}</th>) : <th>Result</th>}</tr></thead><tbody>{items.length ? items.map((item, index) => <tr key={item?._id || item?.id || index}>{keys.map((key) => <td key={key}>{String(item?.[key] ?? '-')}</td>)}</tr>) : <tr><td colSpan={Math.max(keys.length, 1)}>No data found.</td></tr>}</tbody></table></div>{message ? <pre className="inventory-json">{message}</pre> : null}</section></AdminLayout>
}

export default AdminApiScreen
