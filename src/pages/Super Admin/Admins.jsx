import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/ToastProvider'
import { superAdminNavigation } from '../../components/superAdminNavigation'
import {
  assignPharmacyAdmin,
  changePharmacyAdminStatus,
  createPharmacyAdmin,
  deletePharmacyAdmin,
  listAssignmentHospitals,
  listHospitalBranches,
  listPharmacyAdmins,
  resetPharmacyAdminPassword,
  updatePharmacyAdmin,
} from '../../config/api'
import './superadmin.css'
import './AdminsSidebar.css'
import './AdminsTopbar.css'

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  hospitalId: '',
  branchId: '',
}

function normalizeList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.admins)) return response.data.admins
  if (Array.isArray(response?.data?.hospitals)) return response.data.hospitals
  if (Array.isArray(response?.data?.branches)) return response.data.branches
  if (Array.isArray(response?.admins)) return response.admins
  if (Array.isArray(response?.hospitals)) return response.hospitals
  if (Array.isArray(response?.branches)) return response.branches
  if (Array.isArray(response?.results)) return response.results
  return []
}

function getId(item) {
  return item?._id || item?.id || item?.adminId || item?.hospitalId || item?.branchId || item?.uuid
}

function getHospitalId(item) {
  return item?._id || item?.id || item?.hospitalId || item?.externalHospitalId || item?.uuid
}

function getBranchId(item) {
  return item?._id || item?.id || item?.branchId || item?.externalBranchId || item?.uuid
}

function getHospitalName(item) {
  return item?.name || item?.hospitalName || item?.title || item?.externalHospitalId || 'Hospital'
}

function getBranchName(item) {
  return item?.name || item?.branchName || item?.title || item?.externalBranchId || 'Branch'
}

function getName(item) {
  return item?.name || item?.fullName || item?.adminName || item?.email || 'Pharmacy Admin'
}

function getStatus(item) {
  const value = item?.status ?? item?.isActive
  if (typeof value === 'boolean') return value ? 'Active' : 'Inactive'
  return value || 'Active'
}

