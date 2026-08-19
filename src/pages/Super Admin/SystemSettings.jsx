import { useEffect, useState } from 'react'
import { apiUrl } from '../../config/api'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import './SystemSettings.css'

const initialSettings = {
  appName: '',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  status: 'Enabled',
  configurationNotes: '',
  smtpHost: '',
  smtpPort: '',
  senderName: '',
  senderEmail: '',
  smtpUsername: '',
  smtpPassword: '',
  smsProvider: '',
  smsConfigurationName: '',
  smsSenderId: '',
  smsApiKey: '',
  smsApiSecret: '',
  paymentGateway: '',
  paymentConfigurationName: '',
  merchantId: '',
  publicKey: '',
  secretKey: '',
  paymentMode: 'Test',
  paymentApiKey: '',
}

const endpoints = ['pharmacy-super-admin/settings', 'pharmacy-super-admin/system-settings']

function getToken() {
  return sessionStorage.getItem('superAdminToken') || localStorage.getItem('superAdminToken') || ''
}

function unwrap(response) {
  return response?.data?.settings || response?.data?.configuration || response?.settings || response?.configuration || response?.data || response || {}
}

async function settingsRequest(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'ngrok-skip-browser-warning': 'true',
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(options.headers || {}),
    },
  })
  const contentType = response.headers.get('content-type')
  const data = contentType?.includes('application/json') ? await response.json() : null
  if (!response.ok) throw new Error(data?.message || data?.error || 'Unable to process settings request.')
  return data
}

function SystemSettings() {
  const [settings, setSettings] = useState(initialSettings)
  const [tab, setTab] = useState('general')
  const [endpoint, setEndpoint] = useState(endpoints[0])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    let active = true
    async function loadSettings() {
      setLoading(true)
      setError('')
      let lastError = null
      for (const path of endpoints) {
        try {
          const response = await settingsRequest(path)
          if (active) {
            setSettings((current) => ({ ...current, ...unwrap(response) }))
            setEndpoint(path)
          }
          if (active) setLoading(false)
          return
        } catch (requestError) {
          lastError = requestError
        }
      }
      if (active) {
        setError(lastError?.message || 'Unable to load system settings.')
        setLoading(false)
      }
    }
    loadSettings()
    return () => { active = false }
  }, [])

  function update(field, value) {
    setSettings((current) => ({ ...current, [field]: value }))
    setFeedback('')
  }

  async function saveSettings(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setFeedback('')
    try {
      await settingsRequest(endpoint, { method: 'PUT', body: JSON.stringify(settings) })
      setFeedback('Settings saved successfully.')
    } catch (requestError) {
      setError(requestError.message || 'Unable to save system settings.')
    } finally {
      setSaving(false)
    }
  }

  const field = (label, key, type = 'text', placeholder = '') => <label className="settings-field">{label}<input type={type} value={settings[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} /></label>

  return (
    <div className={`super-admin-shell settings-page${sidebarOpen ? ' sidebar-open' : ''}`}>
      <SuperAdminSidebar activeLabel="System Settings" />
      <main className="super-admin-main">
        <SuperAdminTopbar onMenu={() => setSidebarOpen((value) => !value)} />
        <section className="settings-heading"><p>Super Admin</p><h1>System Settings</h1><span>Configure global pharmacy platform preferences.</span></section>
        <form className="settings-card" onSubmit={saveSettings}>
          <nav className="settings-tabs" aria-label="Settings sections">{[['general', 'General Settings'], ['email', 'Email Settings'], ['sms', 'SMS Settings'], ['payment', 'Payment Settings']].map(([value, label]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)} type="button">{label}</button>)}</nav>
          {loading ? <div className="settings-state">Loading current settings...</div> : <>
            {error ? <div className="settings-alert">{error}</div> : null}
            {tab === 'general' ? <div className="settings-form-grid">{field('App Name', 'appName', 'text', 'Enter application name')}<label className="settings-field">Timezone<select value={settings.timezone} onChange={(event) => update('timezone', event.target.value)}><option>Asia/Kolkata</option><option>UTC</option><option>America/New_York</option><option>Europe/London</option></select></label><label className="settings-field">Currency<select value={settings.currency} onChange={(event) => update('currency', event.target.value)}><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option></select></label><label className="settings-field">Status<select value={settings.status} onChange={(event) => update('status', event.target.value)}><option>Enabled</option><option>Disabled</option></select></label><label className="settings-field settings-wide">Configuration Notes<textarea value={settings.configurationNotes} onChange={(event) => update('configurationNotes', event.target.value)} placeholder="Add notes about this configuration..." /></label></div> : null}
            {tab === 'email' ? <div className="settings-form-grid">{field('Sender Name', 'senderName', 'text', 'Pharmacy System')}{field('From Email', 'senderEmail', 'email', 'notifications@example.com')}{field('SMTP Host', 'smtpHost', 'text', 'smtp.example.com')}{field('SMTP Port', 'smtpPort', 'number', '587')}{field('SMTP Username', 'smtpUsername', 'text', 'SMTP username')}{field('SMTP Password', 'smtpPassword', 'password', 'SMTP password')}<label className="settings-field">Status<select value={settings.status} onChange={(event) => update('status', event.target.value)}><option>Enabled</option><option>Disabled</option></select></label><label className="settings-field settings-wide">Configuration Notes<textarea value={settings.configurationNotes} onChange={(event) => update('configurationNotes', event.target.value)} placeholder="Add notes about this configuration..." /></label></div> : null}
            {tab === 'sms' ? <div className="settings-form-grid">{field('Configuration Name', 'smsConfigurationName', 'text', 'SMS configuration')}{field('Provider', 'smsProvider', 'text', 'Provider name')}{field('Sender ID', 'smsSenderId', 'text', 'Sender ID')}{field('API Key', 'smsApiKey', 'password', 'Enter API key')}{field('API Secret', 'smsApiSecret', 'password', 'Enter API secret')}<label className="settings-field">Status<select value={settings.status} onChange={(event) => update('status', event.target.value)}><option>Enabled</option><option>Disabled</option></select></label><label className="settings-field settings-wide">Configuration Notes<textarea value={settings.configurationNotes} onChange={(event) => update('configurationNotes', event.target.value)} placeholder="Add notes about this configuration..." /></label></div> : null}
            {tab === 'payment' ? <div className="settings-form-grid">{field('Configuration Name', 'paymentConfigurationName', 'text', 'Payment configuration')}{field('Gateway Provider', 'paymentGateway', 'text', 'Gateway provider')}{field('Merchant ID', 'merchantId', 'text', 'Merchant ID')}{field('Public Key', 'publicKey', 'text', 'Public key')}{field('Secret Key', 'secretKey', 'password', 'Secret key')}<label className="settings-field">Mode<select value={settings.paymentMode} onChange={(event) => update('paymentMode', event.target.value)}><option>Test</option><option>Live</option></select></label><label className="settings-field">Status<select value={settings.status} onChange={(event) => update('status', event.target.value)}><option>Enabled</option><option>Disabled</option></select></label><label className="settings-field settings-wide">Configuration Notes<textarea value={settings.configurationNotes} onChange={(event) => update('configurationNotes', event.target.value)} placeholder="Add notes about this configuration..." /></label></div> : null}
            <div className="settings-actions">{feedback ? <span className="settings-feedback">{feedback}</span> : null}<button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Config'}</button></div>
          </>}
        </form>
      </main>
    </div>
  )
}

export default SystemSettings
