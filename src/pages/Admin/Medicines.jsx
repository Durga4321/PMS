import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../../components/ToastProvider'
import AdminLayout from './AdminLayout'
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
  getPharmacyDashboard
} from '../../config/api'
import './Medicines.css'

const emptyForm = {
  name: '',
  genericName: '',
  code: '',
  category: '',
  dosageForm: '',
  strength: '',
  unit: '',
  price: '',
  stock: '',
  minStock: '',
  maxStock: '',
  reorderLevel: '',
  manufacturer: '',
  prescriptionRequired: 'No',
  status: 'Active',
  notes: ''
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
  return item?.name || item?.medicineName || item?.brandName || '-'
}

function getCategory(item) {
  return item?.category || item?.categoryName || item?.type || '-'
}

function getDosageForm(item) {
  return item?.dosageForm || item?.form || item?.medicineType || '-'
}

function getStatus(item) {
  const value = item?.status ?? item?.isAvailable ?? item?.available
  if (typeof value === 'boolean') return value ? 'Active' : 'Inactive'
  return value || 'Active'
}

function optionValue(item) {
  if (typeof item === 'string') return item
  return item?.name || item?.category || item?.dosageForm || item?.value || item?.label || ''
}

export default function Medicines() {
  const { showToast } = useToast()
  const [medicines, setMedicines] = useState([])
  const [categories, setCategories] = useState([])
  const [dosageForms, setDosageForms] = useState([])
  
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [dosageForm, setDosageForm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  
  // Modals state
  const [formOpen, setFormOpen] = useState(false)
  const [viewingItem, setViewingItem] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  
  const [form, setForm] = useState(emptyForm)
  
  // Import state
  const [importFile, setImportFile] = useState(null)
  const [importId, setImportId] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [importStats, setImportStats] = useState(null)
  const [importErrors, setImportErrors] = useState(null)

  // Metrics summary
  const [metrics, setMetrics] = useState({
    total: 0,
    active: 0,
    lowStock: 0,
    outStock: 0,
    categoriesCount: 0
  })

  async function loadSummaryMetrics() {
    try {
      const response = await getPharmacyDashboard()
      const data = response?.data || response || {}
      setMetrics({
        total: Number(data?.totalMedicines || data?.medicinesCount || 0),
        active: Number(data?.activeMedicines || data?.activeMedicinesCount || 0),
        lowStock: Number(data?.lowStockMedicines || data?.lowStockCount || 0),
        outStock: Number(data?.outOfStockMedicines || data?.outOfStockCount || 0),
        categoriesCount: Number(data?.totalCategories || data?.categoriesCount || 0)
      })
    } catch (e) {
      console.log('Unable to load Medicines metrics:', e.message)
    }
  }

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
      const list = normalizeList(response)
      setMedicines(list)
      // Fallback local counts calculation
      if (list.length > 0) {
        setMetrics(prev => ({
          ...prev,
          total: list.length,
          active: list.filter(m => getStatus(m).toLowerCase() === 'active' || getStatus(m).toLowerCase() === 'available').length,
          lowStock: list.filter(m => Number(m.stock || 0) > 0 && Number(m.stock || 0) <= Number(m.reorderLevel || 5)).length,
          outStock: list.filter(m => Number(m.stock || 0) === 0).length
        }))
      }
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLookups()
    loadMedicines()
    loadSummaryMetrics()
  }, [])

  // Filtered local medicines list
  const filteredMedicines = useMemo(() => {
    return medicines.filter((medicine) => {
      const nameVal = getName(medicine).toLowerCase()
      const genVal = (medicine?.genericName || '').toLowerCase()
      const codeVal = (medicine?.code || '').toLowerCase()
      const searchVal = query.toLowerCase()
      
      const matchesSearch = nameVal.includes(searchVal) || genVal.includes(searchVal) || codeVal.includes(searchVal)
      const matchesCategory = !category || getCategory(medicine) === category
      const matchesDosage = !dosageForm || getDosageForm(medicine) === dosageForm
      
      const itemStatus = getStatus(medicine).toLowerCase()
      const matchesStatus = statusFilter === 'all' || itemStatus.includes(statusFilter.toLowerCase())
      
      return matchesSearch && matchesCategory && matchesDosage && matchesStatus
    })
  }, [category, dosageForm, medicines, query, statusFilter])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(medicine) {
    setEditing(medicine)
    setForm({
      name: getName(medicine),
      genericName: medicine?.genericName || '',
      code: medicine?.code || '',
      category: getCategory(medicine) === '-' ? '' : getCategory(medicine),
      dosageForm: getDosageForm(medicine) === '-' ? '' : getDosageForm(medicine),
      strength: medicine?.strength || '',
      unit: medicine?.unit || '',
      price: medicine?.price || medicine?.mrp || '',
      stock: medicine?.stock || medicine?.quantity || '',
      minStock: medicine?.minStock || medicine?.minimumStock || '',
      maxStock: medicine?.maxStock || medicine?.maximumStock || '',
      reorderLevel: medicine?.reorderLevel || '',
      manufacturer: medicine?.manufacturer || '',
      prescriptionRequired: medicine?.prescriptionRequired || 'No',
      status: getStatus(medicine),
      notes: medicine?.notes || ''
    })
    setFormOpen(true)
  }

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name,
      medicineName: form.name,
      genericName: form.genericName || undefined,
      code: form.code || undefined,
      category: form.category,
      dosageForm: form.dosageForm,
      strength: form.strength,
      unit: form.unit,
      price: form.price === '' ? undefined : Number(form.price),
      stock: form.stock === '' ? undefined : Number(form.stock),
      minStock: form.minStock === '' ? undefined : Number(form.minStock),
      maxStock: form.maxStock === '' ? undefined : Number(form.maxStock),
      reorderLevel: form.reorderLevel === '' ? undefined : Number(form.reorderLevel),
      manufacturer: form.manufacturer || undefined,
      prescriptionRequired: form.prescriptionRequired,
      status: form.status,
      notes: form.notes || undefined
    }

    try {
      const response = editing ? await updateMedicine(getId(editing), payload) : await createMedicine(payload)
      showToast(response?.message || `Medicine ${editing ? 'updated' : 'created'} successfully.`)
      setFormOpen(false)
      setEditing(null)
      setForm(emptyForm)
      await loadMedicines()
      loadSummaryMetrics()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(medicine) {
    if (!window.confirm(`Are you sure you want to delete ${getName(medicine)}? This cannot be undone.`)) return
    try {
      const response = await deleteMedicine(getId(medicine))
      showToast(response?.message || 'Medicine deleted successfully.')
      await loadMedicines()
      loadSummaryMetrics()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  // Import Actions
  async function handleImportValidation() {
    if (!importFile) return showToast('Please select a CSV file first.', 'error')
    setLoading(true)
    try {
      const response = await validateMedicineImport(importFile)
      const nextImportId = response?.importId || response?.data?.importId || response?.id || ''
      setImportId(nextImportId)
      setImportMessage(response?.message || 'CSV file validated successfully.')
      setImportStats(response?.data || response || null)
      showToast(response?.message || 'CSV validated successfully.')
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleCommitImport() {
    if (!importId) return showToast('Please validate a CSV first.', 'error')
    setLoading(true)
    try {
      const response = await commitMedicineImport(importId)
      setImportMessage(response?.message || 'Medicine CSV import committed.')
      showToast(response?.message || 'Medicine CSV import committed.')
      setImportOpen(false)
      setImportFile(null)
      setImportId('')
      setImportStats(null)
      await loadMedicines()
      loadSummaryMetrics()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleImportStatus() {
    if (!importId) return showToast('Enter an import ID first.', 'error')
    try {
      const response = await getMedicineImportStatus(importId)
      setImportMessage(response?.message || 'Status loaded.')
      setImportStats(response?.data || response)
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleImportErrors() {
    if (!importId) return showToast('Enter an import ID first.', 'error')
    try {
      const response = await getMedicineImportErrors(importId)
      setImportErrors(response?.errors || response?.data || response)
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

  // Status Badge visual mapper
  const getStatusBadge = (medicine) => {
    const status = getStatus(medicine).toLowerCase()
    const qty = Number(medicine?.stock || medicine?.quantity || 0)
    const reorder = Number(medicine?.reorderLevel || 5)

    if (qty === 0) return <span className="branch-status expired">Out of Stock</span>
    if (qty > 0 && qty <= reorder) return <span className="branch-status near-expiry">Low Stock</span>
    if (status.includes('inactive')) return <span className="branch-status" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>Inactive</span>
    return <span className="branch-status active">Active</span>
  }

  return (
    <AdminLayout activeLabel="Medicines" title="Medicine Management" subtitle="Manage medicines, dosage forms, pricing, stock, and medicine catalogue information.">
      <div className="stock-scroll-area">
        <div className="med-layout-container">

          {/* Workflow Buttons Toolbar */}
          <div className="med-toolbar" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '8px' }}>
            <div className="med-action-btns">
              <button 
                type="button" 
                className="med-btn med-btn-primary"
                onClick={openCreate}
              >
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                + Add Medicine
              </button>
              <button 
                type="button" 
                className="med-btn med-btn-secondary"
                onClick={() => setImportOpen(true)}
              >
                Import Medicines
              </button>
            </div>
            <button 
              type="button" 
              className="med-btn med-btn-secondary"
              onClick={loadMedicines}
            >
              <svg viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              Refresh
            </button>
          </div>

          {/* Summary Cards */}
          <div className="med-summary-grid">
            <div className="med-summary-card">
              <label>Total Medicines</label>
              <span>{metrics.total}</span>
            </div>
            <div className="med-summary-card" style={{ borderLeft: '3px solid #10b981' }}>
              <label style={{ color: '#10b981' }}>Active Medicines</label>
              <span style={{ color: '#10b981' }}>{metrics.active}</span>
            </div>
            <div className="med-summary-card" style={{ borderLeft: '3px solid #f59e0b' }}>
              <label style={{ color: '#f59e0b' }}>Low Stock</label>
              <span style={{ color: '#f59e0b' }}>{metrics.lowStock}</span>
            </div>
            <div className="med-summary-card" style={{ borderLeft: '3px solid #ef4444' }}>
              <label style={{ color: '#ef4444' }}>Out of Stock</label>
              <span style={{ color: '#ef4444' }}>{metrics.outStock}</span>
            </div>
            <div className="med-summary-card" style={{ borderLeft: '3px solid #3b82f6' }}>
              <label style={{ color: '#3b82f6' }}>Categories</label>
              <span style={{ color: '#3b82f6' }}>{metrics.categoriesCount}</span>
            </div>
          </div>

          {/* Search Inputs */}
          <div className="med-toolbar">
            <div className="med-search-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
              <input 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
                placeholder="Search medicine by name, generic name, code..." 
              />
            </div>
            <div className="med-filters">
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((item) => <option value={optionValue(item)} key={optionValue(item)}>{optionValue(item)}</option>)}
              </select>
              <select 
                value={dosageForm} 
                onChange={(e) => setDosageForm(e.target.value)}
              >
                <option value="">All Dosage Forms</option>
                {dosageForms.map((item) => <option value={optionValue(item)} key={optionValue(item)}>{optionValue(item)}</option>)}
              </select>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="low stock">Low Stock</option>
                <option value="out of stock">Out of Stock</option>
              </select>
              <button 
                type="button" 
                className="med-btn med-btn-secondary"
                onClick={() => {
                  setQuery('')
                  setCategory('')
                  setDosageForm('')
                  setStatusFilter('all')
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Table Results */}
          <section className="dispense-table-panel">
            <h2>Medicine Catalogue Logs</h2>
            
            {loading ? (
              <div className="dispense-skeleton-row">
                <div className="dispense-skeleton-line" style={{ width: '80%' }}></div>
                <div className="dispense-skeleton-line" style={{ width: '90%' }}></div>
                <div className="dispense-skeleton-line" style={{ width: '70%' }}></div>
              </div>
            ) : (
              <div className="branch-table-wrap">
                <table className="branch-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>S.No.</th>
                      <th>Medicine Name</th>
                      <th>Generic Name</th>
                      <th>Category</th>
                      <th>Dosage Form</th>
                      <th>Strength</th>
                      <th>Unit</th>
                      <th>Selling Price</th>
                      <th>Stock</th>
                      <th>Status</th>
                      <th style={{ width: '180px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMedicines.length ? filteredMedicines.map((medicine, index) => (
                      <tr key={getId(medicine) || index}>
                        <td>{index + 1}</td>
                        <td><div style={{ fontWeight: 600, color: '#1e293b' }}>{getName(medicine)}</div></td>
                        <td>{medicine?.genericName || '-'}</td>
                        <td>{getCategory(medicine)}</td>
                        <td>{getDosageForm(medicine)}</td>
                        <td>{medicine?.strength || '-'}</td>
                        <td>{medicine?.unit || '-'}</td>
                        <td>₹{medicine?.price || medicine?.mrp || '0'}</td>
                        <td>{medicine?.stock || medicine?.quantity || 0}</td>
                        <td>{getStatusBadge(medicine)}</td>
                        <td>
                          <div className="admin-action-group">
                            <button 
                              type="button" 
                              className="admin-action-button view" 
                              aria-label="View Medicine" 
                              title="View Medicine"
                              onClick={() => setViewingItem(medicine)}
                            >
                              <svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                            </button>
                            <button 
                              type="button" 
                              className="admin-action-button edit" 
                              aria-label="Edit Medicine" 
                              title="Edit Medicine"
                              onClick={() => openEdit(medicine)}
                            >
                              <svg viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></svg>
                            </button>
                            <button 
                              type="button" 
                              className="admin-action-button danger" 
                              aria-label="Delete Medicine" 
                              title="Delete Medicine"
                              onClick={() => handleDelete(medicine)}
                            >
                              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="11">
                          <div className="dispense-empty-state">
                            <h3>No medicines found.</h3>
                            <p>Add medicines to your pharmacy catalogue to start managing stock and pricing.</p>
                            <button 
                              type="button" 
                              className="med-btn med-btn-primary" 
                              style={{ marginTop: '12px' }}
                              onClick={openCreate}
                            >
                              + Add Medicine
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Modal 1: Add/Edit Medicine */}
          {formOpen && (
            <div className="med-modal-overlay">
              <form onSubmit={handleSave} className="med-modal-container">
                <div className="med-modal-header">
                  <h2>{editing ? 'Update Medicine Profile' : '+ Add New Medicine'}</h2>
                  <button type="button" className="med-modal-close" onClick={() => setFormOpen(false)}>&times;</button>
                </div>
                <div className="med-modal-body">
                  <h3 style={{ margin: '0 0 4px', fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>Basic Information</h3>
                  <div className="med-detail-row">
                    <div className="med-form-group">
                      <label>Medicine Name *</label>
                      <input 
                        type="text" 
                        value={form.name} 
                        onChange={(e) => setForm({...form, name: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="med-form-group">
                      <label>Generic Name</label>
                      <input 
                        type="text" 
                        value={form.genericName} 
                        onChange={(e) => setForm({...form, genericName: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="med-detail-row">
                    <div className="med-form-group">
                      <label>Medicine Code</label>
                      <input 
                        type="text" 
                        value={form.code} 
                        onChange={(e) => setForm({...form, code: e.target.value})} 
                      />
                    </div>
                    <div className="med-form-group">
                      <label>Category *</label>
                      <input 
                        list="med-categories-list" 
                        value={form.category} 
                        onChange={(e) => setForm({...form, category: e.target.value})} 
                        required 
                      />
                      <datalist id="med-categories-list">
                        {categories.map((item) => <option value={optionValue(item)} key={optionValue(item)} />)}
                      </datalist>
                    </div>
                  </div>

                  <h3 style={{ margin: '8px 0 4px', fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>Dosage & Packing</h3>
                  <div className="med-detail-row">
                    <div className="med-form-group">
                      <label>Dosage Form *</label>
                      <input 
                        list="med-dosage-list" 
                        value={form.dosageForm} 
                        onChange={(e) => setForm({...form, dosageForm: e.target.value})} 
                        required 
                      />
                      <datalist id="med-dosage-list">
                        {dosageForms.map((item) => <option value={optionValue(item)} key={optionValue(item)} />)}
                      </datalist>
                    </div>
                    <div className="med-form-group">
                      <label>Strength (e.g. 500mg)</label>
                      <input 
                        type="text" 
                        value={form.strength} 
                        onChange={(e) => setForm({...form, strength: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="med-detail-row">
                    <div className="med-form-group">
                      <label>Unit (e.g. tablet, vial)</label>
                      <input 
                        type="text" 
                        value={form.unit} 
                        onChange={(e) => setForm({...form, unit: e.target.value})} 
                      />
                    </div>
                    <div className="med-form-group">
                      <label>Manufacturer</label>
                      <input 
                        type="text" 
                        value={form.manufacturer} 
                        onChange={(e) => setForm({...form, manufacturer: e.target.value})} 
                      />
                    </div>
                  </div>

                  <h3 style={{ margin: '8px 0 4px', fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>Pricing & Thresholds</h3>
                  <div className="med-detail-row">
                    <div className="med-form-group">
                      <label>Selling Price (₹) *</label>
                      <input 
                        type="number" 
                        value={form.price} 
                        onChange={(e) => setForm({...form, price: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="med-form-group">
                      <label>Initial Stock Count</label>
                      <input 
                        type="number" 
                        value={form.stock} 
                        onChange={(e) => setForm({...form, stock: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="med-detail-row">
                    <div className="med-form-group">
                      <label>Minimum Stock Threshold</label>
                      <input 
                        type="number" 
                        value={form.minStock} 
                        onChange={(e) => setForm({...form, minStock: e.target.value})} 
                      />
                    </div>
                    <div className="med-form-group">
                      <label>Reorder Stock Level</label>
                      <input 
                        type="number" 
                        value={form.reorderLevel} 
                        onChange={(e) => setForm({...form, reorderLevel: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="med-detail-row">
                    <div className="med-form-group">
                      <label>Prescription Required</label>
                      <select 
                        value={form.prescriptionRequired} 
                        onChange={(e) => setForm({...form, prescriptionRequired: e.target.value})}
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
                    <div className="med-form-group">
                      <label>Catalogue Status</label>
                      <select 
                        value={form.status} 
                        onChange={(e) => setForm({...form, status: e.target.value})}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="med-form-group">
                    <label>Description / Usage Notes</label>
                    <textarea 
                      value={form.notes} 
                      onChange={(e) => setForm({...form, notes: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="med-modal-footer">
                  <button type="button" className="med-btn med-btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
                  <button type="submit" className="med-btn med-btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : editing ? 'Update Medicine' : 'Save Medicine'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal 2: View Details */}
          {viewingItem && (
            <div className="med-modal-overlay">
              <div className="med-modal-container">
                <div className="med-modal-header">
                  <h2>Medicine Details Profile: {getName(viewingItem)}</h2>
                  <button type="button" className="med-modal-close" onClick={() => setViewingItem(null)}>&times;</button>
                </div>
                <div className="med-modal-body">
                  <div className="med-detail-row">
                    <div className="med-detail-item">
                      <label>Medicine Name</label>
                      <span>{getName(viewingItem)}</span>
                    </div>
                    <div className="med-detail-item">
                      <label>Generic Name</label>
                      <span>{viewingItem?.genericName || '-'}</span>
                    </div>
                  </div>
                  <div className="med-detail-row">
                    <div className="med-detail-item">
                      <label>Medicine Code</label>
                      <span><code>{viewingItem?.code || '-'}</code></span>
                    </div>
                    <div className="med-detail-item">
                      <label>Category</label>
                      <span>{getCategory(viewingItem)}</span>
                    </div>
                  </div>
                  <div className="med-detail-row">
                    <div className="med-detail-item">
                      <label>Dosage Form</label>
                      <span>{getDosageForm(viewingItem)}</span>
                    </div>
                    <div className="med-detail-item">
                      <label>Strength & Unit</label>
                      <span>{viewingItem?.strength || ''} {viewingItem?.unit || ''}</span>
                    </div>
                  </div>
                  <div className="med-detail-row">
                    <div className="med-detail-item">
                      <label>Selling Price (MRP)</label>
                      <span>₹{viewingItem?.price || viewingItem?.mrp || '0'}</span>
                    </div>
                    <div className="med-detail-item">
                      <label>Current Stock</label>
                      <span>{viewingItem?.stock || viewingItem?.quantity || 0} units</span>
                    </div>
                  </div>
                  <div className="med-detail-row">
                    <div className="med-detail-item">
                      <label>Minimum Stock Threshold</label>
                      <span>{viewingItem?.minStock || viewingItem?.minimumStock || 10}</span>
                    </div>
                    <div className="med-detail-item">
                      <label>Reorder Level</label>
                      <span>{viewingItem?.reorderLevel || 5}</span>
                    </div>
                  </div>
                  <div className="med-detail-row">
                    <div className="med-detail-item">
                      <label>Prescription Required</label>
                      <span>{viewingItem?.prescriptionRequired || 'No'}</span>
                    </div>
                    <div className="med-detail-item">
                      <label>Status</label>
                      <div style={{ marginTop: '4px' }}>{getStatusBadge(viewingItem)}</div>
                    </div>
                  </div>
                  {viewingItem?.manufacturer && (
                    <div className="med-detail-item">
                      <label>Manufacturer</label>
                      <span>{viewingItem.manufacturer}</span>
                    </div>
                  )}
                  {viewingItem?.notes && (
                    <div className="med-detail-item">
                      <label>Notes / Usage</label>
                      <span style={{ fontStyle: 'italic' }}>&ldquo;{viewingItem.notes}&rdquo;</span>
                    </div>
                  )}
                </div>
                <div className="med-modal-footer">
                  <button type="button" className="med-btn med-btn-primary" onClick={() => setViewingItem(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal 3: CSV Import Wizard */}
          {importOpen && (
            <div className="med-modal-overlay">
              <div className="med-modal-container">
                <div className="med-modal-header">
                  <h2>Import Medicines (CSV Wizard)</h2>
                  <button type="button" className="med-modal-close" onClick={() => setImportOpen(false)}>&times;</button>
                </div>
                <div className="med-modal-body">
                  
                  {/* Step 1: Upload */}
                  <div className="import-step-box">
                    <h4>Step 1: Upload CSV File</h4>
                    <input 
                      type="file" 
                      accept=".csv,text/csv" 
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) setImportFile(file)
                      }} 
                    />
                    <button 
                      type="button" 
                      className="med-btn med-btn-secondary" 
                      style={{ marginTop: '8px' }}
                      onClick={handleTemplateDownload}
                    >
                      Download CSV Template
                    </button>
                  </div>

                  {/* Step 2: Validate */}
                  <div className="import-step-box">
                    <h4>Step 2: Validate Data</h4>
                    <button 
                      type="button" 
                      className="med-btn med-btn-secondary"
                      onClick={handleImportValidation}
                      disabled={!importFile}
                    >
                      Validate File
                    </button>
                    {importId && (
                      <div style={{ fontSize: '12px', color: '#059669', marginTop: '6px' }}>
                        Import ID: <code>{importId}</code> successfully validated.
                      </div>
                    )}
                  </div>

                  {/* Stats View */}
                  {importStats && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                      <div style={{ fontWeight: 600, color: '#166534', marginBottom: '4px' }}>Validation Details:</div>
                      <div>Total Rows: {importStats.totalRows || 0}</div>
                      <div>Valid Rows: {importStats.validRows || 0}</div>
                      <div>Duplicates: {importStats.duplicateRows || 0}</div>
                      <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                        <button type="button" className="med-btn med-btn-secondary" style={{ height: '30px', padding: '0 8px' }} onClick={handleImportStatus}>Get Status</button>
                        <button type="button" className="med-btn med-btn-secondary" style={{ height: '30px', padding: '0 8px' }} onClick={handleImportErrors}>View Error Details</button>
                      </div>
                    </div>
                  )}

                  {importErrors && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '8px', fontSize: '12px', color: '#991b1b', marginTop: '8px' }}>
                      <div style={{ fontWeight: 600 }}>Validation Errors:</div>
                      <pre style={{ margin: '4px 0 0', overflowX: 'auto' }}>{JSON.stringify(importErrors, null, 2)}</pre>
                    </div>
                  )}

                  {importMessage && (
                    <div style={{ fontSize: '13px', color: '#475569', marginTop: '12px', fontStyle: 'italic' }}>
                      Message: {importMessage}
                    </div>
                  )}

                </div>
                <div className="med-modal-footer">
                  <button type="button" className="med-btn med-btn-secondary" onClick={() => setImportOpen(false)}>Cancel</button>
                  <button 
                    type="button" 
                    className="med-btn med-btn-primary"
                    onClick={handleCommitImport}
                    disabled={!importId}
                  >
                    Commit Import
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </AdminLayout>
  )
}
