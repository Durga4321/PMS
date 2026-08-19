import { useEffect, useMemo, useState } from 'react'
import { apiUrl, listPharmacyAdmins } from '../../config/api'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import './UsersPermissions.css'

const MODULES = ['Dashboard', 'Branches', 'Medicines', 'Inventory', 'Purchases', 'Sales', 'Prescriptions', 'Suppliers', 'Stock Transfers', 'Users & Permissions', 'User Management', 'Settings', 'Reports']
const ACTIONS = ['view', 'create', 'edit', 'delete']
const EMPTY_PERMISSIONS = Object.fromEntries(MODULES.map((module) => [module, Object.fromEntries(ACTIONS.map((action) => [action, false]))]))

function Icon({ children }) {
  return <svg className="permissions-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>
}

function listFrom(response, keys = ['data', 'items', 'results', 'admins', 'roles']) {
  if (Array.isArray(response)) return response
  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key]
    if (Array.isArray(response?.data?.[key])) return response.data[key]
  }
  return []
}

function idOf(item) {
  return item?._id || item?.id || item?.adminId || item?.roleId || item?.uuid
}

function nameOf(item) {
  return item?.name || item?.fullName || item?.adminName || item?.roleName || item?.email || 'Unnamed Admin'
}

function bool(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'yes'
}

function normalizePermissionKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ')
}

function normalizePermissions(source) {
  const result = Object.fromEntries(MODULES.map((module) => [module, { ...EMPTY_PERMISSIONS[module] }]))
  if (!source || typeof source !== 'object') return result
  const entries = Array.isArray(source) ? source.map((item) => [item?.module || item?.name, item]) : Object.entries(source)
  entries.forEach(([rawModule, value]) => {
    const module = MODULES.find((item) => normalizePermissionKey(item) === normalizePermissionKey(rawModule))
    if (!module) return
    if (Array.isArray(value)) value.forEach((action) => { if (ACTIONS.includes(String(action).toLowerCase())) result[module][String(action).toLowerCase()] = true })
    else if (typeof value === 'object') ACTIONS.forEach((action) => { result[module][action] = bool(value[action] ?? value[action === 'edit' ? 'update' : action]) })
    else if (bool(value)) ACTIONS.forEach((action) => { result[module][action] = true })
  })
  return result
}

function permissionSource(item) {
  return item?.permissions || item?.modulePermissions || item?.permissionSet || item?.userPermissions || item?.role?.permissions
}

function token() {
  return sessionStorage.getItem('superAdminToken') || localStorage.getItem('superAdminToken') || sessionStorage.getItem('pharmacyAdminToken') || localStorage.getItem('pharmacyAdminToken')
}

async function permissionsRequest(path, options = {}) {
  const response = await fetch(apiUrl(path), { headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...options.headers }, ...options })
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null
  if (!response.ok) throw new Error(data?.message || data?.error || 'Permissions request failed')
  return data
}

function permissionCount(permissions) {
  return Object.values(permissions).reduce((total, actions) => total + Object.values(actions).filter(Boolean).length, 0)
}

