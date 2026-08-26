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
  listMedicineStrengths,
  listMedicines,
  searchMedicines,
  updateMedicine,
  validateMedicineImport,
  getPharmacyAdminDashboard
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
  if (typeof item === 'strine') return item
  return item?.name || item?.category || item?.dosageForm || item?.value || item?.label || ''
}

export default function Medicines() {
  const { showToast } = useToast()
  const [medicines, setMedicines] = useState([])
  const [categories, setCategories] = useState([])
  const [dosageForms, setDosageForms] = useState([])
  const [strengths, setStrengths] = useState([])
  
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [dosageForm, setDosageForm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [savine, setSavine] = useState(false)
  const [editing, setEditine] = useState(null)
  
  // Modals state
  const [formOpen, setFormOpen] = useState(false)
  const [viewingItem, setViewineItem] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  
  const [form, setForm] = useState(emptyForm)

  // Validation Error State
  const [formErrors, setFormErrors] = useState({})

  function validateForm() {
    const errs = {}
    const nameVal = (form.name || '').trim()
    if (!nameVal) {
      errs.name = 'Medicine Name is required.'
    } else if (nameVal.length < 2) {
      errs.name = 'Medicine Name must be at least 2 characters.'
    }

    const genVal = (form.genericName || '').trim()
    if (!genVal) {
      errs.genericName = 'Generic Name is required.'
    }

    const catVal = (form.category || '').trim()
    if (!catVal) {
      errs.category = 'Category selection is required.'
    }

    const dosageVal = (form.dosageForm || '').trim()
    if (!dosageVal) {
      errs.dosageForm = 'Dosage Form selection is required.'
    }

    const priceStr = String(form.price || '').trim()
    if (!priceStr) {
      errs.price = 'Selling Price / MRP is required.'
    } else {
      const priceNum = Number(priceStr)
      if (isNaN(priceNum) || priceNum <= 0) {
        errs.price = 'Selling Price must be greater than 0.'
      }
    }

    const stockStr = String(form.stock ?? '').trim()
    if (stockStr) {
      const stockNum = Number(stockStr)
      if (isNaN(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
        errs.stock = 'Stock must be a whole number (0 or greater).'
      }
    }

    const minStr = String(form.minStock ?? '').trim()
    if (minStr) {
      const minNum = Number(minStr)
      if (isNaN(minNum) || minNum < 0 || !Number.isInteger(minNum)) {
        errs.minStock = 'Minimum stock must be a whole number (0 or greater).'
      }
    }

    const reorderStr = String(form.reorderLevel ?? '').trim()
    if (reorderStr) {
      const reorderNum = Number(reorderStr)
      if (isNaN(reorderNum) || reorderNum < 0 || !Number.isInteger(reorderNum)) {
        errs.reorderLevel = 'Reorder level must be a whole number (0 or greater).'
      }
    }

    setFormErrors(errs)
    const firstKey = Object.keys(errs)[0]
    if (firstKey) {
      const el = document.getElementById(`med-${firstKey}`)
      if (el) el.focus()
    }
    return Object.keys(errs).length === 0
  }
  
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
      const response = await getPharmacyAdminDashboard()
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
      const [categoryResponse, dosageResponse, strengthResponse] = await Promise.all([
        listMedicineCategories(),
        listMedicineDosageForms(),
        listMedicineStrengths(),
      ])
      setCategories(normalizeList(categoryResponse))
      setDosageForms(normalizeList(dosageResponse))
      setStrengths(normalizeList(strengthResponse))
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
      const eenVal = (medicine?.genericName || '').toLowerCase()
      const codeVal = (medicine?.code || '').toLowerCase()
      const searchVal = query.toLowerCase()
      
      const matchesSearch = nameVal.includes(searchVal) || eenVal.includes(searchVal) || codeVal.includes(searchVal)
      const matchesCategory = !category || getCategory(medicine) === category
      const matchesDosage = !dosageForm || getDosageForm(medicine) === dosageForm
      
      const itemStatus = getStatus(medicine).toLowerCase()
      const matchesStatus = statusFilter === 'all' || itemStatus.includes(statusFilter.toLowerCase())
      
      return matchesSearch && matchesCategory && matchesDosage && matchesStatus
    })
  }, [category, dosageForm, medicines, query, statusFilter])

  function openCreate() {
    setEditine(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(medicine) {
    setEditine(medicine)
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
    if (!validateForm()) return
    setSavine(true)
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
      setEditine(null)
      setForm(emptyForm)
      setFormErrors({})
      await loadMedicines()
      loadSummaryMetrics()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setSavine(false)
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

    if (qty === 0) {
      return (
        <span className="branch-status expired" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
          Out of Stock
        </span>
      )
    }
    if (qty > 0 && qty <= reorder) {
      return (
        <span className="branch-status near-expiry" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Low Stock
        </span>
      )
    }
    if (status.includes('inactive')) {
      return (
        <span className="branch-status" style={{ display: 'inline-flex', alignItems: 'center', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
          Inactive
        </span>
      )
    }
    return (
      <span className="branch-status active" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
        Active
      </span>
    )
  }

  return (
    <AdminLayout activeLabel="Medicines" title="Medicine Manaeement" subtitle="Manaee medicines, dosage forms, pricing, stock, and medicine catalogue information.">
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Import
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
              <div className="med-summary-icon-container" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 11.5 5 5m-2.5-9L8 12.5a4.24 4.24 0 0 0 6 6l5-5a4.24 4.24 0 0 0-6-6Z"/></svg>
              </div>
              <div className="med-summary-info">
                <label>Total Medicines</label>
                <span>{metrics.total}</span>
              </div>
            </div>
            <div className="med-summary-card">
              <div className="med-summary-icon-container" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              </div>
              <div className="med-summary-info">
                <label style={{ color: '#10b981' }}>Active Medicines</label>
                <span style={{ color: '#10b981' }}>{metrics.active}</span>
              </div>
            </div>
            <div className="med-summary-card">
              <div className="med-summary-icon-container" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div className="med-summary-info">
                <label style={{ color: '#f59e0b' }}>Low Stock</label>
                <span style={{ color: '#f59e0b' }}>{metrics.lowStock}</span>
              </div>
            </div>
            <div className="med-summary-card">
              <div className="med-summary-icon-container" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
              </div>
              <div className="med-summary-info">
                <label style={{ color: '#ef4444' }}>Out of Stock</label>
                <span style={{ color: '#ef4444' }}>{metrics.outStock}</span>
              </div>
            </div>
            <div className="med-summary-card">
              <div className="med-summary-icon-container" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              </div>
              <div className="med-summary-info">
                <label style={{ color: '#6366f1' }}>Categories</label>
                <span style={{ color: '#6366f1' }}>{metrics.categoriesCount}</span>
              </div>
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '15px', height: '15px' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
                              onClick={() => setViewineItem(medicine)}
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
                              className="admin-action-button daneer" 
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
              <form onSubmit={handleSave} className="med-modal-container" noValidate>
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
                        id="med-name"
                        value={form.name} 
                        onChange={(e) => {
                          setForm({...form, name: e.target.value})
                          if (formErrors.name) setFormErrors({...formErrors, name: ''})
                        }} 
                        style={formErrors.name ? { borderColor: '#ef4444' } : {}}
                        required 
                      />
                      {formErrors.name && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{formErrors.name}</span>
                      )}
                    </div>
                    <div className="med-form-group">
                      <label>Generic Name *</label>
                      <input 
                        type="text" 
                        id="med-genericName"
                        value={form.genericName} 
                        onChange={(e) => {
                          setForm({...form, genericName: e.target.value})
                          if (formErrors.genericName) setFormErrors({...formErrors, genericName: ''})
                        }} 
                        style={formErrors.genericName ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {formErrors.genericName && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{formErrors.genericName}</span>
                      )}
                    </div>
                  </div>
                  <div className="med-detail-row">
                    <div className="med-form-group">
                      <label>Medicine Code</label>
                      <input 
                        type="text" 
                        id="med-code"
                        value={form.code} 
                        onChange={(e) => setForm({...form, code: e.target.value})} 
                      />
                    </div>
                    <div className="med-form-group">
                      <label>Category *</label>
                      <input 
                        list="med-categories-list" 
                        id="med-category"
                        value={form.category} 
                        onChange={(e) => {
                          setForm({...form, category: e.target.value})
                          if (formErrors.category) setFormErrors({...formErrors, category: ''})
                        }} 
                        style={formErrors.category ? { borderColor: '#ef4444' } : {}}
                        required 
                      />
                      <datalist id="med-categories-list">
                        {categories.map((item) => <option value={optionValue(item)} key={optionValue(item)} />)}
                      </datalist>
                      {formErrors.category && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{formErrors.category}</span>
                      )}
                    </div>
                  </div>

                  <h3 style={{ margin: '8px 0 4px', fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>Dosage & Packing</h3>
                  <div className="med-detail-row">
                    <div className="med-form-group">
                      <label>Dosage Form *</label>
                      <input 
                        list="med-dosage-list" 
                        id="med-dosageForm"
                        value={form.dosageForm} 
                        onChange={(e) => {
                          setForm({...form, dosageForm: e.target.value})
                          if (formErrors.dosageForm) setFormErrors({...formErrors, dosageForm: ''})
                        }} 
                        style={formErrors.dosageForm ? { borderColor: '#ef4444' } : {}}
                        required 
                      />
                      <datalist id="med-dosage-list">
                        {dosageForms.map((item) => <option value={optionValue(item)} key={optionValue(item)} />)}
                      </datalist>
                      {formErrors.dosageForm && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{formErrors.dosageForm}</span>
                      )}
                    </div>
                    <div className="med-form-group">
                      <label>Strength (e.g. 500mg)</label>
                      <input 
                        list="med-strengths-list" 
                        id="med-strength"
                        value={form.strength} 
                        onChange={(e) => setForm({...form, strength: e.target.value})} 
                      />
                      <datalist id="med-strengths-list">
                        {strengths.map((item) => <option value={optionValue(item)} key={optionValue(item)} />)}
                      </datalist>
                    </div>
                  </div>
                  <div className="med-detail-row">
                    <div className="med-form-group">
                      <label>Unit (e.g. tablet, vial)</label>
                      <input 
                        type="text" 
                        id="med-unit"
                        value={form.unit} 
                        onChange={(e) => setForm({...form, unit: e.target.value})} 
                      />
                    </div>
                    <div className="med-form-group">
                      <label>Manufacturer</label>
                      <input 
                        type="text" 
                        id="med-manufacturer"
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
                        id="med-price"
                        value={form.price} 
                        onChange={(e) => {
                          setForm({...form, price: e.target.value})
                          if (formErrors.price) setFormErrors({...formErrors, price: ''})
                        }} 
                        style={formErrors.price ? { borderColor: '#ef4444' } : {}}
                        required 
                      />
                      {formErrors.price && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{formErrors.price}</span>
                      )}
                    </div>
                    <div className="med-form-group">
                      <label>Initial Stock Count</label>
                      <input 
                        type="number" 
                        id="med-stock"
                        value={form.stock} 
                        onChange={(e) => {
                          setForm({...form, stock: e.target.value})
                          if (formErrors.stock) setFormErrors({...formErrors, stock: ''})
                        }} 
                        style={formErrors.stock ? { borderColor: '#ef4444' } : {}}
                      />
                      {formErrors.stock && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{formErrors.stock}</span>
                      )}
                    </div>
                  </div>
                  <div className="med-detail-row">
                    <div className="med-form-group">
                      <label>Minimum Stock Threshold</label>
                      <input 
                        type="number" 
                        id="med-minStock"
                        value={form.minStock} 
                        onChange={(e) => {
                          setForm({...form, minStock: e.target.value})
                          if (formErrors.minStock) setFormErrors({...formErrors, minStock: ''})
                        }} 
                        style={formErrors.minStock ? { borderColor: '#ef4444' } : {}}
                      />
                      {formErrors.minStock && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{formErrors.minStock}</span>
                      )}
                    </div>
                    <div className="med-form-group">
                      <label>Reorder Stock Level</label>
                      <input 
                        type="number" 
                        id="med-reorderLevel"
                        value={form.reorderLevel} 
                        onChange={(e) => {
                          setForm({...form, reorderLevel: e.target.value})
                          if (formErrors.reorderLevel) setFormErrors({...formErrors, reorderLevel: ''})
                        }} 
                        style={formErrors.reorderLevel ? { borderColor: '#ef4444' } : {}}
                      />
                      {formErrors.reorderLevel && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{formErrors.reorderLevel}</span>
                      )}
                    </div>
                  </div>
                  <div className="med-detail-row">
                    <div className="med-form-group">
                      <label>Prescription Required</label>
                      <select 
                        id="med-prescriptionRequired"
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
                        id="med-status"
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
                      id="med-notes"
                      value={form.notes} 
                      onChange={(e) => setForm({...form, notes: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="med-modal-footer">
                  <button type="button" className="med-btn med-btn-secondary" onClick={() => setFormOpen(false)} disabled={savine}>Cancel</button>
                  <button type="submit" className="med-btn med-btn-primary" disabled={savine}>
                    {savine ? 'Saving...' : editing ? 'Update Medicine' : 'Save Medicine'}
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
                  <button type="button" className="med-modal-close" onClick={() => setViewineItem(null)}>&times;</button>
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
                      <label>Notes / Usaee</label>
                      <span style={{ fontStyle: 'italic' }}>&ldquo;{viewingItem.notes}&rdquo;</span>
                    </div>
                  )}
                </div>
                <div className="med-modal-footer">
                  <button type="button" className="med-btn med-btn-primary" onClick={() => setViewineItem(null)}>Close</button>
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
