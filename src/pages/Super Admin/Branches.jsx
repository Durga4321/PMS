import { useEffect, useMemo, useState } from 'react'
import { listAssignmentHospitals, listHospitalBranches } from '../../config/api'
import SuperAdminModulePage from './SuperAdminModulePage'
import './Branches.css'

const headers = ['Branch', 'Clinic / Hospital', 'Location', 'Contact', 'Email', 'Status']

function normalizeList(response, key) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.[key])) return response.data[key]
  if (Array.isArray(response?.data?.results)) return response.data.results
  if (Array.isArray(response?.[key])) return response[key]
  if (Array.isArray(response?.results)) return response.results
  return []
}

function getHospitalId(hospital) {
  return hospital?._id || hospital?.id || hospital?.hospitalId || hospital?.externalHospitalId || hospital?.uuid
}

function getHospitalName(hospital) {
  return hospital?.name || hospital?.clinicName || hospital?.hospitalName || hospital?.title || '-'
}

function Branches() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadBranches() {
      setLoading(true)
      setError('')

      try {
        const hospitalResponse = await listAssignmentHospitals()
        const hospitals = normalizeList(hospitalResponse, 'hospitals')
        const branchGroups = await Promise.all(hospitals.map(async (hospital) => {
          const hospitalId = getHospitalId(hospital)
          if (!hospitalId) return []
          const response = await listHospitalBranches(hospitalId)
          return normalizeList(response, 'branches').map((branch) => ({ ...branch, hospitalName: getHospitalName(hospital) }))
        }))

        if (active) setBranches(branchGroups.flat())
      } catch (requestError) {
        if (active) setError(requestError.message || 'Unable to load branches.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadBranches()
    return () => {
      active = false
    }
  }, [])

  const rows = useMemo(() => branches.map((branch) => {
    const statusValue = branch?.status ?? branch?.isActive
    const status = typeof statusValue === 'boolean' ? (statusValue ? 'Active' : 'Inactive') : statusValue || 'Active'

    return [
      branch?.name || branch?.branchName || branch?.title || '-',
      branch?.hospitalName || branch?.clinicName || branch?.hospital || '-',
      branch?.address || branch?.location || [branch?.city, branch?.state, branch?.country].filter(Boolean).join(', ') || '-',
      branch?.phone || branch?.mobile || branch?.contactNumber || branch?.contact || '-',
      branch?.email || '-',
      status,
    ]
  }), [branches])

  return <SuperAdminModulePage title="Branches" headers={headers} rows={rows} loading={loading} error={error} />
}

export default Branches
