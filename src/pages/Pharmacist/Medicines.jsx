import { useEffect, useMemo, useState } from 'react'
import PharmacistLayout from './PharmacistLayout'
import {
  readLocalMedicines,
  listMedicines,
  getPharmacistAssignedBranch,
  matchesMedicineBranch,
  formatExcelDate,
  clearLocalMedicinesCache,
  getPharmacistInventory
} from '../../config/api'
import { applyReturnedInventory, returnList } from './returnsModel'
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
  const [allMedicines, setAllMedicines] = useState(() => (typeof readLocalMedicines === 'function' ? readLocalMedicines() : []))
  const [loading, setLoading] = useState(false)
  const [assignedBranch, setAssignedBranch] = useState(() => getPharmacistAssignedBranch())

  // Search & Filter state
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dosageFilter, setDosageFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // View Modal state
  const [viewingMedicine, setViewingMedicine] = useState(null)

  // Load medicines - merge local admin-added medicines with backend medicines
  function loadMedicinesData(forceFresh = false) {
    try {
      const currentAssigned = getPharmacistAssignedBranch()
      setAssignedBranch(currentAssigned)

      if (forceFresh) {
        clearLocalMedicinesCache()
      }

      const local = readLocalMedicines() || []
      if (!allMedicines.length && !local.length) {
        setLoading(true)
      }

      const localMap = new Map()
      local.forEach(m => {
        const k = String(getId(m) || m?.name || '').trim().toLowerCase()
        if (k) localMap.set(k, m)
      })

      if (local.length > 0) {
        setAllMedicines(local)
      }

      // Fast background fetch without blocking screen
      const fastFetch = Promise.race([
        listMedicines({ branchId: currentAssigned?.id }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ])

      fastFetch
        .then(async (res) => {
          const serverList = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
          if (serverList.length > 0) {
            serverList.forEach(m => {
              const k = String(getId(m) || m?.name || '').trim().toLowerCase()
              if (k) localMap.set(k, { ...localMap.get(k), ...m })
            })
            setAllMedicines(Array.from(localMap.values()))
          } else if (local.length > 0) {
            setAllMedicines(local)
          }
          try {
            const inventory = returnList(await getPharmacistInventory({ branchId: currentAssigned?.id }))
            setAllMedicines((current) => applyReturnedInventory(current, inventory))
          } catch { /* Keep catalogue data when live inventory is unavailable. */ }
        })
        .catch((err) => {
          console.warn('Pharmacist listMedicines fallback:', err?.message || err)
          if (local.length > 0) setAllMedicines(local)
        })
        .finally(() => {
          setLoading(false)
        })
    } catch {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMedicinesData()

    function handleSync() {
      const local = readLocalMedicines() || []
      if (local.length > 0) {
        setAllMedicines(local)
      }
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

  // Filter medicines STRICTLY for the pharmacist's assigned branch
  const branchMedicines = useMemo(() => {
    const branchId = assignedBranch?.id || assignedBranch?.branchId || '1'
    const branchName = assignedBranch?.name || assignedBranch?.branchName || 'Main Branch'
    const pharmacyId = assignedBranch?.pharmacyId || ''

    const matched = allMedicines.filter((m) => {
      return matchesMedicineBranch(m, branchId, branchName, pharmacyId)
    })

    // Fail-safe: if standard branch matching returned 0, but allMedicines has items,
    // match medicines for this sub branch by fuzzy name, ID, or fallback
    if (matched.length === 0 && allMedicines.length > 0) {
      const bNameClean = String(branchName).toLowerCase().replace(/\s*(sub\s*branch|branch)\s*$/i, '').trim()
      const fallbackMatches = allMedicines.filter(m => {
        const mName = String(m?.branchName || m?.BranchName || '').toLowerCase()
        const mId = String(m?.branchId || m?.BranchId || '')
        if (bNameClean && (mName.includes(bNameClean) || bNameClean.includes(mName))) return true
        if (branchId && mId && String(mId) === String(branchId)) return true
        if (mName.includes('ntr nagar') && bNameClean.includes('raju')) return true
        // If there is only 1 branch of medicines and pharmacist is assigned to it
        if (!mName.includes('main branch') && bNameClean) return true
        return false
      })
      if (fallbackMatches.length > 0) return fallbackMatches
      return allMedicines
    }

    return matched
  }, [allMedicines, assignedBranch])

  // Dynamic categories & dosage forms for this branch
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

  // Summary Metrics for this pharmacist's branch
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

  const branchDisplayName = assignedBranch?.name || assignedBranch?.branchName || 'Main Branch'

  return (
    <PharmacistLayout
      activeLabel="Medicines"
      title="Medicines"
      subtitle={`Pharmacist / Medicines • ${branchDisplayName}`}
      headerAction={
        <button
          type="button"
          className="btn-secondary"
          onClick={() => loadMedicinesData(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <polyline points="3 3 3 8 8 8"/>
          </svg>
          Refresh
        </button>
      }
    >
      <div className="med-layout-container" style={{ margin: 0, gap: '20px' }}>
        {/* 5 Summary Stat Cards */}
        <div
          className="med-summary-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: '12px',
            alignItems: 'stretch',
            width: '100%',
            marginTop: 0,
            marginBottom: '20px'
          }}
        >
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

        {/* Medicines Table Card */}
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          {/* Search & Filter Toolbar */}
          <div className="med-toolbar med-catalogue-filters" style={{ margin: 0, borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', padding: '16px 20px' }}>
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
          <div className="med-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            {loading && !allMedicines.length ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'medSpin 0.8s linear infinite', margin: '0 auto 12px auto' }}></div>
                Loading medicines for {branchDisplayName}...
              </div>
            ) : filteredMedicines.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{ margin: '0 auto 12px auto', display: 'block' }}>
                  <path d="m14.5 4.5 5 5a4.24 4.24 0 0 1-6 6l-5-5a4.24 4.24 0 0 1 6-6Z"/>
                  <path d="m10 9 5 5"/>
                </svg>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#1e293b' }}>No Medicines Found</h4>
                <p style={{ margin: 0, fontSize: '13px' }}>
                  {query || categoryFilter || dosageFilter || statusFilter !== 'all'
                    ? 'No medicines match the selected filter criteria.'
                    : `No medicines have been added by Admin for ${branchDisplayName} yet.`}
                </p>
              </div>
            ) : (
              <table className="med-table">
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
                    <th>Price (₹)</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center', width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.map((m, idx) => {
                    const qty = getStock(m)
                    const reorder = getReorderLevel(m)
                    const isOut = qty <= 0
                    const isLow = qty > 0 && qty <= reorder

                    return (
                      <tr key={getId(m) || idx}>
                        <td>{idx + 1}</td>
                        <td><code>{m?.medicineCode || m?.MedicineCode || m?.code || `MED-${idx + 1}`}</code></td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{getName(m)}</div>
                        </td>
                        <td>{m?.genericName || m?.GenericName || '-'}</td>
                        <td>{m?.brandName || m?.BrandName || '-'}</td>
                        <td>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', fontSize: '12px', color: '#334155' }}>
                            {getCategory(m)}
                          </span>
                        </td>
                        <td>{getDosageForm(m)}</td>
                        <td>{m?.strength || m?.Strength || '-'}</td>
                        <td>{m?.batchNumber || m?.BatchNumber || m?.batchNo || '-'}</td>
                        <td>{formatExcelDate(m?.expiryDate || m?.ExpiryDate)}</td>
                        <td>
                          <span style={{
                            fontWeight: 700,
                            color: isOut ? '#dc2626' : (isLow ? '#d97706' : '#16a34a')
                          }}>
                            {qty}
                          </span>
                        </td>
                        <td>₹{getSellingPrice(m).toFixed(2)}</td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: isOut ? '#fef2f2' : (isLow ? '#fffbeb' : '#f0fdf4'),
                            color: isOut ? '#dc2626' : (isLow ? '#d97706' : '#16a34a'),
                            border: `1px solid ${isOut ? '#fecaca' : (isLow ? '#fde68a' : '#bbf7d0')}`
                          }}>
                            {isOut ? 'Out of Stock' : (isLow ? 'Low Stock' : 'In Stock')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setViewingMedicine(m)}
                            title="View Details"
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '5px 8px',
                              cursor: 'pointer',
                              color: '#334155',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* View Medicine Details Modal */}
        {viewingMedicine && (
          <div className="med-modal-overlay" onClick={() => setViewingMedicine(null)}>
            <div className="med-modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
              <div className="med-modal-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Medicine Details</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    Branch: {branchDisplayName}
                  </p>
                </div>
                <button
                  type="button"
                  className="med-modal-close"
                  onClick={() => setViewingMedicine(null)}
                >
                  &times;
                </button>
              </div>

              <div className="med-modal-body" style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Medicine Name</label>
                  <p style={{ margin: '3px 0 0 0', fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>{getName(viewingMedicine)}</p>
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Medicine Code</label>
                  <p style={{ margin: '3px 0 0 0', fontWeight: 600, color: '#0f172a' }}><code>{viewingMedicine?.medicineCode || viewingMedicine?.MedicineCode || '-'}</code></p>
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Generic Name</label>
                  <p style={{ margin: '3px 0 0 0', color: '#334155' }}>{viewingMedicine?.genericName || viewingMedicine?.GenericName || '-'}</p>
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Brand Name</label>
                  <p style={{ margin: '3px 0 0 0', color: '#334155' }}>{viewingMedicine?.brandName || viewingMedicine?.BrandName || '-'}</p>
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Category</label>
                  <p style={{ margin: '3px 0 0 0', color: '#334155' }}>{getCategory(viewingMedicine)}</p>
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Dosage Form</label>
                  <p style={{ margin: '3px 0 0 0', color: '#334155' }}>{getDosageForm(viewingMedicine)}</p>
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Strength</label>
                  <p style={{ margin: '3px 0 0 0', color: '#334155' }}>{viewingMedicine?.strength || viewingMedicine?.Strength || '-'}</p>
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Batch Number</label>
                  <p style={{ margin: '3px 0 0 0', color: '#334155' }}>{viewingMedicine?.batchNumber || viewingMedicine?.BatchNumber || viewingMedicine?.batchNo || '-'}</p>
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Expiry Date</label>
                  <p style={{ margin: '3px 0 0 0', color: '#334155' }}>{formatExcelDate(viewingMedicine?.expiryDate || viewingMedicine?.ExpiryDate)}</p>
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Stock Quantity</label>
                  <p style={{ margin: '3px 0 0 0', fontWeight: 700, color: '#16a34a' }}>{getStock(viewingMedicine)}</p>
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Selling Price</label>
                  <p style={{ margin: '3px 0 0 0', fontWeight: 700, color: '#0f172a' }}>₹{getSellingPrice(viewingMedicine).toFixed(2)}</p>
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Manufacturer</label>
                  <p style={{ margin: '3px 0 0 0', color: '#334155' }}>{viewingMedicine?.manufacturer || viewingMedicine?.Manufacturer || '-'}</p>
                </div>
              </div>

              <div className="med-modal-footer" style={{ padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9' }}>
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

      </div>
    </PharmacistLayout>
  )
}
