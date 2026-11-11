import { useEffect, useState, useMemo, useRef } from 'react'
import { useToast } from '../../components/ToastProvider'
import RowActions from '../../components/RowActions'
import AdminLayout from './AdminLayout'
import {
  changeStockTransferStatus,
  createStockTransfer,
  dispatchStockTransfer,
  getStockTransfer,
  listStockTransfers,
  receiveStockTransfer,
  updateStockTransferDraft,
  listPharmacyBranches,
  readLocalStockTransfers,
  writeLocalStockTransfers,
  listMedicines,
  readLocalMedicines
} from '../../config/api'
import medicineCatalogReference from '../../data/medicineCatalogReference.json'
import './StockTransfers.css'

const normalizeList = (response) => {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.results)) return response.results
  if (Array.isArray(response?.transfers)) return response.transfers
  return []
}

function getId(item, index) {
  return item?._id || item?.id || item?.transferId || `${index}`
}

function resolveMedicineBatch(m, index = 0, fallbackTransferItems = []) {
  if (!m) return `BAT${String(index + 1).padStart(4, '0')}`

  // 1. Direct explicit batch property on medicine object (including imported batches)
  const direct = m?.batchNumber || m?.BatchNumber || m?.batchNo || m?.BatchNo || m?.batch || m?.Batch || m?.lotNumber || m?.LotNumber || m?.batchId || m?.BatchId
  if (direct && String(direct).trim() && String(direct).trim() !== '-') {
    return String(direct).trim()
  }

  const rawMedCode = m?.medicineCode || m?.code || m?.MedicineCode || m?.Code || ''
  const rawNameVal = m?.name || m?.medicineName || m?.brandName || ''
  const codeKey = String(rawMedCode).trim().toLowerCase()
  const nameKey = String(rawNameVal).trim().toLowerCase()

  // 2. Check explicit imported medicines in localStorage
  try {
    const impRaw = localStorage.getItem('pms_imported_medicines')
    if (impRaw) {
      const parsed = JSON.parse(impRaw)
      if (Array.isArray(parsed)) {
        const found = parsed.find(item => {
          const iCode = String(item?.medicineCode || item?.code || '').trim().toLowerCase()
          const iName = String(item?.name || item?.medicineName || '').trim().toLowerCase()
          return (codeKey && iCode && codeKey === iCode) || (nameKey && iName && nameKey === iName)
        })
        const foundBatch = found?.batchNumber || found?.BatchNumber || found?.batchNo || found?.BatchNo
        if (foundBatch && String(foundBatch).trim() && String(foundBatch).trim() !== '-') {
          return String(foundBatch).trim()
        }
      }
    }
  } catch {}

  // 3. Check medicine cache from localStorage / sessionStorage
  try {
    const rawCache = localStorage.getItem('pms_medicine_cache') || sessionStorage.getItem('pms_medicine_cache') || localStorage.getItem('pms_medicine_catalogue_cache')
    if (rawCache) {
      const parsed = JSON.parse(rawCache)
      const idKey = `id:${String(m?.id || m?._id || '').trim().toLowerCase()}`
      const cached = (idKey && parsed[idKey]) || (codeKey && parsed[`code:${codeKey}`]) || (nameKey && parsed[`name:${nameKey}`]) || (codeKey && parsed[codeKey]) || (nameKey && parsed[nameKey])
      const cachedBatch = cached?.batchNumber || cached?.BatchNumber || cached?.batchNo
      if (cachedBatch && String(cachedBatch).trim() && String(cachedBatch).trim() !== '-') {
        return String(cachedBatch).trim()
      }
    }
  } catch {}

  // 4. Check medicineCatalogReference
  if (medicineCatalogReference && typeof medicineCatalogReference === 'object') {
    const ref = (codeKey && medicineCatalogReference[codeKey]) || (nameKey && medicineCatalogReference[nameKey])
    if (ref?.batchNumber && String(ref.batchNumber).trim()) {
      return String(ref.batchNumber).trim()
    }
  }

  // 5. Check if any prior stock transfer logged a batch for this medicine
  if (Array.isArray(fallbackTransferItems) && fallbackTransferItems.length > 0 && nameKey) {
    const prev = fallbackTransferItems.find((t) => {
      const tMed = String(t?.medicineName || t?.name || '').trim().toLowerCase()
      return tMed && (tMed === nameKey || nameKey.includes(tMed) || tMed.includes(nameKey))
    })
    const prevBatch = prev?.batchNumber || prev?.batchNo || prev?.BatchNumber
    if (prevBatch && String(prevBatch).trim() && String(prevBatch).trim() !== '-') {
      return String(prevBatch).trim()
    }
  }

  // 6. Deterministic batch number matching Medicine Management standard
  const digitsMatch = (rawMedCode || rawNameVal).match(/\d+/)
  if (digitsMatch) {
    return `BAT${String(digitsMatch[0]).padStart(4, '0')}`
  }

  return `BAT${String(index + 1).padStart(4, '0')}`
}

// Ingest and consolidate all medicines from Medicine Management (live, local, and imported)
function loadAllMedicineRecords() {
  const map = new Map()

  function ingest(m) {
    if (!m || typeof m !== 'object') return
    const name = String(m?.name || m?.medicineName || m?.brandName || '').trim()
    if (!name || name === '-') return
    const code = String(m?.medicineCode || m?.code || m?.MedicineCode || m?.Code || '').trim()
    const key = `${name.toLowerCase()}___${code.toLowerCase()}`
    if (!map.has(key)) {
      map.set(key, m)
    } else {
      const existing = map.get(key)
      const existingBatch = existing?.batchNumber || existing?.BatchNumber || existing?.batchNo
      const newBatch = m?.batchNumber || m?.BatchNumber || m?.batchNo
      if (!existingBatch && newBatch) {
        map.set(key, { ...existing, ...m })
      }
    }
  }

  // 1. Check pms_imported_medicines (explicit imported medicine rows from Excel upload)
  try {
    const impRaw = localStorage.getItem('pms_imported_medicines')
    if (impRaw) {
      const parsed = JSON.parse(impRaw)
      if (Array.isArray(parsed)) parsed.forEach(ingest)
    }
  } catch {}

  // 2. Check readLocalMedicines()
  try {
    const local = readLocalMedicines()
    if (Array.isArray(local)) local.forEach(ingest)
  } catch {}

  // 3. Check pms_local_medicines directly
  try {
    const masterRaw = localStorage.getItem('pms_local_medicines')
    if (masterRaw) {
      const parsed = JSON.parse(masterRaw)
      if (Array.isArray(parsed)) parsed.forEach(ingest)
    }
  } catch {}

  // 4. Check pms_medicine_catalogue_cache
  try {
    const cacheRaw = localStorage.getItem('pms_medicine_catalogue_cache')
    if (cacheRaw) {
      const parsed = JSON.parse(cacheRaw)
      if (parsed && typeof parsed === 'object') {
        Object.values(parsed).forEach(ingest)
      }
    }
  } catch {}

  return Array.from(map.values())
}

