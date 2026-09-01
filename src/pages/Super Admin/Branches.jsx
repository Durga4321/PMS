import { useEffect, useMemo, useState } from 'react'
import { changeSuperAdminBranchStatus, getSuperAdminBranches } from '../../config/api'
import SuperAdminModulePage from './SuperAdminModulePage'
import './Branches.css'

const headers = ['Branch', 'Clinic / Hospital', 'Location', 'Contact', 'Email', 'Status', 'Actions']

function ActionIcon({ name }) {
  const paths = {
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></>,
    select: <><path d="m5 12 4 4L19 6" /><rect x="3" y="3" width="18" height="18" rx="2" /></>,
    trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

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
      <span className="super-admin-actions"><button className="super-admin-action-button view" type="button" aria-label={`View ${branch?.name || branch?.branchName || 'branch'}`} title="View branch"><ActionIcon name="eye" /></button><button className="super-admin-action-button edit" type="button" aria-label={`Edit ${branch?.name || branch?.branchName || 'branch'}`} title="Edit branch"><ActionIcon name="edit" /></button><button className="super-admin-action-button select" type="button" aria-label={`${String(status).toLowerCase() === 'active' ? 'Deactivate' : 'Activate'} branch`} title={`${String(status).toLowerCase() === 'active' ? 'Deactivate' : 'Activate'} branch`} onClick={() => toggleBranchStatus(branch)}><ActionIcon name="select" /></button><button className="super-admin-action-button danger" type="button" aria-label={`Delete ${branch?.name || branch?.branchName || 'branch'}`} title="Delete branch"><ActionIcon name="trash" /></button></span>,
    ]
  }), [branches])

  return <SuperAdminModulePage title="Branches" headers={headers} rows={rows} loading={loading} error={error} />
}

export default Branches
