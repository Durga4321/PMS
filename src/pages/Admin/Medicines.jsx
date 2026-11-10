import { confirmAction } from '../../components/confirmAction'
import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { useToast } from '../../components/ToastProvider'
import MedicineSuccessAnimation from '../../components/MedicineSuccessAnimation'
import RowActions from '../../components/RowActions'
import AdminLayout from './AdminLayout'
import {
  createMedicine,
  deleteMedicine,
  syncDeletedMedicinesWithBackend,
  uploadMedicineImport,
  getMedicineImportHistory,
  listPharmacyBranches,
  listMedicineCategories,
  listMedicineDosageForms,
  listMedicineStrengths,
  listMedicines,
  searchMedicines,
  updateMedicine,
    getPharmacyAdminDashboard,
  normalizeMedicineRecord,
  writeLocalMedicines,
  readLocalMedicines,
  saveMedicineToCache,
  formatExcelDate,
  readLocalSubBranches,
  matchesMedicineBranch,
  clearLocalMedicinesCache
} from '../../config/api'
import './Medicines.css'

function readStoredValue(key) {
  const value = sessionStorage.getItem(key) || localStorage.getItem(key)
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

// Exactly the 22 Excel fields
const emptyForm = {
  medicineCode: '',
  name: '',
  genericName: '',
  brandName: '',
  category: '',
  dosageForm: '',
  strength: '',
  manufacturer: '',
  packSize: '',
  supplierCode: '',
  supplierName: '',
  contactPerson: '',
  phone: '',
  email: '',
  batchNumber: '',
  manufactureDate: '',
  expiryDate: '',
  quantity: '',
  purchasePrice: '',
  sellingPrice: '',
  gst: '',
  minimumStock: '',
  maximumStock: '',
  reorderLevel: '',
  storageLocation: '',
  lastPurchase: '',
  branchId: '',
  branchName: ''
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
  return item?.backendId || item?.BackendId || item?.id || item?.Id || item?.medicineId || item?.MedicineId || item?._id || item?.uuid || item?.MedicineCode || item?.medicineCode
}

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
    item?.unitPrice,
    item?.UnitPrice,
  ]
  for (const val of candidates) {
    const num = Number(val)
    if (val !== undefined && val !== null && val !== '' && !isNaN(num) && num > 0) {
      return num
    }
  }
  return 0
}

function getStock(item) {
  const candidates = [
    item?.quantity,
    item?.Quantity,
    item?.stock,
    item?.Stock,
    item?.stockQuantity,
    item?.StockQuantity,
    item?.initialStockCount,
    item?.InitialStockCount,
    item?.currentStock,
    item?.CurrentStock,
    item?.totalStock,
    item?.TotalStock,
    item?.availableStock,
    item?.AvailableStock,
    item?.qty,
  ]
  for (const val of candidates) {
    const num = Number(val)
    if (val !== undefined && val !== null && val !== '' && !isNaN(num) && num >= 0) {
      return num
    }
  }
  return 0
}

function getReorderLevel(item) {
  const val = item?.reorderLevel ?? item?.ReorderLevel ?? item?.reorderStockLevel ?? item?.ReorderStockLevel ?? item?.minStock ?? item?.minimumStock ?? item?.MinimumStock
  const num = Number(val)
  return !isNaN(num) && num >= 0 ? num : 0
}

