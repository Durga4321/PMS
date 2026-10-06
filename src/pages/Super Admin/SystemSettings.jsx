import { useEffect, useState } from 'react'
import { getSuperAdminSettings, updateSuperAdminSettings } from '../../config/api'
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

function unwrap(response) {
  return response?.data?.settings || response?.data?.configuration || response?.settings || response?.configuration || response?.data || response || {}
}

function SettingsIcon({ name }) {
  const paths = {
    general: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
    email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    sms: <><path d="M5 5h14v11H8l-3 3V5Z" /><path d="M8 9h8M8 12h5" /></>,
    payment: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M7 14h3" /></>,
    appName: <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M8 8h8M8 12h5M8 16h8" /></>,
    timezone: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
    currency: <><circle cx="12" cy="12" r="8" /><path d="M15 9c-.5-.7-1.4-1-2.5-1-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2c1.5.3 2.5 1 2.5 2s-1.1 2-2.5 2c-1.1 0-2-.3-2.5-1M12 6v12" /></>,
    status: <><circle cx="12" cy="12" r="8" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    notes: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    save: <><path d="M5 4h12l2 2v14H5z" /><path d="M8 4v6h8V4M8 20v-6h8v6" /></>,
  }
  return <span className={`settings-icon settings-icon-${name}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none">{paths[name] || paths.general}</svg></span>
}

function SystemSettings() {
  const [settings, setSettings] = useState(initialSettings)
  const [tab, setTab] = useState('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [showSmsApiKey, setShowSmsApiKey] = useState(false)

  useEffect(() => {
    let active = true
    async function loadSettings() {
      setLoading(true)
      setError('')
      try {
        const response = await getSuperAdminSettings()
        if (active) setSettings((current) => ({ ...current, ...unwrap(response) }))
      } catch (requestError) {
        if (active) setError(requestError.message || 'Unable to load system settings.')
      } finally {
        if (active) setLoading(false)
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
      await updateSuperAdminSettings(settings)
      setFeedback('Settings saved successfully.')
    } catch (requestError) {
      setError(requestError.message || 'Unable to save system settings.')
    } finally {
      setSaving(false)
    }
  }

  const field = (label, key, type = 'text', placeholder = '') => <label className="settings-field"><span className="settings-field-label">{label}</span><span className="settings-control"><SettingsIcon name={key} /><input type={type} value={settings[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} /></span></label>
  const selectField = (label, key, options) => <label className="settings-field"><span className="settings-field-label">{label}</span><span className="settings-control"><SettingsIcon name={key} /><select value={settings[key]} onChange={(event) => update(key, event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></span></label>
  const passwordField = (label, key, placeholder, visible, setVisible) => <div className="settings-field"><label className="settings-field-label" htmlFor={`settings-${key}`}>{label}</label><span className="settings-control"><SettingsIcon name={key} /><input id={`settings-${key}`} type={visible ? 'text' : 'password'} value={settings[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} /><button className="settings-password-toggle" type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? `Hide ${label}` : `Show ${label}`} aria-pressed={visible}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{visible ? <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></> : <><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a15.8 15.8 0 0 1-3.1 3.8M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10 10 0 0 0 3.1-.5" /></>}</svg></button></span></div>
  const secretKeyField = <div className="settings-field"><label className="settings-field-label" htmlFor="settings-secret-key">Secret Key</label><span className="settings-control"><SettingsIcon name="secretKey" /><input id="settings-secret-key" type={showSecretKey ? 'text' : 'password'} value={settings.secretKey} onChange={(event) => update('secretKey', event.target.value)} placeholder="Secret key" /><button className="settings-password-toggle" type="button" onClick={() => setShowSecretKey((visible) => !visible)} aria-label={showSecretKey ? 'Hide Secret Key' : 'Show Secret Key'} aria-pressed={showSecretKey}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{showSecretKey ? <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></> : <><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a15.8 15.8 0 0 1-3.1 3.8M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10 10 0 0 0 3.1-.5" /></>}</svg></button></span></div>
  const notesField = <label className="settings-field settings-wide settings-notes"><span className="settings-section-heading"><SettingsIcon name="notes" /><span><strong>Configuration Notes</strong></span></span><textarea value={settings.configurationNotes} onChange={(event) => update('configurationNotes', event.target.value)} placeholder="Add notes about this configuration..." /></label>

  return (
    <div className={`super-admin-shell settings-page${sidebarOpen ? ' sidebar-open' : ''}`}>
      <SuperAdminSidebar activeLabel="System Settings" />
      <main className="super-admin-main">
        <SuperAdminTopbar onMenu={() => setSidebarOpen((value) => !value)} />
        <section className="settings-heading"><div><h1>System Settings</h1><span>Configure global pharmacy platform preferences.</span></div><span className="settings-environment"><i />Production Environment</span></section>
        <form className="settings-card" onSubmit={saveSettings}>
          <nav className="settings-tabs" aria-label="Settings sections">{[['general', 'General Settings'], ['email', 'Email Settings'], ['sms', 'SMS Settings'], ['payment', 'Payment Settings']].map(([value, label]) => <button key={value} className={`${value} ${tab === value ? 'active' : ''}`} onClick={() => setTab(value)} type="button"><SettingsIcon name={value} />{label}</button>)}<span className="settings-live"><i />Live</span></nav>
          {loading ? <div className="settings-state">Loading current settings...</div> : <>
            {error ? <div className="settings-alert">{error}</div> : null}
            {tab === 'general' ? <div className="settings-form-grid">{field('App Name', 'appName', 'text', 'Enter application name')}{selectField('Timezone', 'timezone', ['Asia/Kolkata', 'UTC', 'America/New_York', 'Europe/London'])}{selectField('Currency', 'currency', ['INR', 'USD', 'EUR', 'GBP'])}{selectField('Status', 'status', ['Enabled', 'Disabled'])}{notesField}</div> : null}
            {tab === 'email' ? <div className="settings-form-grid">{field('Sender Name', 'senderName', 'text', 'Pharmacy System')}{field('From Email', 'senderEmail', 'email', 'notifications@example.com')}{field('SMTP Host', 'smtpHost', 'text', 'smtp.example.com')}{field('SMTP Port', 'smtpPort', 'number', '587')}{field('SMTP Username', 'smtpUsername', 'text', 'SMTP username')}{passwordField('SMTP Password', 'smtpPassword', 'SMTP password', showSmtpPassword, setShowSmtpPassword)}{selectField('Status', 'status', ['Enabled', 'Disabled'])}{notesField}</div> : null}
            {tab === 'sms' ? <div className="settings-form-grid">{field('Configuration Name', 'smsConfigurationName', 'text', 'SMS configuration')}{field('Provider', 'smsProvider', 'text', 'Provider name')}{field('Sender ID', 'smsSenderId', 'text', 'Sender ID')}{passwordField('API Key', 'smsApiKey', 'Enter API key', showSmsApiKey, setShowSmsApiKey)}{field('API Secret', 'smsApiSecret', 'password', 'Enter API secret')}{selectField('Status', 'status', ['Enabled', 'Disabled'])}{notesField}</div> : null}
            {tab === 'payment' ? <div className="settings-form-grid">{field('Configuration Name', 'paymentConfigurationName', 'text', 'Payment configuration')}{field('Gateway Provider', 'paymentGateway', 'text', 'Gateway provider')}{field('Merchant ID', 'merchantId', 'text', 'Merchant ID')}{field('Public Key', 'publicKey', 'text', 'Public key')}{secretKeyField}{selectField('Mode', 'paymentMode', ['Test', 'Live'])}{selectField('Status', 'status', ['Enabled', 'Disabled'])}{notesField}</div> : null}
            <div className="settings-actions">{feedback ? <span className="settings-feedback">{feedback}</span> : null}<button type="submit" disabled={saving}><SettingsIcon name="save" />{saving ? 'Saving...' : 'Save Config'}</button></div>
          </>}
        </form>
      </main>
    </div>
  )
}

export default SystemSettings
