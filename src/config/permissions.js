export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete']

export const ADMIN_MODULES = ['Dashboard', 'Users', 'Medicines', 'Stock', 'Suppliers', 'Purchase Orders', 'Stock Transfers', 'Prescriptions', 'Dispensing', 'Expiry Alerts', 'Reports', 'Settings', 'CMS Integration']

export const MODULE_ALIASES = {
  Dashboard: ['dashboard'],
  Users: ['users', 'user management', 'pharmacists', 'users permissions', 'users & permissions'],
  Medicines: ['medicines', 'medicine'],
  Stock: ['stock', 'inventory'],
  Suppliers: ['suppliers'],
  'Purchase Orders': ['purchase orders', 'purchases', 'purchase'],
  'Stock Transfers': ['stock transfers', 'transfers'],
  Prescriptions: ['prescriptions'],
  Dispensing: ['dispensing', 'sales', 'billing'],
  'Expiry Alerts': ['expiry alerts', 'expiry', 'near expiry'],
  Reports: ['reports'],
  Settings: ['settings'],
  'CMS Integration': ['cms integration', 'cms'],
}

export function normalizePermissionKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[&/]+/g, ' ').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

export function boolPermission(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'yes'
}

export function emptyPermissions(modules = ADMIN_MODULES) {
  return Object.fromEntries(modules.map((module) => [module, Object.fromEntries(PERMISSION_ACTIONS.map((action) => [action, false]))]))
}

export function canonicalModule(rawModule, modules = ADMIN_MODULES) {
  const key = normalizePermissionKey(rawModule)
  return modules.find((module) => [module, ...(MODULE_ALIASES[module] || [])].some((alias) => normalizePermissionKey(alias) === key))
}

export function normalizePermissions(source, modules = ADMIN_MODULES) {
  const result = emptyPermissions(modules)
  if (!source || typeof source !== 'object') return result
  const entries = Array.isArray(source) ? source.map((item) => [item?.module || item?.name || item?.key, item]) : Object.entries(source)
  entries.forEach(([rawModule, value]) => {
    const module = canonicalModule(rawModule, modules)
    if (!module) return
    if (Array.isArray(value)) {
      value.forEach((action) => {
        const normalizedAction = String(action).toLowerCase()
        if (PERMISSION_ACTIONS.includes(normalizedAction)) result[module][normalizedAction] = true
      })
    } else if (value && typeof value === 'object') {
      PERMISSION_ACTIONS.forEach((action) => { result[module][action] = boolPermission(value[action] ?? value[action === 'edit' ? 'update' : action]) })
    } else if (boolPermission(value)) {
      PERMISSION_ACTIONS.forEach((action) => { result[module][action] = true })
    }
  })
  return result
}

export function permissionSource(item) {
  return item?.permissions || item?.modulePermissions || item?.permissionSet || item?.userPermissions || item?.role?.permissions
}

export function serializePermissions(permissions) {
  const normalized = normalizePermissions(permissions)
  return { permissions: normalized, modulePermissions: Object.entries(normalized).map(([module, actions]) => ({ module, ...actions })) }
}

export function hasPermission(permissions, module, action = 'view') {
  if (!permissions || Object.keys(permissions).length === 0) return true
  const normalized = normalizePermissions(permissions)
  const canonical = canonicalModule(module)
  if (!canonical) return true
  return Boolean(normalized[canonical]?.[action])
}

export function readAdminPermissions() {
  const rawUser = sessionStorage.getItem('pharmacyAdminUser') || localStorage.getItem('pharmacyAdminUser')
  const rawAssignment = sessionStorage.getItem('pharmacyAdminAssignment') || localStorage.getItem('pharmacyAdminAssignment')
  try {
    const user = rawUser ? JSON.parse(rawUser) : {}
    const assignment = rawAssignment ? JSON.parse(rawAssignment) : {}
    const source = permissionSource(user) || permissionSource(assignment)
    return source ? normalizePermissions(source) : null
  } catch {
    return null
  }
}