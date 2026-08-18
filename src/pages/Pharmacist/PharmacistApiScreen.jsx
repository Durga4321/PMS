import { useEffect, useState } from 'react'
import { useToast } from '../../components/ToastProvider'
import PharmacistLayout from './PharmacistLayout'

const normalizeList = (response) => {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.results)) return response.results
  if (Array.isArray(response?.bills)) return response.bills
  if (Array.isArray(response?.returns)) return response.returns
  return []
}

function PharmacistApiScreen({ activeLabel, title, subtitle, load, actions = [] }) {
  const { showToast } = useToast()
  const [items, setItems] = useState([])
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
      const body = typeof action.payload === 'function' ? action.payload(id) : action.payload || {}
      const response = await action.fn(id, body)
      setMessage(JSON.stringify(response?.data || response, null, 2))
      showToast(response?.message || `${action.label} completed.`)
      await refresh()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  const keys = [...new Set(items.flatMap((item) => Object.keys(item || {})))].slice(0, 6)

  return <PharmacistLayout activeLabel={activeLabel} title={title} subtitle={subtitle}><section className="pharmacist-panel"><h2>{title}</h2><div className="pharmacist-form"><input value={id} onChange={(event) => setId(event.target.value)} placeholder="Record ID / Bill ID" /><button type="button" onClick={refresh}>Refresh</button></div><div className="pharmacist-actions">{actions.map((action) => <button type="button" onClick={() => run(action)} key={action.label}>{action.label}</button>)}</div><div className="branch-table-wrap"><table className="pharmacist-table"><thead><tr>{keys.length ? keys.map((key) => <th key={key}>{key}</th>) : <th>Result</th>}</tr></thead><tbody>{items.length ? items.map((item, index) => <tr key={item?._id || item?.id || index}>{keys.map((key) => <td key={key}>{String(item?.[key] ?? '-')}</td>)}</tr>) : <tr><td colSpan={Math.max(keys.length, 1)}>No data found.</td></tr>}</tbody></table></div>{message ? <pre className="pharmacist-json">{message}</pre> : null}</section></PharmacistLayout>
}

export default PharmacistApiScreen
