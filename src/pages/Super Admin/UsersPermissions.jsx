import { useEffect, useMemo, useState } from 'react'
import { assignPharmacyAdminRole, getPharmacyAdminRole, getSuperAdminRolePermissions, listPharmacyAdmins, listSuperAdminRoles, updateSuperAdminRolePermissions } from '../../config/api'
import { useToast } from '../../components/ToastProvider'
import { PERMISSION_ACTIONS, emptyPermissions, normalizePermissions } from '../../config/permissions'
import SidebarIcon from '../../components/SidebarIcon'
import { adminNavigation } from '../Admin/adminNavigation'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import './UsersPermissions.css'

const ADMIN_PERMISSION_MODULES = adminNavigation.map(({ label, iconName }) => ({
  label: label === 'Pharmacists' ? 'Users' : label,
  sidebarLabel: label,
  iconName,
}))
const MODULES = ADMIN_PERMISSION_MODULES.map((module) => module.label)
const ACTIONS = PERMISSION_ACTIONS
const EMPTY_PERMISSIONS = emptyPermissions(MODULES)

function Icon({ children }) {
  return <svg className="permissions-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>
}

function ModuleIcon({ module }) {
  const sidebarModule = ADMIN_PERMISSION_MODULES.find((item) => item.label === module || item.sidebarLabel === module)
  const iconClass = String(sidebarModule?.iconName || module).toLowerCase().replace(/\s+/g, '-')
  return <span className={`module-icon module-icon-${iconClass}`} aria-hidden="true"><SidebarIcon name={sidebarModule?.iconName || 'dashboard'} /></span>
}

function listFrom(response, keys = ['data', 'items', 'results', 'roles', 'admins']) {
  if (Array.isArray(response)) return response
  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key]
    if (Array.isArray(response?.data?.[key])) return response.data[key]
  }
  return []
}

function idOf(item) {
  return item?._id || item?.id || item?.roleId || item?.adminId || item?.adminUserId || item?.userId || item?.uuid
}

function nameOf(item) {
  return item?.name || item?.roleName || item?.fullName || item?.adminName || item?.email || 'Unnamed'
}

function roleIdFrom(response, fallback = '') {
  const source = response?.data?.role || response?.data || response?.role || response || {}
  return idOf(source) || source?.pharmacyPermissionRoleId || source?.roleId || fallback
}

function permissionSource(response, fallback) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  return response?.data?.permissions
    || response?.data?.Permissions
    || response?.permissions
    || response?.Permissions
    || response?.data?.modulePermissions
    || response?.data?.ModulePermissions
    || response?.modulePermissions
    || response?.ModulePermissions
    || response?.data?.role?.permissions
    || response?.data?.role?.Permissions
    || response?.role?.permissions
    || response?.role?.Permissions
    || fallback
}

const VALID_BACKEND_MODULES = [
  'Dashboard',
  'Branches',
  'Users',
  'Medicines',
  'Stock',
  'Suppliers',
  'Purchase Orders',
  'Stock Transfers',
  'Prescriptions',
  'Pending',
  'Dispensing',
  'Bills',
  'Returns',
  'Expiry Alerts',
  'Reports',
  'Settings',
  'CMS Integration',
]

function permissionPayload(permissions) {
  const normalized = normalizePermissions(permissions, MODULES)

  // Merge Pharmacies into Branches so pharmacy permissions are preserved
  const branchesPerms = {
    view: Boolean(normalized.Branches?.view || normalized.Pharmacies?.view),
    create: Boolean(normalized.Branches?.create || normalized.Pharmacies?.create),
    edit: Boolean(normalized.Branches?.edit || normalized.Pharmacies?.edit),
    delete: Boolean(normalized.Branches?.delete || normalized.Pharmacies?.delete),
  }

  const effective = {
    ...normalized,
    Branches: branchesPerms,
  }

  const modulePermissions = []
  const seen = new Set()

  VALID_BACKEND_MODULES.forEach((mod) => {
    const key = mod.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)

    const act = effective[mod] || effective[mod.toLowerCase()] || permissions?.[mod] || permissions?.[mod.toLowerCase()] || { view: true, create: true, edit: true, delete: true }
    modulePermissions.push({
      module: mod,
      canView: Boolean(act.canView ?? act.view),
      canCreate: Boolean(act.canCreate ?? act.create),
      canEdit: Boolean(act.canEdit ?? act.edit),
      canDelete: Boolean(act.canDelete ?? act.delete),
    })
  })

  return modulePermissions
}

