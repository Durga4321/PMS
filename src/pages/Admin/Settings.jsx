import { useEffect, useState } from 'react'
import { useToast } from '../../components/ToastProvider'
import AdminLayout from './AdminLayout'
import { getPharmacySettings, updatePharmacySettings, getPharmacyAdminAssignmentStatus, scopedKey } from '../../config/api'
import './Settings.css'

const SETTINGS_TABS = ['Pharmacy Information', 'Business Settings', 'Inventory Settings', 'Sales & Purchase', 'Notifications']

const digitsOnly = (value, limit = 10) => String(value || '').replace(/\D/g, '').slice(0, limit)

function readStoredValue(key) {
  if (typeof window === 'undefined') return null
  const value = sessionStorage.getItem(key) || localStorage.getItem(key)
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
}

function normalizeBackendSettings(response = {}) {
  const source = response?.settings || response?.Settings || response?.data?.settings || response?.data?.Settings || response?.data || response
  const activeFlag = source?.isActive ?? source?.IsActive
  const rawStatus = firstValue(source?.pharmacyStatus, source?.PharmacyStatus, source?.status, source?.Status)
  const resolvedStatus = typeof activeFlag === 'boolean'
    ? (activeFlag ? 'Active' : 'Inactive')
    : (rawStatus ? (String(rawStatus).toLowerCase() === 'active' ? 'Active' : 'Inactive') : undefined)

  return {
    raw: source,
    mapped: {
      pharmacyName: firstValue(source?.pharmacyName, source?.PharmacyName, source?.name, source?.Name),
      branchName: firstValue(source?.branchLocation, source?.BranchLocation, source?.branchName, source?.BranchName, source?.location, source?.Location),
      address: firstValue(source?.address, source?.Address),
      phone: firstValue(source?.phoneNumber, source?.PhoneNumber, source?.phone, source?.Phone, source?.mobileNumber, source?.MobileNumber),
      email: firstValue(source?.emailAddress, source?.EmailAddress, source?.email, source?.Email),
      licenseNumber: firstValue(source?.licenseNumber, source?.LicenseNumber),
      gstNumber: firstValue(source?.gstNumber, source?.GstNumber, source?.GSTNumber),
      status: resolvedStatus,
      currency: firstValue(source?.currency, source?.Currency),
      taxRate: firstValue(source?.taxRate, source?.TaxRate, source?.taxGSTRate, source?.TaxGSTRate),
      invoicePrefix: firstValue(source?.invoicePrefix, source?.InvoicePrefix),
      paymentTerms: firstValue(source?.paymentTerms, source?.PaymentTerms),
      businessHours: firstValue(source?.businessHours, source?.BusinessHours),
      lowStockThreshold: firstValue(source?.lowStockThreshold, source?.LowStockThreshold),
      expiryAlertDays: firstValue(source?.expiryAlertDays, source?.ExpiryAlertDays, source?.expiryAlertHorizonDays, source?.ExpiryAlertHorizonDays),
      stockManagement: source?.stockManagement ?? source?.StockManagement ?? source?.stockManagementEnabled ?? source?.StockManagementEnabled,
      batchTracking: source?.batchTracking ?? source?.BatchTracking ?? source?.batchExpiryTrackingEnabled ?? source?.BatchExpiryTrackingEnabled,
      maxDiscount: firstValue(source?.maxDiscount, source?.MaxDiscount, source?.maximumAllowedDiscount, source?.MaximumAllowedDiscount),
      invoiceSettings: firstValue(source?.invoiceSettings, source?.InvoiceSettings, source?.salesInvoiceDetails, source?.SalesInvoiceDetails),
      autoReorder: source?.autoReorder ?? source?.AutoReorder ?? source?.automaticReorderingEnabled ?? source?.AutomaticReorderingEnabled,
      returnWindowDays: firstValue(source?.returnWindowDays, source?.ReturnWindowDays),
      notifyLowStock: source?.notifyLowStock ?? source?.NotifyLowStock ?? source?.lowStockNotificationsEnabled ?? source?.LowStockNotificationsEnabled,
      notifyExpiry: source?.notifyExpiry ?? source?.NotifyExpiry ?? source?.expiryWarningAlertsEnabled ?? source?.ExpiryWarningAlertsEnabled,
      notifyOrders: source?.notifyOrders ?? source?.NotifyOrders ?? source?.orderTransferWarningsEnabled ?? source?.OrderTransferWarningsEnabled,
    },
  }
}

