import { useEffect, useMemo, useState } from 'react'
import { assignPharmacyAdminRole, createSuperAdminRole, deleteSuperAdminRole, getSuperAdminRolePermissions, listPharmacyAdmins, listSuperAdminRoleDropdown, listSuperAdminRoles, updateSuperAdminRolePermissions } from '../../config/api'
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

function ModuleIcon({ module }) {
  const paths = {
    Dashboard: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    Users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1M17 11a2.5 2.5 0 1 1 0 5M17 20h4" /></>,
    Medicines: <><path d="m14.5 4.5 5 5a4.24 4.24 0 0 1-6 6l-5-5a4.24 4.24 0 0 1 6-6Z" /><path d="m10 9 5 5" /></>,
    Stock: <><path d="m4 8 8-4 8 4-8 4-8-4Z" /><path d="M4 8v8l8 4 8-4V8M12 12v8" /></>,
    Suppliers: <><path d="M4 5h16v14H4z" /><path d="M8 5V3h8v2M8 10h8M8 14h5" /></>,
    'Purchase Orders': <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    'Stock Transfers': <><path d="M4 7h13l3 4v6H4z" /><path d="M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM17 7V4H4" /></>,
    Prescriptions: <><path d="M6 3h12v18H6z" /><path d="M9 7h6M9 11h6M9 15h3" /></>,
    Dispensing: <><path d="M5 8h14v12H5zM8 8V5h8v3M9 12h6M12 10v4" /></>,
    'Expiry Alerts': <><path d="M12 4a7 7 0 1 0 7 7" /><path d="M12 7v5l3 2M17 4h3v3" /></>,
    Reports: <><path d="M5 3h10l4 4v14H5zM15 3v5h5M8 17v-4m4 4V9m4 8v-2" /></>,
    Settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
    'CMS Integration': <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h5M8 16h8" /></>,
  }
  const iconClass = module.toLowerCase().replace(/\s+/g, '-')
  return <span className={`module-icon module-icon-${iconClass}`} aria-hidden="true"><Icon>{paths[module]}</Icon></span>
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
  return item?.roleName || item?.role_name || item?.assignedRoleName || item?.assigned_role_name || item?.role?.roleName || item?.role?.role_name || item?.role?.name || item?.role?.title || item?.assignedRole?.roleName || item?.assignedRole?.role_name || item?.assignedRole?.name || item?.assignedRole?.title || item?.userRole?.name || item?.userRole?.roleName || item?.roleDetails?.name || item?.roleDetails?.roleName || item?.title || item?.name || item?.displayName || (typeof item?.role === 'string' ? item.role : '') || ''
}

function assignedUsersOf(role, admins) {
  const embeddedSource = [role?.assignedUsers, role?.assignedAdmins, role?.users, role?.admins, role?.assignedUser].find((value) => Array.isArray(value) || (value && typeof value === 'object'))
  const embeddedUsers = Array.isArray(embeddedSource) ? embeddedSource : embeddedSource ? [embeddedSource] : null
  if (embeddedUsers) return embeddedUsers
  return admins.filter((admin) => String(roleIdOf(admin)) === String(idOf(role)))
}

function assignedUserCountOf(role, assignedUsers) {
  const count = [role?.assignedUsersCount, role?.assignedAdminsCount, role?.userCount, role?.adminCount].find((value) => typeof value === 'number')
  return count ?? assignedUsers.length
}

