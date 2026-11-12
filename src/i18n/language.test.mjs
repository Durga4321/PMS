import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'

const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
}
globalThis.document = { documentElement: { lang: 'en' } }
globalThis.window = new EventTarget()
globalThis.sessionStorage = globalThis.localStorage
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
after(async () => {
  await server.close()
  delete globalThis.localStorage
  delete globalThis.document
  delete globalThis.window
  delete globalThis.sessionStorage
})
const { setLanguage, getLanguage, translate } = await server.ssrLoadModule('/src/i18n/language.js')
const { jsx, jsxs } = await server.ssrLoadModule('/src/i18n/jsx-runtime.js')

test('language persists, restores English, and updates the document language', () => {
  setLanguage('te')
  assert.equal(getLanguage(), 'te')
  assert.equal(storage.get('pms_language'), 'te')
  assert.equal(document.documentElement.lang, 'te')
  setLanguage('en')
  assert.equal(translate('Dashboard', getLanguage()), 'Dashboard')
  setLanguage('invalid')
  assert.equal(getLanguage(), 'en')
})

test('all role navigation and settings labels have Telugu translations', () => {
  for (const label of ['Dashboard', 'Super Admin', 'Admin Management', 'Pharmacist', 'Medicines', 'Stock', 'Suppliers', 'Purchase Orders', 'Stock Transfers', 'Prescriptions', 'Dispensing', 'Bills', 'Returns', 'Reports', 'Branches', 'Pharmacies', 'Users', 'Roles & Permissions', 'Expiry Alerts', 'Notifications', 'Audit Logs', 'System Settings', 'General Settings', 'Email Settings', 'SMS Settings', 'Payment Settings', 'Language', 'Save Config']) {
    const translated = translate(label, 'te')
    assert.notEqual(translated, label, label)
    assert.match(translated, /[\u0c00-\u0c7f]/, label)
  }
})

test('dynamic messages translate while preserving names, quantities and IDs', () => {
  assert.equal(translate('Imported 125 medicines successfully!', 'te'), '125 మందులు విజయవంతంగా దిగుమతి అయ్యాయి!')
  assert.equal(translate('Delete Ravi Kumar?', 'te'), 'Ravi Kumarను తొలగించాలా?')
  assert.equal(translate('Status: Active', 'te'), 'స్థితి: సక్రియం')
  assert.equal(translate('12 Nov 2026', 'te'), '12 నవంబర్ 2026')
  for (const value of ['Paracetamol 500mg', 'Ravi Kumar', 'City Care Hospital', 'BATCH-01', 'MED0001', 'test@example.com', 'Asia/Kolkata', '123.45']) {
    assert.equal(translate(value, 'te'), value)
  }
})

test('rendered labels, placeholders and accessibility attributes translate; form values stay English', () => {
  setLanguage('te')
  const markup = renderToStaticMarkup(jsxs('section', { children: [
    jsx('h1', { children: 'Dashboard' }),
    jsx('input', { placeholder: 'Medicine Name', 'aria-label': 'Search', value: 'Paracetamol', readOnly: true }),
    jsx('select', { value: 'Active', readOnly: true, children: jsx('option', { children: 'Active' }) }),
    jsx('option', { value: 'en', translate: 'no', children: 'English' }),
    jsx('textarea', { placeholder: 'Add notes about this configuration...', value: 'Patient notes', readOnly: true }),
    jsx('label', { children: 'Phone Number' }),
  ] }))
  assert.match(markup, /డ్యాష్‌బోర్డ్/)
  assert.match(markup, /placeholder="మందు పేరు"/)
  assert.match(markup, /aria-label="వెతకండి"/)
  assert.match(markup, /value="Paracetamol"/)
  assert.match(markup, /value="Active"[^>]*>సక్రియం/)
  assert.match(markup, />English<\/option>/)
  assert.match(markup, /data-pms-source-placeholder="Medicine Name"/)
  assert.match(markup, /data-pms-source-text="Phone Number"/)
  assert.match(markup, />Patient notes<\/textarea>/)
  assert.match(markup, /placeholder="ఈ కాన్ఫిగరేషన్ గురించి గమనికలు జోడించండి/)
  setLanguage('en')
  assert.match(renderToStaticMarkup(jsx('h1', { children: 'Dashboard' })), />Dashboard<\/h1>/)
})

test('all three dashboard screens render in Telugu and return to English', async () => {
  const { default: ToastProvider } = await server.ssrLoadModule('/src/components/ToastProvider.jsx')
  for (const [file, route] of [
    ['/src/pages/Super Admin/SuperAdminDashboard.jsx', '/super-admin/dashboard'],
    ['/src/pages/Admin/AdminDashboard.jsx', '/admin/dashboard'],
    ['/src/pages/Pharmacist/Dashboard.jsx', '/pharmacist/dashboard'],
  ]) {
    const { default: Dashboard } = await server.ssrLoadModule(file)
    const render = () => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [route] }, createElement(ToastProvider, null, createElement(Dashboard))))
    setLanguage('te')
    const telugu = render()
    assert.match(telugu, /డ్యాష్‌బోర్డ్/, route)
    assert.doesNotMatch(telugu, />Dashboard</, route)
    setLanguage('en')
    assert.match(render(), />Dashboard</, route)
  }
})

test('a language storage event updates document language for other tabs', () => {
  storage.set('pms_language', 'te')
  const event = new Event('storage')
  Object.defineProperty(event, 'key', { value: 'pms_language' })
  window.dispatchEvent(event)
  assert.equal(document.documentElement.lang, 'te')
  setLanguage('en')
})
