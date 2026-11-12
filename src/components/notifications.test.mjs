import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import { notificationBody, notificationError, notificationList, notificationPayload, normalizeNotification, notificationTimestamp } from './notificationModel.js'

const savedFetch = globalThis.fetch
const storage = new Map([
  ['superAdminToken', 'test-super'], ['pharmacyAdminToken', 'test-admin'], ['pharmacistToken', 'test-pharmacist'],
  ['pharmacyAdminUser', JSON.stringify({ pharmacyId: 'pharmacy-1', branchId: 'branch-1' })],
  ['pharmacistUser', JSON.stringify({ pharmacyId: 'pharmacy-1', branchId: 'branch-2' })],
])
globalThis.localStorage = globalThis.sessionStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
globalThis.document = { documentElement: { lang: 'en' } }
globalThis.window = new EventTarget()
window.location = { pathname: '/super-admin/notifications' }
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
after(async () => { await server.close(); globalThis.fetch = savedFetch; delete globalThis.window; delete globalThis.document; delete globalThis.localStorage; delete globalThis.sessionStorage })
const { notificationApis } = await server.ssrLoadModule('/src/config/api.js')

test('normalizes nested API envelopes, false read flags, and real record IDs', () => {
  const response = { data: { notifications: [{ notificationId: 0, title: 'Message', isRead: false }], unreadCount: 1 } }
  assert.equal(notificationList(response).length, 1)
  assert.equal(notificationBody(response).unreadCount, 1)
  assert.deepEqual(normalizeNotification(notificationList(response)[0]), { id: '0', title: 'Message', message: '', status: 'unread', createdAt: '', sender: '', recipient: '' })
  assert.equal(normalizeNotification({ id: 'a', isRead: 'false' }).status, 'unread')
  assert.equal(normalizeNotification({ id: 'a', isRead: true }).status, 'read')
  assert.equal(normalizeNotification({ id: 'a', isRead: true }, 'sent').status, 'sent')
  assert.equal(normalizeNotification({ title: 'Missing ID' }).id, '')
})

test('single-recipient and forwarding payloads retain the chosen pharmacist and source', () => {
  const payload = notificationPayload('pharmacyAdmin', { title: '  Review  ', message: '  Please review. ', audience: 'specific-pharmacist', recipientId: 'pharmacist-7', sourceNotificationId: 'incoming-2' })
  assert.deepEqual(payload, { title: 'Review', message: 'Please review.', audience: 'specific-pharmacist', recipientRole: 'pharmacist', recipientIds: ['pharmacist-7'], sourceNotificationId: 'incoming-2' })
  assert.deepEqual(notificationPayload('superAdmin', { title: 'Notice', message: 'Hello', audience: 'specific-admin', recipientId: 'admin-2' }).recipientIds, ['admin-2'])
  assert.deepEqual(notificationPayload('superAdmin', { title: 'Notice', message: 'Hello', audience: 'specific-branch', recipientId: 'branch-2' }), { title: 'Notice', message: 'Hello', audience: 'specific-branch', branchId: 'branch-2' })
})

test('inbox prefers receipt time while sent history uses the original send time', () => {
  const item = { id: 'n-1', createdAt: '2026-11-12T05:56:00Z', sentAt: '2026-11-12T05:57:00Z', receivedAt: '2026-11-12T05:58:00Z' }
  assert.equal(normalizeNotification(item).createdAt, '2026-11-12T05:58:00.000Z')
  assert.equal(normalizeNotification(item, 'sent').createdAt, '2026-11-12T05:57:00.000Z')
  assert.equal(normalizeNotification({ ...item, receivedAt: '', deliveredAt: '2026-11-12T05:59:00Z' }).createdAt, '2026-11-12T05:59:00.000Z')
})

test('UTC timestamps without offsets and explicitly zoned timestamps resolve to the same India receipt time', () => {
  const expected = '2026-11-12T05:56:00.000Z'
  for (const value of ['2026-11-12T05:56:00', '2026-11-12 05:56:00', '2026-11-12T05:56:00Z', '2026-11-12T11:26:00+05:30']) {
    assert.equal(notificationTimestamp(value), expected)
  }
  const local = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(expected))
  assert.equal(local, '11:26')
  assert.equal(notificationTimestamp('invalid'), '')
  assert.equal(notificationTimestamp(''), '')
})