// First-letter and prefix matching filter for Medicine Name
function filterMedicinesByInput(medicinesList, searchVal) {
  const query = String(searchVal || '').trim().toLowerCase()
  if (!query) {
    return [...medicinesList].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  }

  // When user types a single letter: strictly return medicines whose name or word starts with that letter
  if (query.length === 1) {
    const startsDirectly = []
    const startsWord = []

    medicinesList.forEach((m) => {
      const name = String(m?.name || m?.medicineName || '').trim().toLowerCase()
      if (!name) return

      if (name.startsWith(query)) {
        startsDirectly.push(m)
      } else {
        const words = name.split(/[\s\-_\/()]+/)
        if (words.some((w) => w.startsWith(query))) {
          startsWord.push(m)
        }
      }
    })

    startsDirectly.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    startsWord.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))

    return [...startsDirectly, ...startsWord]
  }

  // When user types 2 or more characters: rank prefix matches first, then word-prefix, then general substring
  const startsDirectly = []
  const startsWord = []
  const generalMatches = []

  medicinesList.forEach((m) => {
    const name = String(m?.name || m?.medicineName || '').trim().toLowerCase()
    const code = String(m?.code || m?.medicineCode || '').trim().toLowerCase()
    if (!name && !code) return

    if (name.startsWith(query)) {
      startsDirectly.push(m)
    } else {
      const words = name.split(/[\s\-_\/()]+/)
      if (words.some((w) => w.startsWith(query))) {
        startsWord.push(m)
      } else if (name.includes(query) || (code && code.includes(query))) {
        generalMatches.push(m)
      }
    }
  })

  startsDirectly.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  startsWord.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  generalMatches.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))

  return [...startsDirectly, ...startsWord, ...generalMatches]
}

