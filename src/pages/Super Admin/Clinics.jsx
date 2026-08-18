import { useEffect, useMemo, useState } from 'react'
import { listAssignmentHospitals } from '../../config/api'
import SuperAdminModulePage from './SuperAdminModulePage'
import './Clinics.css'

const headers = ['Clinic / Hospital', 'Location', 'Contact', 'Email', 'Status']

function normalizeList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.hospitals)) return response.data.hospitals
  if (Array.isArray(response?.data?.results)) return response.data.results
  if (Array.isArray(response?.hospitals)) return response.hospitals
  if (Array.isArray(response?.results)) return response.results
  return []
}

function Clinics() {
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadClinics() {
      setLoading(true)
      setError('')

      try {
        const response = await listAssignmentHospitals()
        if (active) setClinics(normalizeList(response))
      } catch (requestError) {
        if (active) setError(requestError.message || 'Unable to load clinics.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadClinics()
    return () => {
      active = false
    }
  }, [])

  const rows = useMemo(() => clinics.map((clinic) => {
    const statusValue = clinic?.status ?? clinic?.isActive
    const status = typeof statusValue === 'boolean' ? (statusValue ? 'Active' : 'Inactive') : statusValue || 'Active'

    return [
      clinic?.name || clinic?.clinicName || clinic?.hospitalName || clinic?.title || '-',
      clinic?.address || clinic?.location || [clinic?.city, clinic?.state, clinic?.country].filter(Boolean).join(', ') || '-',
      clinic?.phone || clinic?.mobile || clinic?.contactNumber || clinic?.contact || '-',
      clinic?.email || '-',
      status,
    ]
  }), [clinics])

  return <SuperAdminModulePage title="Clinics" headers={headers} rows={rows} loading={loading} error={error} />
}

export default Clinics
