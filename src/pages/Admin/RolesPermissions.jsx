import { useEffect, useMemo, useState } from 'react'
import AdminLayout from './AdminLayout'
import {
  listPharmacists,
  getPharmacistPermissions,
  updatePharmacistPermissions,
} from '../../config/api'
import { useToast } from '../../components/ToastProvider'
import {
  PERMISSION_ACTIONS,
  emptyPermissions,
  normalizePermissions,
  PHARMACIST_MODULES,
} from '../../config/permissions'
import SidebarIcon from '../../components/SidebarIcon'
import './RolesPermissions.css'

const MODULES = PHARMACIST_MODULES
const ACTIONS = PERMISSION_ACTIONS
const EMPTY_PERMISSIONS = emptyPermissions(MODULES)

const MODULE_ICONS = {
  Dashboard: 'dashboard',
  Dispensing: 'clipboardCheck',
  Medicines: 'medicines',
  Bills: 'receipt',
  Returns: 'rotateCcw',
  Reports: 'barChart3',
  Notifications: 'notifications',
}

function idOf(item) {
  return item?._id || item?.id || item?.Id || item?.pharmacistId || item?.PharmacistId || item?.userId || item?.UserId || item?.uuid
}

function cleanPharmacistName(raw) {
  if (!raw) return 'Pharmacist'
  const cleaned = String(raw).replace(/\s*(sub\s*branch|branch)\s*$/gi, '').trim()
  return cleaned || 'Pharmacist'
}

function nameOf(item) {
  return item?.name || item?.Name || item?.fullName || item?.FullName || item?.user?.name || item?.User?.Name || item?.email || item?.Email || 'Pharmacist'
}

function permissionCount(permissions) {
  return Object.values(permissions || {}).reduce(
    (total, actions) => total + Object.values(actions || {}).filter(Boolean).length,
    0
  )
}

function hasAnyPermission(permissions) {
  return permissionCount(permissions) > 0
}

function actionLabel(action) {
  return action.charAt(0).toUpperCase() + action.slice(1)
}

function defaultFullPermissions() {
  return Object.fromEntries(
    MODULES.map((m) => [m, { view: true, create: true, edit: true, delete: true }])
  )
}

function extractValidPermissionSource(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  return (
    response?.data?.permissions ||
    response?.data?.Permissions ||
    response?.permissions ||
    response?.Permissions ||
    response?.data?.modulePermissions ||
    response?.data?.ModulePermissions ||
    response?.modulePermissions ||
    response?.ModulePermissions ||
    response?.data?.role?.permissions ||
    response?.role?.permissions ||
    null
  )
}

