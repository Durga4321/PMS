import { useEffect, useMemo, useState } from 'react'
import { assignPharmacyAdminRole, createSuperAdminRole, deleteSuperAdminRole, getSuperAdminRolePermissions, listPharmacyAdmins, listSuperAdminRoles, updateSuperAdminRolePermissions } from '../../config/api'
import { ADMIN_MODULES, PERMISSION_ACTIONS, emptyPermissions, normalizePermissions, permissionSource, serializePermissions } from '../../config/permissions'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import './UsersPermissions.css'

const MODULES = ADMIN_MODULES
const ACTIONS = PERMISSION_ACTIONS
const EMPTY_PERMISSIONS = emptyPermissions(MODULES)

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

function roleIdOf(item) {
  return item?.roleId || item?.role?._id || item?.role?.id || item?.assignedRoleId || item?.role
}

function nameOf(item) {
  return item?.name || item?.fullName || item?.adminName || item?.roleName || item?.email || 'Unnamed'
}

function roleNameOf(item) {
  return item?.name || item?.roleName || item?.title || 'Unnamed Role'
}

function permissionCount(permissions) {
  return Object.values(permissions || {}).reduce((total, actions) => total + Object.values(actions || {}).filter(Boolean).length, 0)
}

function permissionsFromResponse(response, fallback) {
  return response?.data?.permissions || response?.permissions || response?.data?.modulePermissions || response?.modulePermissions || response?.data || response || fallback
}