test('rejects sending without a selected recipient, blank messages, and unauthorized audiences', () => {
  const form = { title: 'Notice', message: 'Hello', audience: 'specific-pharmacist', recipientId: '' }
  assert.throws(() => notificationPayload('pharmacyAdmin', form), /Select a recipient/)
  assert.throws(() => notificationPayload('pharmacist', { ...form, recipientId: 'a' }), /not available/)
  assert.throws(() => notificationPayload('pharmacyAdmin', { ...form, audience: 'all-admins' }), /not available/)
  assert.throws(() => notificationPayload('superAdmin', { ...form, audience: 'all-admins', title: '  ' }), /title and message/)
})

test('HTTP notification calls use the matching role token, tenant, route, and mutation method', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => { calls.push({ url: String(url), ...options }); return new Response(JSON.stringify({ data: options.method === 'POST' ? { id: 'new-notification', status: 'sent', recipientCount: 1 } : { items: [], unreadCount: 0 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }) }
  for (const [role, base, token, branch] of [
    ['superAdmin', 'pharmacy-super-admin', 'test-super', null],
    ['pharmacyAdmin', 'pharmacy-admin', 'test-admin', 'branch-1'],
    ['pharmacist', 'pharmacist', 'test-pharmacist', 'branch-2'],
  ]) {
    await notificationApis[role].list({ folder: 'inbox', status: 'unread', page: 2, pageSize: 20 })
    const call = calls.at(-1)
    assert.match(call.url, new RegExp(`/api/${base}/notifications\\?`))
    assert.equal(call.headers.Authorization, `Bearer ${token}`)
    assert.equal(call.headers['X-Branch-Id'] ?? null, branch)
    assert.match(call.url, /folder=inbox/)
    assert.match(call.url, /page=2/)
    await notificationApis[role].markRead('n/1')
    assert.equal(calls.at(-1).method, 'PATCH')
    assert.ok(calls.at(-1).url.endsWith('/n%2F1/read'))
    await notificationApis[role].remove('n/1')
    assert.equal(calls.at(-1).method, 'DELETE')
    assert.equal(calls.at(-1).url, `/api/${base}/notifications/n%2F1`)
    assert.equal(calls.at(-1).headers.Authorization, `Bearer ${token}`)
    await notificationApis[role].markAllRead()
    assert.equal(calls.at(-1).url, role === 'superAdmin' ? '/api/pharmacy-super-admin/notifications/mark-all-read' : '/api/notifications/mark-all-read')
    assert.equal(calls.at(-1).method, 'PATCH')
    assert.equal(calls.at(-1).headers.Authorization, `Bearer ${token}`)
    await notificationApis[role].unreadCount()
    if (role === 'superAdmin') {
      assert.match(calls.at(-1).url, /\/api\/pharmacy-super-admin\/notifications\?status=unread/)
    } else {
      assert.equal(calls.at(-1).url, '/api/notifications/unread-count')
    }
    assert.equal(calls.at(-1).headers.Authorization, `Bearer ${token}`)
  }
  const payload = notificationPayload('superAdmin', { title: 'Notice', message: 'Hello', audience: 'all-admins' })
  await notificationApis.superAdmin.send(payload)
  assert.equal(calls.at(-1).method, 'POST')
  assert.deepEqual(JSON.parse(calls.at(-1).body), payload)
  assert.equal(calls.at(-1).url, '/api/pharmacy-super-admin/notifications')
  const forwarded = notificationPayload('pharmacyAdmin', { title: 'Review', message: 'Please review.', audience: 'specific-pharmacist', recipientId: 'pharmacist-7', sourceNotificationId: 'incoming-2' })
  await notificationApis.pharmacyAdmin.send(forwarded)
  assert.equal(calls.at(-1).url, '/api/pharmacy-admin/notifications')
  assert.equal(calls.at(-1).method, 'POST')
  assert.equal(calls.at(-1).headers.Authorization, 'Bearer test-admin')
  assert.deepEqual(JSON.parse(calls.at(-1).body), forwarded)
  for (const [role, base, token] of [['superAdmin', 'pharmacy-super-admin', 'test-super'], ['pharmacyAdmin', 'pharmacy-admin', 'test-admin']]) {
    await notificationApis[role].recipients({ role: 'pharmacist', q: 'Ravi Kumar', page: 1, pageSize: 50 })
    const call = calls.at(-1)
    const url = new URL(call.url, 'http://localhost')
    assert.equal(url.pathname, `/api/${base}/notifications/recipients`)
    assert.equal(url.searchParams.get('q'), 'Ravi Kumar')
    assert.equal(url.searchParams.get('role'), 'pharmacist')
    assert.equal(url.searchParams.get('pageSize'), '50')
    assert.equal(call.headers.Authorization, `Bearer ${token}`)
    assert.equal(call.method ?? 'GET', 'GET')
  }
})

test('pharmacists cannot send notifications or enumerate recipients', async () => {
  let requests = 0
  globalThis.fetch = async () => { requests++; throw new Error('Unexpected request') }
  await assert.rejects(notificationApis.pharmacist.send({ title: 'Notice', message: 'Hello' }), /API has not been provided/)
  await assert.rejects(notificationApis.pharmacist.recipients({ role: 'pharmacist' }), /API has not been provided/)
  assert.equal(requests, 0)
})

test('missing endpoints reject instead of recording a pretend successful send', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  await assert.rejects(notificationApis.superAdmin.send({ title: 'Notice', message: 'Hello' }), (error) => error.status === 404 && /Unable to complete this notification request/.test(notificationError(error)))
})

