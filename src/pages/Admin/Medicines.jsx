import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../../components/ToastProvider'
import {
  createMedicine,
  deleteMedicine,
  commitMedicineImport,
  downloadMedicineImportTemplate,
  getMedicineImportErrors,
  getMedicineImportStatus,
  listMedicineCategories,
  listMedicineDosageForms,
  listMedicines,
  searchMedicines,
  updateMedicine,
  validateMedicineImport,
} from '../../config/api'
import AdminLayout from './AdminLayout'

const emptyForm = {
  name: '',
  category: '',
  dosageForm: '',
  strength: '',
  unit: '',
  price: '',
  stock: '',
}

function normalizeList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.medicines)) return response.data.medicines
  if (Array.isArray(response?.medicines)) return response.medicines
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.results)) return response.results
  if (Array.isArray(response?.categories)) return response.categories
  if (Array.isArray(response?.dosageForms)) return response.dosageForms
  return []
}

function getId(item) {
  return item?._id || item?.id || item?.medicineId || item?.uuid
}

function getName(item) {
  return item?.name || item?.medicineName || item?.brandName || 'Medicine'
}

function getCategory(item) {
  return item?.category || item?.categoryName || item?.type || '-'
}

function getDosageForm(item) {
  return item?.dosageForm || item?.form || item?.medicineType || '-'
}

function getStatus(item) {
  const value = item?.status ?? item?.isAvailable ?? item?.available
  if (typeof value === 'boolean') return value ? 'Available' : 'Unavailable'
  return value || 'Available'
}

function optionValue(item) {
  if (typeof item === 'string') return item
  return item?.name || item?.category || item?.dosageForm || item?.value || item?.label || ''
}