function UsersPermissions() {
  const [admins, setAdmins] = useState([])
  const [roles, setRoles] = useState([])
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [selectedAdminId, setSelectedAdminId] = useState('')
  const [permissions, setPermissions] = useState(EMPTY_PERMISSIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [roleName, setRoleName] = useState('')
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function loadRolePermissions(role) {
    const id = idOf(role)
    if (!id) return normalizePermissions(permissionSource(role), MODULES)
    try {
      const response = await getSuperAdminRolePermissions(id)
      return normalizePermissions(permissionsFromResponse(response, permissionSource(role)), MODULES)
    } catch {
      return normalizePermissions(permissionSource(role), MODULES)
    }
  }

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [adminResponse, roleResponse] = await Promise.all([listPharmacyAdmins(), listSuperAdminRoles().catch(() => [])])
      const loadedAdmins = listFrom(adminResponse)
      const loadedRoles = listFrom(roleResponse)
      setAdmins(loadedAdmins)
      setRoles(loadedRoles)
      const firstRole = loadedRoles[0]
      setSelectedRoleId(firstRole ? idOf(firstRole) : '')
      setSelectedAdminId(loadedAdmins[0] ? idOf(loadedAdmins[0]) : '')
      setPermissions(firstRole ? await loadRolePermissions(firstRole) : EMPTY_PERMISSIONS)
    } catch (requestError) {
      setAdmins([])
      setRoles([])
      setSelectedRoleId('')
      setSelectedAdminId('')
      setPermissions(EMPTY_PERMISSIONS)
      setError(requestError.message || 'Unable to load roles and permissions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const selectedRole = roles.find((role) => String(idOf(role)) === String(selectedRoleId))
  const selectedAdmin = admins.find((admin) => String(idOf(admin)) === String(selectedAdminId))
  const roleCards = useMemo(() => roles.map((role) => {
    const rolePermissions = normalizePermissions(permissionSource(role), MODULES)
    return {
      id: idOf(role),
      name: roleNameOf(role),
      permissions: rolePermissions,
      users: admins.filter((admin) => String(roleIdOf(admin)) === String(idOf(role))).length,
    }
  }), [admins, roles])

  async function selectRole(value) {
    const role = roles.find((item) => String(idOf(item)) === String(value))
    setSelectedRoleId(value)
    setPermissions(role ? await loadRolePermissions(role) : EMPTY_PERMISSIONS)
  }

  function togglePermission(module, action) {
    setPermissions((current) => ({ ...current, [module]: { ...current[module], [action]: !current[module][action] } }))
  }

  async function savePermissions(event) {
    event.preventDefault()
    if (!selectedRoleId) return
    setSaving(true)
    try {
      const payload = serializePermissions(permissions)
      await updateSuperAdminRolePermissions(selectedRoleId, payload)
      const refreshed = await getSuperAdminRolePermissions(selectedRoleId).catch(() => null)
      const savedPermissions = normalizePermissions(permissionsFromResponse(refreshed, permissions), MODULES)
      setPermissions(savedPermissions)
      setRoles((current) => current.map((role) => String(idOf(role)) === String(selectedRoleId) ? { ...role, permissions: savedPermissions, modulePermissions: payload.modulePermissions } : role))
      setError('')
    } catch (requestError) {
      setError(requestError.message || 'Unable to save permissions.')
    } finally {
      setSaving(false)
    }
  }

  async function createRole(event) {
    event.preventDefault()
    if (!roleName.trim()) return
    try {
      const response = await createSuperAdminRole({ name: roleName.trim(), permissions: EMPTY_PERMISSIONS, modulePermissions: serializePermissions(EMPTY_PERMISSIONS).modulePermissions })
      const role = response?.role || response?.data || response
      setRoles((current) => [...current, role])
      setRoleName('')
      setModalOpen(false)
    } catch (requestError) {
      setError(requestError.message || 'Unable to create role.')
    }
  }

  async function removeRole(role) {
    const id = idOf(role)
    if (!id) return
    try {
      await deleteSuperAdminRole(id)
      setRoles((current) => current.filter((item) => String(idOf(item)) !== String(id)))
      if (String(selectedRoleId) === String(id)) {
        setSelectedRoleId('')
        setPermissions(EMPTY_PERMISSIONS)
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to delete role.')
    }
  }

  async function assignRole(event) {
    event.preventDefault()
    if (!selectedAdminId || !selectedRoleId) return
    setAssigning(true)
    try {
      await assignPharmacyAdminRole(selectedAdminId, { roleId: selectedRoleId })
      setAdmins((current) => current.map((admin) => String(idOf(admin)) === String(selectedAdminId) ? { ...admin, roleId: selectedRoleId, role: selectedRole } : admin))
      setError('')
    } catch (requestError) {
      setError(requestError.message || 'Unable to assign role.')
    } finally {
      setAssigning(false)
    }
  }

  return <div className={`super-admin-shell permissions-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
    <SuperAdminSidebar activeLabel="Users & Permissions" />
    <main className="super-admin-main permissions-page">
      <SuperAdminTopbar onMenu={() => setSidebarOpen((value) => !value)} />
      <section className="permissions-heading"><div><p className="super-admin-eyebrow">Pharmacy Super Admin</p><h1>Users &amp; Permissions</h1><p>Create roles, save module permissions, and assign roles to pharmacy admins.</p></div><button className="permissions-primary" type="button" onClick={() => setModalOpen(true)}><Icon><path d="M12 5v14M5 12h14" /></Icon>Create Role</button></section>
      {error ? <p className="permissions-error">{error}</p> : null}
      <section className="permissions-panel"><header className="permissions-panel-header"><div><h2>Roles</h2><p>Saved pharmacy roles and module access.</p></div></header><div className="permissions-role-table"><table><thead><tr><th>S.No</th><th>Role</th><th>Modules</th><th>Assigned Users</th><th>Permissions</th><th>Actions</th></tr></thead><tbody>{loading ? <tr><td className="permissions-state" colSpan="6">Loading roles and permissions...</td></tr> : roleCards.length ? roleCards.map((role, index) => <tr key={role.id || index}><td>{index + 1}</td><td><strong>{role.name}</strong><small>System Role</small></td><td><strong>{MODULES.filter((module) => permissionCount({ [module]: role.permissions[module] }) > 0).length}</strong><small>pharmacy modules</small></td><td><strong>{role.users}</strong><small>{role.users === 1 ? 'assigned admin' : 'assigned admins'}</small></td><td><div className="permission-tags">{MODULES.filter((module) => permissionCount({ [module]: role.permissions[module] }) > 0).slice(0, 5).map((module) => <span key={module}><b>{module}</b> selected</span>)}{permissionCount(role.permissions) === 0 ? <span className="permission-none">None</span> : null}</div></td><td><button className="permissions-icon-button" type="button" aria-label={`Edit ${role.name}`} onClick={() => selectRole(role.id)}><Icon><path d="m4 16-1 5 5-1L19 9l-4-4zM14 6l4 4" /></Icon></button><button className="permissions-icon-button danger" type="button" aria-label={`Delete ${role.name}`} onClick={() => removeRole(role)}><Icon><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></Icon></button></td></tr>) : <tr><td className="permissions-state" colSpan="6">No roles found. Click Create Role to add one.</td></tr>}</tbody></table></div></section>
      <section className="permissions-panel assign-panel"><header className="permissions-panel-header"><div><h2>Assign Permissions</h2><p>Module permissions for the selected role.</p></div></header><form onSubmit={savePermissions}><label className="permissions-admin-select"><span>Role</span><select value={selectedRoleId} onChange={(event) => selectRole(event.target.value)}><option value="">{roles.length ? 'Select a role' : '0 role'}</option>{roles.map((role) => <option key={idOf(role)} value={idOf(role)}>{roleNameOf(role)}</option>)}</select></label><div className="permissions-grid-wrap"><table className="permissions-grid"><thead><tr><th>Module</th>{ACTIONS.map((action) => <th key={action}>{action.charAt(0).toUpperCase() + action.slice(1)}</th>)}</tr></thead><tbody>{MODULES.map((module) => <tr key={module}><td>{module}</td>{ACTIONS.map((action) => <td key={action}><label className="permission-check"><input type="checkbox" checked={Boolean(permissions[module]?.[action])} disabled={!selectedRoleId} onChange={() => togglePermission(module, action)} /><span><Icon><path d="m5 12 4 4L19 6" /></Icon></span></label></td>)}</tr>)}</tbody></table></div><div className="permissions-save-row"><span>{selectedRole ? `${permissionCount(permissions)} permissions selected` : '0 role selected'}</span><button className="permissions-primary" disabled={!selectedRoleId || saving} type="submit">{saving ? 'Saving...' : 'Save Role Permissions'}</button></div></form></section>
      <section className="permissions-panel assign-panel"><header className="permissions-panel-header"><div><h2>Assign Role To Admin</h2><p>Attach the selected role to a pharmacy admin account.</p></div></header><form onSubmit={assignRole}><label className="permissions-admin-select"><span>Admin</span><select value={selectedAdminId} onChange={(event) => setSelectedAdminId(event.target.value)}><option value="">{admins.length ? 'Select an admin' : '0 admin'}</option>{admins.map((admin) => <option key={idOf(admin)} value={idOf(admin)}>{nameOf(admin)} - ID {idOf(admin) || '0'}</option>)}</select></label><div className="permissions-save-row"><span>{selectedAdmin && selectedRole ? `${roleNameOf(selectedRole)} -> ${nameOf(selectedAdmin)}` : 'Select admin and role'}</span><button className="permissions-primary" disabled={!selectedAdminId || !selectedRoleId || assigning} type="submit">{assigning ? 'Assigning...' : 'Assign Role'}</button></div></form></section>
    </main>
    {modalOpen ? <div className="permissions-modal-backdrop" role="presentation"><form className="permissions-modal" onSubmit={createRole}><h2>Create Role</h2><p>Add a pharmacy role to the roles list.</p><label>Role Name<input autoFocus required value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="e.g. Inventory Manager" /></label><div><button type="button" onClick={() => setModalOpen(false)}>Cancel</button><button className="permissions-primary" type="submit">Create Role</button></div></form></div> : null}
  </div>
}

export default UsersPermissions