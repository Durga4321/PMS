import { useEffect, useMemo, useState } from 'react'
import PharmacistLayout from './PharmacistLayout'
import {
  readLocalMedicines,
  listMedicines,
  getPharmacistAssignedBranch,
  matchesMedicineBranch,
  formatExcelDate,
  readLocalSubBranches,
  clearLocalMedicinesCache
} from '../../config/api'
import '../Admin/Medicines.css'

function getName(item) {
  return item?.name || item?.Name || item?.medicineName || item?.MedicineName || item?.brandName || item?.BrandName || '-'
}

function getCategory(item) {
  return item?.category || item?.Category || item?.categoryName || item?.CategoryName || '-'
}

function getDosageForm(item) {
  return item?.dosageForm || item?.DosageForm || item?.form || item?.Form || '-'
}

function getStatus(item) {
  const value = item?.status ?? item?.isActive ?? item?.isAvailable ?? item?.available
  if (typeof value === 'boolean') return value ? 'Active' : 'Inactive'
  return value || 'Active'
}

function getSellingPrice(item) {
  const candidates = [
    item?.sellingPrice,
    item?.SellingPrice,
    item?.price,
    item?.Price,
    item?.mrp,
    item?.MRP,
  ]
  for (const c of candidates) {
    if (c !== undefined && c !== null && c !== '') {
      const n = Number(c)
      if (!Number.isNaN(n)) return n
    }
  }
  return 0
}

function getStock(item) {
  const candidates = [
    item?.stock,
    item?.quantity,
    item?.Quantity,
    item?.currentStock,
    item?.initialStockCount,
    item?.Stock,
    item?.CurrentStock
  ]
  for (const c of candidates) {
    if (c !== undefined && c !== null && c !== '') {
      const n = Number(c)
      if (!Number.isNaN(n)) return n
    }
  }
  return 0
}

function getReorderLevel(item) {
  const candidates = [item?.reorderLevel, item?.ReorderLevel, item?.minimumStock, item?.MinimumStock]
  for (const c of candidates) {
    if (c !== undefined && c !== null && c !== '') {
      const n = Number(c)
      if (!Number.isNaN(n)) return n
    }
  }
  return 10
}

function getId(item) {
  return item?.backendId || item?.BackendId || item?.id || item?.Id || item?.medicineId || item?.MedicineId || item?._id || item?.uuid || item?.MedicineCode || item?.medicineCode
}

