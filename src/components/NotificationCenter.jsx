import { useEffect, useId, useRef, useState } from 'react'
import { notificationApis } from '../config/api'
import { useToast } from './ToastProvider'
import { useLanguage } from '../i18n/language'
import { NOTIFICATION_AUDIENCES, notificationBody, notificationError, notificationList, notificationPayload, normalizeNotification, recipientRole } from './notificationModel'
import './NotificationCenter.css'

const PAGE_SIZE = 20

function NotificationIcon({ send = false }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{send ? <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></> : <path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9M10 21h4" />}</svg>
}

export default function NotificationCenter({ role }) {
  const api = notificationApis[role]
  const audiences = NOTIFICATION_AUDIENCES[role]
  const canSend = audiences.length > 0
  const { showToast } = useToast()
  const language = useLanguage()
  const modalTitle = useId()
  const dialog = useRef(null)
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [items, setItems] = useState([])
  const [counts, setCounts] = useState({})
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [form, setForm] = useState({ title: '', message: '', audience: audiences[0]?.[0] || '', recipientId: '' })
  const [recipients, setRecipients] = useState([])
  const [recipientQuery, setRecipientQuery] = useState('')
  const [recipientPage, setRecipientPage] = useState(1)
  const [moreRecipients, setMoreRecipients] = useState(false)
  const [recipientsLoading, setRecipientsLoading] = useState(false)
  const [recipientError, setRecipientError] = useState('')
  const targeted = form.audience.startsWith('specific-')

  useEffect(() => {
    const controller = new AbortController()
    let current = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const response = await api.list({ folder: tab === 'sent' ? 'sent' : 'inbox', ...(tab === 'read' || tab === 'unread' ? { status: tab } : {}), page, pageSize: PAGE_SIZE }, { signal: controller.signal })
        if (!current) return
        const body = notificationBody(response)
        const incoming = notificationList(response).map((item) => normalizeNotification(item, tab === 'sent' ? 'sent' : 'inbox'))
        setItems((previous) => page === 1 ? incoming : [...previous, ...incoming.filter((item) => !item.id || !previous.some((old) => old.id === item.id))])
        const nextCounts = body.counts || response?.counts || {}
        const unread = body.unreadCount ?? nextCounts.unread ?? response?.unreadCount
        setCounts({ ...nextCounts, ...(Number.isFinite(Number(unread)) && unread != null ? { unread: Number(unread) } : {}) })
        if (unread != null && Number.isFinite(Number(unread))) window.dispatchEvent(new CustomEvent('pms:notifications-updated', { detail: { role, unreadCount: Number(unread) } }))
        const total = body.total ?? body.totalCount ?? body.pagination?.total ?? response?.total
        setHasMore(body.hasMore ?? (total != null ? page * PAGE_SIZE < Number(total) : incoming.length === PAGE_SIZE))
      } catch (requestError) {
        if (current) setError(notificationError(requestError))
      } finally {
        if (current) setLoading(false)
      }
    }
    load()
    return () => { current = false; controller.abort() }
  }, [api, role, tab, page, revision])

  useEffect(() => {
    if (!modalOpen || !targeted) return
    const controller = new AbortController()
    let current = true
    async function loadRecipients() {
      setRecipientsLoading(true)
      setRecipientError('')
      try {
        const response = await api.recipients({ role: recipientRole(form.audience), q: recipientQuery.trim(), page: recipientPage, pageSize: 50 }, { signal: controller.signal })
        if (!current) return
        const incoming = notificationList(response).filter((item) => item.id != null && item.id !== '').map((item) => ({ ...item, id: String(item.id) }))
        setRecipients((previous) => recipientPage === 1 ? incoming : [...previous, ...incoming.filter((item) => !previous.some((old) => old.id === item.id))])
        const body = notificationBody(response)
        const total = body.total ?? body.pagination?.total
        setMoreRecipients(body.hasMore ?? (total != null ? recipientPage * 50 < Number(total) : incoming.length === 50))
      } catch (requestError) {
        if (current) { setRecipientError(notificationError(requestError, 'recipients')); setRecipients([]); setForm((value) => ({ ...value, recipientId: '' })) }
      } finally {
        if (current) setRecipientsLoading(false)
      }
    }
    const timer = window.setTimeout(loadRecipients, 250)
    return () => { current = false; window.clearTimeout(timer); controller.abort() }
  }, [api, modalOpen, targeted, form.audience, recipientQuery, recipientPage])

  useEffect(() => {
    if (!modalOpen) return
    const previousFocus = document.activeElement
    dialog.current?.querySelector('input')?.focus()
    return () => previousFocus?.isConnected && previousFocus.focus()
  }, [modalOpen])

  useEffect(() => {
    if (modalOpen) return
    function syncVisible() {
      if (document.visibilityState === 'hidden') return
      setPage(1)
      setRevision((value) => value + 1)
    }
    const timer = window.setInterval(syncVisible, 60000)
    window.addEventListener('focus', syncVisible)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', syncVisible) }
  }, [modalOpen])

  function refresh() {
    setLoading(true)
    setPage(1)
    setItems([])
    setRevision((value) => value + 1)
    window.dispatchEvent(new CustomEvent('pms:notifications-updated', { detail: { role } }))
  }

  function changeTab(value) {
    if (value === tab) return
    setItems([])
    setError('')
    setLoading(true)
    setActionError('')
    setPage(1)
    setTab(value)
  }

  async function changeNotification(action, id) {
    setBusy(true)
    setActionError('')
    try {
      await (action === 'all' ? api.markAllRead() : action === 'read' ? api.markRead(id) : api.remove(id))
      refresh()
    } catch (requestError) {
      setActionError(notificationError(requestError))
    } finally { setBusy(false) }
  }

  async function send(event) {
    event.preventDefault()
    if (sending) return
    setSendError('')
    try {
      const payload = notificationPayload(role, form)
      if (targeted && !recipients.some((item) => item.id === form.recipientId)) throw new Error('Select a recipient before sending.')
      setSending(true)
      await api.send(payload)
      setModalOpen(false)
      setForm({ title: '', message: '', audience: audiences[0][0], recipientId: '' })
      setTab('sent')
      refresh()
      showToast('Notification sent successfully.', 'success')
    } catch (requestError) {
      setSendError(notificationError(requestError))
    } finally { setSending(false) }
  }

  function openComposer(source) {
    setSendError('')
    setRecipientQuery('')
    setRecipientPage(1)
    setRecipients([])
    setForm({ title: source?.title || '', message: source?.message || '', audience: audiences[0][0], recipientId: '', sourceNotificationId: source?.id || '' })
    setModalOpen(true)
  }

  function handleDialogKey(event) {
    if (event.key === 'Escape' && !sending) { event.preventDefault(); setModalOpen(false) }
    if (event.key !== 'Tab') return
    const controls = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')]
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }

  function dateLabel(value) {
    if (!value) return 'Date unavailable'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(language === 'te' ? 'te-IN' : 'en-IN', { timeZone: 'Asia/Kolkata', timeZoneName: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const tabs = [['all', 'All'], ['unread', 'Unread'], ['read', 'Read'], ...(canSend ? [['sent', 'Sent']] : [])]
  const unread = counts.unread ?? items.filter((item) => item.status === 'unread').length

  return <section className="notification-center">
    <header className="notification-center-heading"><div><h1>Notifications</h1><p>{role === 'superAdmin' ? 'Create and send platform notifications.' : role === 'pharmacyAdmin' ? 'Read platform messages and send notifications to a specific pharmacist.' : 'Read notifications sent to you by your administrators.'}</p></div><div className="notification-center-actions"><button type="button" onClick={refresh} disabled={loading || busy}>Refresh</button><button type="button" onClick={() => changeNotification('all')} disabled={loading || busy || unread === 0}>Mark All Read</button>{canSend ? <button type="button" className="notification-center-send" onClick={() => openComposer()}><NotificationIcon send />Send Notification</button> : null}</div></header>
    {actionError ? <p className="notification-center-error" role="alert">{actionError}</p> : null}
    <div className="notification-center-panel">
      <nav className="notification-center-tabs" aria-label="Notification filters">{tabs.map(([value, label]) => <button type="button" key={value} className={tab === value ? 'is-active' : ''} aria-pressed={tab === value} onClick={() => changeTab(value)}>{label}{counts[value] != null ? <b>{counts[value]}</b> : null}</button>)}</nav>
      {error ? <div className="notification-center-error" role="alert"><p>{error}</p><button type="button" onClick={refresh}>Retry</button></div> : null}
      <div className="notification-center-list" aria-busy={loading}>
        {items.map((item, index) => <article className={`notification-center-row is-${item.status}`} key={item.id || `missing-${index}`}><span className="notification-center-icon"><NotificationIcon send={item.status === 'sent'} /></span><div className="notification-center-copy"><h2 translate="no">{item.title}</h2><p translate="no">{item.message}</p>{(item.status === 'sent' ? item.recipient : item.sender) ? <small>{item.status === 'sent' ? 'To:' : 'From:'} <span translate="no">{item.status === 'sent' ? item.recipient : item.sender}</span></small> : null}</div><div className="notification-center-meta"><span className={`notification-center-status is-${item.status}`}>{item.status === 'sent' ? 'Sent' : item.status === 'read' ? 'Read' : 'Unread'}</span><time dateTime={item.createdAt || undefined}>{dateLabel(item.createdAt)}</time><div className="notification-center-row-actions">{role === 'pharmacyAdmin' && item.status !== 'sent' ? <button type="button" disabled={busy || !item.id} onClick={() => openComposer(item)}>Forward to Pharmacist</button> : null}{item.status === 'unread' ? <button type="button" disabled={busy || !item.id} onClick={() => changeNotification('read', item.id)}>Mark as Read</button> : null}<button type="button" disabled={busy || !item.id} onClick={() => changeNotification('delete', item.id)}>Delete</button></div></div></article>)}
        {loading ? <p className="notification-center-empty" role="status">Loading notifications...</p> : !error && !items.length ? <p className="notification-center-empty">No notifications available.</p> : null}
      </div>
      {!error && hasMore ? <button className="notification-center-more" type="button" disabled={loading} onClick={() => { setLoading(true); setPage((value) => value + 1) }}>Load More</button> : null}
    </div>
    {modalOpen ? <div className="notification-center-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) setModalOpen(false) }}><div className="notification-center-dialog" role="dialog" aria-modal="true" aria-labelledby={modalTitle} ref={dialog} onKeyDown={handleDialogKey}><form onSubmit={send}><header><div><p>New message</p><h2 id={modalTitle}>Send Notification</h2></div><button type="button" aria-label="Close" disabled={sending} onClick={() => setModalOpen(false)}>×</button></header>
      <label>Title<input required maxLength={200} value={form.title} disabled={sending} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} placeholder="e.g. Low Stock Alert" /></label>
      <label>Message<textarea required rows={4} maxLength={5000} value={form.message} disabled={sending} onChange={(event) => setForm((value) => ({ ...value, message: event.target.value }))} placeholder="Write the notification message..." /></label>
      <label>Target Audience<select value={form.audience} disabled={sending} onChange={(event) => { setForm((value) => ({ ...value, audience: event.target.value, recipientId: '' })); setRecipients([]); setRecipientQuery(''); setRecipientPage(1); setRecipientError('') }}>{audiences.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {targeted ? <><label>Find recipient<input type="search" value={recipientQuery} disabled={sending} placeholder="Search by name or email..." onChange={(event) => { setRecipientQuery(event.target.value); setRecipientPage(1); setRecipients([]); setForm((value) => ({ ...value, recipientId: '' })) }} /></label><label>{form.audience === 'specific-branch' ? 'Select Branch' : form.audience === 'specific-admin' ? 'Select Admin' : 'Select Pharmacist'}<select required value={form.recipientId} disabled={sending || recipientsLoading} onChange={(event) => setForm((value) => ({ ...value, recipientId: event.target.value }))}><option value="">Select a recipient</option>{recipients.map((item) => <option key={item.id} value={item.id} translate="no">{[item.name || item.email || item.id, item.email && item.name ? item.email : '', item.branchName].filter(Boolean).join(' — ')}</option>)}</select></label>{recipientsLoading ? <p role="status">Loading recipients...</p> : null}{recipientError ? <p className="notification-center-error" role="alert">{recipientError}</p> : !recipientsLoading && !recipients.length ? <p>No eligible recipients found.</p> : null}{moreRecipients ? <button type="button" disabled={recipientsLoading || sending} onClick={() => setRecipientPage((value) => value + 1)}>Load more recipients</button> : null}</> : null}
      {sendError ? <p className="notification-center-error" role="alert">{sendError}</p> : null}
      <footer><button type="button" disabled={sending} onClick={() => setModalOpen(false)}>Cancel</button><button className="notification-center-send" type="submit" disabled={sending || (targeted && (recipientsLoading || Boolean(recipientError) || !form.recipientId))}>{sending ? 'Sending...' : 'Send Notification'}</button></footer>
    </form></div></div> : null}
  </section>
}