function Admins() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [admins, setAdmins] = useState([])
  const [hospitals, setHospitals] = useState([])
  const [branches, setBranches] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingAdmin, setEditingAdmin] = useState(null)
  const [assigningAdmin, setAssigningAdmin] = useState(null)
  const [resettingAdmin, setResettingAdmin] = useState(null)
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const didLoadInitialData = useRef(false)

  const filteredAdmins = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return admins
    return admins.filter((admin) => JSON.stringify(admin).toLowerCase().includes(value))
  }, [admins, query])

  async function loadAdmins() {
    setLoading(true)
    try {
      const data = await listPharmacyAdmins({ search: query })
      setAdmins(normalizeList(data))
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadHospitals() {
    try {
      const data = await listAssignmentHospitals()
      setHospitals(normalizeList(data))
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  useEffect(() => {
    if (didLoadInitialData.current) return
    didLoadInitialData.current = true

    loadAdmins()
    loadHospitals()
  }, [])

  async function loadBranches(hospitalId) {
    setBranches([])
    if (!hospitalId) return

    try {
      const data = await listHospitalBranches(hospitalId)
      setBranches(normalizeList(data))
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  function openCreate() {
    setCreateOpen(true)
    setEditingAdmin(null)
    setForm(emptyForm)
  }

  function closeEditor() {
    setCreateOpen(false)
    setEditingAdmin(null)
    setForm(emptyForm)
  }

  function openEdit(admin) {
    setCreateOpen(false)
    setEditingAdmin(admin)
    setForm({
      name: getName(admin),
      email: admin?.email || '',
      phone: admin?.phone || admin?.mobile || '',
      password: '',
      hospitalId: admin?.hospitalId || admin?.hospital?._id || admin?.hospital?.id || '',
      branchId: admin?.branchId || admin?.branch?._id || admin?.branch?.id || '',
    })
    loadBranches(admin?.hospitalId || admin?.hospital?._id || admin?.hospital?.id || '')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)

    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      ...(form.password ? { password: form.password } : {}),
    }

    try {
      if (editingAdmin) {
        const data = await updatePharmacyAdmin(getId(editingAdmin), payload)
        if (form.hospitalId && form.branchId) {
          await assignPharmacyAdmin(getId(editingAdmin), {
            hospitalId: form.hospitalId,
            branchId: form.branchId,
          })
        }
        showToast(data?.message || 'Admin updated successfully.')
      } else {
        const data = await createPharmacyAdmin(payload)
        showToast(data?.message || 'Admin created successfully.')
      }

      closeEditor()
      await loadAdmins()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(admin) {
    if (!window.confirm(`Delete ${getName(admin)}?`)) return

    try {
      const data = await deletePharmacyAdmin(getId(admin))
      showToast(data?.message || 'Admin deleted successfully.')
      await loadAdmins()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleStatus(admin) {
    const nextStatus = String(getStatus(admin)).toLowerCase() === 'active' ? 'inactive' : 'active'

    try {
      const data = await changePharmacyAdminStatus(getId(admin), { status: nextStatus })
      showToast(data?.message || 'Admin status updated successfully.')
      await loadAdmins()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  function openAssign(admin) {
    const hospitalId = admin?.hospitalId || admin?.hospital?._id || admin?.hospital?.id || ''
    setAssigningAdmin(admin)
    setForm({
      ...emptyForm,
      hospitalId,
      branchId: admin?.branchId || admin?.branch?._id || admin?.branch?.id || '',
    })
    loadBranches(hospitalId)
  }

  async function handleAssign(event) {
    event.preventDefault()

    try {
      const data = await assignPharmacyAdmin(getId(assigningAdmin), {
        hospitalId: form.hospitalId,
        branchId: form.branchId,
      })
      showToast(data?.message || 'Pharmacy assignment updated successfully.')
      setAssigningAdmin(null)
      setForm(emptyForm)
      await loadAdmins()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault()

    try {
      const data = await resetPharmacyAdminPassword(getId(resettingAdmin), {
        temporaryPassword,
        password: temporaryPassword,
      })
      showToast(data?.message || 'Temporary password set successfully.')
      setResettingAdmin(null)
      setTemporaryPassword('')
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  return (
    <div className="management-page">
      <aside className="management-sidebar" aria-label="Super admin navigation">
        <div className="management-brand">
          <b>+</b>
          <div>
            <strong>PMS</strong><small>Super Admin Console</small>
          </div>
        </div>
        <nav>
          {superAdminNavigation.map(({ label, path, icon, color }) => (
            <button type="button" className={label === 'Admins' ? 'active' : ''} onClick={() => navigate(path)} key={label}>
              <span className={`nav-icon nav-icon-${color}`} aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="management-sidebar-footer"><span>SA</span><div><strong>Super Admin</strong><small>Super Admin</small><em>Online</em></div></div>
      </aside>

      <main className="management-main">
        <header className="management-header">
          <button className="management-menu" type="button">☰</button>
          <div className="management-title">
            <h1>Pharmacy Admins</h1>
            <p>Super Admin / Pharmacy Admins</p>
          </div>
          <label className="management-top-search">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dashboard, clinics, admins, reports..." />
          </label>
          <button className="management-notification" type="button">♧<b>1</b></button>
          <button className="management-profile-button" type="button"><span>SA</span><strong>Super Admin</strong><small>Online</small></button>
        </header>

        <section className="management-card">
          <div className="management-card-header">
            <div>
              <h2>Manage Pharmacy Admins</h2>
              <p>Loaded from backend Super Admin APIs.</p>
            </div>
            <button type="button" onClick={openCreate}>Create Admin</button>
          </div>

          <label className="management-search">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pharmacy admins" />
          </label>

          <div className="management-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Hospital</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7">Loading admins...</td></tr>
                ) : filteredAdmins.length ? filteredAdmins.map((admin) => (
                  <tr key={getId(admin)}>
                    <td>{getName(admin)}</td>
                    <td>{admin?.email || '-'}</td>
                    <td>{admin?.phone || admin?.mobile || '-'}</td>
                    <td>{admin?.hospital?.name || admin?.hospitalName || '-'}</td>
                    <td>{admin?.branch?.name || admin?.branchName || '-'}</td>
                    <td><span className={`management-status ${String(getStatus(admin)).toLowerCase()}`}>{getStatus(admin)}</span></td>
                    <td className="management-actions">
                      <button type="button" onClick={() => openEdit(admin)}>Edit</button>
                      <button type="button" onClick={() => openAssign(admin)}>Assign</button>
                      <button type="button" onClick={() => handleStatus(admin)}>Status</button>
                      <button type="button" onClick={() => setResettingAdmin(admin)}>Reset</button>
                      <button type="button" onClick={() => handleDelete(admin)}>Delete</button>
                    </td>
                  </tr>
                )) : (
                  <tr><td className="management-empty" colSpan="7">No pharmacy admins found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {(createOpen || editingAdmin) ? (
        <div className="user-modal">
          <form onSubmit={handleSubmit}>
            <button type="button" onClick={closeEditor}>×</button>
            <h2>{editingAdmin ? 'Edit Admin' : 'Create Admin'}</h2>
            <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
            <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label>Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editingAdmin} /></label>
            <label>
              Hospital
              <select value={form.hospitalId} onChange={(event) => {
                setForm({ ...form, hospitalId: event.target.value, branchId: '' })
                loadBranches(event.target.value)
              }}>
                <option value="">Select hospital</option>
                {hospitals.map((hospital) => <option value={getHospitalId(hospital)} key={getHospitalId(hospital)}>{getHospitalName(hospital)}</option>)}
              </select>
            </label>
            <label>
              Branch
              <select value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })} disabled={!form.hospitalId}>
                <option value="">Select branch</option>
                {branches.map((branch) => <option value={getBranchId(branch)} key={getBranchId(branch)}>{getBranchName(branch)}</option>)}
              </select>
            </label>
            <button className="modal-save" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </form>
        </div>
      ) : null}

      {assigningAdmin ? (
        <div className="user-modal">
          <form onSubmit={handleAssign}>
            <button type="button" onClick={() => setAssigningAdmin(null)}>×</button>
            <h2>Assign Pharmacy</h2>
            <label>
              Hospital
              <select value={form.hospitalId} onChange={(event) => {
                setForm({ ...form, hospitalId: event.target.value, branchId: '' })
                loadBranches(event.target.value)
              }} required>
                <option value="">Select hospital</option>
                {hospitals.map((hospital) => <option value={getHospitalId(hospital)} key={getHospitalId(hospital)}>{getHospitalName(hospital)}</option>)}
              </select>
            </label>
            <label>
              Branch
              <select value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })} disabled={!form.hospitalId} required>
                <option value="">Select branch</option>
                {branches.map((branch) => <option value={getBranchId(branch)} key={getBranchId(branch)}>{getBranchName(branch)}</option>)}
              </select>
            </label>
            <button className="modal-save" type="submit">Assign</button>
          </form>
        </div>
      ) : null}

      {resettingAdmin ? (
        <div className="user-modal">
          <form onSubmit={handleResetPassword}>
            <button type="button" onClick={() => setResettingAdmin(null)}>×</button>
            <h2>Reset Password</h2>
            <label>Temporary Password<input type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} required /></label>
            <button className="modal-save" type="submit">Set Password</button>
          </form>
        </div>
      ) : null}
    </div>
  )
}

export default Admins