test('recipient lookup failures show a clear message without assuming the backend cause', () => {
  for (const status of [404, 405, 501]) {
    assert.equal(notificationError({ status }, 'recipients'), 'Unable to load recipients. Please try again later.')
  }
  assert.equal(notificationError({ status: 403, message: 'Access denied.' }, 'recipients'), 'Access denied.')
})

test('a successful HTTP response with an invalid body is not treated as confirmed delivery or an empty inbox', async () => {
  globalThis.fetch = async () => new Response('<html>Frontend fallback</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })
  await assert.rejects(notificationApis.superAdmin.send({ title: 'Notice', message: 'Hello' }), /invalid response/)
  await assert.rejects(notificationApis.pharmacyAdmin.list(), /invalid response/)
})

test('send accepts successful acknowledgments without requiring a notification ID', async () => {
  for (const role of ['superAdmin', 'pharmacyAdmin']) {
    for (const acknowledgment of [{ message: 'Notification sent successfully.' }, { success: true }, { data: { recipientCount: 2 } }]) {
      globalThis.fetch = async () => new Response(JSON.stringify(acknowledgment), { status: 200, headers: { 'Content-Type': 'application/json' } })
      assert.deepEqual(await notificationApis[role].send({ title: 'Notice', message: 'Hello', audience: 'all-admins' }), acknowledgment)
    }
    globalThis.fetch = async () => new Response(null, { status: 204 })
    assert.equal(await notificationApis[role].send({ title: 'Notice', message: 'Hello' }), null)
  }
})

test('send preserves application errors even when the HTTP status is successful', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, message: 'No eligible admins found.' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  await assert.rejects(notificationApis.superAdmin.send({ title: 'Notice', message: 'Hello' }), /No eligible admins found/)
})

test('notification pages render for every role; only Admin and Super Admin can compose', async () => {
  const { default: ToastProvider } = await server.ssrLoadModule('/src/components/ToastProvider.jsx')
  for (const [file, route, canSend] of [
    ['/src/pages/Super Admin/Notifications.jsx', '/super-admin/notifications', true],
    ['/src/pages/Admin/Notifications.jsx', '/admin/notifications', true],
    ['/src/pages/Pharmacist/Notifications.jsx', '/pharmacist/notifications', false],
  ]) {
    const { default: Page } = await server.ssrLoadModule(file)
    const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [route] }, createElement(ToastProvider, null, createElement(Page))))
    assert.match(html, /<h1>Notifications<\/h1>/)
    assert.match(html, /Mark All Read/)
    assert.equal(html.includes('>Send Notification</button>'), canSend, route)
    assert.equal(html.includes('>Sent</button>'), canSend, route)
  }
})