function Medicines() {
  const { showToast } = useToast()
  const [medicines, setMedicines] = useState([])
  const [categories, setCategories] = useState([])
  const [dosageForms, setDosageForms] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [dosageForm, setDosageForm] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [importId, setImportId] = useState('')
  const [importMessage, setImportMessage] = useState('')

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase()
    return medicines.filter((medicine) => {
      const matchesText = !value || JSON.stringify(medicine).toLowerCase().includes(value)
      const matchesCategory = !category || getCategory(medicine) === category
      const matchesDosage = !dosageForm || getDosageForm(medicine) === dosageForm
      return matchesText && matchesCategory && matchesDosage
    })
  }, [category, dosageForm, medicines, query])

  async function loadLookups() {
    try {
      const [categoryResponse, dosageResponse] = await Promise.all([
        listMedicineCategories(),
        listMedicineDosageForms(),
      ])
      setCategories(normalizeList(categoryResponse))
      setDosageForms(normalizeList(dosageResponse))
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function loadMedicines() {
    setLoading(true)
    try {
      const params = { search: query, q: query, category, dosageForm }
      const response = query ? await searchMedicines(params) : await listMedicines(params)
      setMedicines(normalizeList(response))
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLookups()
    loadMedicines()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(medicine) {
    setEditing(medicine)
    setForm({
      name: getName(medicine),
      category: getCategory(medicine) === '-' ? '' : getCategory(medicine),
      dosageForm: getDosageForm(medicine) === '-' ? '' : getDosageForm(medicine),
      strength: medicine?.strength || '',
      unit: medicine?.unit || '',
      price: medicine?.price || medicine?.mrp || '',
      stock: medicine?.stock || medicine?.quantity || '',
    })
    setFormOpen(true)
  }

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name,
      medicineName: form.name,
      category: form.category,
      dosageForm: form.dosageForm,
      strength: form.strength,
      unit: form.unit,
      price: form.price === '' ? undefined : Number(form.price),
      stock: form.stock === '' ? undefined : Number(form.stock),
    }

    try {
      const response = editing ? await updateMedicine(getId(editing), payload) : await createMedicine(payload)
      showToast(response?.message || `Medicine ${editing ? 'updated' : 'created'} successfully.`)
      setFormOpen(false)
      setEditing(null)
      setForm(emptyForm)
      await loadMedicines()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(medicine) {
    if (!window.confirm(`Delete ${getName(medicine)}?`)) return
    try {
      const response = await deleteMedicine(getId(medicine))
      showToast(response?.message || 'Medicine deleted successfully.')
      await loadMedicines()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleImport(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const response = await validateMedicineImport(file)
      const nextImportId = response?.importId || response?.data?.importId || response?.data?.id || response?.id || ''
      setImportId(nextImportId)
      setImportMessage(response?.message || 'CSV validated successfully.')
      showToast(response?.message || 'CSV validated successfully.')
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      event.target.value = ''
    }
  }

  async function handleCommitImport() {
    if (!importId) {
      showToast('Validate a CSV first.', 'error')
      return
    }
    try {
      const response = await commitMedicineImport(importId)
      setImportMessage(response?.message || 'Medicine CSV import committed.')
      showToast(response?.message || 'Medicine CSV import committed.')
      await loadMedicines()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleImportStatus() {
    if (!importId) return showToast('Enter an import ID first.', 'error')
    try {
      const response = await getMedicineImportStatus(importId)
      setImportMessage(response?.message || JSON.stringify(response?.data || response))
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleImportErrors() {
    if (!importId) return showToast('Enter an import ID first.', 'error')
    try {
      const response = await getMedicineImportErrors(importId)
      setImportMessage(response?.message || JSON.stringify(response?.data || response))
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleTemplateDownload() {
    try {
      const response = await downloadMedicineImportTemplate()
      if (!response.ok) throw new Error('Template download failed.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'medicine-import-template.csv'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  return (
    <AdminLayout activeLabel="Medicines" title="Medicine Catalogue" subtitle="Admin / Medicine Catalogue">
      <section className="branch-panel medicine-panel">
        <div className="branch-panel-heading">
          <div>
            <h2>Medicines</h2>
            <p>Create and manage medicine catalogue records.</p>
          </div>
          <button type="button" onClick={openCreate}>+ Add Medicine</button>
        </div>

        <div className="medicine-filters">
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && loadMedicines()} placeholder="Search medicine" />
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All Categories</option>
            {categories.map((item) => <option value={optionValue(item)} key={optionValue(item)}>{optionValue(item)}</option>)}
          </select>
          <select value={dosageForm} onChange={(event) => setDosageForm(event.target.value)}>
            <option value="">All Dosage Forms</option>
            {dosageForms.map((item) => <option value={optionValue(item)} key={optionValue(item)}>{optionValue(item)}</option>)}
          </select>
          <button type="button" onClick={loadMedicines}>Search</button>
        </div>

        <div className="import-tools">
          <label>
            <span>CSV Import</span>
            <input type="file" accept=".csv,text/csv" onChange={handleImport} />
          </label>
          <input value={importId} onChange={(event) => setImportId(event.target.value)} placeholder="Import ID" />
          <button type="button" onClick={handleCommitImport}>Commit</button>
          <button type="button" onClick={handleImportStatus}>Status</button>
          <button type="button" onClick={handleImportErrors}>Errors</button>
          <button type="button" onClick={handleTemplateDownload}>Template</button>
        </div>
        {importMessage ? <p className="import-message">{importMessage}</p> : null}

        <div className="branch-table-wrap">
          <table className="branch-table">
            <thead><tr><th>Name</th><th>Category</th><th>Dosage Form</th><th>Strength</th><th>Unit</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="9">Loading medicines...</td></tr> : null}
              {!loading && filtered.length ? filtered.map((medicine) => (
                <tr key={getId(medicine)}>
                  <td>{getName(medicine)}</td>
                  <td>{getCategory(medicine)}</td>
                  <td>{getDosageForm(medicine)}</td>
                  <td>{medicine?.strength || '-'}</td>
                  <td>{medicine?.unit || '-'}</td>
                  <td>{medicine?.price || medicine?.mrp || '-'}</td>
                  <td>{medicine?.stock || medicine?.quantity || '-'}</td>
                  <td><span className={`branch-status ${String(getStatus(medicine)).toLowerCase().replaceAll(' ', '-')}`}>{getStatus(medicine)}</span></td>
                  <td className="pharmacist-actions">
                    <button type="button" onClick={() => openEdit(medicine)}>Edit</button>
                    <button type="button" onClick={() => handleDelete(medicine)}>Delete</button>
                  </td>
                </tr>
              )) : null}
              {!loading && !filtered.length ? <tr><td colSpan="9">No medicines found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen ? (
        <div className="admin-modal">
          <form onSubmit={handleSave}>
            <button type="button" onClick={() => setFormOpen(false)}>x</button>
            <h2>{editing ? 'Edit Medicine' : 'Create Medicine'}</h2>
            <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label>Category<input list="medicine-categories" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
            <datalist id="medicine-categories">{categories.map((item) => <option value={optionValue(item)} key={optionValue(item)} />)}</datalist>
            <label>Dosage Form<input list="medicine-dosage-forms" value={form.dosageForm} onChange={(event) => setForm({ ...form, dosageForm: event.target.value })} /></label>
            <datalist id="medicine-dosage-forms">{dosageForms.map((item) => <option value={optionValue(item)} key={optionValue(item)} />)}</datalist>
            <label>Strength<input value={form.strength} onChange={(event) => setForm({ ...form, strength: event.target.value })} /></label>
            <label>Unit<input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></label>
            <label>Price<input type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
            <label>Stock<input type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} /></label>
            <button className="admin-modal-save" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </form>
        </div>
      ) : null}
    </AdminLayout>
  )
}

export default Medicines