export default function RolesPermissions() {
  const { showToast } = useToast()
  const [pharmacists, setPharmacists] = useState([])
  const [selectedPharmacistId, setSelectedPharmacistId] = useState('')
  const [permissions, setPermissions] = useState(defaultFullPermissions())
  const [pharmacistPermissionsMap, setPharmacistPermissionsMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadingPermissions, setLoadingPermissions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saveFeedback, setSaveFeedback] = useState(null)

  // Ensure scroll is at the top on mount
  useEffect(() => {
    const main = document.querySelector('.branch-admin-main')
    if (main) main.scrollTop = 0
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (!success) return undefined
    const timeoutId = window.setTimeout(() => setSuccess(''), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [success])

  async function loadPharmacistPermissions(targetId) {
    if (!targetId) {
      setPermissions(EMPTY_PERMISSIONS)
      return
    }

    setLoadingPermissions(true)
    try {
      const response = await getPharmacistPermissions(targetId)
      const src = extractValidPermissionSource(response)
      if (src && (Array.isArray(src) ? src.length > 0 : Object.keys(src).length > 0)) {
        const normalized = normalizePermissions(src, MODULES)
        setPermissions(normalized)
        setPharmacistPermissionsMap((prev) => ({
          ...prev,
          [String(targetId)]: normalized,
        }))
      } else {
        const fallback = pharmacistPermissionsMap[String(targetId)] || defaultFullPermissions()
        setPermissions(fallback)
      }
    } catch (err) {
      console.warn('Failed to fetch permissions for pharmacist ID:', targetId, err?.message || err)
    } finally {
      setLoadingPermissions(false)
    }
  }

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const res = await listPharmacists()
      const backendList = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.pharmacists)
        ? res.pharmacists
        : []

      const validPharmacists = backendList.filter((p) => {
        const name = String(p?.name || p?.fullName || '').toLowerCase().trim()
        if (!name) return false
        if (name.includes('sub branch') || name.includes('subbranch')) {
          return false
        }
        return true
      })

      setPharmacists(validPharmacists)

      // Fetch permissions for all pharmacists directly from backend API
      const permsMap = {}
      await Promise.allSettled(
        validPharmacists.map(async (p) => {
          const pId = idOf(p)
          if (!pId) return
          try {
            const inlineSrc = extractValidPermissionSource(p)
            if (inlineSrc && (Array.isArray(inlineSrc) ? inlineSrc.length > 0 : Object.keys(inlineSrc).length > 0)) {
              permsMap[String(pId)] = normalizePermissions(inlineSrc, MODULES)
              return
            }
            const permRes = await getPharmacistPermissions(pId)
            const src = extractValidPermissionSource(permRes)
            if (src && (Array.isArray(src) ? src.length > 0 : Object.keys(src).length > 0)) {
              permsMap[String(pId)] = normalizePermissions(src, MODULES)
            } else {
              permsMap[String(pId)] = defaultFullPermissions()
            }
          } catch {
            permsMap[String(pId)] = defaultFullPermissions()
          }
        })
      )
      setPharmacistPermissionsMap(permsMap)

      if (validPharmacists.length > 0) {
        setSelectedPharmacistId((prev) => {
          const exists = prev && validPharmacists.some((p) => String(idOf(p)) === String(prev))
          const targetId = exists ? String(prev) : String(idOf(validPharmacists[0]))
          const initial = permsMap[targetId] || defaultFullPermissions()
          setPermissions(initial)
          return targetId
        })
      } else {
        setSelectedPharmacistId('')
        setPermissions(EMPTY_PERMISSIONS)
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to load pharmacists and permissions.')
      setPharmacists([])
      setPermissions(EMPTY_PERMISSIONS)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedPharmacistId && pharmacists.length > 0) {
      const firstId = String(idOf(pharmacists[0]))
      if (firstId) {
        setSelectedPharmacistId(firstId)
        selectPharmacist(firstId, pharmacists)
      }
    }
  }, [pharmacists, selectedPharmacistId])

  useEffect(() => {
    loadData()
    const handleSync = () => loadData()
    window.addEventListener('pms:pharmacists-updated', handleSync)
    return () => {
      window.removeEventListener('pms:pharmacists-updated', handleSync)
    }
  }, [])

  const selectedPharmacist = pharmacists.find(
    (p) => String(idOf(p)) === String(selectedPharmacistId)
  )
  const permissionState = normalizePermissions(permissions, MODULES)
  const selectedCount = permissionCount(permissionState)
  const allSelected = selectedCount === MODULES.length * ACTIONS.length

  const pharmacistRows = useMemo(() => {
    return pharmacists.map((p, index) => {
      const pId = idOf(p) || String(index + 1)
      const pEmail = p?.email || p?.user?.email || '-'
      const saved = pharmacistPermissionsMap[String(pId)] || defaultFullPermissions()
      return {
        id: pId,
        name: nameOf(p),
        email: pEmail,
        branchName: p?.branchName || p?.BranchName || p?.branch?.name || 'Main Branch',
        savedPermissions: saved,
      }
    })
  }, [pharmacists, pharmacistPermissionsMap])

  async function selectPharmacist(pId, list = pharmacists) {
    if (!pId) return
    const target = (list && list.length ? list : pharmacists).find((p) => String(idOf(p)) === String(pId))
    setSelectedPharmacistId(String(pId))
    setError('')
    setSuccess('')
    setSaveFeedback(null)

    if (pharmacistPermissionsMap[String(pId)]) {
      setPermissions(pharmacistPermissionsMap[String(pId)])
    }

    await loadPharmacistPermissions(pId)
  }

  function togglePermission(module, action, checked) {
    if (!selectedPharmacistId && pharmacists.length > 0) {
      setSelectedPharmacistId(String(idOf(pharmacists[0])))
    }
    setPermissions((current) => {
      const normalized = normalizePermissions(current, MODULES)
      return {
        ...normalized,
        [module]: {
          ...(normalized[module] || {}),
          [action]: checked,
        },
      }
    })
    setSuccess('')
    setError('')
    setSaveFeedback(null)
  }

  function toggleAllPermissions() {
    if (!selectedPharmacistId && pharmacists.length > 0) {
      setSelectedPharmacistId(String(idOf(pharmacists[0])))
    }
    const checked = !allSelected
    setPermissions(
      Object.fromEntries(
        MODULES.map((module) => [
          module,
          Object.fromEntries(ACTIONS.map((action) => [action, checked])),
        ])
      )
    )
    setSuccess('')
    setError('')
    setSaveFeedback(null)
  }

  function isColumnSelected(action) {
    return MODULES.every((module) => Boolean(permissionState[module]?.[action]))
  }

  function toggleColumnPermission(action, checked) {
    if (!selectedPharmacistId && pharmacists.length > 0) {
      setSelectedPharmacistId(String(idOf(pharmacists[0])))
    }
    setPermissions((current) => {
      const normalized = normalizePermissions(current, MODULES)
      return Object.fromEntries(
        MODULES.map((module) => [
          module,
          { ...(normalized[module] || {}), [action]: checked },
        ])
      )
    })
    setSuccess('')
    setError('')
    setSaveFeedback(null)
  }

  async function savePermissions(event) {
    if (event && event.preventDefault) event.preventDefault()
    if (!selectedPharmacistId) {
      const msg = 'Please select a pharmacist first.'
      setError(msg)
      setSaveFeedback({ type: 'error', message: msg })
      showToast(msg, 'error')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    setSaveFeedback(null)

    const pharmName = selectedPharmacist ? nameOf(selectedPharmacist) : `Pharmacist #${selectedPharmacistId}`
    const pharmEmail = selectedPharmacist?.email || selectedPharmacist?.user?.email
    const normalizedToSave = normalizePermissions(permissions, MODULES)

    // Update active session if signed in pharmacist matches
    for (const store of [sessionStorage, localStorage]) {
      try {
        const rawUser = store.getItem('pharmacistUser')
        if (rawUser) {
          const u = JSON.parse(rawUser)
          const matchesId = String(u?.id || u?.userId) === String(selectedPharmacistId)
          const matchesEmail =
            pharmEmail &&
            String(u?.email || '').trim().toLowerCase() === String(pharmEmail).trim().toLowerCase()
          if (matchesId || matchesEmail) {
            u.permissions = normalizedToSave
            u.modulePermissions = normalizedToSave
            store.setItem('pharmacistUser', JSON.stringify(u))
          }
        }
      } catch {}
    }

    try {
      await updatePharmacistPermissions(selectedPharmacistId, normalizedToSave)
      setPermissions(normalizedToSave)
      setPharmacistPermissionsMap((prev) => ({
        ...prev,
        [String(selectedPharmacistId)]: normalizedToSave,
      }))

      window.dispatchEvent(
        new CustomEvent('pms:permissions-updated', {
          detail: {
            pharmacistId: selectedPharmacistId,
            permissions: normalizedToSave,
          },
        })
      )

      const successMsg = `Permissions for ${pharmName} saved successfully!`
      setSuccess(successMsg)
      setSaveFeedback({ type: 'success', message: successMsg })
      showToast(successMsg, 'success')
    } catch (requestError) {
      const errorMsg = requestError?.message || `Failed to save permissions for ${pharmName}.`
      setError(errorMsg)
      setSaveFeedback({ type: 'error', message: errorMsg })
      showToast(errorMsg, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout
      activeLabel="Roles & Permissions"
      title="Roles & Permissions"
      subtitle="Select a pharmacist, assign a backend role, then save View, Create, Edit, and Delete permissions for PMS pharmacist modules."
    >
      <div className="admin-permissions-page">
        {error ? <p className="admin-permissions-error">{error}</p> : null}
        {success ? <p className="admin-permissions-success">{success}</p> : null}

        {/* Pharmacist Roles Summary Table Panel */}
        <section className="admin-permissions-panel admin-summary-panel">
          <div className="admin-permissions-table-wrap">
            <table className="admin-permissions-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>S.NO.</th>
                  <th>ROLE</th>
                  <th>MODULE</th>
                  <th>ASSIGNED USERS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      Loading pharmacists...
                    </td>
                  </tr>
                ) : pharmacistRows.length ? (
                  pharmacistRows.map((p, index) => {
                    const selected = String(p.id) === String(selectedPharmacistId)
                    const currentDisplayPerms = selected ? permissionState : p.savedPermissions

                    return [
                      <tr
                        key={p.id || index}
                        className={selected ? 'is-selected' : ''}
                        onClick={() => selectPharmacist(p.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{index + 1}</td>
                        <td>
                          <div className="admin-role-cell">
                            <span className="admin-role-icon">
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 3 5 6v5c0 4.2 2.8 8.1 7 10 4.2-1.9 7-5.8 7-10V6l-7-3Z" />
                                <path d="m9 12 2 2 4-5" />
                              </svg>
                            </span>
                            <div className="admin-role-copy">
                              <strong>Pharmacist</strong>
                              <small className="admin-role-badge">Assigned Role</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong style={{ color: '#0f172a', fontSize: '13px' }}>{MODULES.length} modules</strong>
                          <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '1px' }}>
                            PMS pharmacist sidebar modules
                          </small>
                        </td>
                        <td>
                          <div className="admin-user-cell">
                            <strong>
                              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="9" cy="8" r="4" />
                                <path d="M3 21v-1a6 6 0 0 1 12 0v1" />
                                <path d="M17 11a3 3 0 1 0 0-6" />
                                <path d="M21 21v-1a5 5 0 0 0-3-4.6" />
                              </svg>
                              1 pharmacist
                            </strong>
                            <small>{cleanPharmacistName(p.name)} - ID {p.id}</small>
                          </div>
                        </td>
                      </tr>,
                      <tr
                        key={`${p.id || index}-detail`}
                        className={`admin-permissions-detail-row${selected ? ' is-selected' : ''}`}
                        onClick={() => selectPharmacist(p.id)}
                      >
                        <td colSpan="4">
                          <div className="admin-permissions-detail">
                            <strong>PERMISSIONS</strong>
                            <div className="admin-permission-tags">
                              {currentDisplayPerms && hasAnyPermission(currentDisplayPerms) ? (
                                MODULES.map((module) => {
                                  const allowed = ACTIONS.filter(
                                    (action) => currentDisplayPerms[module]?.[action]
                                  ).map(actionLabel)
                                  return allowed.length ? (
                                    <span key={module} className="admin-permission-tag">
                                      {module}: {allowed.join(', ')}
                                    </span>
                                  ) : null
                                })
                              ) : (
                                <span className="admin-permission-tag admin-permission-tag-none">
                                  No permissions assigned
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>,
                    ]
                  })
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      No pharmacists found. Create a pharmacist in Pharmacists module first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Assign Permissions Panel */}
        <section id="assign-permissions-card" className="admin-permissions-panel admin-assign-panel">
          <div className="admin-permissions-panel-header">
            <h2>Assign Permissions</h2>
            <p>Pharmacist sidebar module permissions for the selected Pharmacist.</p>
          </div>

          <div className="admin-select-row">
            <label className="admin-select-control">
              <span>Pharmacist / Pharmacist ID</span>
              <select
                value={selectedPharmacistId || (pharmacists.length ? String(idOf(pharmacists[0])) : '')}
                onChange={(e) => selectPharmacist(e.target.value)}
                disabled={loading || saving}
              >
                {!pharmacists.length && <option value="">Select Pharmacist</option>}
                {pharmacists.map((p) => (
                  <option key={idOf(p)} value={String(idOf(p))}>
                    {nameOf(p)} - ID {idOf(p) || '0'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-grid-wrap">
            <table className="admin-grid">
              <thead>
                <tr>
                  <th>
                    <div className="admin-module-head-wrap">
                      <span>Module</span>
                      <button
                        type="button"
                        className="admin-select-all-btn"
                        onClick={toggleAllPermissions}
                        disabled={saving}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                  </th>
                  {ACTIONS.map((action) => (
                    <th key={action}>
                      <button
    type="button"
    className={`admin-column-toggle-btn ${isColumnSelected(action) ? 'is-checked' : ''}`}
    disabled={saving}
    onClick={(e) => {
      e.preventDefault()
      e.stopPropagation()
      toggleColumnPermission(action, !isColumnSelected(action))
    }}
  >
    <span className="admin-column-toggle-mark">
      {isColumnSelected(action) && (
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
    <span>{actionLabel(action)}</span>
  </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((module) => {
                  const iconKey = MODULE_ICONS[module] || 'dashboard'
                  return (
                    <tr key={module}>
                      <td>
                        <div className="admin-grid-module">
                          <span className="admin-grid-module-icon">
                            <SidebarIcon name={iconKey} />
                          </span>
                          <span className="admin-grid-module-name">{module}</span>
                        </div>
                      </td>
                      {ACTIONS.map((action) => (
                        <td key={action}>
                          <button
    type="button"
    tabIndex={-1}
                            className={`admin-perm-checkbox-btn ${Boolean(permissionState[module]?.[action]) ? 'is-checked' : ''}`}
    disabled={saving}
    onClick={(e) => {
      e.preventDefault()
      e.stopPropagation()
      togglePermission(module, action, !Boolean(permissionState[module]?.[action]))
    }}
  >
    <span className="admin-perm-checkbox-mark">
      {Boolean(permissionState[module]?.[action]) && (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
    <span className="admin-perm-checkbox-label">{actionLabel(action)}</span>
  </button>
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="admin-permissions-save-row">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: 600, color: '#334155', fontSize: '13px' }}>
                {`${selectedCount} permissions selected for ${selectedPharmacist ? nameOf(selectedPharmacist) : (pharmacists.length ? nameOf(pharmacists[0]) : 'Pharmacist')}`}
              </span>

              {saveFeedback && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: saveFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
                    color: saveFeedback.type === 'success' ? '#047857' : '#b91c1c',
                    border: `1px solid ${saveFeedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                    width: 'fit-content',
                  }}
                >
                  {saveFeedback.type === 'success' ? (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  )}
                  <span>{saveFeedback.message}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              className="admin-permissions-save-btn"
              onClick={savePermissions}
              disabled={saving}
            >
              {saving ? (
                <>
                  <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'medSpin 0.7s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span>Saving Permissions...</span>
                </>
              ) : (
                'Save Module Permissions'
              )}
            </button>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}
