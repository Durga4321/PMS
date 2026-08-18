import { useEffect, useMemo, useState } from 'react'
import { listPharmacyAdmins } from '../../config/api'
import SuperAdminModulePage from './SuperAdminModulePage'
import './UsersPermissions.css'

const headers = ['Name', 'Email', 'Role', 'Status', 'Permissions']

function normalizeList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.admins)) return response.data.admins
  if (Array.isArray(response?.admins)) return response.admins
  if (Array.isArray(response?.results)) return response.results
  return []
}

function extractPermissions(item) {
  const source = item?.permissions || item?.modulePermissions || item?.permissionSet || item?.userPermissions
  if (Array.isArray(source)) return source.join(', ')
  if (source && typeof source === 'object') {
    return Object.entries(source)
      .filter(([, value]) => value === true || value === 'true' || value === 1 || value === '1')
      .map(([key]) => key)
      .join(', ')
  }
  return '-'
}

function UsersPermissions() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadUsers() {
      setLoading(true)
      setError('')

      try {
        const response = await listPharmacyAdmins()
        if (active) setUsers(normalizeList(response))
      } catch (requestError) {
        if (active) setError(requestError.message || 'Unable to load users.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadUsers()
    return () => {
      active = false
    }
  }, [])

  const rows = useMemo(() => users.map((user) => [
    user?.name || user?.fullName || user?.adminName || '-',
    user?.email || '-',
    user?.role || user?.roleName || user?.adminRole || 'Admin',
    user?.status || (user?.isActive === false ? 'Inactive' : 'Active'),
    extractPermissions(user),
  ]), [users])

  return <SuperAdminModulePage title="Users & Permissions" headers={headers} rows={rows} loading={loading} error={error} />
}

export default UsersPermissions