function permissionCount(permissions) {
  return Object.values(permissions || {}).reduce((total, actions) => total + Object.values(actions || {}).filter(Boolean).length, 0)
}

function hasAnyPermission(permissions) {
  return permissionCount(permissions) > 0
}

function actionLabel(action) {
  return action.charAt(0).toUpperCase() + action.slice(1)
}

function readStoredPermissionsForAdmin(adminId, email) {
  if (!adminId && !email) return null
  try {
    const idKey = adminId ? localStorage.getItem(`pms_admin_permissions_${adminId}`) || sessionStorage.getItem(`pms_admin_permissions_${adminId}`) : null
    const emailKey = email ? localStorage.getItem(`pms_admin_permissions_${String(email).trim().toLowerCase()}`) || sessionStorage.getItem(`pms_admin_permissions_${String(email).trim().toLowerCase()}`) : null
    const raw = idKey || emailKey
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return normalizePermissions(parsed, MODULES)
    }
  } catch {}
  return null
}

function savePermissionsLocallyForAdmin(adminId, perms, email) {
  try {
    const json = JSON.stringify(perms)
    if (adminId) {
      localStorage.setItem(`pms_admin_permissions_${adminId}`, json)
      sessionStorage.setItem(`pms_admin_permissions_${adminId}`, json)
    }
    if (email) {
      const normalizedEmail = String(email).trim().toLowerCase()
      localStorage.setItem(`pms_admin_permissions_${normalizedEmail}`, json)
      sessionStorage.setItem(`pms_admin_permissions_${normalizedEmail}`, json)
    }
    const all = JSON.parse(localStorage.getItem('pms_all_admin_permissions') || '{}')
    if (adminId) all[String(adminId)] = perms
    if (email) all[String(email).trim().toLowerCase()] = perms
    localStorage.setItem('pms_all_admin_permissions', JSON.stringify(all))
  } catch {}
}

function readStoredRoleForAdmin(adminId) {
  if (!adminId) return ''
  try {
    return localStorage.getItem(`pms_admin_role_${adminId}`) || sessionStorage.getItem(`pms_admin_role_${adminId}`) || ''
  } catch {
    return ''
  }
}

function saveRoleLocallyForAdmin(adminId, roleId) {
  if (!adminId || !roleId) return
  try {
    localStorage.setItem(`pms_admin_role_${adminId}`, String(roleId))
    sessionStorage.setItem(`pms_admin_role_${adminId}`, String(roleId))
  } catch {}
}

function updateCurrentAdminSessionIfMatch(adminId, email, perms) {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const rawUser = store.getItem('pharmacyAdminUser')
      if (!rawUser) continue
      const user = JSON.parse(rawUser)
      const matchesId = adminId && String(user?.id || user?.adminId || user?.userId) === String(adminId)
      const matchesEmail = email && String(user?.email || '').trim().toLowerCase() === String(email).trim().toLowerCase()
      if (matchesId || matchesEmail) {
        const updated = {
          ...user,
          permissions: perms,
          modulePermissions: perms,
        }
        store.setItem('pharmacyAdminUser', JSON.stringify(updated))
      }
    } catch {}
  }
}