export default function PharmacistMedicines() {
  const [allMedicines, setAllMedicines] = useState([])
  const [loading, setLoading] = useState(false)
  const [assignedBranch, setAssignedBranch] = useState(() => getPharmacistAssignedBranch())
  const [branches, setBranches] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('')

  // Search & Filter state
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dosageFilter, setDosageFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // View Modal state
  const [viewingMedicine, setViewingMedicine] = useState(null)

  // Load branches
  useEffect(() => {
    function loadBranches() {
      try {
        const currentAssigned = getPharmacistAssignedBranch()
        setAssignedBranch(currentAssigned)

        // Clean Main Branch option (no prefix like "star - Main Branch")
        const mainOption = { id: '1', name: 'Main Branch' }
        const localSub = typeof readLocalSubBranches === 'function' ? readLocalSubBranches() : []

        // Filter out any entries that are just renamed main branch
        const otherBranches = localSub.filter(b => {
          const bName = String(b?.name || b?.branchName || '').trim().toLowerCase()
          return bName && !bName.includes('main branch') && bName !== 'main'
        })

        const seen = new Set(['main branch', '1'])
        const unique = [mainOption]
        for (const b of otherBranches) {
          const id = String(b?.id || b?.branchId || b?._id || '')
          const name = String(b?.name || b?.branchName || '').trim()
          const key = name.toLowerCase()
          if (name && !seen.has(key)) {
            seen.add(key)
            seen.add(id)
            unique.push({ id: id || String(unique.length + 1), name })
          }
        }

        setBranches(unique)
        setSelectedBranchId('1') // default to Main Branch!
      } catch {
        setBranches([{ id: '1', name: 'Main Branch' }])
        setSelectedBranchId('1')
      }
    }
    loadBranches()
  }, [])

  // Load medicines
  function loadMedicinesData(forceFresh = false) {
    setLoading(true)
    try {
      if (forceFresh) {
        clearLocalMedicinesCache()
        setAllMedicines([])
      } else {
        const local = readLocalMedicines()
        if (local && local.length) {
          setAllMedicines(local)
        }
      }
      listMedicines().then((res) => {
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
        setAllMedicines(list || [])
      }).catch((err) => {
        console.warn('Pharmacist loadMedicinesData error:', err?.message || err)
      }).finally(() => {
        setLoading(false)
      })
    } catch {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMedicinesData()

    function handleSync() {
      const local = readLocalMedicines()
      setAllMedicines(local || [])
    }
    window.addEventListener('pms:medicines-updated', handleSync)
    window.addEventListener('pms:stock-updated', handleSync)
    window.addEventListener('storage', handleSync)
    return () => {
      window.removeEventListener('pms:medicines-updated', handleSync)
      window.removeEventListener('pms:stock-updated', handleSync)
      window.removeEventListener('storage', handleSync)
    }
  }, [])

  // Active branch display name (clean "Main Branch" by default)
  const activeBranchName = useMemo(() => {
    if (selectedBranchId === '1') return 'Main Branch'
    const found = branches.find(b => String(b.id) === String(selectedBranchId) || String(b.name) === String(selectedBranchId))
    return found?.name || 'Main Branch'
  }, [branches, selectedBranchId])

  // Pharmacy ID of this logged-in pharmacist
  const assignedPharmacyId = useMemo(() => {
    return String(
      assignedBranch?.pharmacyId ||
      sessionStorage.getItem('workingPharmacyId') ||
      localStorage.getItem('workingPharmacyId') ||
      ''
    ).trim()
  }, [assignedBranch])

  // Filter medicines STRICTLY for the active branch and active pharmacy
  const branchMedicines = useMemo(() => {
    return allMedicines.filter((m) => {
      const mPharmId = String(m?.pharmacyId || m?.PharmacyId || '').trim()
      if (assignedPharmacyId && mPharmId && mPharmId !== assignedPharmacyId) {
        return false
      }
      return matchesMedicineBranch(m, selectedBranchId, activeBranchName, assignedPharmacyId)
    })
  }, [allMedicines, selectedBranchId, activeBranchName, assignedPharmacyId])

  // Extract dynamic categories & dosage forms for this branch
  const branchCategories = useMemo(() => {
    const set = new Set()
    branchMedicines.forEach(m => {
      const cat = getCategory(m)
      if (cat && cat !== '-') set.add(cat)
    })
    return Array.from(set).sort()
  }, [branchMedicines])

  const branchDosageForms = useMemo(() => {
    const set = new Set()
    branchMedicines.forEach(m => {
      const df = getDosageForm(m)
      if (df && df !== '-') set.add(df)
    })
    return Array.from(set).sort()
  }, [branchMedicines])

  // Summary Metrics for this branch
  const metrics = useMemo(() => {
    const total = branchMedicines.length
    const active = branchMedicines.filter(m => {
      const st = String(getStatus(m)).toLowerCase()
      return (st === 'active' || st === 'available') && getStock(m) > 0
    }).length
    const lowStock = branchMedicines.filter(m => {
      const qty = getStock(m)
      return qty > 0 && qty <= getReorderLevel(m)
    }).length
    const outStock = branchMedicines.filter(m => getStock(m) <= 0).length
    return {
      total,
      active,
      lowStock,
      outStock,
      categoriesCount: branchCategories.length
    }
  }, [branchMedicines, branchCategories])

  // Filtered list matching search query, category, dosage, status
  const filteredMedicines = useMemo(() => {
    return branchMedicines.filter((m) => {
      const nameVal = String(getName(m) || '').toLowerCase()
      const genVal = String(m?.genericName || m?.GenericName || '').toLowerCase()
      const brandVal = String(m?.brandName || m?.BrandName || '').toLowerCase()
      const codeVal = String(m?.medicineCode || m?.MedicineCode || m?.code || '').toLowerCase()
      const batchVal = String(m?.batchNumber || m?.BatchNumber || '').toLowerCase()
      const mfgVal = String(m?.manufacturer || m?.Manufacturer || '').toLowerCase()
      const q = String(query || '').toLowerCase().trim()

      const matchesSearch = !q ||
        nameVal.includes(q) ||
        genVal.includes(q) ||
        brandVal.includes(q) ||
        codeVal.includes(q) ||
        batchVal.includes(q) ||
        mfgVal.includes(q)

      const matchesCat = !categoryFilter || getCategory(m) === categoryFilter
      const matchesDosage = !dosageFilter || getDosageForm(m) === dosageFilter

      const qty = getStock(m)
      const reorder = getReorderLevel(m)
      let matchesStatus = true
      if (statusFilter === 'in stock') matchesStatus = qty > reorder
      else if (statusFilter === 'low stock') matchesStatus = qty > 0 && qty <= reorder
      else if (statusFilter === 'out of stock') matchesStatus = qty <= 0
      else if (statusFilter === 'active') matchesStatus = String(getStatus(m)).toLowerCase().includes('active') && qty > 0

      return matchesSearch && matchesCat && matchesDosage && matchesStatus
    })
  }, [branchMedicines, query, categoryFilter, dosageFilter, statusFilter])

  return (
    <PharmacistLayout activeLabel="Medicines" title="Medicines Catalogue" subtitle="Pharmacist / Medicines">
      <div className="med-layout-container" style={{ margin: 0, gap: '20px' }}>
        
        {/* Branch Context Banner */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 20px',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
          borderRadius: '12px',
          border: '1px solid #bbf7d0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(34,197,94,0.3)'
            }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/>
                <circle cx="12" cy="10" r="2.5"/>
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Branch Catalogue
                </h2>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  background: '#dcfce7',
                  color: '#166534',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid #86efac'
                }}>
                  Live Sync
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {branches.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Branch:</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #86efac',
                    background: '#ffffff',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: '#166534',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {branches.map(b => (
                    <option key={b.id || b.name} value={b.id || b.name}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={() => loadMedicinesData(true)}
              title="Refresh and sync directly with database"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Branch Summary Cards */}
        <div className="med-summary-grid">
          <div className="med-summary-card">
            <div className="med-summary-icon-container" style={{ background: '#ecfdf5', color: '#059669' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="m14.5 4.5 5 5a4.24 4.24 0 0 1-6 6l-5-5a4.24 4.24 0 0 1 6-6Z"/>
                <path d="m10 9 5 5"/>
              </svg>
            </div>
            <div className="med-summary-info">
              <label>Total Medicines</label>
              <span>{metrics.total}</span>
            </div>
          </div>

          <div className="med-summary-card">
            <div className="med-summary-icon-container" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div className="med-summary-info">
              <label>Active in Stock</label>
              <span style={{ color: '#16a34a' }}>{metrics.active}</span>
            </div>
          </div>

          <div className="med-summary-card">
            <div className="med-summary-icon-container" style={{ background: '#fffbeb', color: '#d97706' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="med-summary-info">
              <label>Low Stock</label>
              <span style={{ color: '#d97706' }}>{metrics.lowStock}</span>
            </div>
          </div>

          <div className="med-summary-card">
            <div className="med-summary-icon-container" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <div className="med-summary-info">
              <label>Out of Stock</label>
              <span style={{ color: '#dc2626' }}>{metrics.outStock}</span>
            </div>
          </div>

          <div className="med-summary-card">
            <div className="med-summary-icon-container" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="m2 17 10 5 10-5M2 12l10 5 10-5M2 7l10 5 10-5"/>
              </svg>
            </div>
            <div className="med-summary-info">
              <label>Categories</label>
              <span style={{ color: '#7c3aed' }}>{metrics.categoriesCount}</span>
            </div>
          </div>
        </div>

        {/* Toolbar & Catalogue Logs */}
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Branch Medicine Catalogue
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Showing medicines added by Admin for {activeBranchName} ({filteredMedicines.length} items)
              </p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="med-toolbar med-catalogue-filters" style={{ margin: 0, borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}>
            <div className="med-search-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by medicine name, generic name, code, brand, batch..."
              />
            </div>
            <div className="med-filters">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {branchCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={dosageFilter}
                onChange={(e) => setDosageFilter(e.target.value)}
              >
                <option value="">All Dosage Forms</option>
                {branchDosageForms.map((df) => (
                  <option key={df} value={df}>{df}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="in stock">In Stock</option>
                <option value="low stock">Low Stock</option>
                <option value="out of stock">Out of Stock</option>
              </select>

              <button
                type="button"
                className="med-btn med-btn-secondary"
                onClick={() => {
                  setQuery('')
                  setCategoryFilter('')
                  setDosageFilter('')
                  setStatusFilter('all')
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '15px', height: '15px' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Clear Filters
              </button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
              Loading branch medicines...
            </div>
          ) : (
            <div className="branch-table-wrap">
              <table className="branch-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>S.No.</th>
                    <th>Medicine Code</th>
                    <th>Medicine Name</th>
                    <th>Generic Name</th>
                    <th>Brand Name</th>
                    <th>Category</th>
                    <th>Dosage Form</th>
                    <th>Strength</th>
                    <th>Batch No.</th>
                    <th>Expiry Date</th>
                    <th>Stock</th>
                    <th>Selling Price</th>
                    <th>Status</th>
                    <th style={{ minWidth: '80px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.length ? filteredMedicines.map((medicine, index) => {
                    const medCode = medicine?.medicineCode || medicine?.MedicineCode || medicine?.code || medicine?.Code || '-'
                    const brand = medicine?.brandName || medicine?.BrandName || '-'
                    const batch = medicine?.batchNumber || medicine?.BatchNumber || '-'
                    const expDate = formatExcelDate(medicine?.expiryDate || medicine?.ExpiryDate) || '-'
                    const selling = getSellingPrice(medicine)
                    const qty = getStock(medicine)
                    const reorder = getReorderLevel(medicine)
                    const isOut = qty <= 0
                    const isLow = qty > 0 && qty <= reorder

                    return (
                      <tr key={getId(medicine) || index}>
                        <td>{index + 1}</td>
                        <td><code>{medCode}</code></td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>
                            {getName(medicine)}
                          </div>
                        </td>
                        <td>{medicine?.genericName || medicine?.GenericName || '-'}</td>
                        <td>{brand}</td>
                        <td><span className="med-category-pill">{getCategory(medicine)}</span></td>
                        <td>{getDosageForm(medicine)}</td>
                        <td>{medicine?.strength || medicine?.Strength || '-'}</td>
                        <td><code>{batch}</code></td>
                        <td>{expDate}</td>
                        <td>
                          <span style={{
                            fontWeight: 700,
                            color: isOut ? '#dc2626' : isLow ? '#d97706' : '#15803d'
                          }}>
                            {qty}
                          </span>
                        </td>
                        <td><span style={{ fontWeight: 600, color: '#16a34a' }}>₹{selling}</span></td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: isOut ? '#fee2e2' : isLow ? '#fef3c7' : '#dcfce7',
                            color: isOut ? '#991b1b' : isLow ? '#92400e' : '#166534',
                            border: `1px solid ${isOut ? '#fca5a5' : isLow ? '#fcd34d' : '#86efac'}`
                          }}>
                            {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setViewingMedicine(medicine)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#f8fafc',
                              color: '#334155',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                            title="View complete medicine specifications"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td colSpan="14" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                            <path d="m14.5 4.5 5 5a4.24 4.24 0 0 1-6 6l-5-5a4.24 4.24 0 0 1 6-6Z"/>
                            <path d="m10 9 5 5"/>
                          </svg>
                          <div style={{ fontWeight: 600, fontSize: '15px', color: '#334155' }}>
                            No medicines found for {activeBranchName}
                          </div>
                          <div style={{ fontSize: '13px' }}>
                            {query || categoryFilter || dosageFilter || statusFilter !== 'all'
                              ? 'Try adjusting your search filters.'
                              : 'Medicines added or imported in Admin for this branch will automatically appear here.'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* View Medicine Details Modal */}
      {viewingMedicine && (
        <div className="med-modal-overlay" onClick={() => setViewingMedicine(null)}>
          <div className="med-modal-card" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div className="med-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  {getName(viewingMedicine)}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Code: {viewingMedicine?.medicineCode || viewingMedicine?.MedicineCode || '-'} | Branch: {activeBranchName}
                </span>
              </div>
              <button type="button" className="med-close-btn" onClick={() => setViewingMedicine(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="med-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
              {/* Group 1 */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', marginBottom: '10px' }}>01 Basic Details</div>
                <div className="med-detail-row">
                  <div className="med-detail-item">
                    <label>Medicine Code</label>
                    <span><code>{viewingMedicine?.medicineCode || viewingMedicine?.MedicineCode || '-'}</code></span>
                  </div>
                  <div className="med-detail-item">
                    <label>Assigned Branch</label>
                    <span style={{ fontWeight: 600, color: '#166534' }}>{activeBranchName}</span>
                  </div>
                </div>
                <div className="med-detail-row" style={{ marginTop: '8px' }}>
                  <div className="med-detail-item">
                    <label>Generic Name</label>
                    <span>{viewingMedicine?.genericName || viewingMedicine?.GenericName || '-'}</span>
                  </div>
                  <div className="med-detail-item">
                    <label>Brand Name</label>
                    <span>{viewingMedicine?.brandName || viewingMedicine?.BrandName || '-'}</span>
                  </div>
                </div>
                <div className="med-detail-row" style={{ marginTop: '8px' }}>
                  <div className="med-detail-item">
                    <label>Category</label>
                    <span>{getCategory(viewingMedicine)}</span>
                  </div>
                  <div className="med-detail-item">
                    <label>Manufacturer</label>
                    <span>{viewingMedicine?.manufacturer || viewingMedicine?.Manufacturer || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Group 2 */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', marginBottom: '10px' }}>02 Dosage & Packaging</div>
                <div className="med-detail-row">
                  <div className="med-detail-item">
                    <label>Dosage Form</label>
                    <span>{getDosageForm(viewingMedicine)}</span>
                  </div>
                  <div className="med-detail-item">
                    <label>Strength</label>
                    <span>{viewingMedicine?.strength || viewingMedicine?.Strength || '-'}</span>
                  </div>
                </div>
                <div className="med-detail-row" style={{ marginTop: '8px' }}>
                  <div className="med-detail-item">
                    <label>Pack Size</label>
                    <span style={{ fontWeight: 600 }}>{viewingMedicine?.packSize || viewingMedicine?.PackSize || '-'}</span>
                  </div>
                  <div className="med-detail-item">
                    <label>Storage Location</label>
                    <span>{viewingMedicine?.storageLocation || viewingMedicine?.StorageLocation || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Group 3 */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', marginBottom: '10px' }}>03 Batch & Expiry</div>
                <div className="med-detail-row">
                  <div className="med-detail-item">
                    <label>Batch Number</label>
                    <span><code>{viewingMedicine?.batchNumber || viewingMedicine?.BatchNumber || '-'}</code></span>
                  </div>
                  <div className="med-detail-item">
                    <label>Expiry Date</label>
                    <span style={{ fontWeight: 600, color: '#dc2626' }}>{formatExcelDate(viewingMedicine?.expiryDate || viewingMedicine?.ExpiryDate) || '-'}</span>
                  </div>
                </div>
                <div className="med-detail-row" style={{ marginTop: '8px' }}>
                  <div className="med-detail-item">
                    <label>Mfg Date</label>
                    <span>{formatExcelDate(viewingMedicine?.manufactureDate || viewingMedicine?.ManufactureDate) || '-'}</span>
                  </div>
                  <div className="med-detail-item">
                    <label>Supplier Name</label>
                    <span>{viewingMedicine?.supplierName || viewingMedicine?.SupplierName || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Group 4 */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', marginBottom: '10px' }}>04 Inventory & Pricing</div>
                <div className="med-detail-row">
                  <div className="med-detail-item">
                    <label>Current Stock</label>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: getStock(viewingMedicine) <= getReorderLevel(viewingMedicine) ? '#d97706' : '#15803d' }}>
                      {getStock(viewingMedicine)}
                    </span>
                  </div>
                  <div className="med-detail-item">
                    <label>Selling Price</label>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: '#16a34a' }}>
                      ₹{getSellingPrice(viewingMedicine)}
                    </span>
                  </div>
                </div>
                <div className="med-detail-row" style={{ marginTop: '8px' }}>
                  <div className="med-detail-item">
                    <label>Minimum Stock</label>
                    <span>{viewingMedicine?.minimumStock ?? viewingMedicine?.minStock ?? '-'}</span>
                  </div>
                  <div className="med-detail-item">
                    <label>Reorder Level</label>
                    <span>{getReorderLevel(viewingMedicine)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="med-modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="med-btn med-btn-secondary"
                onClick={() => setViewingMedicine(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PharmacistLayout>
  )
}
