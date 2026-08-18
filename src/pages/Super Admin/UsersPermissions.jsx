import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/ToastProvider'
import UserProfileMenu from '../../components/UserProfileMenu'
import { superAdminNavigation } from '../../components/superAdminNavigation'
import { listAssignmentHospitals, listPharmacyAdmins } from '../../config/api'

function normalizeList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.admins)) return response.data.admins
  if (Array.isArray(response?.data?.hospitals)) return response.data.hospitals
  if (Array.isArray(response?.admins)) return response.admins
  if (Array.isArray(response?.hospitals)) return response.hospitals
  if (Array.isArray(response?.results)) return response.results
  return []
}

function getId(item) {
  return item?._id || item?.id || item?.adminId || item?.uuid || item?.hospitalId || item?.branchId
}

function getName(item) {
  return item?.name || item?.fullName || item?.adminName || item?.email || 'User'
}

function getRole(item) {
  const rawRole = item?.role || item?.roleName || item?.userRole || item?.accessRole || item?.adminRole
  if (typeof rawRole === 'string' && rawRole.trim()) return rawRole
  if (rawRole && typeof rawRole === 'object' && rawRole.name) return rawRole.name
  return 'Admin'
}

function extractPermissions(item) {
  const sources = [
    item?.permissions,
    item?.modulePermissions,
    item?.permissionSet,
    item?.userPermissions,
    item?.access?.permissions,
    item?.role?.permissions,
  ]

  const values = new Set()

  sources.forEach((source) => {
    if (!source) return

    if (Array.isArray(source)) {
      source.forEach((value) => {
        const text = String(value || '').trim()
        if (text) values.add(text)
      })
      return
    }

    if (typeof source === 'object') {
      Object.entries(source).forEach(([key, value]) => {
        if (value === true || value === 'true' || value === 1 || value === '1') {
          values.add(key)
        }
      })
    }
  })

  return [...values]
}