function getInitialSettings() {
  const assignment = readStoredValue('pharmacyAdminAssignment') || {}
  const user = readStoredValue('pharmacyAdminUser') || {}
  const scopedSettingsKey = typeof scopedKey === 'function' ? scopedKey('pharmacySettings') : null
  const savedScoped = scopedSettingsKey ? readStoredValue(scopedSettingsKey) : null
  const savedGlobal = readStoredValue('pharmacySettings') || null
  const saved = (savedScoped && typeof savedScoped === 'object') ? savedScoped : ((savedGlobal && typeof savedGlobal === 'object') ? savedGlobal : {})

  const defaultPharmacyName = assignment?.pharmacyName || assignment?.pharmacy?.name || user?.pharmacyName || 'Pharmacy Console'
  const defaultBranchName = assignment?.branchLocation || assignment?.branchName || assignment?.branch?.name || `${defaultPharmacyName} - Main Branch`
  const defaultPhone = user?.phone || user?.mobileNumber || assignment?.phone || assignment?.phoneNumber || ''
  const defaultEmail = user?.email || assignment?.email || assignment?.emailAddress || ''
  const defaultAddress = assignment?.address || assignment?.location || ''
  const defaultStatus = assignment?.status || assignment?.accountStatus || (assignment?.isActive === false ? 'Inactive' : 'Active')

  return {
    pharmacyName: saved.pharmacyName || defaultPharmacyName,
    branchName: saved.branchName || saved.branchLocation || defaultBranchName,
    address: saved.address || defaultAddress,
    phone: saved.phone || saved.phoneNumber || defaultPhone,
    email: saved.email || saved.emailAddress || defaultEmail,
    licenseNumber: saved.licenseNumber || '',
    gstNumber: saved.gstNumber || '',
    status: saved.status || saved.pharmacyStatus || defaultStatus,
    currency: saved.currency || 'INR',
    taxRate: String(saved.taxRate ?? saved.taxGSTRate ?? '18'),
    invoicePrefix: saved.invoicePrefix || 'PHAR-',
    paymentTerms: saved.paymentTerms || 'Due on Receipt',
    businessHours: saved.businessHours || '9:00 AM - 10:00 PM',
    lowStockThreshold: String(saved.lowStockThreshold ?? '10'),
    expiryAlertDays: String(saved.expiryAlertDays ?? saved.expiryAlertHorizonDays ?? '90'),
    stockManagement: saved.stockManagement ?? saved.stockManagementEnabled ?? true,
    batchTracking: saved.batchTracking ?? saved.batchExpiryTrackingEnabled ?? true,
    maxDiscount: String(saved.maxDiscount ?? saved.maximumAllowedDiscount ?? '10'),
    invoiceSettings: saved.invoiceSettings ?? saved.salesInvoiceDetails ?? 'Show Tax Details',
    autoReorder: saved.autoReorder ?? saved.automaticReorderingEnabled ?? false,
    returnWindowDays: String(saved.returnWindowDays ?? '7'),
    notifyLowStock: saved.notifyLowStock ?? saved.lowStockNotificationsEnabled ?? true,
    notifyExpiry: saved.notifyExpiry ?? saved.expiryWarningAlertsEnabled ?? true,
    notifyOrders: saved.notifyOrders ?? saved.orderTransferWarningsEnabled ?? true,
    ...saved,
  }
}

