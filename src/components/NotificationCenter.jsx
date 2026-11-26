import { useEffect, useId, useRef, useState } from 'react'
import {
  notificationApis,
  getSuperAdminSubscriptionRequest,
  approveSuperAdminSubscriptionRequest,
  rejectSuperAdminSubscriptionRequest,
} from '../config/api'
import { useToast } from './ToastProvider'
import { useLanguage } from '../i18n/language'
import { NOTIFICATION_AUDIENCES, notificationBody, notificationError, notificationList, notificationPayload, normalizeNotification, recipientRole } from './notificationModel'
import {
  getLocalInquiries,
  getLocalInquiryNotifications,
  markInquiryNotificationRead,
  markAllInquiryNotificationsRead,
  deleteInquiryNotification,
} from '../services/planInquiryService'
import './NotificationCenter.css'

const PAGE_SIZE = 20

function NotificationIcon({ send = false }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{send ? <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></> : <path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9M10 21h4" />}</svg>
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function isSubscriptionRequestNotification(item) {
  if (!item) return false
  if (item.isPlanInquiry || item.category === 'plan_inquiry' || item.category === 'subscription_request') return true
  const title = String(item.title || '').toLowerCase()
  const message = String(item.message || '').toLowerCase()
  if (title.includes('subscription request') || title.includes('plan inquiry') || title.includes('pharmacy subscription')) return true
  if (message.includes('subscription request #') || message.includes('plan inquiry') || message.includes('ready to review') || message.includes('has requested the')) return true
  return false
}

function extractSubscriptionRequestId(item) {
  if (item?.serverId) return String(item.serverId)
  if (item?.inquiryId) return String(item.inquiryId)
  const msg = String(item?.message || '')
  const match = msg.match(/subscription request #?(\d+)/i)
  if (match) return match[1]
  const idMatch = String(item?.id || '').match(/inq-(\d+)/i)
  if (idMatch) return idMatch[1]
  return null
}

function parseDetailsFromNotification(item, reqId) {
  const msg = String(item?.message || '')
  const phoneMatch = msg.match(/Phone:\s*([^\s|]+)/i)
  const emailMatch = msg.match(/Email:\s*([^\s|]+)/i)
  const noteMatch = msg.match(/Note:\s*"([^"]+)"/i) || msg.match(/Note:\s*([^|]+)/i)
  const planMatch = msg.match(/requested the ([^(|]+) plan/i) || msg.match(/Plan:\s*([^\s|]+)/i)
  const freqMatch = msg.match(/(Annual Billing|Monthly Billing)/i)
  const senderMatch = msg.match(/^([^from]+)\s+from\s+"?([^"(]+)"?/i)

  return {
    id: reqId ? `srv-inq-${reqId}` : (item?.id || 'inq-unknown'),
    serverId: reqId || null,
    fullName: (senderMatch ? senderMatch[1].trim() : '') || item?.sender || 'Pharmacy Applicant',
    pharmacyName: (senderMatch ? senderMatch[2].trim() : '') || 'Pharmacy / Clinic',
    email: emailMatch ? emailMatch[1].trim() : '',
    phone: phoneMatch ? phoneMatch[1].trim() : '',
    planName: planMatch ? planMatch[1].trim() : 'Starter Pharmacy',
    billingFrequency: freqMatch ? (freqMatch[1].toLowerCase().includes('annual') ? 'annual' : 'monthly') : 'monthly',
    branchCount: '1',
    city: '',
    message: noteMatch ? noteMatch[1].trim() : (msg.includes('ready to review') ? '' : msg),
    status: 'Pending',
    createdAt: item?.createdAt || new Date().toISOString(),
  }
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

  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [viewInquiry, setViewInquiry] = useState(null)
  const [inquiryLoading, setInquiryLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const viewDialog = useRef(null)

  useEffect(() => {
    if (!api) return
    const controller = new AbortController()
    let current = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const response = await api.list({ folder: tab === 'sent' ? 'sent' : 'inbox', ...(tab === 'read' || tab === 'unread' ? { status: tab } : {}), page, pageSize: PAGE_SIZE }, { signal: controller.signal })
        if (!current) return
        const body = notificationBody(response)
        const total = body.total ?? body.pagination?.total ?? body.count
        const unread = body.unread ?? body.unreadCount
        const nextCounts = body.counts || {}
        let incoming = notificationList(response).map((item) => normalizeNotification(item, tab === 'sent' ? 'sent' : 'inbox'))

        if (role === 'superAdmin' && tab !== 'sent') {
          const localInquiries = getLocalInquiryNotifications(tab)
          const formattedInquiries = localInquiries.map((inq) => ({
            id: inq.id,
            inquiryId: inq.inquiryId,
            title: inq.title,
            message: inq.message,
            status: inq.status,
            createdAt: inq.createdAt,
            sender: inq.sender,
            recipient: inq.recipient,
            isPlanInquiry: true,
          }))
          incoming = [...formattedInquiries, ...incoming]
        }
        setItems((previous) => page === 1 ? incoming : [...previous, ...incoming.filter((item) => !item.id || !previous.some((old) => old.id === item.id))])
        setCounts({ ...nextCounts, ...(Number.isFinite(Number(unread)) && unread != null ? { unread: Number(unread) } : {}) })
        if (unread != null && Number.isFinite(Number(unread))) window.dispatchEvent(new CustomEvent('pms:notifications-updated', { detail: { role, unreadCount: Number(unread) } }))
        setHasMore(total != null ? page * PAGE_SIZE < Number(total) : incoming.length === PAGE_SIZE)
      } catch (requestError) {
        if (!current || controller.signal.aborted || requestError?.name === 'AbortError' || requestError?.name === 'CanceledError' || requestError?.code === 'ERR_CANCELED') return
        if (current) setError(notificationError(requestError))
      } finally {
        if (current && !controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => { current = false; controller.abort() }
  }, [api, role, tab, page, revision])

  useEffect(() => {
    if (!modalOpen || !targeted || !api) return
    const controller = new AbortController()
    let current = true
    async function loadRecipients() {
      setRecipientsLoading(true)
      setRecipientError('')
      try {
        const response = await api.recipients({ role: recipientRole(form.audience), q: recipientQuery.trim(), page: recipientPage, pageSize: 50 }, { signal: controller.signal })
        if (!current || controller.signal.aborted) return
        const incoming = notificationList(response).map((item) => ({
          ...item,
          id: String(item.id ?? item.pharmacistId ?? item._id ?? item.userId?.id ?? ''),
          name: item.name || item.fullName || item.pharmacistName || item.user?.name,
          email: item.email || item.user?.email,
        })).filter((item) => item.id !== '')
        setRecipients((previous) => recipientPage === 1 ? incoming : [...previous, ...incoming.filter((item) => !previous.some((old) => old.id === item.id))])
        const body = notificationBody(response)
        const total = body.total ?? body.pagination?.total
        setMoreRecipients(body.hasMore ?? (total != null ? recipientPage * 50 < Number(total) : incoming.length === 50))
      } catch (requestError) {
        if (!current || controller.signal.aborted || requestError?.name === 'AbortError' || requestError?.name === 'CanceledError' || requestError?.code === 'ERR_CANCELED') return
        if (current) { setRecipientError(notificationError(requestError, 'recipients')); setRecipients([]); setForm((value) => ({ ...value, recipientId: '' })) }
      } finally {
        if (current && !controller.signal.aborted) setRecipientsLoading(false)
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
    let lastSync = Date.now()
    function syncVisible() {
      if (document.visibilityState === 'hidden') return
      const now = Date.now()
      // Throttle window focus revalidation (30s) to avoid cancelling in-flight requests or resetting pagination
      if (now - lastSync < 30000) return
      lastSync = now
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
      if (role === 'superAdmin') {
        if (action === 'all') {
          markAllInquiryNotificationsRead()
        } else if (action === 'read' && id) {
          markInquiryNotificationRead(id)
        } else if (action === 'delete' && id) {
          deleteInquiryNotification(id)
        }
      }
      try {
        await (action === 'all' ? api.markAllRead() : action === 'read' ? api.markRead(id) : api.remove(id))
      } catch (apiErr) {
        if (!String(id).startsWith('inq-noti-') && action !== 'all') {
          throw apiErr
        }
      }
      refresh()
    } catch (requestError) {
      setActionError(notificationError(requestError))
    } finally { setBusy(false) }
  }

  async function send(event) {
    event.preventDefault()
    if (sending) return
    setSendError('')
    // Read the submitted controls so validation uses exactly what is visible,
    // including values filled by the browser without a React change event.
    const submitted = new FormData(event.currentTarget)
    const submittedForm = { ...form, title: String(submitted.get('title') ?? ''), message: String(submitted.get('message') ?? ''), recipientId: String(submitted.get('recipientId') ?? '') }
    try {
      const payload = notificationPayload(role, submittedForm)
      if (targeted && !recipients.some((item) => item.id === submittedForm.recipientId)) throw new Error('Select a recipient before sending.')
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

  async function openViewDetails(item) {
    setViewModalOpen(true)
    setInquiryLoading(true)
    setViewInquiry(null)

    if (item.status === 'unread' && item.id) {
      changeNotification('read', item.id)
    }

    if (item.planDetails) {
      setViewInquiry({
        ...item.planDetails,
        id: item.inquiryId || item.id,
        title: item.title,
        message: item.message,
        createdAt: item.createdAt,
        status: item.status || 'Pending',
      })
      setInquiryLoading(false)
      return
    }

    const reqId = extractSubscriptionRequestId(item)
    const localList = getLocalInquiries()
    const localMatch = localList.find((inq) =>
      (reqId && (String(inq.serverId) === String(reqId) || String(inq.id).includes(reqId))) ||
      (item.inquiryId && (inq.id === item.inquiryId || inq.inquiryId === item.inquiryId)) ||
      (item.sender && inq.fullName && item.sender.includes(inq.fullName))
    )

    if (reqId) {
      try {
        const res = await getSuperAdminSubscriptionRequest(reqId)
        if (res) {
          const rec = res.data || res
          const resolvedPlanName = rec.planName || (rec.planId === 1 ? 'Starter Pharmacy' : rec.planId === 2 ? 'Professional Chain' : rec.planId === 3 ? 'Hospital Network' : (localMatch?.planName || 'Starter Pharmacy'))
          const resolvedMonthly = rec.planId === 1 ? 1499 : rec.planId === 2 ? 3999 : rec.planId === 3 ? 8999 : (localMatch?.price || 1499)
          const resolvedYearly = rec.planId === 1 ? 1199 : rec.planId === 2 ? 3199 : rec.planId === 3 ? 7199 : (localMatch?.yearlyPrice || 1199)

          setViewInquiry({
            ...localMatch,
            ...rec,
            serverId: reqId,
            id: localMatch?.id || `srv-inq-${reqId}`,
            fullName: rec.fullName || localMatch?.fullName || 'Applicant',
            pharmacyName: rec.pharmacyName || localMatch?.pharmacyName || 'Pharmacy',
            email: rec.email || localMatch?.email || '',
            phone: rec.phone || localMatch?.phone || '',
            city: rec.city || localMatch?.city || '',
            branchCount: rec.branchCount || localMatch?.branchCount || 1,
            planName: resolvedPlanName,
            planId: rec.planId || localMatch?.planId || 1,
            monthlyPrice: resolvedMonthly,
            yearlyPrice: resolvedYearly,
            billingFrequency: rec.billingFrequency || localMatch?.billingCycle || 'monthly',
            message: rec.message || localMatch?.message || '',
            status: rec.status || localMatch?.status || 'Pending',
            createdAt: rec.createdAt || localMatch?.createdAt || item.createdAt,
          })
          setInquiryLoading(false)
          return
        }
      } catch (err) {
        console.warn('Could not load subscription request from server:', err?.message)
      }
    }

    if (localMatch) {
      setViewInquiry(localMatch)
      setInquiryLoading(false)
      return
    }

    setViewInquiry(parseDetailsFromNotification(item, reqId))
    setInquiryLoading(false)
  }

  async function handleApprove(inquiry) {
    if (!inquiry) return
    setActionBusy(true)
    const serverId = inquiry.serverId || (String(inquiry.id).startsWith('srv-inq-') ? inquiry.id.replace('srv-inq-', '') : null)
    try {
      if (serverId) {
        try {
          await approveSuperAdminSubscriptionRequest(serverId)
        } catch (serverErr) {
          console.warn('Server approve API:', serverErr.message)
        }
      }
      const local = getLocalInquiries()
      const updated = local.map((inq) => {
        if (inq.id === inquiry.id || (serverId && inq.serverId == serverId)) {
          return { ...inq, status: 'Approved' }
        }
        return inq
      })
      localStorage.setItem('pms_super_admin_inquiries', JSON.stringify(updated))
      setViewInquiry((prev) => prev ? { ...prev, status: 'Approved' } : null)
      showToast(`Subscription request #${serverId || inquiry.id} approved successfully!`, 'success')
      refresh()
    } catch (err) {
      showToast('Failed to approve request: ' + (err.message || 'Please try again'), 'error')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleReject(inquiry) {
    if (!inquiry) return
    setActionBusy(true)
    const serverId = inquiry.serverId || (String(inquiry.id).startsWith('srv-inq-') ? inquiry.id.replace('srv-inq-', '') : null)
    try {
      if (serverId) {
        try {
          await rejectSuperAdminSubscriptionRequest(serverId)
        } catch (serverErr) {
          console.warn('Server reject API:', serverErr.message)
        }
      }
      const local = getLocalInquiries()
      const updated = local.map((inq) => {
        if (inq.id === inquiry.id || (serverId && inq.serverId == serverId)) {
          return { ...inq, status: 'Rejected' }
        }
        return inq
      })
      localStorage.setItem('pms_super_admin_inquiries', JSON.stringify(updated))
      setViewInquiry((prev) => prev ? { ...prev, status: 'Rejected' } : null)
      showToast(`Subscription request #${serverId || inquiry.id} rejected.`, 'info')
      refresh()
    } catch (err) {
      showToast('Failed to reject request: ' + (err.message || 'Please try again'), 'error')
    } finally {
      setActionBusy(false)
    }
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
        {items.map((item, index) => <article className={`notification-center-row is-${item.status}`} key={item.id || `missing-${index}`}><span className="notification-center-icon"><NotificationIcon send={item.status === 'sent'} /></span><div className="notification-center-copy"><h2 translate="no">{item.isPlanInquiry && <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '99px', background: '#ccfbf1', color: '#0f766e', fontSize: '10px', fontWeight: 800, marginRight: '8px' }}>Plan Inquiry</span>}{item.title}</h2><p translate="no">{item.message}</p>{(item.status === 'sent' ? item.recipient : item.sender) ? <small>{item.status === 'sent' ? 'To:' : 'From:'} <span translate="no">{item.status === 'sent' ? item.recipient : item.sender}</span></small> : null}</div><div className="notification-center-meta"><span className={`notification-center-status is-${item.status}`}>{item.status === 'sent' ? 'Sent' : item.status === 'read' ? 'Read' : 'Unread'}</span><time dateTime={item.createdAt || undefined}>{dateLabel(item.createdAt)}</time><div className="notification-center-row-actions">{isSubscriptionRequestNotification(item) ? <button type="button" className="notification-center-view-btn" onClick={() => openViewDetails(item)} title="View what the user sent regarding the plan and details"><EyeIcon />View Request</button> : null}{role === 'pharmacyAdmin' && item.status !== 'sent' ? <button type="button" disabled={busy || !item.id} onClick={() => openComposer(item)}>Forward to Pharmacist</button> : null}{item.status === 'unread' ? <button type="button" disabled={busy || !item.id} onClick={() => changeNotification('read', item.id)}>Mark as Read</button> : null}<button type="button" disabled={busy || !item.id} onClick={() => changeNotification('delete', item.id)}>Delete</button></div></div></article>)}
        {loading ? <p className="notification-center-empty" role="status">Loading notifications...</p> : !error && !items.length ? <p className="notification-center-empty">No notifications available.</p> : null}
      </div>
      {!error && hasMore ? <button className="notification-center-more" type="button" disabled={loading} onClick={() => { setLoading(true); setPage((value) => value + 1) }}>Load More</button> : null}
    </div>
    {modalOpen ? <div className="notification-center-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) setModalOpen(false) }}><div className="notification-center-dialog" role="dialog" aria-modal="true" aria-labelledby={modalTitle} ref={dialog} onKeyDown={handleDialogKey}><form onSubmit={send}><header><div><p>New message</p><h2 id={modalTitle}>Send Notification</h2></div><button type="button" aria-label="Close" disabled={sending} onClick={() => setModalOpen(false)}>×</button></header>
      <label>Title<input name="title" required maxLength={200} value={form.title} disabled={sending} onChange={(event) => { const title = event.target.value; setForm((value) => ({ ...value, title })); setSendError('') }} placeholder="e.g. Low Stock Alert" /></label>
      <label>Message<textarea name="message" required rows={4} maxLength={5000} value={form.message} disabled={sending} onChange={(event) => { const message = event.target.value; setForm((value) => ({ ...value, message })); setSendError('') }} placeholder="Write the notification message..." /></label>
      <label>Target Audience<select value={form.audience} disabled={sending} onChange={(event) => { setForm((value) => ({ ...value, audience: event.target.value, recipientId: '' })); setRecipients([]); setRecipientQuery(''); setRecipientPage(1); setRecipientError('') }}>{audiences.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {targeted ? <><label>Find recipient<input type="search" value={recipientQuery} disabled={sending} placeholder="Search by name or email..." onChange={(event) => { setRecipientQuery(event.target.value); setRecipientPage(1); setRecipients([]); setForm((value) => ({ ...value, recipientId: '' })) }} /></label><label>{form.audience === 'specific-branch' ? 'Select Branch' : form.audience === 'specific-admin' ? 'Select Admin' : 'Select Pharmacist'}<select name="recipientId" required value={form.recipientId} disabled={sending || recipientsLoading} onChange={(event) => setForm((value) => ({ ...value, recipientId: event.target.value }))}><option value="">Select a recipient</option>{recipients.map((item) => <option key={item.id} value={item.id} translate="no">{[item.name || item.email || item.id, item.email && item.name ? item.email : '', item.branchName].filter(Boolean).join(' — ')}</option>)}</select></label>{recipientsLoading ? <p role="status">Loading recipients...</p> : null}{recipientError ? <p className="notification-center-error" role="alert">{recipientError}</p> : !recipientsLoading && !recipients.length ? <p>No eligible recipients found.</p> : null}{moreRecipients ? <button type="button" disabled={recipientsLoading || sending} onClick={() => setRecipientPage((value) => value + 1)}>Load more recipients</button> : null}</> : null}
      {sendError ? <p className="notification-center-error" role="alert">{sendError}</p> : null}
      <footer><button type="button" disabled={sending} onClick={() => setModalOpen(false)}>Cancel</button><button className="notification-center-send" type="submit" disabled={sending || (targeted && (recipientsLoading || Boolean(recipientError) || !form.recipientId))}>{sending ? 'Sending...' : 'Send Notification'}</button></footer>
    </form></div></div> : null}

    {viewModalOpen ? (
      <div
        className="notification-center-backdrop"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !actionBusy) setViewModalOpen(false)
        }}
      >
        <div className="inquiry-modal-dialog" role="dialog" aria-modal="true" ref={viewDialog}>
          <header className="inquiry-modal-header">
            <div className="inquiry-modal-header-copy">
              <h2>
                <span>Pharmacy Subscription Request</span>
                {viewInquiry?.serverId ? <span>#{viewInquiry.serverId}</span> : null}
                <span className={`inquiry-badge-status is-${String(viewInquiry?.status || 'pending').toLowerCase()}`}>
                  {viewInquiry?.status || 'Pending'}
                </span>
              </h2>
              <p>
                Submitted on {dateLabel(viewInquiry?.createdAt)}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              disabled={actionBusy}
              onClick={() => setViewModalOpen(false)}
            >
              ×
            </button>
          </header>

          {inquiryLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--pms-muted, #64748b)' }}>
              Loading request details...
            </div>
          ) : viewInquiry ? (
            <>
              <div className="inquiry-modal-body">
                {/* Plan Summary Banner */}
                <div className="inquiry-plan-banner">
                  <div>
                    <span className="inquiry-badge-plan">Chosen Plan</span>
                    <h3 className="inquiry-plan-title" style={{ marginTop: 4 }}>
                      {viewInquiry.planName || 'Starter Pharmacy'}
                    </h3>
                    <p className="inquiry-plan-sub">
                      Branch limit: <strong>{viewInquiry.branchCount || '1'} {Number(viewInquiry.branchCount) > 1 ? 'Branches' : 'Branch / Location'}</strong>
                    </p>
                  </div>
                  <div>
                    <span className="inquiry-plan-price">
                      ₹{Number(viewInquiry.billingFrequency === 'annual' || viewInquiry.billingCycle === 'yearly' ? (viewInquiry.yearlyPrice || 1199) : (viewInquiry.monthlyPrice || viewInquiry.price || 1499)).toLocaleString('en-IN')}
                    </span>
                    <span className="inquiry-plan-cycle">
                      {viewInquiry.billingFrequency === 'annual' || viewInquiry.billingCycle === 'yearly' ? '/month (Annual Billing)' : '/month (Monthly Billing)'}
                    </span>
                  </div>
                </div>

                {/* Applicant & Pharmacy Information Grid */}
                <div className="inquiry-details-grid">
                  <div className="inquiry-field-box">
                    <div className="inquiry-field-label">Applicant Name</div>
                    <div className="inquiry-field-value">{viewInquiry.fullName || '—'}</div>
                  </div>

                  <div className="inquiry-field-box">
                    <div className="inquiry-field-label">Pharmacy / Hospital Name</div>
                    <div className="inquiry-field-value">{viewInquiry.pharmacyName || '—'}</div>
                  </div>

                  <div className="inquiry-field-box">
                    <div className="inquiry-field-label">Work Email</div>
                    <div className="inquiry-field-value">
                      {viewInquiry.email ? (
                        <a href={`mailto:${viewInquiry.email}`}>{viewInquiry.email}</a>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>

                  <div className="inquiry-field-box">
                    <div className="inquiry-field-label">Phone / Mobile</div>
                    <div className="inquiry-field-value">
                      {viewInquiry.phone ? (
                        <a href={`tel:${viewInquiry.phone}`}>{viewInquiry.phone}</a>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>

                  <div className="inquiry-field-box">
                    <div className="inquiry-field-label">City / Location</div>
                    <div className="inquiry-field-value">{viewInquiry.city || 'Not specified'}</div>
                  </div>

                  <div className="inquiry-field-box">
                    <div className="inquiry-field-label">Billing Cycle</div>
                    <div className="inquiry-field-value" style={{ textTransform: 'capitalize' }}>
                      {viewInquiry.billingFrequency === 'annual' || viewInquiry.billingCycle === 'yearly' ? 'Annual (20% Savings)' : 'Monthly'}
                    </div>
                  </div>
                </div>

                {/* User Message / Special Requirements Note */}
                <div className="inquiry-message-callout">
                  <div className="inquiry-message-callout-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>User Message & Special Requirements</span>
                  </div>
                  <p className="inquiry-message-text">
                    {viewInquiry.message?.trim() ? `"${viewInquiry.message.trim()}"` : 'No additional message or special requirements noted.'}
                  </p>
                </div>
              </div>

              <footer className="inquiry-modal-footer">
                <div className="inquiry-modal-footer-left">
                  {String(viewInquiry.status).toLowerCase() !== 'approved' ? (
                    <button
                      type="button"
                      className="inquiry-action-approve"
                      disabled={actionBusy}
                      onClick={() => handleApprove(viewInquiry)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      Approve Request
                    </button>
                  ) : null}

                  {String(viewInquiry.status).toLowerCase() !== 'rejected' ? (
                    <button
                      type="button"
                      className="inquiry-action-reject"
                      disabled={actionBusy}
                      onClick={() => handleReject(viewInquiry)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                      Reject Request
                    </button>
                  ) : null}
                </div>

                <div className="inquiry-modal-footer-right">
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => setViewModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </footer>
            </>
          ) : null}
        </div>
      </div>
    ) : null}
  </section>
}