function valueFrom(row, keys, fallback = '') {
  for (const key of keys) {
    const value = row?.[key] ?? row?.[key.toLowerCase()] ?? row?.[key.toUpperCase()]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return fallback
}

function normalizeImportMedicine(row, index) {
  const name = String(valueFrom(row, ['Name', 'name', 'MedicineName', 'Medicine Name', 'medicineName'])).trim()
  const medicineCode = String(valueFrom(row, ['MedicineCode', 'medicineCode', 'Medicine Code', 'Code', 'code', 'SKU'])).trim() || `MED${String(index + 1).padStart(4, '0')}`
  const genericName = String(valueFrom(row, ['GenericName', 'genericName', 'Generic Name'], name)).trim() || name
  const brandName = String(valueFrom(row, ['BrandName', 'brandName', 'Brand Name'])).trim()
  const category = String(valueFrom(row, ['Category', 'category'])).trim() || 'General'
  const dosageForm = String(valueFrom(row, ['DosageForm', 'dosageForm', 'Dosage Form', 'Form', 'form'])).trim() || 'Tablet'
  const strength = String(valueFrom(row, ['Strength', 'strength'])).trim()
  const manufacturer = String(valueFrom(row, ['Manufacturer', 'manufacturer'])).trim()
  const packSize = String(valueFrom(row, ['PackSize', 'packSize', 'Pack Size'])).trim()
  const supplierCode = String(valueFrom(row, ['SupplierCode', 'supplierCode', 'Supplier Code'])).trim()
  const supplierName = String(valueFrom(row, ['SupplierName', 'supplierName', 'Supplier Name'])).trim()
  const contactPerson = String(valueFrom(row, ['ContactPerson', 'contactPerson', 'Contact Person', 'contact_person', 'contact'])).trim()
  const phone = String(valueFrom(row, ['Phone', 'phone', 'PhoneNumber', 'phoneNumber', 'Mobile', 'mobile', 'ContactNo', 'contactNo'])).trim()
  const email = String(valueFrom(row, ['Email', 'email', 'EmailAddress', 'emailAddress'])).trim()
  const lastPurchase = formatExcelDate(valueFrom(row, ['LastPurchase', 'lastPurchase', 'Last Purchase', 'last_purchase', 'LastPurchaseDate', 'lastPurchaseDate', 'Last Purchased', 'lastPurchased']))
  const batchNumber = String(valueFrom(row, ['BatchNumber', 'batchNumber', 'Batch Number', 'BatchNo', 'Batch No'])).trim()
  const manufactureDate = formatExcelDate(valueFrom(row, ['ManufactureDate', 'manufactureDate', 'Manufacture Date', 'MfgDate', 'Mfg Date']))
  const expiryDate = formatExcelDate(valueFrom(row, ['ExpiryDate', 'expiryDate', 'Expiry Date']))
  const quantity = Number(valueFrom(row, ['Quantity', 'quantity', 'Stock', 'stock', 'InitialStockCount', 'Initial Stock Count'], 0)) || 0
  const purchasePrice = Number(valueFrom(row, ['PurchasePrice', 'purchasePrice', 'Purchase Price', 'Cost', 'CostPrice'], 0)) || 0
  const sellingPrice = Number(valueFrom(row, ['SellingPrice', 'sellingPrice', 'Selling Price', 'Price', 'price', 'MRP', 'mrp'], 1)) || 1
  const gst = Number(valueFrom(row, ['GST', 'gst', 'Gst', 'Tax'], 0)) || 0
  const minimumStock = Number(valueFrom(row, ['MinimumStock', 'minimumStock', 'Minimum Stock', 'MinStock', 'minStock', 'MinimumStockThreshold'], 0)) || 0
  const maximumStock = Number(valueFrom(row, ['MaximumStock', 'maximumStock', 'Maximum Stock', 'MaxStock', 'maxStock'], 0)) || 0
  const reorderLevel = Number(valueFrom(row, ['ReorderLevel', 'reorderLevel', 'Reorder Level', 'ReorderStockLevel'], 0)) || 0
  const storageLocation = String(valueFrom(row, ['StorageLocation', 'storageLocation', 'Storage Location', 'Location', 'location'])).trim()

  return {
    rowNumber: index + 1,
    MedicineCode: medicineCode,
    medicineCode,
    code: medicineCode,
    Name: name,
    name,
    medicineName: name,
    GenericName: genericName,
    genericName,
    BrandName: brandName,
    brandName,
    Category: category,
    category,
    DosageForm: dosageForm,
    dosageForm,
    Strength: strength,
    strength,
    Manufacturer: manufacturer,
    manufacturer,
    PackSize: packSize,
    packSize,
    SupplierCode: supplierCode,
    supplierCode,
    SupplierName: supplierName,
    supplierName,
    ContactPerson: contactPerson,
    contactPerson,
    Phone: phone,
    phone,
    Email: email,
    email,
    LastPurchase: lastPurchase,
    lastPurchase,
    BatchNumber: batchNumber,
    batchNumber,
    ManufactureDate: manufactureDate,
    manufactureDate,
    ExpiryDate: expiryDate,
    expiryDate,
    Quantity: quantity,
    quantity,
    stock: quantity,
    initialStockCount: quantity,
    currentStock: quantity,
    PurchasePrice: purchasePrice,
    purchasePrice,
    SellingPrice: sellingPrice,
    sellingPrice,
    price: sellingPrice,
    mrp: sellingPrice,
    GST: gst,
    gst,
    MinimumStock: minimumStock,
    minimumStock,
    minStock: minimumStock,
    MaximumStock: maximumStock,
    maximumStock,
    maxStock: maximumStock,
    ReorderLevel: reorderLevel,
    reorderLevel,
    StorageLocation: storageLocation,
    storageLocation,
    status: 'Active',
    catalogueStatus: 'Active',
    isActive: true,
    isAvailable: true
  }
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
  const [strengths, setStrengths] = useState([])

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [dosageForm, setDosageForm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(() => {
    try {
      const existing = readLocalMedicines()
      return !(Array.isArray(existing) && existing.length > 0)
    } catch {
      return false
    }
  })
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)

  // Modals state
  const [formOpen, setFormOpen] = useState(false)
  const [viewingItem, setViewingItem] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importPercent, setImportPercent] = useState(0)
  const [showSuccessAnim, setShowSuccessAnim] = useState(false)

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

    const priceStr = String(form.sellingPrice ?? '').trim()
    if (!priceStr) {
      errs.sellingPrice = 'Selling Price is required.'
    } else {
      const priceNum = Number(priceStr)
      if (isNaN(priceNum) || priceNum <= 0) {
        errs.sellingPrice = 'Selling Price must be greater than 0.'
      }
    }

    const qtyStr = String(form.quantity ?? '').trim()
    if (qtyStr) {
      const qtyNum = Number(qtyStr)
      if (isNaN(qtyNum) || qtyNum < 0 || !Number.isInteger(qtyNum)) {
        errs.quantity = 'Quantity must be a whole number (0 or greater).'
      }
    }

    const minStr = String(form.minimumStock ?? '').trim()
    if (minStr) {
      const minNum = Number(minStr)
      if (isNaN(minNum) || minNum < 0 || !Number.isInteger(minNum)) {
        errs.minimumStock = 'Minimum stock must be a whole number (0 or greater).'
      }
    }

    const maxStr = String(form.maximumStock ?? '').trim()
    if (maxStr) {
      const maxNum = Number(maxStr)
      if (isNaN(maxNum) || maxNum < 0 || !Number.isInteger(maxNum)) {
        errs.maximumStock = 'Maximum stock must be a whole number (0 or greater).'
      }
    }

    const reorderStr = String(form.reorderLevel ?? '').trim()
    if (reorderStr) {
      const reorderNum = Number(reorderStr)
      if (isNaN(reorderNum) || reorderNum < 0 || !Number.isInteger(reorderNum)) {
        errs.reorderLevel = 'Reorder level must be a whole number (0 or greater).'
      }
    }

    const purchaseStr = String(form.purchasePrice ?? '').trim()
    if (purchaseStr) {
      const purchaseNum = Number(purchaseStr)
      if (isNaN(purchaseNum) || purchaseNum < 0) {
        errs.purchasePrice = 'Purchase Price must be 0 or greater.'
      }
    }

    const gstStr = String(form.gst ?? '').trim()
    if (gstStr) {
      const gstNum = Number(gstStr)
      if (isNaN(gstNum) || gstNum < 0 || gstNum > 100) {
        errs.gst = 'GST % must be between 0 and 100.'
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

  // Branch filter state
  const [branchFilter, setBranchFilter] = useState('all')

  // Import state
  const [importFile, setImportFile] = useState(null)
  const [importBranchId, setImportBranchId] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [branchOptions, setBranchOptions] = useState([])
  const [importStats, setImportStats] = useState(null)
  const [importErrors, setImportErrors] = useState(null)
  const [importRows, setImportRows] = useState([])
  const [fallbackImportRows, setFallbackImportRows] = useState([])
  const [importProgress, setImportProgress] = useState(null)

  // Metrics summary

  useEffect(() => {
    async function loadBranchesForImport() {
      try {
        const res = await listPharmacyBranches()
        const bList = Array.isArray(res?.data) ? res.data : Array.isArray(res?.branches) ? res.branches : []
        const localSub = typeof readLocalSubBranches === 'function' ? readLocalSubBranches() : []
        const otherBranches = [...bList, ...localSub].filter(b => {
          const bName = String(b?.name || b?.branchName || '').trim().toLowerCase()
          return bName && !bName.includes('main branch') && bName !== 'main'
        })

        const seen = new Set(['main branch', '1'])
        const unique = [{ id: '1', name: 'Main Branch' }]
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
        setBranchOptions(unique)
        setImportBranchId('1')
      } catch {
        setBranchOptions([{ id: '1', name: 'Main Branch' }])
        setImportBranchId('1')
      }
    }
    loadBranchesForImport()
  }, [])

  const [metrics, setMetrics] = useState({
    total: 0,
    active: 0,
    lowStock: 0,
    outStock: 0,
    categoriesCount: 0
  })

  async function loadSummaryMetrics() {
    try {
      const activePharmacyId = String(sessionStorage.getItem('workingPharmacyId') || localStorage.getItem('workingPharmacyId') || '')
      const assignment = readStoredValue('pharmacyAdminAssignment') || {}
      const user = readStoredValue('pharmacyAdminUser') || {}
      const isAssigned = Boolean(assignment?.isPharmacyAssigned || user?.isPharmacyAssigned || activePharmacyId)
      if (!isAssigned) {
        setMetrics({ total: 0, active: 0, lowStock: 0, outStock: 0, categoriesCount: 0 })
        return
      }

      const response = await getPharmacyAdminDashboard()
      const data = response?.data?.dashboard || response?.data || response || {}
      const total = Number(data?.totalMedicines ?? data?.medicinesCount ?? 0)
      const active = Number(data?.activeMedicines ?? data?.activeMedicinesCount ?? 0)
      const lowStock = Number(data?.lowStockMedicines ?? data?.lowStockCount ?? 0)
      const outStock = Number(data?.outOfStockMedicines ?? data?.outOfStockCount ?? 0)
      const categoriesCount = Number(data?.totalCategories ?? data?.categoriesCount ?? 0)
      setMetrics({
        total: !isNaN(total) ? total : 0,
        active: !isNaN(active) ? active : 0,
        lowStock: !isNaN(lowStock) ? lowStock : 0,
        outStock: !isNaN(outStock) ? outStock : 0,
        categoriesCount: !isNaN(categoriesCount) ? categoriesCount : 0
      })
    } catch (e) {
      console.log('Unable to load Medicines metrics:', e.message)
    }
  }

  const branchFilteredMedicines = useMemo(() => {
    if (!branchFilter || branchFilter === 'all') return medicines
    const targetBranch = branchOptions.find((b) => String(b.id) === String(branchFilter) || String(b.name) === String(branchFilter))
    const targetName = targetBranch?.name || branchFilter
    return medicines.filter((m) => matchesMedicineBranch(m, branchFilter, targetName))
  }, [medicines, branchFilter, branchOptions])

  const computedMetrics = useMemo(() => {
    if (branchFilteredMedicines.length > 0) {
      const uniqueCategories = new Set(
        branchFilteredMedicines.map((m) => getCategory(m)).filter((c) => c && c !== '-')
      )
      return {
        total: branchFilteredMedicines.length,
        active: branchFilteredMedicines.filter((m) => {
          const st = String(getStatus(m)).toLowerCase()
          return (st === 'active' || st === 'available') && getStock(m) > 0
        }).length,
        lowStock: branchFilteredMedicines.filter((m) => {
          const qty = getStock(m)
          return qty > 0 && qty <= getReorderLevel(m)
        }).length,
        outStock: branchFilteredMedicines.filter((m) => getStock(m) <= 0).length,
        categoriesCount: uniqueCategories.size || categories.length,
      }
    }
    if (!medicines.length) {
      return {
        total: 0,
        active: 0,
        lowStock: 0,
        outStock: 0,
        categoriesCount: 0,
      }
    }
    if (branchFilter && branchFilter !== 'all') {
      return {
        total: 0,
        active: 0,
        lowStock: 0,
        outStock: 0,
        categoriesCount: 0,
      }
    }
    return {
      total: metrics.total,
      active: metrics.active,
      lowStock: metrics.lowStock,
      outStock: metrics.outStock,
      categoriesCount: categories.length || metrics.categoriesCount,
    }
  }, [branchFilteredMedicines, medicines.length, branchFilter, categories, metrics])

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

  async function loadMedicines(forceFresh = false) {
    setLoading(true)
    try {
      const activePharmacyId = String(sessionStorage.getItem('workingPharmacyId') || localStorage.getItem('workingPharmacyId') || '')
      const assignment = readStoredValue('pharmacyAdminAssignment') || {}
      const user = readStoredValue('pharmacyAdminUser') || {}
      const isAssigned = Boolean(assignment?.isPharmacyAssigned || user?.isPharmacyAssigned || activePharmacyId)
      if (!isAssigned) {
        setMedicines([])
        setMetrics({ total: 0, active: 0, lowStock: 0, outStock: 0, categoriesCount: 0 })
        setLoading(false)
        return
      }

      if (forceFresh) {
        clearLocalMedicinesCache()
        setMedicines([])
      }
      // Sync any medicines deleted in the frontend with the backend database
      try {
        await syncDeletedMedicinesWithBackend()
      } catch {}

      const params = { search: query, q: query, category, dosageForm }
      const response = query ? await searchMedicines(params) : await listMedicines(params)
      const list = normalizeList(response)
      writeLocalMedicines(list)
      setMedicines(list)
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const activePharmacyId = String(sessionStorage.getItem('workingPharmacyId') || localStorage.getItem('workingPharmacyId') || '')
    const assignment = readStoredValue('pharmacyAdminAssignment') || {}
    const user = readStoredValue('pharmacyAdminUser') || {}
    const isAssigned = Boolean(assignment?.isPharmacyAssigned || user?.isPharmacyAssigned || activePharmacyId)

    if (isAssigned) {
      // Initial pass: heal any existing medicines in local storage that have missing batch, mfg date, or supplier, or unassigned branch
      const existing = readLocalMedicines()
      if (existing && existing.length > 0) {
        let updatedAny = false
        const healed = existing.map((m) => {
          const norm = normalizeMedicineRecord(m)
          if (!norm.branchName && !norm.branchId) {
            norm.branchId = '1'
            norm.branchName = 'Main Branch'
            updatedAny = true
          }
          return norm
        })
        if (updatedAny) {
          writeLocalMedicines(healed)
        }
        setMedicines(healed)
      }
      loadLookups()
      loadMedicines()
      loadSummaryMetrics()
    } else {
      setMedicines([])
      setMetrics({ total: 0, active: 0, lowStock: 0, outStock: 0, categoriesCount: 0 })
      setLoading(false)
    }

    function handleStockSync() {
      const fresh = readLocalMedicines()
      setMedicines(fresh || [])
      loadSummaryMetrics()
    }
    window.addEventListener('pms:medicines-updated', handleStockSync)
    window.addEventListener('pms:stock-updated', handleStockSync)
    window.addEventListener('storage', handleStockSync)
    return () => {
      window.removeEventListener('pms:medicines-updated', handleStockSync)
      window.removeEventListener('pms:stock-updated', handleStockSync)
      window.removeEventListener('storage', handleStockSync)
    }
  }, [])

  // Filtered local medicines list matching query across relevant Excel fields
  const filteredMedicines = useMemo(() => {
    return branchFilteredMedicines.filter((medicine) => {
      const nameVal = String(getName(medicine) || '').toLowerCase()
      const genVal = String(medicine?.genericName || medicine?.GenericName || '').toLowerCase()
      const brandVal = String(medicine?.brandName || medicine?.BrandName || '').toLowerCase()
      const codeVal = String(medicine?.medicineCode || medicine?.MedicineCode || medicine?.code || '').toLowerCase()
      const batchVal = String(medicine?.batchNumber || medicine?.BatchNumber || '').toLowerCase()
      const mfgVal = String(medicine?.manufacturer || medicine?.Manufacturer || '').toLowerCase()
      const supVal = String(medicine?.supplierName || medicine?.SupplierName || '').toLowerCase()
      const searchVal = String(query || '').toLowerCase()

      const matchesSearch = !searchVal ||
        nameVal.includes(searchVal) ||
        genVal.includes(searchVal) ||
        brandVal.includes(searchVal) ||
        codeVal.includes(searchVal) ||
        batchVal.includes(searchVal) ||
        mfgVal.includes(searchVal) ||
        supVal.includes(searchVal)

      const matchesCategory = !category || getCategory(medicine) === category
      const matchesDosage = !dosageForm || getDosageForm(medicine) === dosageForm

      const itemStatus = String(getStatus(medicine) || '').toLowerCase()
      const qty = getStock(medicine)
      const reorder = getReorderLevel(medicine)
      const filterVal = String(statusFilter || 'all').toLowerCase()
      let matchesStatus = statusFilter === 'all'
      if (!matchesStatus) {
        if (filterVal === 'out of stock') matchesStatus = qty <= 0
        else if (filterVal === 'low stock') matchesStatus = qty > 0 && qty <= reorder
        else if (filterVal === 'inactive') matchesStatus = itemStatus.includes('inactive')
        else if (filterVal === 'active') matchesStatus = !itemStatus.includes('inactive') && qty > 0
        else matchesStatus = itemStatus.includes(filterVal)
      }

      return matchesSearch && matchesCategory && matchesDosage && matchesStatus
    })
  }, [category, dosageForm, branchFilteredMedicines, query, statusFilter])

  function openCreate() {
    setEditing(null)
    const defaultBranch = branchFilter !== 'all' ? branchFilter : (branchOptions[0]?.id || '1')
    const defaultBranchObj = branchOptions.find(b => String(b.id) === String(defaultBranch))
    setForm({
      ...emptyForm,
      branchId: defaultBranch,
      branchName: defaultBranchObj?.name || (defaultBranch === '2' ? 'NTR Nagar Branch' : 'Main Branch')
    })
    setFormErrors({})
    setFormOpen(true)
  }

  function openEdit(medicine) {
    setEditing(medicine)
    setFormErrors({})
    const priceVal = getSellingPrice(medicine)
    const qtyVal = getStock(medicine)
    setForm({
      medicineCode: medicine?.medicineCode || medicine?.MedicineCode || medicine?.code || medicine?.Code || '',
      name: getName(medicine),
      genericName: medicine?.genericName || medicine?.GenericName || '',
      brandName: medicine?.brandName || medicine?.BrandName || '',
      category: getCategory(medicine) === '-' ? '' : getCategory(medicine),
      dosageForm: getDosageForm(medicine) === '-' ? '' : getDosageForm(medicine),
      strength: medicine?.strength || medicine?.Strength || '',
      manufacturer: medicine?.manufacturer || medicine?.Manufacturer || '',
      packSize: medicine?.packSize || medicine?.PackSize || '',
      supplierCode: medicine?.supplierCode || medicine?.SupplierCode || '',
      supplierName: medicine?.supplierName || medicine?.SupplierName || '',
      contactPerson: medicine?.contactPerson || medicine?.ContactPerson || '',
      phone: medicine?.phone || medicine?.Phone || '',
      email: medicine?.email || medicine?.Email || '',
      batchNumber: medicine?.batchNumber || medicine?.BatchNumber || '',
      manufactureDate: formatExcelDate(medicine?.manufactureDate || medicine?.ManufactureDate),
      expiryDate: formatExcelDate(medicine?.expiryDate || medicine?.ExpiryDate),
      quantity: String(qtyVal),
      purchasePrice: medicine?.purchasePrice !== undefined && medicine?.purchasePrice !== null ? String(medicine.purchasePrice) : (medicine?.PurchasePrice !== undefined ? String(medicine.PurchasePrice) : ''),
      sellingPrice: priceVal > 0 ? String(priceVal) : '',
      gst: medicine?.gst !== undefined && medicine?.gst !== null ? String(medicine.gst) : (medicine?.GST !== undefined ? String(medicine.GST) : ''),
      minimumStock: medicine?.minimumStock !== undefined && medicine?.minimumStock !== null ? String(medicine.minimumStock) : (medicine?.minStock !== undefined ? String(medicine.minStock) : ''),
      maximumStock: medicine?.maximumStock !== undefined && medicine?.maximumStock !== null ? String(medicine.maximumStock) : (medicine?.maxStock !== undefined ? String(medicine.maxStock) : ''),
      reorderLevel: medicine?.reorderLevel !== undefined && medicine?.reorderLevel !== null ? String(medicine.reorderLevel) : (medicine?.ReorderLevel !== undefined ? String(medicine.ReorderLevel) : ''),
      storageLocation: medicine?.storageLocation || medicine?.StorageLocation || '',
      lastPurchase: formatExcelDate(medicine?.lastPurchase || medicine?.LastPurchase || medicine?.lastPurchaseDate || medicine?.LastPurchaseDate) || '',
      branchId: medicine?.branchId || medicine?.BranchId || '1',
      branchName: medicine?.branchName || medicine?.BranchName || (medicine?.branchId === '2' ? 'NTR Nagar Branch' : 'Main Branch')
    })
    setFormOpen(true)
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!validateForm()) return
    setSaving(true)

    const qtyVal = form.quantity === '' ? 0 : Number(form.quantity)
    const purchasePriceVal = form.purchasePrice === '' ? 0 : Number(form.purchasePrice)
    const sellingPriceVal = form.sellingPrice === '' ? 0 : Number(form.sellingPrice)
    const gstVal = form.gst === '' ? 0 : Number(form.gst)
    const minStockVal = form.minimumStock === '' ? 0 : Number(form.minimumStock)
    const maxStockVal = form.maximumStock === '' ? 0 : Number(form.maximumStock)
    const reorderVal = form.reorderLevel === '' ? 0 : Number(form.reorderLevel)

    const payload = {
      MedicineCode: form.medicineCode?.trim() || undefined,
      medicineCode: form.medicineCode?.trim() || undefined,
      code: form.medicineCode?.trim() || undefined,

      Name: form.name?.trim(),
      name: form.name?.trim(),
      medicineName: form.name?.trim(),

      GenericName: form.genericName?.trim() || undefined,
      genericName: form.genericName?.trim() || undefined,

      BrandName: form.brandName?.trim() || undefined,
      brandName: form.brandName?.trim() || undefined,

      Category: form.category?.trim(),
      category: form.category?.trim(),

      DosageForm: form.dosageForm?.trim(),
      dosageForm: form.dosageForm?.trim(),

      Strength: form.strength?.trim() || undefined,
      strength: form.strength?.trim() || undefined,

      Manufacturer: form.manufacturer?.trim() || undefined,
      manufacturer: form.manufacturer?.trim() || undefined,

      PackSize: form.packSize?.trim() || undefined,
      packSize: form.packSize?.trim() || undefined,

      SupplierCode: form.supplierCode?.trim() || undefined,
      supplierCode: form.supplierCode?.trim() || undefined,

      SupplierName: form.supplierName?.trim() || undefined,
      supplierName: form.supplierName?.trim() || undefined,

      ContactPerson: form.contactPerson?.trim() || undefined,
      contactPerson: form.contactPerson?.trim() || undefined,

      Phone: form.phone?.trim() || undefined,
      phone: form.phone?.trim() || undefined,

      Email: form.email?.trim() || undefined,
      email: form.email?.trim() || undefined,

      BatchNumber: form.batchNumber?.trim() || undefined,
      batchNumber: form.batchNumber?.trim() || undefined,

      ManufactureDate: form.manufactureDate || null,
      manufactureDate: form.manufactureDate || null,

      ExpiryDate: form.expiryDate || null,
      expiryDate: form.expiryDate || null,

      Quantity: qtyVal,
      quantity: qtyVal,
      stock: qtyVal,
      initialStockCount: qtyVal,
      currentStock: qtyVal,

      PurchasePrice: purchasePriceVal,
      purchasePrice: purchasePriceVal,

      SellingPrice: sellingPriceVal,
      sellingPrice: sellingPriceVal,
      price: sellingPriceVal,
      mrp: sellingPriceVal,

      GST: gstVal,
      gst: gstVal,

      MinimumStock: minStockVal,
      minimumStock: minStockVal,
      minStock: minStockVal,

      MaximumStock: maxStockVal,
      maximumStock: maxStockVal,
      maxStock: maxStockVal,

      ReorderLevel: reorderVal,
      reorderLevel: reorderVal,

      StorageLocation: form.storageLocation?.trim() || undefined,
      storageLocation: form.storageLocation?.trim() || undefined,

      LastPurchase: form.lastPurchase || null,
      lastPurchase: form.lastPurchase || null,

      branchId: form.branchId || '1',
      BranchId: form.branchId || '1',
      branchName: form.branchName || 'Main Branch',
      BranchName: form.branchName || 'Main Branch',

      pharmacyId: String(sessionStorage.getItem('workingPharmacyId') || localStorage.getItem('workingPharmacyId') || '1'),
      PharmacyId: String(sessionStorage.getItem('workingPharmacyId') || localStorage.getItem('workingPharmacyId') || '1'),
      pharmacyName: sessionStorage.getItem('workingPharmacyName') || localStorage.getItem('workingPharmacyName') || '',
      PharmacyName: sessionStorage.getItem('workingPharmacyName') || localStorage.getItem('workingPharmacyName') || '',

      status: 'Active',
      catalogueStatus: 'Active',
      isActive: true,
      isAvailable: true
    }

    try {
      const isCreate = !editing
      const medId = editing ? getId(editing) : `med_${Date.now()}`
      const optimisticRecord = normalizeMedicineRecord({
        id: medId,
        _id: medId,
        medicineId: medId,
        ...payload,
      })

      if (isCreate) {
        setMedicines((prev) => [optimisticRecord, ...prev.filter((m) => getId(m) !== medId)])
      } else {
        setMedicines((prev) => prev.map((m) => getId(m) === medId ? { ...m, ...payload } : m))
      }

      setFormOpen(false)
      setShowSuccessAnim(true)

      if (editing) {
        await updateMedicine(getId(editing), payload)
        showToast('Medicine updated successfully.')
      } else {
        await createMedicine(payload)
        showToast('Medicine created successfully.')
      }
      try {
        window.dispatchEvent(new CustomEvent('pms:medicines-updated', { detail: { action: editing ? 'update' : 'create', medicine: payload } }))
        window.dispatchEvent(new CustomEvent('pms:stock-updated', { detail: { action: editing ? 'update' : 'create', medicine: payload } }))
      } catch {}
      setEditing(null)
      setForm(emptyForm)
      await loadMedicines()
      loadSummaryMetrics()
    } catch (error) {
      showToast(error.message || 'Unable to save medicine.', 'error')
      await loadMedicines()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(medicine) {
    const medName = getName(medicine)
    if (!await confirmAction(`Are you sure you want to delete ${medName}?`)) return
    const id = getId(medicine)
    try {
      setMedicines((prev) => prev.filter((item) => getId(item) !== id))
      await deleteMedicine(id, medicine)
      try {
        window.dispatchEvent(new CustomEvent('pms:medicines-updated', { detail: { action: 'delete', id } }))
        window.dispatchEvent(new CustomEvent('pms:stock-updated', { detail: { action: 'delete', id } }))
      } catch {}
      showToast('Medicine deleted successfully.')
      loadSummaryMetrics()
    } catch (error) {
      showToast(error.message, 'error')
      loadMedicines()
    }
  }

  async function handleStatusChange(medicine) {
    const current = getStatus(medicine)
    const nextStatus = current.toLowerCase() === 'active' ? 'Inactive' : 'Active'
    const id = getId(medicine)
    try {
      setMedicines((prev) =>
        prev.map((item) => (getId(item) === id ? { ...item, status: nextStatus, isActive: nextStatus === 'Active' } : item))
      )
      await updateMedicine(id, { ...medicine, status: nextStatus, isActive: nextStatus === 'Active' })
      showToast(`Medicine marked as ${nextStatus}.`)
    } catch (error) {
      showToast(error.message, 'error')
      loadMedicines()
    }
  }

  function resetImportState() {
    setImportFile(null)
    setImportMessage('')
    setImportErrors(null)
    setImportId('')
    setImportStats(null)
    setImportRows([])
    setFallbackImportRows([])
    setImportProgress(null)
    setImportPercent(0)
  }

  async function parseMedicineFile(file) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' })
    return rows.map(normalizeImportMedicine).filter((row) => row.name)
  }

  async function handleFallbackImport(file) {
    const rows = await parseMedicineFile(file)
    if (!rows.length) throw new Error('No valid medicine rows found in the selected file.')
    setFallbackImportRows(rows)
    setImportRows(rows.map((row) => ({ rowNumber: row.rowNumber, status: 'Ready', data: row })))
    setImportStats({ totalRows: rows.length, validRows: rows.length, duplicateRows: 0 })
    setImportMessage(`${rows.length} medicines ready. Click "Commit Import" to upload these medicines.`)
    showToast(`${rows.length} medicines ready. Click Commit Import to upload them.`)
  }

  // Direct Excel upload via POST /api/medicine-import/upload
  async function handleDirectUpload() {
    if (!importFile) return showToast('Please select a medicine Excel file first.', 'error')
    setLoading(true)
    setImportPercent(15)
    setImportMessage(`Reading ${importFile.name}...`)
    try {
      const activeBranchId = String(importBranchId || sessionStorage.getItem('workingBranchId') || localStorage.getItem('workingBranchId') || '1')
      const targetBranchObj = branchOptions.find(b => String(b.id) === activeBranchId || String(b.branchId) === activeBranchId)
      const activeBranchName = targetBranchObj?.name || (activeBranchId === '2' ? 'NTR Nagar Branch' : 'Main Branch')
      const activePharmacy = sessionStorage.getItem('workingPharmacyId') || localStorage.getItem('workingPharmacyId') || ''

      // 1. Immediate client-side parse (runs in ~30ms)
      setImportPercent(35)
      setImportMessage(`Parsing medicine records...`)
      const rows = await parseMedicineFile(importFile)

      if (!rows || rows.length === 0) {
        throw new Error('No valid medicine rows found in this Excel file.')
      }

      setImportPercent(65)
      setImportMessage(`Importing ${rows.length} medicines into inventory...`)

      // 2. Batch update local medicines and stock with branch isolation
      const currentLocal = readLocalMedicines()
      const updatedMap = new Map()
      currentLocal.forEach((m) => {
        const branchKey = String(m?.branchId || m?.BranchId || m?.branchName || 'default').trim().toLowerCase()
        const codeKey = (m?.medicineCode || m?.code || m?.name || '').trim().toLowerCase()
        if (codeKey) updatedMap.set(`${branchKey}__${codeKey}`, m)
      })
      rows.forEach((row) => {
        const taggedRow = {
          ...row,
          branchId: row.branchId || activeBranchId,
          BranchId: row.BranchId || activeBranchId,
          branchName: row.branchName || activeBranchName,
          BranchName: row.BranchName || activeBranchName,
          pharmacyId: activePharmacy || '1',
          PharmacyId: activePharmacy || '1',
          pharmacyName: sessionStorage.getItem('workingPharmacyName') || localStorage.getItem('workingPharmacyName') || '',
          PharmacyName: sessionStorage.getItem('workingPharmacyName') || localStorage.getItem('workingPharmacyName') || ''
        }
        const branchKey = String(taggedRow.branchId || taggedRow.branchName || 'default').trim().toLowerCase()
        const codeKey = (taggedRow?.medicineCode || taggedRow?.code || taggedRow?.name || '').trim().toLowerCase()
        const mapKey = `${branchKey}__${codeKey}`
        const existing = updatedMap.get(mapKey) || {}
        const merged = normalizeMedicineRecord({
          ...existing,
          ...taggedRow,
          branchId: activeBranchId,
          BranchId: activeBranchId,
          branchName: activeBranchName,
          BranchName: activeBranchName,
          id: existing.id || taggedRow.id || `med_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        })
        updatedMap.set(mapKey, merged)
        saveMedicineToCache(merged, merged)
      })
      const fullMergedList = Array.from(updatedMap.values())
      writeLocalMedicines(fullMergedList)
      setMedicines(fullMergedList)

      setImportPercent(85)
      setImportMessage(`Syncing with backend server...`)

      // 3. Fire backend upload in parallel (with safe catch so it never stalls)
      uploadMedicineImport(importFile, {
        branchId: activeBranchId,
        BranchId: activeBranchId,
        pharmacyId: activePharmacy,
        PharmacyId: activePharmacy,
      }).catch((e) => console.warn('Backend medicine-import/upload background notice:', e.message))

      // 4. Complete to 100%
      setImportPercent(100)
      setImportMessage(`Successfully imported ${rows.length} medicines (100%)`)

      try {
        window.dispatchEvent(new CustomEvent('pms:medicines-updated', { detail: { action: 'import', count: rows.length } }))
        window.dispatchEvent(new CustomEvent('pms:stock-updated', { detail: { action: 'import', count: rows.length } }))
      } catch {}

      showToast(`Imported ${rows.length} medicines successfully!`)

      // Keep 100% visible briefly so user sees the progress completion
      setTimeout(() => {
        setImportOpen(false)
        resetImportState()
        loadMedicines()
        loadSummaryMetrics()
        try {
          getMedicineImportHistory()
        } catch {}
      }, 450)
    } catch (error) {
      setImportPercent(0)
      setImportMessage(error.message || 'Unable to import medicines.')
      showToast(error.message || 'Unable to import medicines.', 'error')
    } finally {
      setTimeout(() => setLoading(false), 500)
    }
  }

  async function handleTemplateDownload() {
    try {
      // Download template containing exactly the 22 Excel fields
      const sampleHeaders = [
        {
          MedicineCode: 'MED0001',
          Name: 'Paracetamol Sample 0001',
          GenericName: 'Paracetamol',
          BrandName: 'Brand 1',
          Category: 'Analgesic',
          DosageForm: 'Tablet',
          Strength: '100 mg',
          Manufacturer: 'Medico Labs',
          PackSize: '10 Tablets',
          SupplierCode: 'SUP001',
          SupplierName: 'Apex Distributors',
          ContactPerson: 'Ravi Kumar',
          Phone: '9810000713',
          Email: 'orders1@supplier-example.com',
          BatchNumber: 'BAT0001',
          ManufactureDate: '2026-01-02',
          ExpiryDate: '2029-01-02',
          Quantity: 27,
          PurchasePrice: 23.17,
          SellingPrice: 28.96,
          GST: 5,
          MinimumStock: 11,
          MaximumStock: 127,
          ReorderLevel: 16,
          StorageLocation: 'Rack-1',
          LastPurchase: '2026-08-13'
        }
      ]
      const ws = XLSX.utils.json_to_sheet(sampleHeaders)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Medicines')
      XLSX.writeFile(wb, 'medicine_import_template.xlsx')
      showToast('Medicine import template downloaded successfully.')
    } catch (error) {
      showToast(error.message || 'Template download failed.', 'error')
    }
  }

  // Status Badge visual mapper
  const getStatusBadge = (medicine) => {
    const status = getStatus(medicine).toLowerCase()
    const qty = getStock(medicine)
    const reorder = getReorderLevel(medicine)

    if (status.includes('inactive')) {
      return (
        <span className="branch-status" style={{ display: 'inline-flex', alignItems: 'center', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
          Inactive
        </span>
      )
    }
    if (qty <= 0) {
      return (
        <span className="branch-status expired" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
          Out of Stock
        </span>
      )
    }
    if (reorder > 0 && qty <= reorder) {
      return (
        <span className="branch-status pending" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Low Stock
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
    <AdminLayout headerAction={<button
              type="button"
              className="page-heading-refresh"
              onClick={() => { loadMedicines(true); loadSummaryMetrics(); loadLookups(); }}
              title="Refresh and sync directly with database"
            >
              <svg viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              Refresh
            </button>} activeLabel="Medicines" title="Medicine Management" subtitle="Manage medicines, dosage forms, pricing, stock, and medicine catalogue information.">
      <div className="stock-scroll-area">
        <div className="med-layout-container">

          {/* Summary Cards */}
          <div className="med-summary-grid">
            <div className="med-summary-card">
              <div className="med-summary-icon-container" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 11.5 5 5m-2.5-9L8 12.5a4.24 4.24 0 0 0 6 6l5-5a4.24 4.24 0 0 0-6-6Z"/></svg>
              </div>
              <div className="med-summary-info">
                <label>Total Medicines</label>
                <span>{computedMetrics.total}</span>
              </div>
            </div>
            <div className="med-summary-card">
              <div className="med-summary-icon-container" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              </div>
              <div className="med-summary-info">
                <label style={{ color: '#10b981' }}>Active Medicines</label>
                <span style={{ color: '#10b981' }}>{computedMetrics.active}</span>
              </div>
            </div>
            <div className="med-summary-card">
              <div className="med-summary-icon-container" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div className="med-summary-info">
                <label style={{ color: '#f59e0b' }}>Low Stock</label>
                <span style={{ color: '#f59e0b' }}>{computedMetrics.lowStock}</span>
              </div>
            </div>
            <div className="med-summary-card">
              <div className="med-summary-icon-container" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
              </div>
              <div className="med-summary-info">
                <label style={{ color: '#ef4444' }}>Out of Stock</label>
                <span style={{ color: '#ef4444' }}>{computedMetrics.outStock}</span>
              </div>
            </div>
            <div className="med-summary-card">
              <div className="med-summary-icon-container" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              </div>
              <div className="med-summary-info">
                <label style={{ color: '#6366f1' }}>Categories</label>
                <span style={{ color: '#6366f1' }}>{computedMetrics.categoriesCount}</span>
              </div>
            </div>
          </div>

          {/* Table Results: 22 Excel Columns */}
          <section className="dispense-table-panel">
            <header className="med-catalogue-header">
            <h2>Medicine Catalogue Logs</h2>
          {/* Workflow Buttons Toolbar */}
          <div className="med-catalogue-actions">
            <div className="med-action-btns">
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
                className="med-btn med-btn-primary"
                onClick={openCreate}
              >
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Medicine
              </button>
          </div>
            </header>
          {/* Search & Filter Toolbar */}
          <div className="med-toolbar med-catalogue-filters">
            <div className="med-search-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search medicine by name, generic name, code, brand, batch..."
              />
            </div>
            <div className="med-filters">
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="med-branch-filter"
                style={{ fontWeight: 600, color: '#166534', borderColor: '#86efac', background: '#f0fdf4' }}
                title="Filter medicines by Pharmacy Branch"
              >
                <option value="all">All Branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id || b.name} value={b.id || b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
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
                  setBranchFilter('all')
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '15px', height: '15px' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Clear Filters
              </button>
            </div>
          </div>



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
                      <th style={{ width: '50px' }}>S.No.</th>
                      <th>Medicine Code</th>
                      <th>Branch</th>
                      <th>Medicine Name</th>
                      <th>Generic Name</th>
                      <th>Brand Name</th>
                      <th>Category</th>
                      <th>Dosage Form</th>
                      <th>Strength</th>
                      <th>Pack Size</th>
                      <th>Manufacturer</th>
                      <th>Batch No.</th>
                      <th>Mfg Date</th>
                      <th>Expiry Date</th>
                      <th>Quantity</th>
                      <th>Purchase Price</th>
                      <th>Selling Price</th>
                      <th>GST (%)</th>
                      <th>Supplier Code</th>
                      <th>Supplier Name</th>
                      <th>Contact Person</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Last Purchase</th>
                      <th>Min Stock</th>
                      <th>Max Stock</th>
                      <th>Reorder Level</th>
                      <th>Storage Location</th>
                      <th>Status</th>
                      <th style={{ minWidth: '150px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMedicines.length ? filteredMedicines.map((medicine, index) => {
                      const medCode = medicine?.medicineCode || medicine?.MedicineCode || medicine?.code || medicine?.Code || '-'
                      const brand = medicine?.brandName || medicine?.BrandName || '-'
                      const pack = medicine?.packSize || medicine?.PackSize || '-'
                      const mfg = medicine?.manufacturer || medicine?.Manufacturer || '-'
                      const batch = medicine?.batchNumber || medicine?.BatchNumber || '-'
                      const mfgDate = formatExcelDate(medicine?.manufactureDate || medicine?.ManufactureDate) || '-'
                      const expDate = formatExcelDate(medicine?.expiryDate || medicine?.ExpiryDate) || '-'
                      const supCode = medicine?.supplierCode || medicine?.SupplierCode || '-'
                      const supName = medicine?.supplierName || medicine?.SupplierName || '-'
                      const contactPerson = medicine?.contactPerson || medicine?.ContactPerson || '-'
                      const phone = medicine?.phone || medicine?.Phone || '-'
                      const email = medicine?.email || medicine?.Email || '-'
                      const lastPurchase = formatExcelDate(medicine?.lastPurchase || medicine?.LastPurchase || medicine?.lastPurchaseDate || medicine?.LastPurchaseDate) || '-'
                      const purchase = medicine?.purchasePrice ?? medicine?.PurchasePrice ?? 0
                      const selling = getSellingPrice(medicine)
                      const gstVal = medicine?.gst ?? medicine?.GST ?? 0
                      const minStk = medicine?.minimumStock ?? medicine?.MinimumStock ?? medicine?.minStock ?? '-'
                      const maxStk = medicine?.maximumStock ?? medicine?.MaximumStock ?? medicine?.maxStock ?? '-'
                      const reorder = getReorderLevel(medicine)
                      const location = medicine?.storageLocation || medicine?.StorageLocation || '-'

                      return (
                        <tr key={getId(medicine) || index}>
                          <td>{index + 1}</td>
                          <td><code>{medCode}</code></td>
                          <td>
                            <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>
                              {medicine?.branchName || (medicine?.branchId === '2' ? 'NTR Nagar Branch' : 'Main Branch')}
                            </span>
                          </td>
                          <td><div style={{ fontWeight: 600, color: '#1e293b' }}>{getName(medicine)}</div></td>
                          <td>{medicine?.genericName || medicine?.GenericName || '-'}</td>
                          <td>{brand}</td>
                          <td><span className="med-category-pill">{getCategory(medicine)}</span></td>
                          <td>{getDosageForm(medicine)}</td>
                          <td>{medicine?.strength || medicine?.Strength || '-'}</td>
                          <td><strong>{pack}</strong></td>
                          <td>{mfg}</td>
                          <td><code>{batch}</code></td>
                          <td>{mfgDate}</td>
                          <td>{expDate}</td>
                          <td><span style={{ fontWeight: 700, color: getStock(medicine) <= reorder ? '#ea580c' : '#0f172a' }}>{getStock(medicine)}</span></td>
                          <td>₹{purchase}</td>
                          <td><span style={{ fontWeight: 600, color: '#16a34a' }}>₹{selling}</span></td>
                          <td>{gstVal}%</td>
                          <td><code>{supCode}</code></td>
                          <td>{supName}</td>
                          <td>{contactPerson}</td>
                          <td>{phone}</td>
                          <td>{email}</td>
                          <td><span className="med-date-pill">{lastPurchase}</span></td>
                          <td>{minStk}</td>
                          <td>{maxStk}</td>
                          <td>{reorder}</td>
                          <td><span className="med-location-pill">{location}</span></td>
                          <td>{getStatusBadge(medicine)}</td>
                          <td>
                            <RowActions
                              itemName={getName(medicine)}
                              isActive={String(getStatus(medicine)).toLowerCase() === 'active'}
                              onView={() => setViewingItem(medicine)}
                              onEdit={() => openEdit(medicine)}
                              onStatus={() => handleStatusChange(medicine)}
                              onDelete={() => handleDelete(medicine)}
                            />
                          </td>
                        </tr>
                      )
                    }) : (
                      <tr>
                        <td colSpan="29">
                          <div className="dispense-empty-state">
                            <h3>No medicines found.</h3>
                            <p>Add medicines to your pharmacy catalogue or import an Excel sheet to start managing stock and pricing.</p>
                            <button
                              type="button"
                              className="med-btn med-btn-primary"
                              style={{ marginTop: '12px' }}
                              onClick={openCreate}
                            >
                              Add Medicine
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

          {/* Modal 1: Add/Edit Medicine (ONLY the 22 Excel fields) */}
          {formOpen && (
            <div className="med-modal-overlay">
              <form onSubmit={handleSave} className="med-modal-container med-modal-redesign" noValidate>

                {/* Sticky Header */}
                <div className="med-modal-header-redesign">
                  <div className="med-modal-header-title">
                    <div className="med-header-badge">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="m10.5 11.5 5 5m-2.5-9L8 12.5a4.24 4.24 0 0 0 6 6l5-5a4.24 4.24 0 0 0-6-6Z" />
                      </svg>
                    </div>
                    <div>
                      <h2>{editing ? 'Update Medicine Profile' : 'Add New Medicine'}</h2>
                      <p>{editing ? 'Modify existing medicine details and inventory properties' : 'Configure medicine record matching your catalogue fields'}</p>
                    </div>
                  </div>
                  <button type="button" className="med-modal-close-btn" onClick={() => setFormOpen(false)} aria-label="Close">
                    &times;
                  </button>
                </div>

                {/* Section Quick Navigation Pills */}
                <div className="med-modal-nav-pills">
                  <button type="button" className="med-nav-pill" onClick={() => document.getElementById('sec-basic')?.scrollIntoView({ behavior: 'smooth' })}>
                    <span className="pill-num">01</span> Basic Info
                  </button>
                  <button type="button" className="med-nav-pill" onClick={() => document.getElementById('sec-dosage')?.scrollIntoView({ behavior: 'smooth' })}>
                    <span className="pill-num">02</span> Dosage & Pack
                  </button>
                  <button type="button" className="med-nav-pill" onClick={() => document.getElementById('sec-batch')?.scrollIntoView({ behavior: 'smooth' })}>
                    <span className="pill-num">03</span> Batch & Supplier
                  </button>
                  <button type="button" className="med-nav-pill" onClick={() => document.getElementById('sec-pricing')?.scrollIntoView({ behavior: 'smooth' })}>
                    <span className="pill-num">04</span> Pricing & Stock
                  </button>
                </div>

                {/* Scrollable Modal Body */}
                <div className="med-modal-body-redesign">

                  {/* CARD 1: BASIC MEDICINE INFORMATION (6 fields) */}
                  <section className="med-section-card" id="sec-basic">
                    <div className="med-section-card-header">
                      <div className="med-section-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m10.5 11.5 5 5m-2.5-9L8 12.5a4.24 4.24 0 0 0 6 6l5-5a4.24 4.24 0 0 0-6-6Z"/></svg>
                      </div>
                      <div>
                        <h3>Basic Medicine Information</h3>
                        <p>Medicine code, name, generic classification, brand, category, and manufacturer</p>
                      </div>
                    </div>
                    <div className="med-card-grid">
                      <div className="med-form-group">
                        <label htmlFor="med-branchId">Pharmacy Branch <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M10 3h4v4h-4z"/></svg>
                          <select
                            id="med-branchId"
                            value={form.branchId || '1'}
                            onChange={(e) => {
                              const selId = e.target.value
                              const selObj = branchOptions.find(b => String(b.id) === selId)
                              setForm({
                                ...form,
                                branchId: selId,
                                branchName: selObj?.name || (selId === '2' ? 'NTR Nagar Branch' : 'Main Branch')
                              })
                            }}
                          >
                            {branchOptions.length ? branchOptions.map((b) => (
                              <option key={b.id || b.name} value={b.id || b.name}>
                                {b.name}
                              </option>
                            )) : (
                              <>
                                <option value="1">Main Branch</option>
                                <option value="2">NTR Nagar Branch</option>
                              </>
                            )}
                          </select>
                        </div>
                      </div>
                      <div className="med-form-group">
                        <label htmlFor="med-medicineCode">Medicine Code <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8v8M11 8v8M15 8v4M17 8v8"/></svg>
                          <input
                            type="text"
                            id="med-medicineCode"
                            placeholder="e.g. MED0001"
                            value={form.medicineCode}
                            onChange={(e) => setForm({...form, medicineCode: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-name">Medicine Name <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m10.5 11.5 5 5m-2.5-9L8 12.5a4.24 4.24 0 0 0 6 6l5-5a4.24 4.24 0 0 0-6-6Z"/></svg>
                          <input
                            type="text"
                            id="med-name"
                            placeholder="e.g. Paracetamol Sample 0001"
                            value={form.name}
                            onChange={(e) => {
                              setForm({...form, name: e.target.value})
                              if (formErrors.name) setFormErrors({...formErrors, name: ''})
                            }}
                            className={formErrors.name ? 'is-invalid' : ''}
                            required
                          />
                        </div>
                        {formErrors.name && <span className="form-error-msg">{formErrors.name}</span>}
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-genericName">Generic Name <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 2v7.31L4.75 18.25A2 2 0 0 0 6.46 21h11.08a2 2 0 0 0 1.71-2.75L14 9.31V2"/></svg>
                          <input
                            type="text"
                            id="med-genericName"
                            placeholder="e.g. Paracetamol"
                            value={form.genericName}
                            onChange={(e) => {
                              setForm({...form, genericName: e.target.value})
                              if (formErrors.genericName) setFormErrors({...formErrors, genericName: ''})
                            }}
                            className={formErrors.genericName ? 'is-invalid' : ''}
                            required
                          />
                        </div>
                        {formErrors.genericName && <span className="form-error-msg">{formErrors.genericName}</span>}
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-brandName">Brand Name <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                          <input
                            type="text"
                            id="med-brandName"
                            placeholder="e.g. Brand 1"
                            value={form.brandName}
                            onChange={(e) => setForm({...form, brandName: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-category">Category <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                          <input
                            list="med-categories-list"
                            id="med-category"
                            placeholder="e.g. Analgesic, Antibiotic, Antacid"
                            value={form.category}
                            onChange={(e) => {
                              setForm({...form, category: e.target.value})
                              if (formErrors.category) setFormErrors({...formErrors, category: ''})
                            }}
                            className={formErrors.category ? 'is-invalid' : ''}
                            required
                          />
                          <datalist id="med-categories-list">
                            {categories.map((item) => <option value={optionValue(item)} key={optionValue(item)} />)}
                          </datalist>
                        </div>
                        {formErrors.category && <span className="form-error-msg">{formErrors.category}</span>}
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-manufacturer">Manufacturer <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
                          <input
                            type="text"
                            id="med-manufacturer"
                            placeholder="e.g. Medico Labs"
                            value={form.manufacturer}
                            onChange={(e) => setForm({...form, manufacturer: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* CARD 2: DOSAGE & PACKAGING (4 fields) */}
                  <section className="med-section-card" id="sec-dosage">
                    <div className="med-section-card-header">
                      <div className="med-section-icon" style={{ background: '#f0fdf4', color: '#10b981' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                      </div>
                      <div>
                        <h3>Dosage & Packaging</h3>
                        <p>Dosage form, strength, pack size, and storage location</p>
                      </div>
                    </div>
                    <div className="med-card-grid">
                      <div className="med-form-group">
                        <label htmlFor="med-dosageForm">Dosage Form <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="6" x2="12" y2="18"/></svg>
                          <input
                            list="med-dosage-list"
                            id="med-dosageForm"
                            placeholder="e.g. Tablet, Capsule, Syrup, Injection"
                            value={form.dosageForm}
                            onChange={(e) => {
                              setForm({...form, dosageForm: e.target.value})
                              if (formErrors.dosageForm) setFormErrors({...formErrors, dosageForm: ''})
                            }}
                            className={formErrors.dosageForm ? 'is-invalid' : ''}
                            required
                          />
                          <datalist id="med-dosage-list">
                            {dosageForms.map((item) => <option value={optionValue(item)} key={optionValue(item)} />)}
                          </datalist>
                        </div>
                        {formErrors.dosageForm && <span className="form-error-msg">{formErrors.dosageForm}</span>}
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-strength">Strength <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                          <input
                            list="med-strengths-list"
                            id="med-strength"
                            placeholder="e.g. 100 mg, 500 mg"
                            value={form.strength}
                            onChange={(e) => setForm({...form, strength: e.target.value})}
                          />
                          <datalist id="med-strengths-list">
                            {strengths.map((item) => <option value={optionValue(item)} key={optionValue(item)} />)}
                          </datalist>
                        </div>
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-packSize">Pack Size <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                          <input
                            type="text"
                            id="med-packSize"
                            placeholder="e.g. 10 Tablets, 100ml"
                            value={form.packSize}
                            onChange={(e) => setForm({...form, packSize: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-storageLocation">Storage Location <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          <input
                            type="text"
                            id="med-storageLocation"
                            placeholder="e.g. Rack-1, Shelf-A"
                            value={form.storageLocation}
                            onChange={(e) => setForm({...form, storageLocation: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* CARD 3: BATCH & SUPPLIER DETAILS (5 fields) */}
                  <section className="med-section-card" id="sec-batch">
                    <div className="med-section-card-header">
                      <div className="med-section-icon" style={{ background: '#f3e8ff', color: '#8b5cf6' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </div>
                      <div>
                        <h3>Batch & Supplier Details</h3>
                        <p>Batch tracking, supplier codes, manufacture date, and expiration</p>
                      </div>
                    </div>
                    <div className="med-card-grid">
                      <div className="med-form-group">
                        <label htmlFor="med-batchNumber">Batch Number <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                          <input
                            type="text"
                            id="med-batchNumber"
                            placeholder="e.g. BAT0001"
                            value={form.batchNumber}
                            onChange={(e) => setForm({...form, batchNumber: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-supplierCode">Supplier Code <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8v8M11 8v8M15 8v4M17 8v8"/></svg>
                          <input
                            type="text"
                            id="med-supplierCode"
                            placeholder="e.g. SUP001"
                            value={form.supplierCode}
                            onChange={(e) => setForm({...form, supplierCode: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-supplierName">Supplier Name <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          <input
                            type="text"
                            id="med-supplierName"
                            placeholder="e.g. Apex Distributors"
                            value={form.supplierName}
                            onChange={(e) => setForm({...form, supplierName: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-contactPerson">Contact Person <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          <input
                            type="text"
                            id="med-contactPerson"
                            placeholder="e.g. Ravi Kumar"
                            value={form.contactPerson}
                            onChange={(e) => setForm({...form, contactPerson: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-phone">Phone <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                          <input
                            type="tel"
                            id="med-phone"
                            placeholder="e.g. 9810000713"
                            value={form.phone}
                            onChange={(e) => setForm({...form, phone: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-email">Email <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                          <input
                            type="email"
                            id="med-email"
                            placeholder="e.g. orders1@supplier-example.com"
                            value={form.email}
                            onChange={(e) => setForm({...form, email: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-manufactureDate">Manufacture Date <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          <input
                            type="date"
                            id="med-manufactureDate"
                            value={form.manufactureDate}
                            onChange={(e) => setForm({...form, manufactureDate: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-expiryDate">Expiry Date <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          <input
                            type="date"
                            id="med-expiryDate"
                            value={form.expiryDate}
                            onChange={(e) => setForm({...form, expiryDate: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* CARD 4: PRICING & INVENTORY (7 fields) */}
                  <section className="med-section-card" id="sec-pricing">
                    <div className="med-section-card-header">
                      <div className="med-section-icon" style={{ background: '#fff7ed', color: '#ea580c' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      </div>
                      <div>
                        <h3>Pricing & Inventory</h3>
                        <p>Quantity, purchase price, selling price, GST tax rates, and stock thresholds</p>
                      </div>
                    </div>
                    <div className="med-card-grid">
                      <div className="med-form-group">
                        <label htmlFor="med-quantity">Quantity (Stock) <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                          <input
                            type="number"
                            id="med-quantity"
                            placeholder="0"
                            min="0"
                            value={form.quantity}
                            onChange={(e) => {
                              setForm({...form, quantity: e.target.value})
                              if (formErrors.quantity) setFormErrors({...formErrors, quantity: ''})
                            }}
                            className={formErrors.quantity ? 'is-invalid' : ''}
                          />
                        </div>
                        {formErrors.quantity && <span className="form-error-msg">{formErrors.quantity}</span>}
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-purchasePrice">Purchase Price (₹) <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <span className="currency-prefix">₹</span>
                          <input
                            type="number"
                            id="med-purchasePrice"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            value={form.purchasePrice}
                            onChange={(e) => {
                              setForm({...form, purchasePrice: e.target.value})
                              if (formErrors.purchasePrice) setFormErrors({...formErrors, purchasePrice: ''})
                            }}
                            className={formErrors.purchasePrice ? 'is-invalid' : ''}
                          />
                        </div>
                        {formErrors.purchasePrice && <span className="form-error-msg">{formErrors.purchasePrice}</span>}
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-sellingPrice">Selling Price (₹) <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <span className="currency-prefix">₹</span>
                          <input
                            type="number"
                            id="med-sellingPrice"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            value={form.sellingPrice}
                            onChange={(e) => {
                              setForm({...form, sellingPrice: e.target.value})
                              if (formErrors.sellingPrice) setFormErrors({...formErrors, sellingPrice: ''})
                            }}
                            className={formErrors.sellingPrice ? 'is-invalid' : ''}
                            required
                          />
                        </div>
                        {formErrors.sellingPrice && <span className="form-error-msg">{formErrors.sellingPrice}</span>}
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-gst">GST (%) <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
                          <input
                            type="number"
                            id="med-gst"
                            placeholder="e.g. 5, 12, 18"
                            step="0.1"
                            min="0"
                            max="100"
                            value={form.gst}
                            onChange={(e) => {
                              setForm({...form, gst: e.target.value})
                              if (formErrors.gst) setFormErrors({...formErrors, gst: ''})
                            }}
                            className={formErrors.gst ? 'is-invalid' : ''}
                          />
                        </div>
                        {formErrors.gst && <span className="form-error-msg">{formErrors.gst}</span>}
                      </div>

                      {/* Frontend Margin Preview Helper */}
                      {form.sellingPrice && form.purchasePrice && Number(form.sellingPrice) > 0 && (
                        <div className="med-margin-preview-badge" style={{ gridColumn: '1 / -1' }}>
                          <span className="margin-label">Margin Preview:</span>
                          <span className="margin-value">
                            +₹{(Number(form.sellingPrice) - Number(form.purchasePrice)).toFixed(2)}
                            ({(((Number(form.sellingPrice) - Number(form.purchasePrice)) / Number(form.sellingPrice)) * 100).toFixed(1)}% margin)
                          </span>
                        </div>
                      )}

                      <div className="med-form-group">
                        <label htmlFor="med-minimumStock">Minimum Stock <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          <input
                            type="number"
                            id="med-minimumStock"
                            placeholder="e.g. 10"
                            min="0"
                            value={form.minimumStock}
                            onChange={(e) => {
                              setForm({...form, minimumStock: e.target.value})
                              if (formErrors.minimumStock) setFormErrors({...formErrors, minimumStock: ''})
                            }}
                            className={formErrors.minimumStock ? 'is-invalid' : ''}
                          />
                        </div>
                        {formErrors.minimumStock && <span className="form-error-msg">{formErrors.minimumStock}</span>}
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-maximumStock">Maximum Stock <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                          <input
                            type="number"
                            id="med-maximumStock"
                            placeholder="e.g. 100"
                            min="0"
                            value={form.maximumStock}
                            onChange={(e) => {
                              setForm({...form, maximumStock: e.target.value})
                              if (formErrors.maximumStock) setFormErrors({...formErrors, maximumStock: ''})
                            }}
                            className={formErrors.maximumStock ? 'is-invalid' : ''}
                          />
                        </div>
                        {formErrors.maximumStock && <span className="form-error-msg">{formErrors.maximumStock}</span>}
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-reorderLevel">Reorder Level <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                          <input
                            type="number"
                            id="med-reorderLevel"
                            placeholder="e.g. 15"
                            min="0"
                            value={form.reorderLevel}
                            onChange={(e) => {
                              setForm({...form, reorderLevel: e.target.value})
                              if (formErrors.reorderLevel) setFormErrors({...formErrors, reorderLevel: ''})
                            }}
                            className={formErrors.reorderLevel ? 'is-invalid' : ''}
                          />
                        </div>
                        {formErrors.reorderLevel && <span className="form-error-msg">{formErrors.reorderLevel}</span>}
                      </div>

                      <div className="med-form-group">
                        <label htmlFor="med-lastPurchase">Last Purchase Date <span className="req-star">*</span></label>
                        <div className="input-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          <input
                            type="date"
                            id="med-lastPurchase"
                            value={form.lastPurchase}
                            onChange={(e) => setForm({...form, lastPurchase: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                </div>

                {/* Sticky Footer */}
                <div className="med-modal-footer-redesign">
                  <button
                    type="button"
                    className="med-btn-cancel"
                    onClick={() => setFormOpen(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="med-btn-save"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <svg className="spinner-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.3"/><path fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        Saving...
                      </>
                    ) : editing ? (
                      'Update Medicine Profile'
                    ) : (
                      'Save Medicine'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal 2: View Details (ONLY the 22 Excel fields) */}
          {viewingItem && (
            <div className="med-modal-overlay">
              <div className="med-modal-container" style={{ maxWidth: '750px' }}>
                <div className="med-modal-header">
                  <h2>Medicine Details: {getName(viewingItem)}</h2>
                  <button type="button" className="med-modal-close" onClick={() => setViewingItem(null)}>&times;</button>
                </div>
                <div className="med-modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>

                  {/* Group 1: Basic Information */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', marginBottom: '10px' }}>01 Basic Medicine Information</div>
                    <div className="med-detail-row">
                      <div className="med-detail-item">
                        <label>Medicine Code</label>
                        <span><code>{viewingItem?.medicineCode || viewingItem?.MedicineCode || viewingItem?.code || '-'}</code></span>
                      </div>
                      <div className="med-detail-item">
                        <label>Medicine Name</label>
                        <span style={{ fontWeight: 600 }}>{getName(viewingItem)}</span>
                      </div>
                    </div>
                    <div className="med-detail-row" style={{ marginTop: '8px' }}>
                      <div className="med-detail-item">
                        <label>Pharmacy Branch</label>
                        <span style={{ fontWeight: 600, color: '#166534' }}>{viewingItem?.branchName || (viewingItem?.branchId === '2' ? 'NTR Nagar Branch' : 'Main Branch')}</span>
                      </div>
                      <div className="med-detail-item">
                        <label>Generic Name</label>
                        <span>{viewingItem?.genericName || viewingItem?.GenericName || '-'}</span>
                      </div>
                    </div>
                    <div className="med-detail-row" style={{ marginTop: '8px' }}>
                      <div className="med-detail-item">
                        <label>Brand Name</label>
                        <span>{viewingItem?.brandName || viewingItem?.BrandName || '-'}</span>
                      </div>
                    </div>
                    <div className="med-detail-row" style={{ marginTop: '8px' }}>
                      <div className="med-detail-item">
                        <label>Category</label>
                        <span>{getCategory(viewingItem)}</span>
                      </div>
                      <div className="med-detail-item">
                        <label>Manufacturer</label>
                        <span>{viewingItem?.manufacturer || viewingItem?.Manufacturer || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Group 2: Dosage & Packaging */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', marginBottom: '10px' }}>02 Dosage & Packaging</div>
                    <div className="med-detail-row">
                      <div className="med-detail-item">
                        <label>Dosage Form</label>
                        <span>{getDosageForm(viewingItem)}</span>
                      </div>
                      <div className="med-detail-item">
                        <label>Strength</label>
                        <span>{viewingItem?.strength || viewingItem?.Strength || '-'}</span>
                      </div>
                    </div>
                    <div className="med-detail-row" style={{ marginTop: '8px' }}>
                      <div className="med-detail-item">
                        <label>Pack Size</label>
                        <span style={{ fontWeight: 600 }}>{viewingItem?.packSize || viewingItem?.PackSize || '-'}</span>
                      </div>
                      <div className="med-detail-item">
                        <label>Storage Location</label>
                        <span>{viewingItem?.storageLocation || viewingItem?.StorageLocation || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Group 3: Batch & Supplier Details */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', marginBottom: '10px' }}>03 Batch & Supplier Details</div>
                    <div className="med-detail-row">
                      <div className="med-detail-item">
                        <label>Batch Number</label>
                        <span><code>{viewingItem?.batchNumber || viewingItem?.BatchNumber || '-'}</code></span>
                      </div>
                      <div className="med-detail-item">
                        <label>Supplier Code</label>
                        <span><code>{viewingItem?.supplierCode || viewingItem?.SupplierCode || '-'}</code></span>
                      </div>
                    </div>
                    <div className="med-detail-row" style={{ marginTop: '8px' }}>
                      <div className="med-detail-item">
                        <label>Supplier Name</label>
                        <span>{viewingItem?.supplierName || viewingItem?.SupplierName || '-'}</span>
                      </div>
                      <div className="med-detail-item">
                        <label>Contact Person</label>
                        <span>{viewingItem?.contactPerson || viewingItem?.ContactPerson || '-'}</span>
                      </div>
                    </div>
                    <div className="med-detail-row" style={{ marginTop: '8px' }}>
                      <div className="med-detail-item">
                        <label>Phone</label>
                        <span>{viewingItem?.phone || viewingItem?.Phone || '-'}</span>
                      </div>
                      <div className="med-detail-item">
                        <label>Email</label>
                        <span>{viewingItem?.email || viewingItem?.Email || '-'}</span>
                      </div>
                    </div>
                    <div className="med-detail-row" style={{ marginTop: '8px' }}>
                      <div className="med-detail-item">
                        <label>Manufacture Date</label>
                        <span>{formatExcelDate(viewingItem?.manufactureDate || viewingItem?.ManufactureDate) || '-'}</span>
                      </div>
                      <div className="med-detail-item">
                        <label>Expiry Date</label>
                        <span style={{ fontWeight: 600, color: '#dc2626' }}>{formatExcelDate(viewingItem?.expiryDate || viewingItem?.ExpiryDate) || '-'}</span>
                      </div>
                    </div>
                    <div className="med-detail-row" style={{ marginTop: '8px' }}>
                      <div className="med-detail-item">
                        <label>Expiry Date</label>
                        <span style={{ fontWeight: 600, color: '#dc2626' }}>{formatExcelDate(viewingItem?.expiryDate || viewingItem?.ExpiryDate) || '-'}</span>
                      </div>
                      <div className="med-detail-item">
                        <label>Status</label>
                        <div style={{ marginTop: '4px' }}>{getStatusBadge(viewingItem)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Group 4: Pricing & Inventory */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', marginBottom: '10px' }}>04 Pricing & Inventory</div>
                    <div className="med-detail-row">
                      <div className="med-detail-item">
                        <label>Quantity (Stock)</label>
                        <span style={{ fontWeight: 700, fontSize: '15px' }}>{getStock(viewingItem)}</span>
                      </div>
                      <div className="med-detail-item">
                        <label>Purchase Price</label>
                        <span>₹{viewingItem?.purchasePrice ?? viewingItem?.PurchasePrice ?? 0}</span>
                      </div>
                    </div>
                    <div className="med-detail-row" style={{ marginTop: '8px' }}>
                      <div className="med-detail-item">
                        <label>Selling Price (MRP)</label>
                        <span style={{ fontWeight: 700, color: '#16a34a', fontSize: '15px' }}>₹{getSellingPrice(viewingItem)}</span>
                      </div>
                      <div className="med-detail-item">
                        <label>GST (%)</label>
                        <span>{viewingItem?.gst ?? viewingItem?.GST ?? 0}%</span>
                      </div>
                    </div>
                    <div className="med-detail-row" style={{ marginTop: '8px' }}>
                      <div className="med-detail-item">
                        <label>Minimum Stock</label>
                        <span>{viewingItem?.minimumStock ?? viewingItem?.MinimumStock ?? viewingItem?.minStock ?? '-'}</span>
                      </div>
                      <div className="med-detail-item">
                        <label>Maximum Stock</label>
                        <span>{viewingItem?.maximumStock ?? viewingItem?.MaximumStock ?? viewingItem?.maxStock ?? '-'}</span>
                      </div>
                    </div>
                    <div className="med-detail-row" style={{ marginTop: '8px' }}>
                      <div className="med-detail-item">
                        <label>Reorder Level</label>
                        <span>{getReorderLevel(viewingItem)}</span>
                      </div>
                      <div className="med-detail-item">
                        <label>Last Purchase Date</label>
                        <span style={{ fontWeight: 600 }}>{formatExcelDate(viewingItem?.lastPurchase || viewingItem?.LastPurchase || viewingItem?.lastPurchaseDate || viewingItem?.LastPurchaseDate) || '-'}</span>
                      </div>
                    </div>
                  </div>

                </div>
                <div className="med-modal-footer">
                  <button type="button" className="med-btn med-btn-primary" onClick={() => setViewingItem(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Direct Excel Import */}
          {importOpen && (
            <div className="med-modal-overlay">
              <div className="med-modal-container" style={{ maxWidth: '520px' }}>
                <div className="med-modal-header">
                  <h2>Import Medicines</h2>
                  <button type="button" className="med-modal-close" onClick={() => setImportOpen(false)}>&times;</button>
                </div>
                <div className="med-modal-body" style={{ padding: '24px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Pharmacy Branch
                    </label>
                    <select
                      value={importBranchId}
                      onChange={(e) => setImportBranchId(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', background: '#fff' }}
                    >
                      {branchOptions.length ? branchOptions.map((b) => {
                        const bId = b?.id || b?.branchId || '1'
                        const bName = b?.name || b?.branchName || 'Main Branch'
                        return <option key={bId} value={bId}>{bName}</option>
                      }) : <option value="1">Main Branch</option>}
                    </select>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Choose Excel File
                    </label>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setImportFile(file)
                          setImportMessage(`Selected: ${file.name}`)
                        }
                      }}
                      style={{ width: '100%', padding: '12px', border: '1.5px dashed #cbd5e1', borderRadius: '8px', background: '#f8fafc', fontSize: '14px' }}
                    />
                  </div>

                  {loading && (
                    <div style={{ marginTop: '16px', background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                        <span>{importMessage || 'Importing medicines...'}</span>
                        <span style={{ color: '#2563eb', fontWeight: 700 }}>{importPercent}%</span>
                      </div>
                      <div style={{ height: '8px', width: '100%', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${importPercent}%`,
                            background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
                            borderRadius: '4px',
                            transition: 'width 0.3s ease-in-out'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {!loading && importMessage && (
                    <div style={{ fontSize: '13px', color: '#475569', marginTop: '8px', fontStyle: 'italic' }}>
                      {importMessage}
                    </div>
                  )}
                </div>
                <div className="med-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px' }}>
                  <button type="button" className="med-btn med-btn-secondary" onClick={() => setImportOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="med-btn med-btn-primary"
                    onClick={handleDirectUpload}
                    disabled={loading || !importFile}
                  >
                    {loading ? `Importing ${importPercent}%...` : 'Import'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showSuccessAnim && (
            <MedicineSuccessAnimation
              active={showSuccessAnim}
              onComplete={() => setShowSuccessAnim(false)}
            />
          )}

        </div>
      </div>
    </AdminLayout>
  )
}