export default function StockTransfers() {
  const { showToast } = useToast()
  const [items, setItems] = useState(() => {
    try {
      const local = readLocalStockTransfers()
      return Array.isArray(local) ? local : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  // Modal states
  const [viewingItem, setViewineItem] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [branches, setBranches] = useState([])
  const [signedInBranch, setSignedInBranch] = useState('Main Branch')

  // Medicine selection state (sourced directly as per Medicine Management)
  const [medicines, setMedicines] = useState(() => {
    try {
      const all = loadAllMedicineRecords()
      return all.length > 0 ? all : []
    } catch {
      return []
    }
  })
  const [createMedDropdownOpen, setCreateMedDropdownOpen] = useState(false)
  const [editMedDropdownOpen, setEditMedDropdownOpen] = useState(false)
  const createMedRef = useRef(null)
  const editMedRef = useRef(null)

  const [createBatchDropdownOpen, setCreateBatchDropdownOpen] = useState(false)
  const [editBatchDropdownOpen, setEditBatchDropdownOpen] = useState(false)
  const createBatchRef = useRef(null)
  const editBatchRef = useRef(null)

  // Derived medicine options with batch, strength, and stock from Medicine Management
  const medicineOptions = useMemo(() => {
    const map = new Map()
    const allPool = [...medicines]
    const localImported = loadAllMedicineRecords()
    localImported.forEach(m => {
      const mName = String(m?.name || m?.medicineName || '').trim().toLowerCase()
      const mCode = String(m?.medicineCode || m?.code || '').trim().toLowerCase()
      if (!allPool.some(p => {
        const pName = String(p?.name || p?.medicineName || '').trim().toLowerCase()
        const pCode = String(p?.medicineCode || p?.code || '').trim().toLowerCase()
        return (mCode && pCode && mCode === pCode) || (mName && pName && mName === pName)
      })) {
        allPool.push(m)
      }
    })

    allPool.forEach((m, idx) => {
      const name = String(m?.name || m?.medicineName || m?.brandName || '').trim()
      if (!name) return
      const key = name.toLowerCase()
      if (!map.has(key)) {
        const batchNo = resolveMedicineBatch(m, idx, items)
        map.set(key, {
          name,
          code: m?.medicineCode || m?.code || '',
          category: m?.category || m?.categoryName || '',
          dosageForm: m?.dosageForm || '',
          strength: m?.strength || '',
          batchNo: batchNo,
          stock: m?.stock ?? m?.quantity ?? m?.currentStock ?? null
        })
      }
    })
    return Array.from(map.values())
  }, [medicines, items])

  useEffect(() => {
    let active = true
    async function loadInitialData() {
      try {
        const res = await listPharmacyBranches()
        const list = res?.branches || res?.data || []
        if (active && Array.isArray(list)) {
          setBranches(list)
        }
      } catch {}

      try {
        const assignment = JSON.parse(sessionStorage.getItem('pharmacyAdminAssignment') || localStorage.getItem('pharmacyAdminAssignment') || '{}')
        const name = assignment?.branch?.name || assignment?.branchName || assignment?.branchLocation || 'Main Branch'
        const cleanName = name.includes('•') ? name.split('•')[0].trim() : name.trim()
        if (active && cleanName) {
          setSignedInBranch(cleanName)
        }
      } catch {}

      try {
        const medRes = await listMedicines()
        const medList = normalizeList(medRes)
        const localImported = loadAllMedicineRecords()
        const combined = [...localImported]
        medList.forEach(b => {
          const bName = String(b?.name || b?.medicineName || '').trim().toLowerCase()
          const bCode = String(b?.medicineCode || b?.code || '').trim().toLowerCase()
          if (!combined.some(c => {
            const cName = String(c?.name || c?.medicineName || '').trim().toLowerCase()
            const cCode = String(c?.medicineCode || c?.code || '').trim().toLowerCase()
            return (bCode && cCode && bCode === cCode) || (bName && cName && bName === cName)
          })) {
            combined.push(b)
          }
        })
        if (active && combined.length > 0) {
          setMedicines(combined)
        }
      } catch {}
    }

    loadInitialData()

    function handleMedicineSync() {
      const fresh = loadAllMedicineRecords()
      if (active && Array.isArray(fresh) && fresh.length > 0) {
        setMedicines(fresh)
      }
    }

    window.addEventListener('pms:medicines-updated', handleMedicineSync)
    window.addEventListener('pms:stock-updated', handleMedicineSync)
    window.addEventListener('storage', handleMedicineSync)

    function handleClickOutside(event) {
      if (createMedRef.current && !createMedRef.current.contains(event.target)) {
        setCreateMedDropdownOpen(false)
      }
      if (createBatchRef.current && !createBatchRef.current.contains(event.target)) {
        setCreateBatchDropdownOpen(false)
      }
      if (editMedRef.current && !editMedRef.current.contains(event.target)) {
        setEditMedDropdownOpen(false)
      }
      if (editBatchRef.current && !editBatchRef.current.contains(event.target)) {
        setEditBatchDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      active = false
      window.removeEventListener('pms:medicines-updated', handleMedicineSync)
      window.removeEventListener('pms:stock-updated', handleMedicineSync)
      window.removeEventListener('storage', handleMedicineSync)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  function openCreateModal() {
    let currentBranch = signedInBranch || 'Main Branch'
    try {
      const assignment = JSON.parse(sessionStorage.getItem('pharmacyAdminAssignment') || localStorage.getItem('pharmacyAdminAssignment') || '{}')
      const name = assignment?.branch?.name || assignment?.branchName || assignment?.branchLocation
      if (name) currentBranch = name.includes('•') ? name.split('•')[0].trim() : name.trim()
    } catch {}

    const fresh = loadAllMedicineRecords()
    if (Array.isArray(fresh) && fresh.length > 0) {
      setMedicines(fresh)
    }

    setCreateMedDropdownOpen(false)
    setCreateBatchDropdownOpen(false)
    setCreateForm(prev => ({
      ...prev,
      fromLocation: prev.fromLocation || currentBranch || 'Main Branch'
    }))
    setCreateOpen(true)
  }

  // Dashboard summaries - strictly derived from items, completely stable
  const summary = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter(t => String(t?.status || 'pending').toLowerCase() === 'pending').length,
      dispatched: items.filter(t => ['dispatched', 'in transit'].includes(String(t?.status || '').toLowerCase())).length,
      received: items.filter(t => ['received', 'completed'].includes(String(t?.status || '').toLowerCase())).length,
      cancelled: items.filter(t => String(t?.status || '').toLowerCase() === 'cancelled').length
    }
  }, [items])

  // Create Form State
  const [createForm, setCreateForm] = useState({
    fromLocation: '',
    toLocation: '',
    medicineName: '',
    batchNo: '',
    quantity: '',
    requestedBy: '',
    approvedBy: ''
  })

  // Edit Form State
  const [editForm, setEditForm] = useState({
    id: '',
    fromLocation: '',
    toLocation: '',
    medicineName: '',
    batchNo: '',
    quantity: '',
    requestedBy: '',
    approvedBy: '',
    status: 'Pending'
  })

  // Filtered medicine options for Create Form - strictly matches first-letter related medicines when 1 letter is typed
  const filteredCreateMedOptions = useMemo(() => {
    return filterMedicinesByInput(medicineOptions, createForm.medicineName)
  }, [medicineOptions, createForm.medicineName])

  // Filtered medicine options for Edit Form - strictly matches first-letter related medicines when 1 letter is typed
  const filteredEditMedOptions = useMemo(() => {
    return filterMedicinesByInput(medicineOptions, editForm?.medicineName)
  }, [medicineOptions, editForm?.medicineName])

  // Comprehensive batch number options sourced directly as per Medicine Management
  const batchOptions = useMemo(() => {
    const list = []
    const seen = new Set()

    function addBatch(batchNo, medicineName, expiryDate = '', stock = null, source = '') {
      const cleanBatch = String(batchNo || '').trim()
      if (!cleanBatch || cleanBatch === '-') return
      const cleanMed = String(medicineName || '').trim()
      const key = `${cleanBatch.toLowerCase()}___${cleanMed.toLowerCase()}`
      if (!seen.has(key)) {
        seen.add(key)
        list.push({
          batchNo: cleanBatch,
          medicineName: cleanMed,
          expiryDate: expiryDate || '',
          stock: stock !== null && !isNaN(Number(stock)) ? Number(stock) : null,
          source
        })
      }
    }

    // 1. From all medicines in Medicine Management (including imported, local, and live)
    const allPool = [...medicines]
    const localImported = loadAllMedicineRecords()
    localImported.forEach(m => {
      const mName = String(m?.name || m?.medicineName || '').trim().toLowerCase()
      const mCode = String(m?.medicineCode || m?.code || '').trim().toLowerCase()
      if (!allPool.some(p => {
        const pName = String(p?.name || p?.medicineName || '').trim().toLowerCase()
        const pCode = String(p?.medicineCode || p?.code || '').trim().toLowerCase()
        return (mCode && pCode && mCode === pCode) || (mName && pName && mName === pName)
      })) {
        allPool.push(m)
      }
    })

    allPool.forEach((m, idx) => {
      const medName = String(m?.name || m?.medicineName || m?.brandName || '').trim()
      const resolvedBatch = resolveMedicineBatch(m, idx, items)
      const exp = m?.expiryDate || m?.ExpiryDate || ''
      const stk = m?.stock ?? m?.quantity ?? m?.currentStock ?? null
      addBatch(resolvedBatch, medName, exp, stk, 'medicine')
    })

    // 2. From existing stock transfer records
    items.forEach((t) => {
      const b = t?.batchNumber || t?.batchNo || t?.BatchNumber
      const mName = t?.medicineName || t?.medicine || t?.name
      if (b && mName) {
        addBatch(b, mName, '', t?.quantity, 'transfer')
      }
    })

    // 3. From local inventory / stock if present in storage
    try {
      const rawStock = localStorage.getItem('pms_stock') || localStorage.getItem('pms_inventory')
      if (rawStock) {
        const parsedStock = JSON.parse(rawStock)
        if (Array.isArray(parsedStock)) {
          parsedStock.forEach((stk) => {
            const b = stk?.batchNo || stk?.batchNumber || stk?.batchId
            const mName = stk?.name || stk?.medicineName
            if (b) addBatch(b, mName, stk?.expiryDate, stk?.quantity || stk?.stock, 'inventory')
          })
        }
      }
    } catch {}

    // 4. From medicineCatalogReference (standard catalog batches)
    if (medicineCatalogReference && typeof medicineCatalogReference === 'object') {
      Object.values(medicineCatalogReference).forEach((ref) => {
        if (ref?.batchNumber && ref?.name) {
          addBatch(ref.batchNumber, ref.name, ref.expiryDate, ref.quantity, 'catalog')
        }
      })
    }

    return list
  }, [medicines, items])

  // Filtered batch options for Create Form - shows medicine's matching batches first, then all catalogue batches
  const filteredCreateBatchOptions = useMemo(() => {
    const searchVal = String(createForm.batchNo || '').trim().toLowerCase()
    const selectedMed = String(createForm.medicineName || '').trim().toLowerCase()

    const matchingBatches = []
    const otherBatches = []

    batchOptions.forEach((opt) => {
      const optMed = String(opt.medicineName || '').trim().toLowerCase()
      const isDirectMatch = Boolean(
        selectedMed && (
          optMed === selectedMed ||
          (selectedMed.length > 3 && optMed.includes(selectedMed)) ||
          (optMed.length > 3 && selectedMed.includes(optMed))
        )
      )

      if (isDirectMatch) {
        matchingBatches.push({ ...opt, isDirectMatch: true })
      } else {
        otherBatches.push(opt)
      }
    })

    // Matching batches for selected medicine appear at the top, followed by other available batches
    let combined = selectedMed
      ? [...matchingBatches, ...otherBatches]
      : batchOptions

    if (searchVal) {
      combined = combined.filter((b) =>
        b.batchNo.toLowerCase().includes(searchVal) ||
        (b.medicineName && b.medicineName.toLowerCase().includes(searchVal))
      )
    }

    return combined
  }, [batchOptions, createForm.batchNo, createForm.medicineName])

  // Filtered batch options for Edit Form - shows medicine's matching batches first, then all catalogue batches
  const filteredEditBatchOptions = useMemo(() => {
    const searchVal = String(editForm?.batchNo || '').trim().toLowerCase()
    const selectedMed = String(editForm?.medicineName || '').trim().toLowerCase()

    const matchingBatches = []
    const otherBatches = []

    batchOptions.forEach((opt) => {
      const optMed = String(opt.medicineName || '').trim().toLowerCase()
      const isDirectMatch = Boolean(
        selectedMed && (
          optMed === selectedMed ||
          (selectedMed.length > 3 && optMed.includes(selectedMed)) ||
          (optMed.length > 3 && selectedMed.includes(optMed))
        )
      )

      if (isDirectMatch) {
        matchingBatches.push({ ...opt, isDirectMatch: true })
      } else {
        otherBatches.push(opt)
      }
    })

    let combined = selectedMed
      ? [...matchingBatches, ...otherBatches]
      : batchOptions

    if (searchVal) {
      combined = combined.filter((b) =>
        b.batchNo.toLowerCase().includes(searchVal) ||
        (b.medicineName && b.medicineName.toLowerCase().includes(searchVal))
      )
    }

    return combined
  }, [batchOptions, editForm?.batchNo, editForm?.medicineName])

  // Validation Error States
  const [createErrors, setCreateErrors] = useState({})
  const [editErrors, setEditErrors] = useState({})

  function validateCreateForm() {
    const errs = {}
    let fromLoc = (createForm.fromLocation || '').trim()
    if (fromLoc.includes('•')) fromLoc = fromLoc.split('•')[0].trim()
    if (!fromLoc) {
      errs.fromLocation = 'From Location / Branch is required.'
    } else if (fromLoc.length < 2) {
      errs.fromLocation = 'From Location must be at least 2 characters.'
    }

    let toLoc = (createForm.toLocation || '').trim()
    if (toLoc.includes('•')) toLoc = toLoc.split('•')[0].trim()
    if (!toLoc) {
      errs.toLocation = 'To Location / Branch is required.'
    } else if (toLoc.length < 2) {
      errs.toLocation = 'To Location must be at least 2 characters.'
    } else if (fromLoc && toLoc && fromLoc.toLowerCase() === toLoc.toLowerCase()) {
      errs.toLocation = 'Source and destination locations cannot be the same.'
    }

    const medName = (createForm.medicineName || '').trim()
    if (!medName) {
      errs.medicineName = 'Medicine Name is required.'
    } else if (medName.length < 2) {
      errs.medicineName = 'Medicine Name must be at least 2 characters.'
    }

    const batch = (createForm.batchNo || '').trim()
    if (!batch) {
      errs.batchNo = 'Batch Number is required.'
    }

    const qtyStr = String(createForm.quantity || '').trim()
    if (!qtyStr) {
      errs.quantity = 'Transfer Quantity is required.'
    } else {
      const qtyNum = Number(qtyStr)
      if (isNaN(qtyNum) || qtyNum <= 0) {
        errs.quantity = 'Transfer quantity must be greater than 0.'
      } else if (!Number.isInteger(qtyNum)) {
        errs.quantity = 'Transfer quantity must be a whole number.'
      }
    }

    const reqBy = (createForm.requestedBy || '').trim()
    if (!reqBy) {
      errs.requestedBy = 'Requested By name is required.'
    } else if (reqBy.length < 2) {
      errs.requestedBy = 'Requested By name must be at least 2 characters.'
    }

    setCreateErrors(errs)
    const firstKey = Object.keys(errs)[0]
    if (firstKey) {
      const el = document.getElementById(`create-${firstKey}`)
      if (el) el.focus()
    }
    return Object.keys(errs).length === 0
  }

  function validateEditForm() {
    const errs = {}
    const fromLoc = (editForm.fromLocation || '').trim()
    if (!fromLoc) {
      errs.fromLocation = 'From Location / Branch is required.'
    } else if (fromLoc.length < 2) {
      errs.fromLocation = 'From Location must be at least 2 characters.'
    }

    const toLoc = (editForm.toLocation || '').trim()
    if (!toLoc) {
      errs.toLocation = 'To Location / Branch is required.'
    } else if (toLoc.length < 2) {
      errs.toLocation = 'To Location must be at least 2 characters.'
    } else if (fromLoc && toLoc && fromLoc.toLowerCase() === toLoc.toLowerCase()) {
      errs.toLocation = 'Source and destination locations cannot be the same.'
    }

    const medName = (editForm.medicineName || '').trim()
    if (!medName) {
      errs.medicineName = 'Medicine Name is required.'
    } else if (medName.length < 2) {
      errs.medicineName = 'Medicine Name must be at least 2 characters.'
    }

    const batch = (editForm.batchNo || '').trim()
    if (!batch) {
      errs.batchNo = 'Batch Number is required.'
    }

    const qtyStr = String(editForm.quantity || '').trim()
    if (!qtyStr) {
      errs.quantity = 'Transfer Quantity is required.'
    } else {
      const qtyNum = Number(qtyStr)
      if (isNaN(qtyNum) || qtyNum <= 0) {
        errs.quantity = 'Transfer quantity must be greater than 0.'
      } else if (!Number.isInteger(qtyNum)) {
        errs.quantity = 'Transfer quantity must be a whole number.'
      }
    }

    const reqBy = (editForm.requestedBy || '').trim()
    if (!reqBy) {
      errs.requestedBy = 'Requested By name is required.'
    } else if (reqBy.length < 2) {
      errs.requestedBy = 'Requested By name must be at least 2 characters.'
    }

    const status = (editForm.status || '').trim()
    if (!status) {
      errs.status = 'Status selection is required.'
    }

    setEditErrors(errs)
    const firstKey = Object.keys(errs)[0]
    if (firstKey) {
      const el = document.getElementById(`edit-${firstKey}`)
      if (el) el.focus()
    }
    return Object.keys(errs).length === 0
  }

  async function refresh() {
    setLoading(true)
    try {
      const response = await listStockTransfers()
      const list = normalizeList(response)
      if (Array.isArray(list) && list.length > 0) {
        setItems(list)
        writeLocalStockTransfers(list)
      } else {
        const local = readLocalStockTransfers()
        if (Array.isArray(local) && local.length > 0) {
          setItems(local)
        }
      }
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  // Filtered Stock Transfers list
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const medicine = String(item?.medicineName || item?.medicine?.name || item?.name || '').toLowerCase()
      const transId = String(item?.transferId || item?._id || item?.id || '').toLowerCase()
      const batch = String(item?.batchNo || item?.batchNumber || '').toLowerCase()
      const fromLoc = String(item?.fromLocation || item?.source?.name || (typeof item?.source === 'string' ? item.source : '') || '').toLowerCase()
      const toLoc = String(item?.toLocation || item?.destination?.name || (typeof item?.destination === 'string' ? item.destination : '') || '').toLowerCase()
      const query = search.toLowerCase().trim()

      if (!query) return true
      return medicine.includes(query) || transId.includes(query) || batch.includes(query) || fromLoc.includes(query) || toLoc.includes(query)
    })
  }, [items, search])

  // Create Submit Action
  async function handleCreateSubmit(e) {
    e.preventDefault()
    if (!validateCreateForm()) return
    setSubmitting(true)
    try {
      const quantityNum = Number(createForm.quantity || 1)
      let fromLocClean = createForm.fromLocation.trim()
      if (fromLocClean.includes('•')) fromLocClean = fromLocClean.split('•')[0].trim()
      let toLocClean = createForm.toLocation.trim()
      if (toLocClean.includes('•')) toLocClean = toLocClean.split('•')[0].trim()

      // Match destination and source branches against registered active branches
      const matchedTo = branches.find(b => {
        const bName = String(b.name || b.branchName || b.BranchName || '').trim().toLowerCase()
        return bName && (bName === toLocClean.toLowerCase() || toLocClean.toLowerCase().startsWith(bName) || bName.startsWith(toLocClean.toLowerCase()))
      })
      if (matchedTo) {
        toLocClean = String(matchedTo.name || matchedTo.branchName || matchedTo.BranchName).trim()
      }

      const matchedFrom = branches.find(b => {
        const bName = String(b.name || b.branchName || b.BranchName || '').trim().toLowerCase()
        return bName && (bName === fromLocClean.toLowerCase() || fromLocClean.toLowerCase().startsWith(bName) || bName.startsWith(fromLocClean.toLowerCase()))
      })
      if (matchedFrom) {
        fromLocClean = String(matchedFrom.name || matchedFrom.branchName || matchedFrom.BranchName).trim()
      }

      const body = {
        fromLocation: fromLocClean,
        toLocation: toLocClean,
        medicineName: createForm.medicineName.trim(),
        batchNumber: createForm.batchNo.trim(),
        batchNo: createForm.batchNo.trim(),
        transferQuantity: quantityNum,
        quantity: quantityNum,
        requestedBy: createForm.requestedBy.trim(),
        approvedBy: (createForm.approvedBy || '').trim()
      }
      const res = await createStockTransfer(body)
      const createdItem = res?.data || res || body

      setItems(prev => {
        const next = [createdItem, ...prev.filter(x => getId(x) !== getId(createdItem))]
        writeLocalStockTransfers(next)
        return next
      })

      showToast('Stock transfer created successfully!')
      setCreateOpen(false)
      setCreateForm({
        fromLocation: '',
        toLocation: '',
        medicineName: '',
        batchNo: '',
        quantity: '',
        requestedBy: '',
        approvedBy: ''
      })
      setCreateErrors({})
      refresh()
    } catch (err) {
      showToast(err.message || 'Failed to create stock transfer request.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Update Submit Action
  async function handleUpdateSubmit(e) {
    e.preventDefault()
    if (!validateEditForm()) return
    setSubmitting(true)
    try {
      const quantityNum = Number(editForm.quantity || 1)
      const body = {
        fromLocation: editForm.fromLocation.trim(),
        toLocation: editForm.toLocation.trim(),
        medicineName: editForm.medicineName.trim(),
        batchNumber: editForm.batchNo.trim(),
        batchNo: editForm.batchNo.trim(),
        transferQuantity: quantityNum,
        quantity: quantityNum,
        requestedBy: editForm.requestedBy.trim(),
        approvedBy: (editForm.approvedBy || '').trim(),
        status: editForm.status
      }
      try {
        await updateStockTransferDraft(editForm.id, {
          quantity: quantityNum,
          notes: editForm.status ? `Status: ${editForm.status}` : null
        })
      } catch {}
      await changeStockTransferStatus(editForm.id, { status: editForm.status })
      setItems(prev => {
        const next = prev.map(x => getId(x) === editForm.id ? { ...x, ...body } : x)
        writeLocalStockTransfers(next)
        return next
      })
      showToast('Stock transfer updated successfully!')
      setEditItem(null)
      setEditErrors({})
      refresh()
    } catch (err) {
      showToast(err.message || 'Failed to update stock transfer.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Action Helpers: Dispatch & Receive & Cancel
  async function handleDispatch(id) {
    setLoading(true)
    try {
      await dispatchStockTransfer(id, {})
      setItems(prev => {
        const next = prev.map(x => getId(x) === id ? { ...x, status: 'Dispatched' } : x)
        writeLocalStockTransfers(next)
        return next
      })
      showToast('Stock transfer dispatched!')
      refresh()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleReceive(id) {
    setLoading(true)
    try {
      await receiveStockTransfer(id, {})
      setItems(prev => {
        const next = prev.map(x => getId(x) === id ? { ...x, status: 'Received' } : x)
        writeLocalStockTransfers(next)
        return next
      })
      showToast('Stock transfer received and finalized!')
      refresh()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel(id) {
    setLoading(true)
    try {
      await changeStockTransferStatus(id, { status: 'Cancelled' })
      setItems(prev => {
        const next = prev.map(x => getId(x) === id ? { ...x, status: 'Cancelled' } : x)
        writeLocalStockTransfers(next)
        return next
      })
      showToast('Stock transfer cancelled.')
      refresh()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function openEdit(item) {
    setEditForm({
      id: item?._id || item?.id,
      fromLocation: item?.fromLocation || item?.source || '',
      toLocation: item?.toLocation || item?.destination || '',
      medicineName: item?.medicineName || item?.name || '',
      batchNo: item?.batchNo || item?.batchNumber || '',
      quantity: String(item?.quantity || ''),
      requestedBy: item?.requestedBy || '',
      approvedBy: item?.approvedBy || '',
      status: item?.status || 'Pending'
    })
    setEditItem(item)
  }

  async function openView(item) {
    const id = item?._id || item?.id
    try {
      const response = await getStockTransfer(id)
      setViewineItem(response?.data || response || item)
    } catch (e) {
      setViewineItem(item)
    }
  }

  // Dynamic getters for columns - 100% object-safe to prevent React crashes
  const getFromLoc = (item) => {
    const val = item?.fromLocation || item?.source || '-'
    if (val && typeof val === 'object') return val.name || val.location || '-'
    return val || '-'
  }
  const getToLoc = (item) => {
    const val = item?.toLocation || item?.destination || '-'
    if (val && typeof val === 'object') return val.name || val.location || '-'
    return val || '-'
  }
  const getMedicineName = (item) => {
    const val = item?.medicineName || item?.medicine?.name || item?.name || '-'
    if (val && typeof val === 'object') return val.name || val.medicineName || '-'
    return val || '-'
  }
  const getBatchNo = (item) => {
    const val = item?.batchNumber || item?.batchNo || '-'
    if (val && typeof val === 'object') return val.number || val.batchNumber || val.batchNo || '-'
    return val || '-'
  }
  const getQty = (item) => {
    const val = item?.transferQuantity || item?.quantity || item?.qty || 0
    if (val && typeof val === 'object') return val.amount || val.transferQuantity || val.qty || 0
    return val
  }
  const getDate = (item) => {
    const d = item?.createdAt || item?.date || '-'
    if (typeof d === 'string' && d.includes('T')) return d.split('T')[0]
    if (d && typeof d === 'object') {
      if (d instanceof Date) return d.toISOString().split('T')[0]
      return d.date || d.formatted || '-'
    }
    return String(d || '-')
  }
  const getTransferId = (item) => {
    const val = item?.transferId || item?._id || '-'
    if (val && typeof val === 'object') return val.number || val.id || '-'
    return String(val || '-')
  }

  // Badge Status Class
  const getStatusBadge = (item) => {
    const status = String(item?.status || 'Pending').toLowerCase()
    if (status.includes('completed') || status.includes('received')) return <span className="branch-status active">Received</span>
    if (status.includes('cancelled')) return <span className="branch-status expired">Cancelled</span>
    if (status.includes('dispatched') || status.includes('transit')) return <span className="branch-status view">Dispatched</span>
    if (status.includes('draft')) return <span className="branch-status" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>Draft</span>
    return <span className="branch-status near-expiry">Pending</span>
  }

  return (
    <AdminLayout headerAction={<button
              type="button"
              className="page-heading-refresh"
              onClick={refresh}
            >
              <svg viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              Refresh
            </button>} activeLabel="Stock Transfers" title="Stock Transfers" subtitle="Manaee medicine stock transfers between pharmacy locations.">
      <div className="stock-scroll-area">
        <div className="transfer-layout-container">

          {/* Summary Cards (5 Equal Sized Cards) */}
          <div className="transfer-summary-grid">
            <div className="transfer-summary-card" style={{ '--card-accent': '#2563eb', '--card-bg': '#eff6ff', '--card-border': 'rgba(37, 99, 235, 0.2)' }}>
              <div className="transfer-summary-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 1 21 5 17 9"/>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                  <polyline points="7 23 3 19 7 15"/>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
              </div>
              <div className="transfer-summary-info">
                <label>Total Transfers</label>
                <span>{summary.total}</span>
              </div>
            </div>

            <div className="transfer-summary-card" style={{ '--card-accent': '#f59e0b', '--card-bg': '#fef3c7', '--card-border': 'rgba(245, 158, 11, 0.2)' }}>
              <div className="transfer-summary-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div className="transfer-summary-info">
                <label>Pending Transfers</label>
                <span>{summary.pending}</span>
              </div>
            </div>

            <div className="transfer-summary-card" style={{ '--card-accent': '#0ea5e9', '--card-bg': '#e0f2fe', '--card-border': 'rgba(14, 165, 233, 0.2)' }}>
              <div className="transfer-summary-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="13 17 18 12 13 7"/>
                  <line x1="6" y1="12" x2="18" y2="12"/>
                </svg>
              </div>
              <div className="transfer-summary-info">
                <label>Dispatched</label>
                <span>{summary.dispatched}</span>
              </div>
            </div>

            <div className="transfer-summary-card" style={{ '--card-accent': '#10b981', '--card-bg': '#ecfdf5', '--card-border': 'rgba(16, 185, 129, 0.2)' }}>
              <div className="transfer-summary-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div className="transfer-summary-info">
                <label>Received</label>
                <span>{summary.received}</span>
              </div>
            </div>

            <div className="transfer-summary-card" style={{ '--card-accent': '#ef4444', '--card-bg': '#fee2e2', '--card-border': 'rgba(239, 68, 68, 0.2)' }}>
              <div className="transfer-summary-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <div className="transfer-summary-info">
                <label>Cancelled</label>
                <span>{summary.cancelled}</span>
              </div>
            </div>
          </div>

          {/* Table Results */}
          <section className="dispense-table-panel">
            <header className="transfer-record-header"><h2>Transfer Logs</h2>
<button
                type="button"
                className="transfer-btn transfer-btn-primary"
                onClick={openCreateModal}
              >
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Transfer
              </button>
            </header>
          {/* Search Inputs */}
          <div className="transfer-toolbar transfer-record-filters">
            <div className="transfer-search-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transfer ID, medicine, batch, location..."
              />
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
                      <th>Transfer ID</th>
                      <th>From Location</th>
                      <th>To Location</th>
                      <th>Medicine</th>
                      <th>Batch Number</th>
                      <th>Quantity</th>
                      <th>Transfer Date</th>
                      <th>Status</th>
                      <th style={{ width: '180px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length ? filteredItems.map((item, index) => (
                      <tr key={getId(item, index)}>
                        <td><code>{getTransferId(item)}</code></td>
                        <td>{getFromLoc(item)}</td>
                        <td>{getToLoc(item)}</td>
                        <td><div style={{ fontWeight: 600, color: '#1e293b' }}>{getMedicineName(item)}</div></td>
                        <td><code>{getBatchNo(item)}</code></td>
                        <td>{getQty(item)}</td>
                        <td>{getDate(item)}</td>
                        <td>{getStatusBadge(item)}</td>
                        <td>
                          <RowActions itemName={getTransferId(item)} onView={() => openView(item)} onEdit={() => openEdit(item)} onStatus={() => handleReceive(item?._id || item?.id)} onDelete={() => handleCancel(item?._id || item?.id)} />
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="9">
                          <div className="dispense-empty-state">
                            <h3>No stock transfers found.</h3>
                            <p>Stock transfers will appear here when medicine is transferred between pharmacy locations.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Modal 1: Create Transfer */}
          {createOpen && (
            <div className="transfer-modal-overlay">
              <form onSubmit={handleCreateSubmit} className="transfer-modal-container" noValidate>
                <div className="transfer-modal-header">
                  <h2>Create Stock Transfer Request</h2>
                  <button type="button" className="transfer-modal-close" onClick={() => setCreateOpen(false)}>&times;</button>
                </div>
                <div className="transfer-modal-body">
                  <div className="transfer-form-grid">
                    <div className="transfer-form-group">
                      <label>From Location / Branch *</label>
                      <input
                        type="text"
                        id="create-fromLocation"
                        list="from-branches-list"
                        value={createForm.fromLocation}
                        onChange={(e) => {
                          setCreateForm({...createForm, fromLocation: e.target.value})
                          if (createErrors.fromLocation) setCreateErrors({...createErrors, fromLocation: ''})
                        }}
                        placeholder="e.g. Main Branch"
                        style={createErrors.fromLocation ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      <datalist id="from-branches-list">
                        <option value={signedInBranch} />
                        {branches.map((b, i) => (
                          <option key={b.id || i} value={b.name || b.branchName} />
                        ))}
                      </datalist>
                      {createErrors.fromLocation && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{createErrors.fromLocation}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>To Location / Branch *</label>
                      <input
                        type="text"
                        id="create-toLocation"
                        list="to-branches-list"
                        value={createForm.toLocation}
                        onChange={(e) => {
                          setCreateForm({...createForm, toLocation: e.target.value})
                          if (createErrors.toLocation) setCreateErrors({...createErrors, toLocation: ''})
                        }}
                        placeholder="e.g. Jaya"
                        style={createErrors.toLocation ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      <datalist id="to-branches-list">
                        {branches.filter(b => (b.name || b.branchName) !== createForm.fromLocation).map((b, i) => (
                          <option key={b.id || i} value={b.name || b.branchName} />
                        ))}
                      </datalist>
                      {createErrors.toLocation && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{createErrors.toLocation}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Medicine Name *</label>
                      <div className="transfer-combobox-wrap" ref={createMedRef}>
                        <input
                          type="text"
                          id="create-medicineName"
                          className="transfer-combobox-input"
                          value={createForm.medicineName}
                          onChange={(e) => {
                            const val = e.target.value
                            setCreateForm(prev => ({ ...prev, medicineName: val }))
                            if (createErrors.medicineName) setCreateErrors(prev => ({ ...prev, medicineName: '' }))
                            setCreateMedDropdownOpen(true)
                          }}
                          onFocus={() => setCreateMedDropdownOpen(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setCreateMedDropdownOpen(false)
                          }}
                          placeholder="Select or type medicine name..."
                          style={createErrors.medicineName ? { borderColor: '#ef4444' } : {}}
                          autoComplete="off"
                          required
                        />
                        <button
                          type="button"
                          className="transfer-combobox-toggle"
                          onClick={() => setCreateMedDropdownOpen(prev => !prev)}
                          tabIndex={-1}
                          aria-label="Toggle medicine dropdown"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                              transform: createMedDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease'
                            }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>

                        {createMedDropdownOpen && (
                          <div className="transfer-combobox-menu">
                            {filteredCreateMedOptions.length > 0 ? (
                              filteredCreateMedOptions.map((med, idx) => {
                                const isSelected = createForm.medicineName.trim().toLowerCase() === med.name.toLowerCase()
                                return (
                                  <div
                                    key={med.code || `${med.name}-${idx}`}
                                    className={`transfer-combobox-option ${isSelected ? 'is-selected' : ''}`}
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      setCreateForm(prev => ({
                                        ...prev,
                                        medicineName: med.name,
                                        batchNo: med.batchNo || prev.batchNo
                                      }))
                                      if (createErrors.medicineName) {
                                        setCreateErrors(prev => ({ ...prev, medicineName: '' }))
                                      }
                                      if (med.batchNo && createErrors.batchNo) {
                                        setCreateErrors(prev => ({ ...prev, batchNo: '' }))
                                      }
                                      setCreateMedDropdownOpen(false)
    setCreateBatchDropdownOpen(false)
                                    }}
                                  >
                                    <div className="transfer-combobox-option-title">
                                      {med.name}
                                    </div>
                                    <div className="transfer-combobox-option-meta">
                                      {med.batchNo && <span>Batch: <strong>{med.batchNo}</strong></span>}
                                      {med.strength && <span>• {med.strength}</span>}
                                      {med.category && <span>• {med.category}</span>}
                                      {med.stock !== null && (
                                        <span style={{ marginLeft: 'auto', color: med.stock > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                          Stock: {med.stock}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })
                            ) : (
                              <div className="transfer-combobox-empty">
                                {createForm.medicineName.trim()
                                  ? `No existing medicines matching "${createForm.medicineName}". You can keep typing to use this name.`
                                  : 'No medicines available in catalogue.'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {createErrors.medicineName && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{createErrors.medicineName}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Batch Number *</label>
                      <div className="transfer-combobox-wrap" ref={createBatchRef}>
                        <input
                          type="text"
                          id="create-batchNo"
                          className="transfer-combobox-input"
                          value={createForm.batchNo}
                          onChange={(e) => {
                            const val = e.target.value
                            setCreateForm(prev => ({ ...prev, batchNo: val }))
                            if (createErrors.batchNo) setCreateErrors(prev => ({ ...prev, batchNo: '' }))
                            setCreateBatchDropdownOpen(true)
                          }}
                          onFocus={() => setCreateBatchDropdownOpen(true)}
                          onClick={() => setCreateBatchDropdownOpen(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setCreateBatchDropdownOpen(false)
                          }}
                          placeholder="Select or type batch number..."
                          style={createErrors.batchNo ? { borderColor: '#ef4444' } : {}}
                          autoComplete="off"
                          required
                        />
                        <button
                          type="button"
                          className="transfer-combobox-toggle"
                          onClick={() => setCreateBatchDropdownOpen(prev => !prev)}
                          tabIndex={-1}
                          aria-label="Toggle batch dropdown"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                              transform: createBatchDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease'
                            }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>

                        {createBatchDropdownOpen && (
                          <div className="transfer-combobox-menu">
                            {filteredCreateBatchOptions.length > 0 ? (
                              filteredCreateBatchOptions.map((opt, idx) => {
                                const isSelected = createForm.batchNo.trim().toLowerCase() === opt.batchNo.toLowerCase()
                                return (
                                  <div
                                    key={`${opt.batchNo}-${opt.medicineName}-${idx}`}
                                    className={`transfer-combobox-option ${isSelected ? 'is-selected' : ''}`}
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      setCreateForm(prev => ({
                                        ...prev,
                                        batchNo: opt.batchNo,
                                        medicineName: prev.medicineName || opt.medicineName
                                      }))
                                      if (createErrors.batchNo) {
                                        setCreateErrors(prev => ({ ...prev, batchNo: '' }))
                                      }
                                      if (opt.medicineName && createErrors.medicineName) {
                                        setCreateErrors(prev => ({ ...prev, medicineName: '' }))
                                      }
                                      setCreateBatchDropdownOpen(false)
                                    }}
                                  >
                                    <div className="transfer-combobox-option-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <span>{opt.batchNo}</span>
                                      {opt.isDirectMatch && (
                                        <span style={{
                                          fontSize: '10px',
                                          fontWeight: 700,
                                          padding: '2px 6px',
                                          borderRadius: '999px',
                                          background: '#ecfdf5',
                                          color: '#059669',
                                          border: '1px solid #a7f3d0'
                                        }}>
                                          Matches Selected Medicine
                                        </span>
                                      )}
                                    </div>
                                    <div className="transfer-combobox-option-meta">
                                      {opt.medicineName && <span>Medicine: <strong>{opt.medicineName}</strong></span>}
                                      {opt.expiryDate && <span>• Exp: {opt.expiryDate}</span>}
                                      {opt.stock !== null && (
                                        <span style={{ marginLeft: 'auto', color: opt.stock > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                          Stock: {opt.stock}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })
                            ) : (
                              <div className="transfer-combobox-empty">
                                {createForm.batchNo.trim()
                                  ? `No existing batch matching "${createForm.batchNo}". You can keep typing to use this batch number.`
                                  : 'No batch numbers found. Type a batch number.'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {createErrors.batchNo && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{createErrors.batchNo}</span>
                      )}
                    </div>
                    <div className="transfer-form-group full-width">
                      <label>Transfer Quantity *</label>
                      <input
                        type="number"
                        id="create-quantity"
                        value={createForm.quantity}
                        onChange={(e) => {
                          setCreateForm({...createForm, quantity: e.target.value})
                          if (createErrors.quantity) setCreateErrors({...createErrors, quantity: ''})
                        }}
                        style={createErrors.quantity ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {createErrors.quantity && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{createErrors.quantity}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Requested By *</label>
                      <input
                        type="text"
                        id="create-requestedBy"
                        value={createForm.requestedBy}
                        onChange={(e) => {
                          setCreateForm({...createForm, requestedBy: e.target.value})
                          if (createErrors.requestedBy) setCreateErrors({...createErrors, requestedBy: ''})
                        }}
                        style={createErrors.requestedBy ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {createErrors.requestedBy && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{createErrors.requestedBy}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Approved By</label>
                      <input
                        type="text"
                        id="create-approvedBy"
                        value={createForm.approvedBy}
                        onChange={(e) => setCreateForm({...createForm, approvedBy: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <div className="transfer-modal-footer">
                  <button type="button" className="transfer-btn transfer-btn-secondary" onClick={() => setCreateOpen(false)} disabled={submitting}>Cancel</button>
                  <button type="submit" className="transfer-btn transfer-btn-primary" disabled={submitting}>
                    {submitting ? 'Requesting...' : 'Request Transfer'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal 2: Edit Transfer */}
          {editItem && (
            <div className="transfer-modal-overlay">
              <form onSubmit={handleUpdateSubmit} className="transfer-modal-container" noValidate>
                <div className="transfer-modal-header">
                  <h2>Update Stock Transfer: {getTransferId(editItem)}</h2>
                  <button type="button" className="transfer-modal-close" onClick={() => setEditItem(null)}>&times;</button>
                </div>
                <div className="transfer-modal-body">
                  <div className="transfer-form-grid">
                    <div className="transfer-form-group">
                      <label>From Location / Branch *</label>
                      <input
                        type="text"
                        id="edit-fromLocation"
                        value={editForm.fromLocation}
                        onChange={(e) => {
                          setEditForm({...editForm, fromLocation: e.target.value})
                          if (editErrors.fromLocation) setEditErrors({...editErrors, fromLocation: ''})
                        }}
                        style={editErrors.fromLocation ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {editErrors.fromLocation && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{editErrors.fromLocation}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>To Location / Branch *</label>
                      <input
                        type="text"
                        id="edit-toLocation"
                        value={editForm.toLocation}
                        onChange={(e) => {
                          setEditForm({...editForm, toLocation: e.target.value})
                          if (editErrors.toLocation) setEditErrors({...editErrors, toLocation: ''})
                        }}
                        style={editErrors.toLocation ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {editErrors.toLocation && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{editErrors.toLocation}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Medicine Name *</label>
                      <div className="transfer-combobox-wrap" ref={editMedRef}>
                        <input
                          type="text"
                          id="edit-medicineName"
                          className="transfer-combobox-input"
                          value={editForm.medicineName}
                          onChange={(e) => {
                            const val = e.target.value
                            setEditForm(prev => ({ ...prev, medicineName: val }))
                            if (editErrors.medicineName) setEditErrors(prev => ({ ...prev, medicineName: '' }))
                            setEditMedDropdownOpen(true)
                          }}
                          onFocus={() => setEditMedDropdownOpen(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditMedDropdownOpen(false)
                          }}
                          placeholder="Select or type medicine name..."
                          style={editErrors.medicineName ? { borderColor: '#ef4444' } : {}}
                          autoComplete="off"
                          required
                        />
                        <button
                          type="button"
                          className="transfer-combobox-toggle"
                          onClick={() => setEditMedDropdownOpen(prev => !prev)}
                          tabIndex={-1}
                          aria-label="Toggle medicine dropdown"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                              transform: editMedDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease'
                            }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>

                        {editMedDropdownOpen && (
                          <div className="transfer-combobox-menu">
                            {filteredEditMedOptions.length > 0 ? (
                              filteredEditMedOptions.map((med, idx) => {
                                const isSelected = editForm.medicineName.trim().toLowerCase() === med.name.toLowerCase()
                                return (
                                  <div
                                    key={med.code || `${med.name}-${idx}`}
                                    className={`transfer-combobox-option ${isSelected ? 'is-selected' : ''}`}
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      setEditForm(prev => ({
                                        ...prev,
                                        medicineName: med.name,
                                        batchNo: med.batchNo || prev.batchNo
                                      }))
                                      if (editErrors.medicineName) {
                                        setEditErrors(prev => ({ ...prev, medicineName: '' }))
                                      }
                                      if (med.batchNo && editErrors.batchNo) {
                                        setEditErrors(prev => ({ ...prev, batchNo: '' }))
                                      }
                                      setEditMedDropdownOpen(false)
                                    }}
                                  >
                                    <div className="transfer-combobox-option-title">
                                      {med.name}
                                    </div>
                                    <div className="transfer-combobox-option-meta">
                                      {med.batchNo && <span>Batch: <strong>{med.batchNo}</strong></span>}
                                      {med.strength && <span>• {med.strength}</span>}
                                      {med.category && <span>• {med.category}</span>}
                                      {med.stock !== null && (
                                        <span style={{ marginLeft: 'auto', color: med.stock > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                          Stock: {med.stock}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })
                            ) : (
                              <div className="transfer-combobox-empty">
                                {editForm.medicineName.trim()
                                  ? `No existing medicines matching "${editForm.medicineName}". You can keep typing to use this name.`
                                  : 'No medicines available in catalogue.'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {editErrors.medicineName && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{editErrors.medicineName}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Batch Number *</label>
                      <div className="transfer-combobox-wrap" ref={editBatchRef}>
                        <input
                          type="text"
                          id="edit-batchNo"
                          className="transfer-combobox-input"
                          value={editForm.batchNo}
                          onChange={(e) => {
                            const val = e.target.value
                            setEditForm(prev => ({ ...prev, batchNo: val }))
                            if (editErrors.batchNo) setEditErrors(prev => ({ ...prev, batchNo: '' }))
                            setEditBatchDropdownOpen(true)
                          }}
                          onFocus={() => setEditBatchDropdownOpen(true)}
                          onClick={() => setEditBatchDropdownOpen(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditBatchDropdownOpen(false)
                          }}
                          placeholder="Select or type batch number..."
                          style={editErrors.batchNo ? { borderColor: '#ef4444' } : {}}
                          autoComplete="off"
                          required
                        />
                        <button
                          type="button"
                          className="transfer-combobox-toggle"
                          onClick={() => setEditBatchDropdownOpen(prev => !prev)}
                          tabIndex={-1}
                          aria-label="Toggle batch dropdown"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                              transform: editBatchDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease'
                            }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>

                        {editBatchDropdownOpen && (
                          <div className="transfer-combobox-menu">
                            {filteredEditBatchOptions.length > 0 ? (
                              filteredEditBatchOptions.map((opt, idx) => {
                                const isSelected = editForm.batchNo.trim().toLowerCase() === opt.batchNo.toLowerCase()
                                return (
                                  <div
                                    key={`${opt.batchNo}-${opt.medicineName}-${idx}`}
                                    className={`transfer-combobox-option ${isSelected ? 'is-selected' : ''}`}
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      setEditForm(prev => ({
                                        ...prev,
                                        batchNo: opt.batchNo,
                                        medicineName: prev.medicineName || opt.medicineName
                                      }))
                                      if (editErrors.batchNo) {
                                        setEditErrors(prev => ({ ...prev, batchNo: '' }))
                                      }
                                      if (opt.medicineName && editErrors.medicineName) {
                                        setEditErrors(prev => ({ ...prev, medicineName: '' }))
                                      }
                                      setEditBatchDropdownOpen(false)
                                    }}
                                  >
                                    <div className="transfer-combobox-option-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <span>{opt.batchNo}</span>
                                      {opt.isDirectMatch && (
                                        <span style={{
                                          fontSize: '10px',
                                          fontWeight: 700,
                                          padding: '2px 6px',
                                          borderRadius: '999px',
                                          background: '#ecfdf5',
                                          color: '#059669',
                                          border: '1px solid #a7f3d0'
                                        }}>
                                          Matches Selected Medicine
                                        </span>
                                      )}
                                    </div>
                                    <div className="transfer-combobox-option-meta">
                                      {opt.medicineName && <span>Medicine: <strong>{opt.medicineName}</strong></span>}
                                      {opt.expiryDate && <span>• Exp: {opt.expiryDate}</span>}
                                      {opt.stock !== null && (
                                        <span style={{ marginLeft: 'auto', color: opt.stock > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                          Stock: {opt.stock}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })
                            ) : (
                              <div className="transfer-combobox-empty">
                                {editForm.batchNo.trim()
                                  ? `No existing batch matching "${editForm.batchNo}". You can keep typing to use this batch number.`
                                  : 'No batch numbers found. Type a batch number.'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {editErrors.batchNo && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{editErrors.batchNo}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Status *</label>
                      <select
                        id="edit-status"
                        value={editForm.status}
                        onChange={(e) => {
                          setEditForm({...editForm, status: e.target.value})
                          if (editErrors.status) setEditErrors({...editErrors, status: ''})
                        }}
                        style={editErrors.status ? { borderColor: '#ef4444' } : {}}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Pending">Pending</option>
                        <option value="Dispatched">Dispatched</option>
                        <option value="Received">Received</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                      {editErrors.status && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{editErrors.status}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Transfer Quantity *</label>
                      <input
                        type="number"
                        id="edit-quantity"
                        value={editForm.quantity}
                        onChange={(e) => {
                          setEditForm({...editForm, quantity: e.target.value})
                          if (editErrors.quantity) setEditErrors({...editErrors, quantity: ''})
                        }}
                        style={editErrors.quantity ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {editErrors.quantity && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{editErrors.quantity}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Requested By *</label>
                      <input
                        type="text"
                        id="edit-requestedBy"
                        value={editForm.requestedBy}
                        onChange={(e) => {
                          setEditForm({...editForm, requestedBy: e.target.value})
                          if (editErrors.requestedBy) setEditErrors({...editErrors, requestedBy: ''})
                        }}
                        style={editErrors.requestedBy ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {editErrors.requestedBy && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{editErrors.requestedBy}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Approved By</label>
                      <input
                        type="text"
                        id="edit-approvedBy"
                        value={editForm.approvedBy}
                        onChange={(e) => setEditForm({...editForm, approvedBy: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <div className="transfer-modal-footer">
                  <button type="button" className="transfer-btn transfer-btn-secondary" onClick={() => setEditItem(null)} disabled={submitting}>Cancel</button>
                  <button type="submit" className="transfer-btn transfer-btn-primary" disabled={submitting}>
                    {submitting ? 'Updating...' : 'Update Transfer'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal 3: View Details */}
          {viewingItem && (
            <div className="transfer-modal-overlay">
              <div className="transfer-modal-container">
                <div className="transfer-modal-header">
                  <h2>Stock Transfer Details: {getTransferId(viewingItem)}</h2>
                  <button type="button" className="transfer-modal-close" onClick={() => setViewineItem(null)}>&times;</button>
                </div>
                <div className="transfer-modal-body">
                  <div className="transfer-detail-row">
                    <div className="transfer-detail-item">
                      <label>Source Location</label>
                      <span>{getFromLoc(viewingItem)}</span>
                    </div>
                    <div className="transfer-detail-item">
                      <label>Destination Location</label>
                      <span>{getToLoc(viewingItem)}</span>
                    </div>
                  </div>
                  <div className="transfer-detail-row">
                    <div className="transfer-detail-item">
                      <label>Medicine Name</label>
                      <span>{getMedicineName(viewingItem)}</span>
                    </div>
                    <div className="transfer-detail-item">
                      <label>Batch Number</label>
                      <span><code>{getBatchNo(viewingItem)}</code></span>
                    </div>
                  </div>
                  <div className="transfer-detail-row">
                    <div className="transfer-detail-item">
                      <label>Transfer Quantity</label>
                      <span>{getQty(viewingItem)} units</span>
                    </div>
                    <div className="transfer-detail-item">
                      <label>Transfer Date</label>
                      <span>{getDate(viewingItem)}</span>
                    </div>
                  </div>
                  <div className="transfer-detail-row">
                    <div className="transfer-detail-item">
                      <label>Requested By</label>
                      <span>{viewingItem?.requestedBy || '-'}</span>
                    </div>
                    <div className="transfer-detail-item">
                      <label>Approved By</label>
                      <span>{viewingItem?.approvedBy || '-'}</span>
                    </div>
                  </div>
                  <div className="transfer-detail-item">
                    <label>Transfer Status</label>
                    <div style={{ marginTop: '4px' }}>{getStatusBadge(viewingItem)}</div>
                  </div>
                </div>
                <div className="transfer-modal-footer">
                  <button type="button" className="transfer-btn transfer-btn-primary" onClick={() => setViewineItem(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </AdminLayout>
  )
}