export default function UsersPermissions() {
  const { showToast } = useToast()
  const [admins, setAdmins] = useState([])
  const [roles, setRoles] = useState([])
  const [adminRoles, setAdminRoles] = useState({})
  const [selectedAdminId, setSelectedAdminId] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [permissions, setPermissions] = useState(EMPTY_PERMISSIONS)
  const [loading, setLoading] = useState(true)
  const [loadingPermissions, setLoadingPermissions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saveFeedback, setSaveFeedback] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!success) return undefined
    const timeoutId = window.setTimeout(() => setSuccess(''), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [success])

  async function loadRolePermissions(targetId, adminEmail) {
    if (!targetId) {
      setPermissions(EMPTY_PERMISSIONS)
      return
    }

    // 1. Immediately display locally saved permissions so user changes are never lost
    const cached = readStoredPermissionsForAdmin(targetId, adminEmail)
    if (cached && hasAnyPermission(cached)) {
      setPermissions(cached)
    }

    setLoadingPermissions(true)
    try {
      const response = await getSuperAdminRolePermissions(targetId)
      const src = permissionSource(response, null)
      if (src && (Array.isArray(src) ? src.length > 0 : Object.keys(src).length > 0)) {
        const normalized = normalizePermissions(src, MODULES)
        if (normalized.Branches) {
          normalized.Pharmacies = { ...normalized.Branches }
        }
        setPermissions(normalized)
        savePermissionsLocallyForAdmin(targetId, normalized, adminEmail)
      } else if (!cached) {
        setPermissions(EMPTY_PERMISSIONS)
      }
    } catch (requestError) {
      if (!cached) {
        setPermissions(EMPTY_PERMISSIONS)
      }
    } finally {
      setLoadingPermissions(false)
    }
  }

  async function loadAdminRoles(loadedAdmins) {
    const pairs = await Promise.all(loadedAdmins.map(async (admin) => {
      const adminId = idOf(admin)
      if (!adminId) return null
      const localRole = readStoredRoleForAdmin(adminId)
      if (localRole) return [String(adminId), String(localRole)]
      try {
        const response = await getPharmacyAdminRole(adminId)
        return [String(adminId), String(roleIdFrom(response, admin?.pharmacyPermissionRoleId || admin?.roleId || ''))]
      } catch {
        return [String(adminId), String(admin?.pharmacyPermissionRoleId || admin?.roleId || '')]
      }
    }))
    return Object.fromEntries(pairs.filter(Boolean))
  }

  async function loadData() {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const [adminResponse, roleResponse] = await Promise.all([listPharmacyAdmins(), listSuperAdminRoles()])
      const loadedAdmins = listFrom(adminResponse, ['admins', 'items', 'results', 'data'])
      const loadedRoles = listFrom(roleResponse, ['roles', 'items', 'results', 'data'])
      const roleMap = await loadAdminRoles(loadedAdmins)
      const firstAdmin = loadedAdmins[0]
      const firstAdminId = idOf(firstAdmin) || ''
      const firstRoleId = roleMap[String(firstAdminId)] || idOf(loadedRoles[0]) || ''
      setAdmins(loadedAdmins)
      setRoles(loadedRoles)
      setAdminRoles(roleMap)
      setSelectedAdminId(firstAdminId)
      setSelectedRoleId(firstRoleId)
      await loadRolePermissions(firstAdminId, firstAdmin?.email)
    } catch (requestError) {
      setError(requestError.message || 'Unable to load admins, roles, and permissions.')
      setAdmins([])
      setRoles([])
      setAdminRoles({})
      setPermissions(EMPTY_PERMISSIONS)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const selectedAdmin = admins.find((admin) => String(idOf(admin)) === String(selectedAdminId))
  const selectedRole = roles.find((role) => String(idOf(role)) === String(selectedRoleId))
  const permissionState = normalizePermissions(permissions, MODULES)
  const selectedCount = permissionCount(permissionState)
  const allSelected = selectedCount === MODULES.length * ACTIONS.length

  const adminRows = useMemo(() => admins.map((admin) => {
    const adminId = idOf(admin)
    const roleId = adminRoles[String(adminId)] || readStoredRoleForAdmin(adminId) || admin?.pharmacyPermissionRoleId || admin?.roleId || ''
    const role = roles.find((item) => String(idOf(item)) === String(roleId))
    const cachedPerms = readStoredPermissionsForAdmin(adminId, admin?.email)
    return {
      id: adminId,
      name: nameOf(admin),
      email: admin?.email || '-',
      roleName: role ? nameOf(role) : (nameOf(admin) || 'Not assigned'),
      roleId,
      savedPermissions: cachedPerms,
    }
  }), [admins, adminRoles, roles])

  async function selectAdmin(adminId) {
    const targetAdmin = admins.find((admin) => String(idOf(admin)) === String(adminId))
    const roleId = adminRoles[String(adminId)] || readStoredRoleForAdmin(adminId) || adminId
    setSelectedAdminId(adminId)
    setSelectedRoleId(roleId)
    setError('')
    setSuccess('')
    setSaveFeedback(null)
    await loadRolePermissions(adminId, targetAdmin?.email)
  }

  async function chooseRole(roleId) {
    setSelectedRoleId(roleId)
    setError('')
    setSuccess('')
    setSaveFeedback(null)
    if (roleId) {
      await loadRolePermissions(roleId, selectedAdmin?.email)
    }
  }

  function togglePermission(module, action, checked) {
    setPermissions((current) => {
      const normalized = normalizePermissions(current, MODULES)
      const updated = {
        ...normalized,
        [module]: { ...normalized[module], [action]: checked }
      }
      if (module === 'Pharmacies' || module === 'Branches') {
        updated.Pharmacies = { ...updated[module] }
        updated.Branches = { ...updated[module] }
      }
      return updated
    })
    setSuccess('')
    setError('')
    setSaveFeedback(null)
  }

  function toggleAllPermissions() {
    const checked = !allSelected
    setPermissions(Object.fromEntries(MODULES.map((module) => [module, Object.fromEntries(ACTIONS.map((action) => [action, checked]))])))
    setSuccess('')
    setError('')
    setSaveFeedback(null)
  }

  function isColumnSelected(action) {
    return MODULES.every((module) => Boolean(permissionState[module]?.[action]))
  }

  function toggleColumnPermission(action, checked) {
    setPermissions((current) => {
      const normalized = normalizePermissions(current, MODULES)
      return Object.fromEntries(MODULES.map((module) => [module, { ...normalized[module], [action]: checked }]))
    })
    setSuccess('')
    setError('')
    setSaveFeedback(null)
  }

  async function savePermissions(event) {
    if (event) event.preventDefault()
    if (!selectedAdminId) {
      const msg = 'Please select an admin first.'
      setError(msg)
      setSaveFeedback({ type: 'error', message: msg })
      showToast(msg, 'error')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    setSaveFeedback(null)

    const adminName = selectedAdmin ? nameOf(selectedAdmin) : `Admin #${selectedAdminId}`
    const adminEmail = selectedAdmin?.email

    // 1. Immediately persist permissions locally so settings are never lost
    const localSavedPermissions = normalizePermissions(permissions, MODULES)
    if (localSavedPermissions.Branches) {
      localSavedPermissions.Pharmacies = { ...localSavedPermissions.Branches }
    }
    setPermissions(localSavedPermissions)
    savePermissionsLocallyForAdmin(selectedAdminId, localSavedPermissions, adminEmail)

    if (selectedRoleId) {
      setAdminRoles((current) => ({ ...current, [String(selectedAdminId)]: String(selectedRoleId) }))
      saveRoleLocallyForAdmin(selectedAdminId, selectedRoleId)
    }

    // 2. Update active admin session if currently signed in as this admin
    updateCurrentAdminSessionIfMatch(selectedAdminId, adminEmail, localSavedPermissions)

    // 3. Broadcast live event so open modules update immediately
    window.dispatchEvent(new CustomEvent('pms:permissions-updated', {
      detail: {
        adminId: selectedAdminId,
        email: adminEmail,
        permissions: localSavedPermissions
      }
    }))

    // 4. Save to backend API
    try {
      const payload = permissionPayload(localSavedPermissions)
      await updateSuperAdminRolePermissions(selectedAdminId, payload)

      if (selectedRoleId) {
        await assignPharmacyAdminRole(selectedAdminId, { roleId: selectedRoleId }).catch(() => null)
      }

      const successMsg = `Permissions for ${adminName} saved successfully!`
      setSuccess(successMsg)
      setSaveFeedback({ type: 'success', message: successMsg })
      showToast(successMsg, 'success')
    } catch (requestError) {
      console.error('Backend savePermissions error:', requestError)
      const errorMsg = requestError?.message || `Failed to save permissions for ${adminName}.`
      setError(errorMsg)
      setSaveFeedback({ type: 'error', message: errorMsg })
      showToast(errorMsg, 'error')
    } finally {
      setSaving(false)
    }
  }

  return <div className={`super-admin-shell permissions-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
    <SuperAdminSidebar activeLabel="Roles & Permissions" />
    <main className="super-admin-main permissions-page">
      <SuperAdminTopbar onMenu={() => setSidebarOpen((value) => !value)} />
      <section className="permissions-heading"><div><h1>Roles &amp; Permissions</h1><p>Select an admin, assign a backend role, then save View, Create, Edit, and Delete permissions for PMS admin modules.</p></div></section>
      {error ? <p className="permissions-error">{error}</p> : null}
      {success ? <p className="permissions-success">{success}</p> : null}

      <section className="permissions-panel permissions-summary-panel">
        <div className="permissions-role-table permissions-admin-summary">
          <table>
            <thead>
              <tr><th>S.NO.</th><th>ROLE</th><th>MODULE</th><th>ASSIGNED USERS</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="permissions-state" colSpan="4">Loading admins...</td></tr>
              ) : adminRows.length ? adminRows.map((admin, index) => {
                const selected = String(admin.id) === String(selectedAdminId)
                const currentDisplayPerms = selected ? permissionState : admin.savedPermissions
                return [
                  <tr key={admin.id || index} className={selected ? 'is-selected' : ''} onClick={() => selectAdmin(admin.id)}>
                    <td>{index + 1}</td>
                    <td>
                      <div className="role-name-cell">
                        <span className="role-mark"><Icon><path d="M12 3 5 6v5c0 4.2 2.8 8.1 7 10 4.2-1.9 7-5.8 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></Icon></span>
                        <span><strong>{admin.roleName}</strong><small className="role-badge">Assigned Role</small></span>
                      </div>
                    </td>
                    <td><strong>{MODULES.length} modules</strong><small>PMS admin sidebar modules</small></td>
                    <td>
                      <div className="permission-user-cell">
                        <strong><Icon><circle cx="9" cy="8" r="4" /><path d="M3 21v-1a6 6 0 0 1 12 0v1" /><path d="M17 11a3 3 0 1 0 0-6" /><path d="M21 21v-1a5 5 0 0 0-3-4.6" /></Icon>1 admin</strong>
                        <small>{admin.name} - ID {admin.id || '0'}</small>
                      </div>
                    </td>
                  </tr>,
                  <tr key={`${admin.id || index}-permissions`} className={`permissions-detail-row${selected ? ' is-selected' : ''}`} onClick={() => selectAdmin(admin.id)}>
                    <td colSpan="4">
                      <div className="permissions-detail">
                        <strong>Permissions</strong>
                        <div className="permission-tags">
                          {selected ? (
                            hasAnyPermission(permissionState) ? MODULES.map((module) => {
                              const allowed = ACTIONS.filter((action) => permissionState[module]?.[action]).map(actionLabel)
                              return allowed.length ? <span key={module}>{module}: {allowed.join(', ')}</span> : null
                            }) : <span className="permission-none">No permissions assigned</span>
                          ) : (
                            currentDisplayPerms && hasAnyPermission(currentDisplayPerms) ? MODULES.map((module) => {
                              const allowed = ACTIONS.filter((action) => currentDisplayPerms[module]?.[action]).map(actionLabel)
                              return allowed.length ? <span key={module}>{module}: {allowed.join(', ')}</span> : null
                            }) : <span className="permission-none">Click to select and configure permissions</span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>,
                ]
              }) : (
                <tr><td className="permissions-state" colSpan="4">No admins found. Create admins first.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="permissions-panel assign-panel">
        <header className="permissions-panel-header">
          <div>
            <h2>Assign Permissions</h2>
            <p>Admin sidebar module permissions for the selected Admin role.</p>
          </div>
        </header>
        <form onSubmit={savePermissions}>
          <div className="permissions-select-row">
            <label className="permissions-admin-select">
              <span>Admin Role / Admin ID</span>
              <select value={selectedAdminId} onChange={(event) => selectAdmin(event.target.value)} disabled={loading || saving}>
                <option value="">Select Admin</option>
                {admins.map((admin) => (
                  <option key={idOf(admin)} value={idOf(admin)}>
                    {nameOf(admin)} - ID {idOf(admin) || '0'}
                  </option>
                ))}
              </select>
            </label>
            <label className="permissions-admin-select">
              <span>Backend Role</span>
              <select value={selectedRoleId} onChange={(event) => chooseRole(event.target.value)} disabled={loading || saving}>
                <option value="">Select Role</option>
                {roles.map((role) => (
                  <option key={idOf(role)} value={idOf(role)}>
                    {nameOf(role)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="permissions-grid-wrap">
            <table className="permissions-grid">
              <thead>
                <tr>
                  <th>
                    <span className="permissions-module-head">
                      <span>Module</span>
                      <button className="permissions-select-all" type="button" onClick={toggleAllPermissions} disabled={!selectedAdminId || loadingPermissions || saving}>
                        <Icon><path d="m5 12 4 4L19 6" /></Icon>{allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </span>
                  </th>
                  {ACTIONS.map((action) => (
                    <th key={action}>
                      <label className="permissions-column-toggle">
                        <input type="checkbox" checked={isColumnSelected(action)} disabled={!selectedAdminId || loadingPermissions || saving} onChange={(event) => toggleColumnPermission(action, event.target.checked)} />
                        {actionLabel(action)}
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((module) => (
                  <tr key={module}>
                    <td>
                      <span className="module-label">
                        <ModuleIcon module={module} />
                        <span>{module}</span>
                      </span>
                    </td>
                    {ACTIONS.map((action) => (
                      <td key={action}>
                        <label className={`permission-check permission-check-${action}`}>
                          <input type="checkbox" checked={Boolean(permissionState[module]?.[action])} disabled={!selectedAdminId || loadingPermissions || saving} onChange={(event) => togglePermission(module, action, event.target.checked)} />
                          <span><Icon><path d="m5 12 4 4L19 6" /></Icon></span>
                          {actionLabel(action)}
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="permissions-save-row">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontWeight: 600, color: '#334155' }}>
                {selectedAdmin ? `${selectedCount} permissions selected for ${nameOf(selectedAdmin)} (${selectedRole ? nameOf(selectedRole) : nameOf(selectedAdmin)})` : 'Select an admin and role'}
              </span>
              {saveFeedback && (
                <div 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: saveFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
                    color: saveFeedback.type === 'success' ? '#047857' : '#b91c1c',
                    border: `1px solid ${saveFeedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                    width: 'fit-content'
                  }}
                >
                  {saveFeedback.type === 'success' ? (
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  )}
                  <span>{saveFeedback.message}</span>
                </div>
              )}
            </div>
            <button 
              className="permissions-primary" 
              disabled={!selectedAdminId || saving || loadingPermissions} 
              type="submit"
              style={{ minWidth: '220px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {saving ? (
                <>
                  <svg 
                    viewBox="0 0 24 24" 
                    width="16" 
                    height="16" 
                    stroke="currentColor" 
                    fill="none" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    style={{ animation: 'permissionsSpin 0.7s linear infinite' }}
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span>Saving Permissions...</span>
                </>
              ) : (
                'Save Module Permissions'
              )}
            </button>
          </div>
        </form>
      </section>

    </main>
  </div>
}