function UsersPermissions() {
  const [admins, setAdmins] = useState([])
  const [roles, setRoles] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [permissions, setPermissions] = useState(EMPTY_PERMISSIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [roleName, setRoleName] = useState('')
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [adminResponse, roleResponse] = await Promise.all([listPharmacyAdmins(), permissionsRequest('pharmacy-super-admin/roles').catch(() => [])])
      const loadedAdmins = listFrom(adminResponse)
      setAdmins(loadedAdmins)
      setRoles(listFrom(roleResponse))
      const first = loadedAdmins[0]
      setSelectedId(first ? idOf(first) : '')
      setPermissions(normalizePermissions(permissionSource(first)))
    } catch {
      setAdmins([])
      setRoles([])
      setSelectedId('')
      setPermissions(normalizePermissions())
      setError('Unable to load roles and permissions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const selectedAdmin = admins.find((admin) => String(idOf(admin)) === String(selectedId))
  const roleRows = roles.length ? roles : admins
  const roleCards = useMemo(() => roleRows.map((role) => ({
    item: role,
    id: idOf(role),
    name: nameOf(role),
    permissions: normalizePermissions(permissionSource(role)),
    users: role?.assignedUsers ?? role?.userCount ?? role?.assignedAdminCount ?? (admins.some((admin) => idOf(admin) === idOf(role)) ? 1 : 0),
  })), [admins, roleRows])

  function selectAdmin(value) {
    const admin = admins.find((item) => String(idOf(item)) === String(value))
    setSelectedId(value)
    setPermissions(normalizePermissions(permissionSource(admin)))
  }

  function togglePermission(module, action) {
    setPermissions((current) => ({ ...current, [module]: { ...current[module], [action]: !current[module][action] } }))
  }

  async function savePermissions(event) {
    event.preventDefault()
    if (!selectedId) return
    setSaving(true)
    try {
      await permissionsRequest(`pharmacy-super-admin/admins/${encodeURIComponent(selectedId)}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) })
      setAdmins((current) => current.map((admin) => idOf(admin) === selectedId ? { ...admin, permissions } : admin))
    } catch {
      setError('Unable to save permissions.')
    } finally {
      setSaving(false)
    }
  }

  async function createRole(event) {
    event.preventDefault()
    if (!roleName.trim()) return
    try {
      const response = await permissionsRequest('pharmacy-super-admin/roles', { method: 'POST', body: JSON.stringify({ name: roleName.trim(), permissions: normalizePermissions() }) })
      setRoles((current) => [...current, response?.role || response?.data || response])
      setRoleName('')
      setModalOpen(false)
    } catch {
      setError('Unable to create role.')
    }
  }

  async function deleteRole(role) {
    if (!roles.length || !role.id) return
    try {
      await permissionsRequest(`pharmacy-super-admin/roles/${encodeURIComponent(role.id)}`, { method: 'DELETE' })
      setRoles((current) => current.filter((item) => idOf(item) !== role.id))
    } catch {
      setError('Unable to delete role.')
    }
  }

  return <div className={`super-admin-shell permissions-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
    <SuperAdminSidebar activeLabel="Users & Permissions" />
    <main className="super-admin-main permissions-page">
      <SuperAdminTopbar onMenu={() => setSidebarOpen((value) => !value)} />
      <section className="permissions-heading"><div><p className="super-admin-eyebrow">Pharmacy Super Admin</p><h1>Users &amp; Permissions</h1><p>Create roles and assign View, Create, Edit, and Delete permissions.</p></div><button className="permissions-primary" type="button" onClick={() => setModalOpen(true)}><Icon><path d="M12 5v14M5 12h14" /></Icon>Create Role</button></section>
      {error ? <p className="permissions-error">{error}</p> : null}
      <section className="permissions-panel">
        <header className="permissions-panel-header">
          <div>
            <h2>Users &amp; Permissions</h2>
            <p>Pharmacy roles, assigned admins, and module access.</p>
          </div>
        </header>

        <div className="permissions-role-table">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Role</th>
                <th>Module</th>
                <th>Assigned Users</th>
                <th>Permissions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="permissions-state" colSpan="6">Loading roles and permissions...</td>
                </tr>
              ) : roleCards.length ? (
                roleCards.map((role, index) => (
                  <tr key={role.id || index}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{role.name}</strong>
                      <small>System Role</small>
                    </td>
                    <td>
                      <strong>{MODULES.filter((module) => permissionCount({ [module]: role.permissions[module] }) > 0).length}</strong>
                      <small>pharmacy modules</small>
                    </td>
                    <td>
                      <strong>{role.users}</strong>
                      <small>{role.users === 1 ? 'assigned admin' : 'assigned admins'}</small>
                    </td>
                    <td>
                      <div className="permission-tags">
                        {MODULES.filter((module) => permissionCount({ [module]: role.permissions[module] }) > 0).slice(0, 5).map((module) => (
                          <span key={module}><b>{module}</b> View, Create, Edit, Delete</span>
                        ))}
                        {permissionCount(role.permissions) === 0 ? <span className="permission-none">None</span> : null}
                      </div>
                    </td>
                    <td>
                      <button className="permissions-icon-button" type="button" aria-label={`Edit ${role.name}`} onClick={() => { const admin = admins.find((item) => idOf(item) === role.id); if (admin) selectAdmin(role.id) }}>
                        <Icon><path d="m4 16-1 5 5-1L19 9l-4-4zM14 6l4 4" /></Icon>
                      </button>
                      <button className="permissions-icon-button danger" type="button" aria-label={`Delete ${role.name}`} disabled={!roles.length} onClick={() => deleteRole(role)}>
                        <Icon><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></Icon>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="permissions-state" colSpan="6">No roles or permissions found. Click Create Role to add a role.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="permissions-panel assign-panel">
        <header className="permissions-panel-header">
          <div>
            <h2>Assign Permissions</h2>
            <p>Pharmacy module permissions for the selected Admin role.</p>
          </div>
        </header>

        <form onSubmit={savePermissions}>
          <label className="permissions-admin-select">
            <span>Admin Role / Admin ID</span>
            <select value={selectedId} onChange={(event) => selectAdmin(event.target.value)}>
              <option value="">{admins.length ? 'Select an admin' : '0 admin'}</option>
              {admins.map((admin) => (
                <option key={idOf(admin)} value={idOf(admin)}>{nameOf(admin)} - ID {idOf(admin) || '0'}</option>
              ))}
            </select>
          </label>

          <div className="permissions-grid-wrap">
            <table className="permissions-grid">
              <thead>
                <tr>
                  <th>Module</th>
                  {ACTIONS.map((action) => <th key={action}>{action.charAt(0).toUpperCase() + action.slice(1)}</th>)}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((module) => (
                  <tr key={module}>
                    <td>{module}</td>
                    {ACTIONS.map((action) => (
                      <td key={action}>
                        <label className="permission-check">
                          <input type="checkbox" checked={Boolean(permissions[module][action])} disabled={!selectedId} onChange={() => togglePermission(module, action)} />
                          <span>
                            <Icon><path d="m5 12 4 4L19 6" /></Icon>
                          </span>
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="permissions-save-row">
            <span>{selectedAdmin ? `${permissionCount(permissions)} permissions selected` : '0 admin selected'}</span>
            <button className="permissions-primary" disabled={!selectedId || saving} type="submit">{saving ? 'Saving...' : 'Save Module Permissions'}</button>
          </div>
        </form>
      </section>

    </main>

    {modalOpen ? (
      <div className="permissions-modal-backdrop" role="presentation">
        <form className="permissions-modal" onSubmit={createRole}>
          <h2>Create Role</h2>
          <p>Add a pharmacy role to the roles list.</p>
          <label>
            Role Name
            <input autoFocus required value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="e.g. Inventory Manager" />
          </label>
          <div>
            <button type="button" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="permissions-primary" type="submit">Create Role</button>
          </div>
        </form>
      </div>
    ) : null}

  </div>
}

export default UsersPermissions