function assignedUserLabelOf(user) {
  if (typeof user === 'string') return user
  const name = nameOf(user)
  const id = idOf(user)
  return `${name}${id ? ` - ID ${id}` : ''}`
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
      const [adminResponse, roleResponse, roleDropdownResponse] = await Promise.all([listPharmacyAdmins(), listSuperAdminRoles().catch(() => []), listSuperAdminRoleDropdown().catch(() => [])])
      const loadedAdmins = listFrom(adminResponse)
      const loadedRoleOptions = listFrom(roleDropdownResponse, ['roles', 'items', 'results', 'data'])
      const loadedRoles = loadedRoleOptions.length ? loadedRoleOptions : listFrom(roleResponse, ['roles', 'items', 'results', 'data'])
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
  const permissionState = normalizePermissions(permissions, MODULES)
  const roleCards = useMemo(() => roles.map((role) => {
    const rolePermissions = normalizePermissions(permissionSource(role), MODULES)
    const assignedAdmins = assignedUsersOf(role, admins)
    return {
      id: idOf(role),
      name: roleNameOf(role),
      permissions: rolePermissions,
      users: assignedUserCountOf(role, assignedAdmins),
      assignedAdmins,
    }
  }), [admins, roles])

  async function selectRole(value) {
    const role = roles.find((item) => String(idOf(item)) === String(value))
    setSelectedRoleId(value)
    setPermissions(role ? await loadRolePermissions(role) : EMPTY_PERMISSIONS)
  }

  function togglePermission(module, action, checked) {
    setPermissions((current) => {
      const normalized = normalizePermissions(current, MODULES)
      return {
        ...normalized,
        [module]: {
          ...normalized[module],
          [action]: checked,
        },
      }
    })
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
      <section className="permissions-panel"><header className="permissions-panel-header"><div><h2>System Roles</h2><p>Manage and configure system roles.</p></div></header><div className="permissions-role-table"><table><thead><tr><th>S.No</th><th>Role Name</th><th>Pharmacy Modules</th><th>Assigned Users</th><th>Permissions</th><th>Actions</th></tr></thead><tbody>{loading ? <tr><td className="permissions-state" colSpan="6">Loading roles and permissions...</td></tr> : roleCards.length ? roleCards.map((role, index) => <tr key={role.id || index}><td>{index + 1}</td><td><div className="role-name-cell"><span className="role-mark"><Icon><path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></Icon></span><span><strong>{role.name}</strong><small className="role-badge">System Role</small></span></div></td><td><strong>{MODULES.filter((module) => permissionCount({ [module]: role.permissions[module] }) > 0).length}</strong><small>pharmacy modules</small></td><td><strong>{role.users}</strong><small>{role.assignedAdmins.map(assignedUserLabelOf).join(', ') || (role.users === 1 ? 'assigned admin' : 'assigned admins')}</small></td><td><div className="permission-tags">{MODULES.filter((module) => permissionCount({ [module]: role.permissions[module] }) > 0).slice(0, 5).map((module) => <span key={module}><b>{module}</b> selected</span>)}{permissionCount(role.permissions) === 0 ? <span className="permission-none">None</span> : null}</div></td><td><div className="permissions-action-group"><button className="permissions-icon-button view" type="button" aria-label={`View ${role.name}`} onClick={() => selectRole(role.id)}><Icon><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" /><circle cx="12" cy="12" r="2.5" /></Icon></button><button className="permissions-icon-button edit" type="button" aria-label={`Edit ${role.name}`} onClick={() => selectRole(role.id)}><Icon><path d="m4 16-1 5 5-1L19 9l-4-4zM14 6l4 4" /></Icon></button><button className="permissions-icon-button select" type="button" aria-label={`Select permissions for ${role.name}`} onClick={() => selectRole(role.id)}><Icon><rect x="5" y="4" width="14" height="16" rx="2" /><path d="m8 12 2.5 2.5L16 9" /></Icon></button><button className="permissions-icon-button danger" type="button" aria-label={`Delete ${role.name}`} onClick={() => removeRole(role)}><Icon><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></Icon></button></div></td></tr>) : <tr><td className="permissions-state" colSpan="6">No roles found. Click Create Role to add one.</td></tr>}</tbody></table></div></section>
      <section className="permissions-panel assign-panel"><header className="permissions-panel-header"><div><h2>Assign Permissions</h2><p>Module permissions for the selected role.</p></div></header><form onSubmit={savePermissions}><label className="permissions-admin-select"><span>Role</span><select value={selectedRoleId} onChange={(event) => selectRole(event.target.value)}><option value="">{roles.length ? 'Select a role' : '0 role'}</option>{roles.map((role) => <option key={idOf(role)} value={idOf(role)}>{roleNameOf(role)}</option>)}</select></label><div className="permissions-grid-wrap"><table className="permissions-grid"><thead><tr><th>Module</th>{ACTIONS.map((action) => <th key={action}>{action.charAt(0).toUpperCase() + action.slice(1)}</th>)}</tr></thead><tbody>{MODULES.map((module) => <tr key={module}><td><span className="module-label"><ModuleIcon module={module} /><span>{module}</span></span></td>{ACTIONS.map((action) => <td key={action}><label className={`permission-check permission-check-${action}`}><input type="checkbox" checked={Boolean(permissionState[module]?.[action])} disabled={!selectedRoleId} onChange={(event) => togglePermission(module, action, event.target.checked)} /><span><Icon><path d="m5 12 4 4L19 6" /></Icon></span></label></td>)}</tr>)}</tbody></table></div><div className="permissions-save-row"><span>{selectedRole ? `${permissionCount(permissionState)} permissions selected` : '0 role selected'}</span><button className="permissions-primary" disabled={!selectedRoleId || saving} type="submit">{saving ? 'Saving...' : 'Save Role Permissions'}</button></div></form></section>
      <section className="permissions-panel assign-panel"><header className="permissions-panel-header"><div><h2>Assign Role To Admin</h2><p>Attach the selected role to a pharmacy admin account.</p></div></header><form onSubmit={assignRole}><label className="permissions-admin-select"><span>Admin</span><select value={selectedAdminId} onChange={(event) => setSelectedAdminId(event.target.value)}><option value="">{admins.length ? 'Select an admin' : '0 admin'}</option>{admins.map((admin) => <option key={idOf(admin)} value={idOf(admin)}>{nameOf(admin)} - ID {idOf(admin) || '0'}</option>)}</select></label><div className="permissions-save-row"><span>{selectedAdmin && selectedRole ? `${roleNameOf(selectedRole)} -> ${nameOf(selectedAdmin)}` : 'Select admin and role'}</span><button className="permissions-primary" disabled={!selectedAdminId || !selectedRoleId || assigning} type="submit">{assigning ? 'Assigning...' : 'Assign Role'}</button></div></form></section>
    </main>
    {modalOpen ? <div className="permissions-modal-backdrop" role="presentation"><form className="permissions-modal" onSubmit={createRole}><h2>Create Role</h2><p>Add a pharmacy role to the roles list.</p><label>Role Name<input autoFocus required value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="e.g. Inventory Manager" /></label><div><button type="button" onClick={() => setModalOpen(false)}>Cancel</button><button className="permissions-primary" type="submit">Create Role</button></div></form></div> : null}
  </div>
}

export default UsersPermissions