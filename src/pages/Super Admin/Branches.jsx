import { useEffect, useMemo, useState } from 'react'
import { changeSuperAdminBranchStatus, getSuperAdminBranches } from '../../config/api'
import SuperAdminModulePage from './SuperAdminModulePage'
import './Branches.css'

const headers = ['Branch', 'Clinic / Hospital', 'Location', 'Contact', 'Email', 'Status', 'Actions']

function normalizeList(response, key) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.[key])) return response.data[key]
  if (Array.isArray(response?.data?.results)) return response.data.results
  if (Array.isArray(response?.[key])) return response[key]
  if (Array.isArray(response?.results)) return response.results
  return []
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
        const response = await getSuperAdminBranches()
        if (active) setBranches(normalizeList(response, 'branches'))
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

function branchId(branch) {
    return branch?._id || branch?.id || branch?.branchId || branch?.externalBranchId
  }

  async function toggleBranchStatus(branch) {
    const id = branchId(branch)
    if (!id) return
    const current = String(branch?.status ?? (branch?.isActive === false ? 'Inactive' : 'Active')).toLowerCase()
    const nextStatus = current === 'active' ? 'Inactive' : 'Active'
    try {
      await changeSuperAdminBranchStatus(id, { status: nextStatus, isActive: nextStatus === 'Active' })
      setBranches((currentBranches) => currentBranches.map((item) => branchId(item) === id ? { ...item, status: nextStatus, isActive: nextStatus === 'Active' } : item))
    } catch (requestError) {
      setError(requestError.message || 'Unable to change branch status.')
    }
  }

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
      <button className="super-admin-inline-action" type="button" onClick={() => toggleBranchStatus(branch)}>{String(status).toLowerCase() === 'active' ? 'Deactivate' : 'Activate'}</button>,
    ]
  }), [branches])

  return <SuperAdminModulePage title="Branches" headers={headers} rows={rows} loading={loading} error={error} />
}

export default Branches
