import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../../components/ToastProvider'
import {
  assignPharmacistToAdminPharmacy,
  changePharmacistStatus,
  createPharmacist,
  deletePharmacist,
  listPharmacists,
  resetPharmacistPassword,
  updatePharmacist,
  updatePharmacistPermissions,
} from '../../config/api'
import AdminLayout from './AdminLayout'

const emptyForm = { name: '', email: '', phone: '', password: '' }
const permissionKeys = ['prescriptions', 'dispensing', 'stock', 'reports']

function normalizeList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.pharmacists)) return response.data.pharmacists
  if (Array.isArray(response?.pharmacists)) return response.pharmacists
  if (Array.isArray(response?.results)) return response.results
  return []
}

function getId(item) {
  return item?._id || item?.id || item?.pharmacistId || item?.uuid
}

function getName(item) {
  return item?.name || item?.fullName || item?.pharmacistName || item?.email || 'Pharmacist'
}

function getStatus(item) {
  const value = item?.status ?? item?.isActive
  if (typeof value === 'boolean') return value ? 'Active' : 'Inactive'
  return value || 'Active'
}

function Users() {
  const { showToast } = useToast()
  const [pharmacists, setPharmacists] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [permissionsFor, setPermissionsFor] = useState(null)
  const [permissions, setPermissions] = useState({})
  const [resetting, setResetting] = useState(null)
  const [temporaryPassword, setTemporaryPassword] = useState('')

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return pharmacists
    return pharmacists.filter((item) => JSON.stringify(item).toLowerCase().includes(value))
  }, [pharmacists, query])

  async function loadPharmacists() {
    setLoading(true)
    try {
      const response = await listPharmacists({ search: query })
      setPharmacists(normalizeList(response))
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPharmacists()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(pharmacist) {
    setEditing(pharmacist)
    setForm({
      name: getName(pharmacist),
      email: pharmacist?.email || '',
      phone: pharmacist?.phone || pharmacist?.mobile || '',
      password: '',
    })
    setFormOpen(true)
  }

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      ...(form.password ? { password: form.password } : {}),
    }

    try {
      const response = editing ? await updatePharmacist(getId(editing), payload) : await createPharmacist(payload)
      showToast(response?.message || `Pharmacist ${editing ? 'updated' : 'created'} successfully.`)
      setFormOpen(false)
      setEditing(null)
      setForm(emptyForm)
      await loadPharmacists()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(pharmacist) {
    if (!window.confirm(`Delete ${getName(pharmacist)}?`)) return
    try {
      const response = await deletePharmacist(getId(pharmacist))
      showToast(response?.message || 'Pharmacist deleted successfully.')
      await loadPharmacists()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleStatus(pharmacist) {
    const nextStatus = String(getStatus(pharmacist)).toLowerCase() === 'active' ? 'inactive' : 'active'
    try {
      const response = await changePharmacistStatus(getId(pharmacist), { status: nextStatus })
      showToast(response?.message || 'Pharmacist status updated successfully.')
      await loadPharmacists()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleAssign(pharmacist) {
    try {
      const response = await assignPharmacistToAdminPharmacy(getId(pharmacist))
      showToast(response?.message || 'Admin pharmacy assigned to pharmacist.')
      await loadPharmacists()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  function openPermissions(pharmacist) {
    setPermissionsFor(pharmacist)
    setPermissions(pharmacist?.permissions || {})
  }

  async function handlePermissions(event) {
    event.preventDefault()
    try {
      const response = await updatePharmacistPermissions(getId(permissionsFor), { permissions })
      showToast(response?.message || 'Pharmacist permissions updated successfully.')
      setPermissionsFor(null)
      await loadPharmacists()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault()
    try {
      const response = await resetPharmacistPassword(getId(resetting), { temporaryPassword, password: temporaryPassword })
      showToast(response?.message || 'Temporary password set successfully.')
      setResetting(null)
      setTemporaryPassword('')
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  return (
    <AdminLayout activeLabel="Users" title="Manage Pharmacists" subtitle="Admin / Pharmacists">
      <section className="branch-panel pharmacist-panel">
        <div className="branch-panel-heading">
          <div>
            <h2>Pharmacists</h2>
            <p>Manage pharmacist access under this admin pharmacy.</p>
          </div>
          <button type="button" onClick={openCreate}>+ Add Pharmacist</button>
        </div>

        <label className="pharmacist-search">
          <span>Search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && loadPharmacists()} placeholder="Search by name, email or phone" />
          <button type="button" onClick={loadPharmacists}>Search</button>
        </label>

        <div className="branch-table-wrap">
          <table className="branch-table">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Pharmacy</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="6">Loading pharmacists...</td></tr> : null}
              {!loading && filtered.length ? filtered.map((pharmacist) => (
                <tr key={getId(pharmacist)}>
                  <td>{getName(pharmacist)}</td>
                  <td>{pharmacist?.email || '-'}</td>
                  <td>{pharmacist?.phone || pharmacist?.mobile || '-'}</td>
                  <td>{pharmacist?.pharmacy?.name || pharmacist?.pharmacyName || pharmacist?.branchName || '-'}</td>
                  <td><span className={`branch-status ${String(getStatus(pharmacist)).toLowerCase()}`}>{getStatus(pharmacist)}</span></td>
                  <td className="pharmacist-actions">
                    <button type="button" onClick={() => openEdit(pharmacist)}>Edit</button>
                    <button type="button" onClick={() => openPermissions(pharmacist)}>Permissions</button>
                    <button type="button" onClick={() => handleAssign(pharmacist)}>Assign</button>
                    <button type="button" onClick={() => handleStatus(pharmacist)}>Status</button>
                    <button type="button" onClick={() => setResetting(pharmacist)}>Reset</button>
                    <button type="button" onClick={() => handleDelete(pharmacist)}>Delete</button>
                  </td>
                </tr>
              )) : null}
              {!loading && !filtered.length ? <tr><td colSpan="6">No pharmacists found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen ? (
        <div className="admin-modal">
          <form onSubmit={handleSave}>
            <button type="button" onClick={() => setFormOpen(false)}>x</button>
            <h2>{editing ? 'Edit Pharmacist' : 'Create Pharmacist'}</h2>
            <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
            <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label>Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editing} /></label>
            <button className="admin-modal-save" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </form>
        </div>
      ) : null}

      {permissionsFor ? (
        <div className="admin-modal">
          <form onSubmit={handlePermissions}>
            <button type="button" onClick={() => setPermissionsFor(null)}>x</button>
            <h2>Permissions</h2>
            {permissionKeys.map((key) => <label className="admin-check" key={key}><input type="checkbox" checked={Boolean(permissions[key])} onChange={(event) => setPermissions({ ...permissions, [key]: event.target.checked })} />{key}</label>)}
            <button className="admin-modal-save" type="submit">Save Permissions</button>
          </form>
        </div>
      ) : null}

      {resetting ? (
        <div className="admin-modal">
          <form onSubmit={handleResetPassword}>
            <button type="button" onClick={() => setResetting(null)}>x</button>
            <h2>Reset Password</h2>
            <label>Temporary Password<input type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} required /></label>
            <button className="admin-modal-save" type="submit">Set Password</button>
          </form>
        </div>
      ) : null}
    </AdminLayout>
  )
}

export default Users
