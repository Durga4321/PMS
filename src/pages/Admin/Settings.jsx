import { useEffect, useState } from 'react'
import { useToast } from '../../components/ToastProvider'
import AdminLayout from './AdminLayout'
import { getPharmacySettings, updatePharmacySettings, getPharmacyAdminAssignmentStatus } from '../../config/api'
import './Settings.css'

function readStoredValue(key) {
  const value = sessionStorage.getItem(key) || localStorage.getItem(key)
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export default function Settings() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [settings, setSettings] = useState({
    // Pharmacy Information
    pharmacyName: 'Pharmacy Console',
    branchName: 'Main Branch',
    address: '',
    phone: '',
    email: '',
    licenseNumber: '',
    gstNumber: '',
    status: 'Active',
    
    // Business Settings
    currency: 'INR',
    taxRate: '18',
    invoicePrefix: 'PHAR-',
    paymentTerms: 'Due on Receipt',
    businessHours: '9:00 AM - 10:00 PM',
    
    // Inventory Settings
    lowStockThreshold: '10',
    expiryAlertDays: '90',
    stockManagement: true,
    batchTracking: true,
    
    // Sales & Purchase Settings
    maxDiscount: '10',
    invoiceSettings: 'Show tax details',
    autoReorder: false,
    returnWindowDays: '7',
    
    // Notification Settings
    notifyLowStock: true,
    notifyExpiry: true,
    notifyOrders: true
  })

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      const response = await getPharmacySettings()
      if (response?.data) {
        setSettings((prev) => ({ ...prev, ...response.data }))
      } else if (response) {
        setSettings((prev) => ({ ...prev, ...response }))
      }
      showToast('Settings loaded from backend.')
    } catch (apiError) {
      console.log('Backend settings API failed/unavailable, trying local fallback:', apiError.message)
      
      const user = readStoredValue('pharmacyAdminUser') || {}
      const assignment = readStoredValue('pharmacyAdminAssignment') || {}
      const savedLocal = readStoredValue('pharmacySettings') || {}
      
      setSettings((prev) => ({
        ...prev,
        pharmacyName: savedLocal.pharmacyName || assignment?.pharmacyName || assignment?.pharmacy?.name || assignment?.hospitalName || assignment?.hospital?.name || prev.pharmacyName,
        branchName: savedLocal.branchName || assignment?.branchName || assignment?.branch?.name || prev.branchName,
        address: savedLocal.address || assignment?.address || assignment?.location || prev.address,
        phone: savedLocal.phone || user?.phone || user?.mobile || assignment?.phone || prev.phone,
        email: savedLocal.email || user?.email || assignment?.email || prev.email,
        licenseNumber: savedLocal.licenseNumber || prev.licenseNumber,
        gstNumber: savedLocal.gstNumber || prev.gstNumber,
        status: savedLocal.status || assignment?.status || prev.status,
        ...savedLocal
      }))

      try {
        const freshAssignment = await getPharmacyAdminAssignmentStatus()
        const freshData = freshAssignment?.data || freshAssignment
        if (freshData) {
          setSettings((prev) => ({
            ...prev,
            pharmacyName: freshData.pharmacyName || freshData.pharmacy?.name || prev.pharmacyName,
            branchName: freshData.branchName || freshData.branch?.name || prev.branchName,
            status: freshData.status || prev.status
          }))
        }
      } catch (e) {
        console.log('Assignment status API call failed:', e.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await updatePharmacySettings(settings)
      localStorage.setItem('pharmacySettings', JSON.stringify(settings))
      showToast('Settings saved successfully!')
    } catch (error) {
      console.log('Backend settings save failed/unavailable, saving locally:', error.message)
      localStorage.setItem('pharmacySettings', JSON.stringify(settings))
      showToast('Settings saved locally.', 'success')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value
    }))
  }

  return (
    <AdminLayout activeLabel="Settings" title="Pharmacy Settings" subtitle="Admin / Settings">
      <div className="stock-scroll-area">
        <form onSubmit={handleSave} className="settings-layout-container">
          
          {loading ? (
            <p className="settings-status-msg">Loading pharmacy settings...</p>
          ) : (
            <>
              {/* Card 1: Pharmacy Information */}
              <section className="settings-section-card">
                <h2>
                  <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  Pharmacy Information
                </h2>
                <div className="settings-form-grid">
                  <div className="settings-form-group">
                    <label>Pharmacy Name</label>
                    <input 
                      type="text" 
                      value={settings.pharmacyName} 
                      onChange={(e) => handleChange('pharmacyName', e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Branch / Location</label>
                    <input 
                      type="text" 
                      value={settings.branchName} 
                      onChange={(e) => handleChange('branchName', e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Phone Number</label>
                    <input 
                      type="text" 
                      value={settings.phone} 
                      onChange={(e) => handleChange('phone', e.target.value)} 
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      value={settings.email} 
                      onChange={(e) => handleChange('email', e.target.value)} 
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>License Number</label>
                    <input 
                      type="text" 
                      value={settings.licenseNumber} 
                      onChange={(e) => handleChange('licenseNumber', e.target.value)} 
                      placeholder="e.g. DL-20B-123456"
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>GST Number</label>
                    <input 
                      type="text" 
                      value={settings.gstNumber} 
                      onChange={(e) => handleChange('gstNumber', e.target.value)} 
                      placeholder="e.g. 07AAAAA1111A1Z1"
                    />
                  </div>
                  <div className="settings-form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Address</label>
                    <input 
                      type="text" 
                      value={settings.address} 
                      onChange={(e) => handleChange('address', e.target.value)} 
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Pharmacy Status</label>
                    <select 
                      value={settings.status} 
                      onChange={(e) => handleChange('status', e.target.value)}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Card 2: Business Settings */}
              <section className="settings-section-card">
                <h2>
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  Business Settings
                </h2>
                <div className="settings-form-grid">
                  <div className="settings-form-group">
                    <label>Currency</label>
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
                    <label>Tax / GST Rate (%)</label>
                    <input 
                      type="number" 
                      value={settings.taxRate} 
                      onChange={(e) => handleChange('taxRate', e.target.value)} 
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Invoice Prefix</label>
                    <input 
                      type="text" 
                      value={settings.invoicePrefix} 
                      onChange={(e) => handleChange('invoicePrefix', e.target.value)} 
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Payment Terms</label>
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
                    <label>Business Hours</label>
                    <input 
                      type="text" 
                      value={settings.businessHours} 
                      onChange={(e) => handleChange('businessHours', e.target.value)} 
                    />
                  </div>
                </div>
              </section>

              {/* Card 3: Inventory Settings */}
              <section className="settings-section-card">
                <h2>
                  <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg>
                  Inventory Settings
                </h2>
                <div className="settings-form-grid" style={{ marginBottom: '20px' }}>
                  <div className="settings-form-group">
                    <label>Low Stock Threshold (units)</label>
                    <input 
                      type="number" 
                      value={settings.lowStockThreshold} 
                      onChange={(e) => handleChange('lowStockThreshold', e.target.value)} 
                      min="1"
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Expiry Alert Horizon (Days)</label>
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
                      <label htmlFor="toggle-stock-mgnt">Stock Management</label>
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
                      <label htmlFor="toggle-batch-tracking">Batch & Expiry Tracking</label>
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
              </section>

              {/* Card 4: Sales & Purchase Settings */}
              <section className="settings-section-card">
                <h2>
                  <svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  Sales & Purchase Settings
                </h2>
                <div className="settings-form-grid" style={{ marginBottom: '20px' }}>
                  <div className="settings-form-group">
                    <label>Maximum Allowed Discount (%)</label>
                    <input 
                      type="number" 
                      value={settings.maxDiscount} 
                      onChange={(e) => handleChange('maxDiscount', e.target.value)} 
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Sales Invoice Details</label>
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
                    <label>Return Window (Days)</label>
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
                      <label htmlFor="toggle-auto-reorder">Automatic Reordering</label>
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
              </section>

              {/* Card 5: Notification Settings */}
              <section className="settings-section-card">
                <h2>
                  <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  Notification Settings
                </h2>
                <div className="settings-toggle-group">
                  <div className="settings-toggle-row">
                    <div className="settings-toggle-info">
                      <label htmlFor="toggle-low-stock-alert">Low Stock Notifications</label>
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
                      <label htmlFor="toggle-expiry-alert">Expiry Warning Alerts</label>
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
                      <label htmlFor="toggle-order-alert">Order & Transfer Warnings</label>
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
              </section>

              {/* Save Button Bar */}
              <div className="settings-save-bar">
                <button type="submit" disabled={saving}>
                  {saving ? 'Saving Changes...' : 'Save Settings'}
                </button>
              </div>
            </>
          )}

        </form>
      </div>
    </AdminLayout>
  )
}