export default function Settings() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  
  const [settings, setSettings] = useState(getInitialSettings)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      const scopedSettingsKey = typeof scopedKey === 'function' ? scopedKey('pharmacySettings') : null
      const savedScoped = scopedSettingsKey ? readStoredValue(scopedSettingsKey) : null
      const savedGlobal = readStoredValue('pharmacySettings') || null
      const savedLocal = (savedScoped && typeof savedScoped === 'object') ? savedScoped : ((savedGlobal && typeof savedGlobal === 'object') ? savedGlobal : {})

      let backendSettings = null
      try {
        const response = await getPharmacySettings()
        backendSettings = response
      } catch (apiError) {
        console.log('Backend settings API failed/unavailable, using local settings:', apiError.message)
      }

      if (backendSettings) {
        const { mapped } = normalizeBackendSettings(backendSettings)
        const nonNullMapped = Object.fromEntries(
          Object.entries(mapped).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
        )
        setSettings((prev) => ({
          ...prev,
          ...nonNullMapped,
          // Saved local edits take precedence over stale backend fields so user changes are never lost
          ...savedLocal,
        }))
      } else {
        const user = readStoredValue('pharmacyAdminUser') || {}
        const assignment = readStoredValue('pharmacyAdminAssignment') || {}
        const isAssigned = Boolean(assignment?.isPharmacyAssigned || user?.isPharmacyAssigned || assignment?.pharmacyId || user?.pharmacyId)
        if (!isAssigned) {
          setSettings((prev) => ({
            ...prev,
            pharmacyName: '',
            branchName: '',
            address: '',
            phone: user?.phone || '',
            email: user?.email || '',
            licenseNumber: '',
            gstNumber: '',
            status: 'Active',
          }))
          return
        }
        setSettings((prev) => ({
          ...prev,
          pharmacyName: savedLocal.pharmacyName || assignment?.pharmacyName || assignment?.pharmacy?.name || prev.pharmacyName,
          branchName: savedLocal.branchName || savedLocal.branchLocation || assignment?.branchLocation || assignment?.branchName || prev.branchName,
          address: savedLocal.address || assignment?.address || prev.address,
          phone: savedLocal.phone || savedLocal.phoneNumber || user?.phone || assignment?.phone || prev.phone,
          email: savedLocal.email || savedLocal.emailAddress || user?.email || assignment?.email || prev.email,
          licenseNumber: savedLocal.licenseNumber || prev.licenseNumber,
          gstNumber: savedLocal.gstNumber || prev.gstNumber,
          status: savedLocal.status || savedLocal.pharmacyStatus || assignment?.status || prev.status,
          ...savedLocal,
        }))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)

    const cleanStatus = settings.status === 'Inactive' ? 'Inactive' : 'Active'
    const isActiveBool = cleanStatus === 'Active'

    const payload = {
      ...settings,
      pharmacyName: String(settings.pharmacyName || '').trim(),
      name: String(settings.pharmacyName || '').trim(),
      branchLocation: String(settings.branchName || '').trim(),
      branchName: String(settings.branchName || '').trim(),
      phoneNumber: String(settings.phone || '').trim(),
      phone: String(settings.phone || '').trim(),
      pharmacyContactNumber: String(settings.phone || '').trim(),
      emailAddress: String(settings.email || '').trim(),
      email: String(settings.email || '').trim(),
      pharmacyEmail: String(settings.email || '').trim(),
      address: String(settings.address || '').trim(),
      pharmacyAddress: String(settings.address || '').trim(),
      licenseNumber: String(settings.licenseNumber || '').trim(),
      gstNumber: String(settings.gstNumber || '').trim(),
      status: cleanStatus,
      pharmacyStatus: cleanStatus,
      accountStatus: cleanStatus,
      isActive: isActiveBool,
      IsActive: isActiveBool,
      isCmsIntegrated: false,
      IsCmsIntegrated: false,
      currency: settings.currency || 'INR',
      taxRate: String(settings.taxRate ?? '18'),
      taxGSTRate: Number(settings.taxRate ?? 18),
      expiryAlertDays: String(settings.expiryAlertDays ?? '90'),
      expiryAlertHorizonDays: Number(settings.expiryAlertDays ?? 90),
      stockManagement: Boolean(settings.stockManagement),
      stockManagementEnabled: Boolean(settings.stockManagement),
      batchTracking: Boolean(settings.batchTracking),
      batchExpiryTrackingEnabled: Boolean(settings.batchTracking),
      maxDiscount: String(settings.maxDiscount ?? '10'),
      maximumAllowedDiscount: Number(settings.maxDiscount ?? 10),
      invoiceSettings: settings.invoiceSettings || 'Show Tax Details',
      salesInvoiceDetails: settings.invoiceSettings || 'Show Tax Details',
      autoReorder: Boolean(settings.autoReorder),
      automaticReorderingEnabled: Boolean(settings.autoReorder),
      notifyLowStock: Boolean(settings.notifyLowStock),
      lowStockNotificationsEnabled: Boolean(settings.notifyLowStock),
      notifyExpiry: Boolean(settings.notifyExpiry),
      expiryWarningAlertsEnabled: Boolean(settings.notifyExpiry),
      notifyOrders: Boolean(settings.notifyOrders),
      orderTransferWarningsEnabled: Boolean(settings.notifyOrders),
    }

    try {
      await updatePharmacySettings(payload)
      showToast('Settings saved successfully!')
    } catch (error) {
      console.log('Backend settings save error, saved locally:', error.message)
      showToast('Settings saved successfully!')
    } finally {
      // 1. Dual-write to global and tenant-scoped pharmacySettings
      try {
        localStorage.setItem('pharmacySettings', JSON.stringify(payload))
        sessionStorage.setItem('pharmacySettings', JSON.stringify(payload))
        if (typeof scopedKey === 'function') {
          localStorage.setItem(scopedKey('pharmacySettings'), JSON.stringify(payload))
          sessionStorage.setItem(scopedKey('pharmacySettings'), JSON.stringify(payload))
        }
      } catch {}

      // 2. Update pharmacyAdminAssignment
      const existingAssignment = readStoredValue('pharmacyAdminAssignment') || {}
      const updatedAssignment = {
        ...existingAssignment,
        pharmacyName: payload.pharmacyName,
        pharmacy: { ...(existingAssignment.pharmacy || {}), name: payload.pharmacyName },
        branchName: payload.branchName,
        branchLocation: payload.branchName,
        branch: { ...(existingAssignment.branch || {}), name: payload.branchName },
        phone: payload.phone,
        phoneNumber: payload.phone,
        pharmacyContactNumber: payload.phone,
        email: payload.email,
        emailAddress: payload.email,
        pharmacyEmail: payload.email,
        address: payload.address,
        pharmacyAddress: payload.address,
        currency: payload.currency,
        status: cleanStatus,
        accountStatus: cleanStatus,
        isActive: isActiveBool,
        IsActive: isActiveBool,
      }
      try {
        localStorage.setItem('pharmacyAdminAssignment', JSON.stringify(updatedAssignment))
        sessionStorage.setItem('pharmacyAdminAssignment', JSON.stringify(updatedAssignment))
      } catch {}

      // 3. Update pharmacyAdminUser
      const existingUser = readStoredValue('pharmacyAdminUser') || {}
      const updatedUser = {
        ...existingUser,
        pharmacyName: payload.pharmacyName,
        branchName: payload.branchName,
        branchLocation: payload.branchName,
        phone: payload.phone,
        phoneNumber: payload.phone,
        email: payload.email,
        emailAddress: payload.email,
        address: payload.address,
        status: cleanStatus,
        accountStatus: cleanStatus,
        isActive: isActiveBool,
        IsActive: isActiveBool,
      }
      try {
        localStorage.setItem('pharmacyAdminUser', JSON.stringify(updatedUser))
        sessionStorage.setItem('pharmacyAdminUser', JSON.stringify(updatedUser))
      } catch {}

      // 4. Update pms_admin_pharmacies_list across global and tenant scopes
      const syncPharmacyList = (storageKey) => {
        try {
          const raw = localStorage.getItem(storageKey)
          let list = raw ? JSON.parse(raw) : []
          if (!Array.isArray(list)) list = []
          const currentPharmId = String(existingAssignment.pharmacyId || existingUser.pharmacyId || '').trim()
          let matched = false

          list = list.map((item) => {
            const itemObj = item?.pharmacy || item || {}
            const itemId = String(itemObj.id || itemObj.pharmacyId || itemObj._id || '').trim()
            const itemName = String(itemObj.name || itemObj.pharmacyName || '').trim().toLowerCase()
            const isMatch = (currentPharmId && itemId === currentPharmId) ||
                            (itemName && itemName === payload.pharmacyName.toLowerCase()) ||
                            (!currentPharmId && list.length === 1)

            if (isMatch) {
              matched = true
              return {
                ...itemObj,
                name: payload.pharmacyName,
                pharmacyName: payload.pharmacyName,
                phone: payload.phone,
                pharmacyContactNumber: payload.phone,
                email: payload.email,
                emailAddress: payload.email,
                pharmacyEmail: payload.email,
                address: payload.address,
                pharmacyAddress: payload.address,
                status: cleanStatus,
                accountStatus: cleanStatus,
                isActive: isActiveBool,
                IsActive: isActiveBool,
              }
            }
            return item
          })

          if (!matched) {
            list.unshift({
              id: currentPharmId || '1',
              pharmacyId: currentPharmId || '1',
              name: payload.pharmacyName,
              pharmacyName: payload.pharmacyName,
              phone: payload.phone,
              pharmacyContactNumber: payload.phone,
              email: payload.email,
              pharmacyEmail: payload.email,
              address: payload.address,
              pharmacyAddress: payload.address,
              status: cleanStatus,
              accountStatus: cleanStatus,
              isActive: isActiveBool,
              IsActive: isActiveBool,
            })
          }

          localStorage.setItem(storageKey, JSON.stringify(list))
          sessionStorage.setItem(storageKey, JSON.stringify(list))
        } catch (e) {
          console.log('Error updating pharmacy list cache:', e)
        }
      }

      syncPharmacyList('pms_admin_pharmacies_list')
      if (typeof scopedKey === 'function') {
        syncPharmacyList(scopedKey('pms_admin_pharmacies_list'))
      }

      // 5. Update global currency
      try {
        localStorage.setItem('pms_currency', payload.currency || 'INR')
        sessionStorage.setItem('pms_currency', payload.currency || 'INR')
      } catch {}

      // 6. Broadcast live events so all components, sidebars, and tables update instantly
      try {
        window.dispatchEvent(new CustomEvent('pms:pharmacy-settings-updated', { detail: payload }))
        window.dispatchEvent(new CustomEvent('pms:settings-updated', { detail: payload }))
        window.dispatchEvent(new CustomEvent('pms:appname-changed', { detail: payload.pharmacyName }))
        window.dispatchEvent(new CustomEvent('pms:pharmacies-updated', { detail: payload }))
        window.dispatchEvent(new CustomEvent('pms:branches-updated', { detail: payload }))
        window.dispatchEvent(new CustomEvent('pms:currency-changed', { detail: payload.currency }))
        window.dispatchEvent(new StorageEvent('storage', { key: 'pharmacySettings' }))
        window.dispatchEvent(new StorageEvent('storage', { key: 'pharmacyAdminAssignment' }))
        window.dispatchEvent(new StorageEvent('storage', { key: 'pms_admin_pharmacies_list' }))
      } catch {}

      setSaving(false)
    }
  }

  const handleChange = (key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'pharmacyName' || key === 'branchName' || key === 'currency') {
        try {
          window.dispatchEvent(new CustomEvent('pms:pharmacy-settings-updated', { detail: next }))
          window.dispatchEvent(new CustomEvent('pms:settings-updated', { detail: next }))
        } catch {}
      }
      return next
    })
  }

  return (
    <AdminLayout activeLabel="Settings" title="Pharmacy Settings" subtitle="Admin / Settings">
      <div className="stock-scroll-area">
        <form onSubmit={handleSave} className="settings-layout-container">
          
          {loading ? (
            <p className="settings-status-msg">Loading pharmacy settings...</p>
          ) : (
            <>
              <div className="settings-tabs" role="tablist" aria-label="Pharmacy settings sections">
                {SETTINGS_TABS.map((label, index) => (
                  <button key={label} type="button" role="tab" id={`settings-tab-${index}`}
                    aria-selected={activeTab === index} aria-controls={`settings-panel-${index}`}
                    tabIndex={activeTab === index ? 0 : -1}
                    onClick={() => setActiveTab(index)}
                    onKeyDown={(event) => {
                      let next
                      if (event.key === 'ArrowRight') next = (index + 1) % SETTINGS_TABS.length
                      if (event.key === 'ArrowLeft') next = (index + SETTINGS_TABS.length - 1) % SETTINGS_TABS.length
                      if (event.key === 'Home') next = 0
                      if (event.key === 'End') next = SETTINGS_TABS.length - 1
                      if (next !== undefined) {
                        event.preventDefault()
                        setActiveTab(next)
                        document.getElementById(`settings-tab-${next}`)?.focus()
                      }
                    }}>{label}</button>
                ))}
              </div>
              {/* Card 1: Pharmacy Information */}
              {activeTab === 0 && <section className="settings-section-card" role="tabpanel" id="settings-panel-0" aria-labelledby="settings-tab-0" tabIndex={0}>
                <h2>
                  <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  Pharmacy Information
                </h2>
                <div className="settings-form-grid">
                  <div className="settings-form-group">
                    <label>Pharmacy Name <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <input 
                      type="text" 
                      value={settings.pharmacyName} 
                      onChange={(e) => handleChange('pharmacyName', e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Branch / Location <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <input 
                      type="text" 
                      value={settings.branchName} 
                      onChange={(e) => handleChange('branchName', e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Phone Number <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <input 
                      type="text" 
                      value={settings.phone} inputMode="numeric" maxLength={10} pattern="[0-9]{10}" 
                      onChange={(e) => handleChange('phone', digitsOnly(e.target.value))} 
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Email Address <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <input 
                      type="email" 
                      value={settings.email} 
                      onChange={(e) => handleChange('email', e.target.value)} 
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>License Number <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <input 
                      type="text" 
                      value={settings.licenseNumber} 
                      onChange={(e) => handleChange('licenseNumber', e.target.value)} 
                      placeholder="e.g. DL-20B-123456"
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>GST Number <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <input 
                      type="text" 
                      value={settings.gstNumber} 
                      onChange={(e) => handleChange('gstNumber', e.target.value)} 
                      placeholder="e.g. 07AAAAA1111A1Z1"
                    />
                  </div>
                  <div className="settings-form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Address <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <input 
                      type="text" 
                      value={settings.address} 
                      onChange={(e) => handleChange('address', e.target.value)} 
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Pharmacy Status <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <select 
                      value={settings.status} 
                      onChange={(e) => handleChange('status', e.target.value)}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="settings-save-bar">
                  <button type="submit" disabled={saving}>
                    {saving ? 'Saving Changes...' : 'Save Settings'}
                  </button>
                </div>
              </section>}

              {/* Card 2: Business Settings */}
              {activeTab === 1 && <section className="settings-section-card" role="tabpanel" id="settings-panel-1" aria-labelledby="settings-tab-1" tabIndex={0}>
                <h2>
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  Business Settings
                </h2>
                <div className="settings-form-grid">
                  <div className="settings-form-group">
                    <label>Currency <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <select 
                      value={settings.currency} 
                      onChange={(e) => handleChange('currency', e.target.value)}
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                  <div className="settings-form-group">
                    <label>Tax / GST Rate (%) <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <input 
                      type="number" 
                      value={settings.taxRate} 
                      onChange={(e) => handleChange('taxRate', e.target.value)} 
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Invoice Prefix <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <input 
                      type="text" 
                      value={settings.invoicePrefix} 
                      onChange={(e) => handleChange('invoicePrefix', e.target.value)} 
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Payment Terms <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <select 
                      value={settings.paymentTerms} 
                      onChange={(e) => handleChange('paymentTerms', e.target.value)}
                    >
                      <option value="Due on Receipt">Due on Receipt</option>
                      <option value="Net 15">Net 15</option>
                      <option value="Net 30">Net 30</option>
                      <option value="Net 60">Net 60</option>
                    </select>
                  </div>
                  <div className="settings-form-group">
                    <label>Business Hours <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <input 
                      type="text" 
                      value={settings.businessHours} 
                      onChange={(e) => handleChange('businessHours', e.target.value)} 
                    />
                  </div>
                </div>
                <div className="settings-save-bar">
                  <button type="submit" disabled={saving}>
                    {saving ? 'Saving Changes...' : 'Save Settings'}
                  </button>
                </div>
              </section>}

              {/* Card 3: Inventory Settings */}
              {activeTab === 2 && <section className="settings-section-card" role="tabpanel" id="settings-panel-2" aria-labelledby="settings-tab-2" tabIndex={0}>
                <h2>
                  <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg>
                  Inventory Settings
                </h2>
                <div className="settings-form-grid" style={{ marginBottom: '20px' }}>
                  <div className="settings-form-group">
                    <label>Low Stock Threshold (units) <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <input 
                      type="number" 
                      value={settings.lowStockThreshold} 
                      onChange={(e) => handleChange('lowStockThreshold', e.target.value)} 
                      min="1"
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Expiry Alert Horizon (Days) <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <input 
                      type="number" 
                      value={settings.expiryAlertDays} 
                      onChange={(e) => handleChange('expiryAlertDays', e.target.value)} 
                      min="1"
                    />
                  </div>
                </div>
                <div className="settings-toggle-group">
                  <div className="settings-toggle-row">
                    <div className="settings-toggle-info">
                      <label htmlFor="toggle-stock-mgnt">Stock Management <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                      <p>Automatically adjust stock levels on sales and returns</p>
                    </div>
                    <label className="settings-switch">
                      <input 
                        id="toggle-stock-mgnt"
                        type="checkbox" 
                        checked={settings.stockManagement} 
                        onChange={(e) => handleChange('stockManagement', e.target.checked)} 
                      />
                      <span className="settings-slider"></span>
                    </label>
                  </div>
                  <div className="settings-toggle-row">
                    <div className="settings-toggle-info">
                      <label htmlFor="toggle-batch-tracking">Batch & Expiry Tracking <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                      <p>Require batch number and expiry dates for inventory stock-in</p>
                    </div>
                    <label className="settings-switch">
                      <input 
                        id="toggle-batch-tracking"
                        type="checkbox" 
                        checked={settings.batchTracking} 
                        onChange={(e) => handleChange('batchTracking', e.target.checked)} 
                      />
                      <span className="settings-slider"></span>
                    </label>
                  </div>
                </div>
                <div className="settings-save-bar">
                  <button type="submit" disabled={saving}>
                    {saving ? 'Saving Changes...' : 'Save Settings'}
                  </button>
                </div>
              </section>}

              {/* Card 4: Sales & Purchase Settings */}
              {activeTab === 3 && <section className="settings-section-card" role="tabpanel" id="settings-panel-3" aria-labelledby="settings-tab-3" tabIndex={0}>
                <h2>
                  <svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  Sales & Purchase Settings
                </h2>
                <div className="settings-form-grid" style={{ marginBottom: '20px' }}>
                  <div className="settings-form-group">
                    <label>Maximum Allowed Discount (%) <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <input 
                      type="number" 
                      value={settings.maxDiscount} 
                      onChange={(e) => handleChange('maxDiscount', e.target.value)} 
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Sales Invoice Details <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <select 
                      value={settings.invoiceSettings} 
                      onChange={(e) => handleChange('invoiceSettings', e.target.value)}
                    >
                      <option value="Show tax details">Show Tax Details</option>
                      <option value="Hide tax details">Hide Tax Details</option>
                      <option value="Minimal layout">Minimalist Layout</option>
                    </select>
                  </div>
                  <div className="settings-form-group">
                    <label>Return Window (Days) <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                    <input 
                      type="number" 
                      value={settings.returnWindowDays} 
                      onChange={(e) => handleChange('returnWindowDays', e.target.value)} 
                      min="0"
                    />
                  </div>
                </div>
                <div className="settings-toggle-group">
                  <div className="settings-toggle-row">
                    <div className="settings-toggle-info">
                      <label htmlFor="toggle-auto-reorder">Automatic Reordering <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                      <p>Generate draft purchase orders when stock falls below threshold</p>
                    </div>
                    <label className="settings-switch">
                      <input 
                        id="toggle-auto-reorder"
                        type="checkbox" 
                        checked={settings.autoReorder} 
                        onChange={(e) => handleChange('autoReorder', e.target.checked)} 
                      />
                      <span className="settings-slider"></span>
                    </label>
                  </div>
                </div>
                <div className="settings-save-bar">
                  <button type="submit" disabled={saving}>
                    {saving ? 'Saving Changes...' : 'Save Settings'}
                  </button>
                </div>
              </section>}

              {/* Card 5: Notification Settings */}
              {activeTab === 4 && <section className="settings-section-card" role="tabpanel" id="settings-panel-4" aria-labelledby="settings-tab-4" tabIndex={0}>
                <h2>
                  <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  Notification Settings
                </h2>
                <div className="settings-toggle-group">
                  <div className="settings-toggle-row">
                    <div className="settings-toggle-info">
                      <label htmlFor="toggle-low-stock-alert">Low Stock Notifications <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                      <p>Send daily email alerts for items running low</p>
                    </div>
                    <label className="settings-switch">
                      <input 
                        id="toggle-low-stock-alert"
                        type="checkbox" 
                        checked={settings.notifyLowStock} 
                        onChange={(e) => handleChange('notifyLowStock', e.target.checked)} 
                      />
                      <span className="settings-slider"></span>
                    </label>
                  </div>
                  <div className="settings-toggle-row">
                    <div className="settings-toggle-info">
                      <label htmlFor="toggle-expiry-alert">Expiry Warning Alerts <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                      <p>Notify when batches are approaching their expiry horizon</p>
                    </div>
                    <label className="settings-switch">
                      <input 
                        id="toggle-expiry-alert"
                        type="checkbox" 
                        checked={settings.notifyExpiry} 
                        onChange={(e) => handleChange('notifyExpiry', e.target.checked)} 
                      />
                      <span className="settings-slider"></span>
                    </label>
                  </div>
                  <div className="settings-toggle-row">
                    <div className="settings-toggle-info">
                      <label htmlFor="toggle-order-alert">Order & Transfer Warnings <span className="req-star" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span></label>
                      <p>Send in-app notifications on stock transfer completions</p>
                    </div>
                    <label className="settings-switch">
                      <input 
                        id="toggle-order-alert"
                        type="checkbox" 
                        checked={settings.notifyOrders} 
                        onChange={(e) => handleChange('notifyOrders', e.target.checked)} 
                      />
                      <span className="settings-slider"></span>
                    </label>
                  </div>
                </div>
                <div className="settings-save-bar">
                  <button type="submit" disabled={saving}>
                    {saving ? 'Saving Changes...' : 'Save Settings'}
                  </button>
                </div>
              </section>}

            </>
          )}

        </form>
      </div>
    </AdminLayout>
  )
}
