const DB = 'pms-prescription-references'

export function prescriptionScope() {
  function read(key) { try { return JSON.parse(sessionStorage.getItem(key) || localStorage.getItem(key) || '{}') } catch { return {} } }
  const user = read('pharmacistUser')
  const assignment = read('pharmacistAssignment')
  const actor = user.id || user.userId || user.pharmacistId || user._id || user.email
  if (!actor) throw new Error('Please sign in as a pharmacist to save prescription references.')
  return JSON.stringify([actor, assignment.pharmacyId || user.pharmacyId || '', assignment.branchId || user.branchId || ''])
}

async function database() {
  if (!globalThis.indexedDB) throw new Error('This browser cannot save prescription drafts. Please use a browser with device storage enabled.')
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('references', { keyPath: 'key' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Unable to open prescription storage on this device.'))
  })
}

async function transaction(mode, action) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('references', mode)
    const request = action(tx.objectStore('references'))
    tx.oncomplete = () => { db.close(); resolve(request?.result) }
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error('Unable to save prescription references on this device. Check available storage.')) }
  })
}

export function readPrescriptionDraft(scope) { return transaction('readonly', (store) => store.get(`draft:${scope}`)) }
export function savePrescriptionDraft(scope, draft) { return transaction('readwrite', (store) => store.put({ key: `draft:${scope}`, scope, draft, savedAt: new Date().toISOString() })) }
export function archivePrescription(scope, draft) { return transaction('readwrite', (store) => store.put({ key: `record:${scope}:${draft.requestId}`, scope, draft, savedAt: new Date().toISOString() })) }
export async function listPrescriptionReferences(scope) {
  const records = await transaction('readonly', (store) => store.getAll())
  return records.filter((record) => record.scope === scope && record.key.startsWith('record:')).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}
export function clearPrescriptionDraft(scope) { return transaction('readwrite', (store) => store.delete(`draft:${scope}`)) }