function UsersPermissions() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [users, setUsers] = useState([])
  const [hospitals, setHospitals] = useState([])
  const [selectedAdmin, setSelectedAdmin] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadData() {
      setLoading(true)

      try {
        const [adminResponse, hospitalResponse] = await Promise.all([
          listPharmacyAdmins(),
          listAssignmentHospitals(),
        ])

        if (!active) return
        setUsers(normalizeList(adminResponse))
        setHospitals(normalizeList(hospitalResponse))
      } catch (error) {
        showToast(error.message, 'error')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadData()
    return () => {
      active = false
    }
  }, [showToast])

  const rows = useMemo(() => {
    return users.map((user) => ({
      id: getId(user),
      name: getName(user),
      role: getRole(user),
      permissions: extractPermissions(user),
    }))
  }, [users])

  const uniqueRoles = useMemo(() => [...new Set(rows.map((row) => row.role).filter(Boolean))], [rows])

  const rolesSummary = useMemo(() => {
    return uniqueRoles.map((role) => ({
      name: role,
      modules: 14,
      users: rows.filter((row) => row.role === role).length,
      permissions: [...new Set(rows.filter((row) => row.role === role).flatMap((row) => row.permissions))].length,
    }))
  }, [uniqueRoles, rows])

  const modulesList = [
    'Dashboard',
    'Branches',
    'Clinics',
    'Dispensing',
    'Stock',
    'Reports',
    'Lab Technicians',
    'Lab Files',
    'Patients',
    'Audit Logs',
    'Schedule Settings',
    'Roles & Permissions',
    'User Management',
  ]

  return (
    <div className={`users-page${sidebarOpen ? ' users-sidebar-open' : ''}`}>
      <aside className="users-sidebar">
        <div className="users-brand">
          <b>+</b>
          <div>
            <strong>PMS</strong>
            <small>Super Admin</small>
          </div>
        </div>

        <nav>
          {superAdminNavigation.map(({ label, path, icon }) => (
            <button type="button" key={label} className={label === 'Users & Permissions' ? 'active' : ''} onClick={() => navigate(path)}>
              <span aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <div className="users-footer">
          ⚙ <span><b>Pharmacy Management</b><small>System v1.0.0</small></span>
        </div>
      </aside>

      <main className="users-main">
        <header className="users-header">
          <button type="button" className="users-hamburger" onClick={() => setSidebarOpen((value) => !value)}>☰</button>
          <div>
            <h1>Roles &amp; Permissions</h1>
            <p>Dashboard › Roles &amp; Permissions</p>
          </div>

          <div className="users-header-right">
            <label>⌕ <input placeholder="Search roles, admin, admins, reports..." /></label>
            <UserProfileMenu roleType="super-admin" />
          </div>
        </header>

        <section className="users-content" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 280px)' }}>
          <div className="users-list-card" style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
            <div className="management-heading">
              <div>
                <h2>Roles</h2>
                <p>Create roles and assign View, Create, Edit, and Delete permissions.</p>
              </div>
              <button type="button">+ Create Role</button>
            </div>

            <div className="management-table" style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fff' }}>
                  <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                    <th style={{ width: '60px', padding: '12px 8px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#666' }}>S.No.</th>
                    <th style={{ width: '120px', padding: '12px 8px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#666' }}>Role</th>
                    <th style={{ width: '120px', padding: '12px 8px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#666' }}>Module</th>
                    <th style={{ width: '140px', padding: '12px 8px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#666' }}>Assigned Users</th>
                    <th style={{ flex: 1, padding: '12px 8px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#666' }}>Permissions</th>
                    <th style={{ width: '100px', padding: '12px 8px', textAlign: 'center', fontWeight: '600', fontSize: '12px', color: '#666' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Loading roles...</td></tr>
                  ) : rolesSummary.length ? (
                    rolesSummary.map((role, index) => {
                      const adminsWithRole = rows.filter((r) => r.role === role.name)
                      const allPermissionsForRole = [...new Set(adminsWithRole.flatMap((r) => r.permissions))]
                      return (
                        <tr key={role.name} style={{ borderBottom: '1px solid #f0f0f0', height: 'auto' }}>
                          <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '600', fontSize: '12px', verticalAlign: 'top' }}>
                            {index + 1}
                          </td>
                          <td style={{ padding: '12px 8px', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', backgroundColor: '#10b981', color: '#fff', borderRadius: '50%', fontSize: '12px', fontWeight: 'bold' }}>
                                ✓
                              </span>
                              <b style={{ fontSize: '13px' }}>{role.name}</b>
                            </div>
                            <div style={{ fontSize: '11px', color: '#10b981', marginLeft: '36px' }}>System Role</div>
                          </td>
                          <td style={{ padding: '12px 8px', verticalAlign: 'top', fontSize: '12px', color: '#666' }}>
                            {role.modules} modules
                            <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>Admin sidebar modules</div>
                          </td>
                          <td style={{ padding: '12px 8px', verticalAlign: 'top', fontSize: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <span>👤</span>
                              <span>{adminsWithRole.length} admin{adminsWithRole.length !== 1 ? 's' : ''}</span>
                            </div>
                            {adminsWithRole.length > 0 && (
                              <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                                {adminsWithRole.map((a) => a.name).join(', ')} - ID {adminsWithRole[0]?.id || 'N/A'}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 8px', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px' }}>
                              {allPermissionsForRole.length > 0 ? (
                                allPermissionsForRole.map((perm, i) => (
                                  <span key={i} style={{ display: 'inline-block', color: '#10b981', fontSize: '11px', whiteSpace: 'nowrap', lineHeight: '1.4' }}>
                                    ✓ {perm}
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: '#999', fontSize: '11px' }}>No permissions assigned</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                            <button type="button" onClick={() => setSelectedAdmin(adminsWithRole[0]?.id)} style={{ padding: '6px 10px', marginRight: '4px', border: '1px solid #ddd', background: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>✎</button>
                            <button type="button" style={{ padding: '6px 10px', border: '1px solid #ddd', background: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', color: '#f43e48' }}>🗑</button>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No roles found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="users-content" style={{ marginTop: '24px', marginBottom: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 520px)' }}>
          <div className="users-list-card" style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
            <div className="management-heading">
              <div>
                <h2>Assign Permissions</h2>
                <p>Admin sidebar module permissions for the selected Admin role.</p>
              </div>
            </div>

            <div style={{ padding: '20px', borderBottom: '1px solid #e0e0e0' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#333' }}>
                Admin Role / Admin ID
              </label>
              <select
                value={selectedAdmin || ''}
                onChange={(e) => setSelectedAdmin(e.target.value || null)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '13px',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                }}
              >
                <option value="">Select an admin...</option>
                {rows.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.name} - ID {admin.id}
                  </option>
                ))}
              </select>
            </div>

            {selectedAdmin ? (
              <>
                <div className="management-table" style={{ flex: 1, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #e0e0e0', position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '13px', color: '#333' }}>Module</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', fontSize: '13px', color: '#333' }}>View</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', fontSize: '13px', color: '#333' }}>Create</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', fontSize: '13px', color: '#333' }}>Edit</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', fontSize: '13px', color: '#333' }}>Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const selectedAdminData = rows.find((r) => r.id === selectedAdmin)
                        const adminPermissions = selectedAdminData?.permissions || []
                        const adminPermissionSet = new Set(adminPermissions)

                        return modulesList.map((module) => {
                          const hasViewPerm = adminPermissionSet.has(`${module}:view`) || adminPermissionSet.has(`${module}:View`) || adminPermissionSet.has(`${module}:READ`)
                          const hasCreatePerm = adminPermissionSet.has(`${module}:create`) || adminPermissionSet.has(`${module}:Create`) || adminPermissionSet.has(`${module}:WRITE`)
                          const hasEditPerm = adminPermissionSet.has(`${module}:edit`) || adminPermissionSet.has(`${module}:Edit`) || adminPermissionSet.has(`${module}:UPDATE`)
                          const hasDeletePerm = adminPermissionSet.has(`${module}:delete`) || adminPermissionSet.has(`${module}:Delete`) || adminPermissionSet.has(`${module}:REMOVE`)

                          return (
                            <tr key={module} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '12px 16px', fontWeight: '500', fontSize: '13px', color: '#333' }}>
                                {module}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={hasViewPerm}
                                  readOnly
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    accentColor: '#10b981',
                                    cursor: 'pointer',
                                  }}
                                />
                                {hasViewPerm && <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>View</div>}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={hasCreatePerm}
                                  readOnly
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    accentColor: '#10b981',
                                    cursor: 'pointer',
                                  }}
                                />
                                {hasCreatePerm && <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>Create</div>}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={hasEditPerm}
                                  readOnly
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    accentColor: '#10b981',
                                    cursor: 'pointer',
                                  }}
                                />
                                {hasEditPerm && <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>Edit</div>}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={hasDeletePerm}
                                  readOnly
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    accentColor: '#10b981',
                                    cursor: 'pointer',
                                  }}
                                />
                                {hasDeletePerm && <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>Delete</div>}
                              </td>
                            </tr>
                          )
                        })
                      })()}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f9f9f9' }}>
                  <button
                    type="button"
                    onClick={() => showToast('Module permissions saved successfully!', 'success')}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#0f9e6f',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    💾 Save Module Permissions
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#999', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Select an admin from the dropdown above to manage its permissions.
              </div>
            )}
          </div>
        </section>

        <section className="roles-info" style={{ backgroundColor: '#e8f4f8', border: '1px solid #b3d9e8', borderRadius: '4px', padding: '16px 20px', marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <i style={{ fontSize: '20px', color: '#0668ef', flexShrink: 0 }}>ℹ</i>
          <div style={{ flex: 1 }}>
            <b style={{ display: 'block', marginBottom: '4px', color: '#333', fontSize: '13px' }}>User Roles &amp; Permissions</b>
            <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>Manage system roles, assign users, and configure permissions to control access to different modules and features.</p>
          </div>
          <button
            type="button"
            style={{
              padding: '10px 18px',
              color: '#fff',
              border: '1px solid #0d8a67',
              background: 'linear-gradient(180deg, #12a77a 0%, #0d8a67 100%)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '700',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
            }}
          >
            💾 Save Module Permissions
          </button>
        </section>
      </main>
    </div>
  )
}

export default UsersPermissions
