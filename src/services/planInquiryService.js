// Service for managing customer plan inquiries and delivering them to the Super Admin
// Connected directly to fresh backend APIs with notifications & local fallback
import {
  API_BASE_URL,
  submitPublicSubscriptionRequest,
  submitSubscriptionRequest,
  getSuperAdminSubscriptionRequests,
  listSuperAdminSubscriptionRequests,
  getSuperAdminSubscriptionRequestDetails,
  approveSuperAdminSubscriptionRequest,
  rejectSuperAdminSubscriptionRequest,
  resendSuperAdminSubscriptionInvitation,
} from '../config/api.js'
import { setNotificationCount, getNotificationCount } from './notificationManager.js'

const INQUIRIES_STORAGE_KEY = 'pms_super_admin_inquiries'
const NOTIFICATIONS_STORAGE_KEY = 'pms_super_admin_inbox_notis'

// 1. Public: Submit the plan and contact details
// POST /api/public/pharmacy-subscription-requests
export async function submitPlanInquiry(data, options = {}) {
  // 1. Resolve server integer planId (1: Starter, 2: Pro, 3: Enterprise)
  let serverPlanId = 1
  if (typeof data.planId === 'number') {
    serverPlanId = data.planId
  } else {
    const pStr = String(data.planId || '').toLowerCase()
    if (pStr.includes('pro') || pStr === '2') {
      serverPlanId = 2
    } else if (pStr.includes('enterprise') || pStr.includes('hospital') || pStr === '3') {
      serverPlanId = 3
    } else {
      serverPlanId = 1
    }
  }

  const billingFrequency = (String(data.billingCycle || '').toLowerCase() === 'yearly' || String(data.billingCycle || '').toLowerCase() === 'annual')
    ? 'annual'
    : 'monthly'

  const serverPayload = {
    planId: serverPlanId,
    billingFrequency: billingFrequency,
    fullName: String(data.fullName || '').trim(),
    pharmacyName: String(data.pharmacyName || '').trim(),
    email: String(data.email || '').trim(),
    phone: String(data.phone || '').trim(),
    city: String(data.city || '').trim() || null,
    branchCount: parseInt(data.branchCount, 10) || 1,
    message: String(data.message || '').trim() || null,
  }

  // 2. Submit to backend API: /api/public/pharmacy-subscription-requests
  let serverResult = null
  try {
    const submitFn = submitPublicSubscriptionRequest || submitSubscriptionRequest
    serverResult = await submitFn(serverPayload, options)
  } catch (err) {
    console.warn('Backend pharmacy-subscription-requests API call failed, falling back to local persistence:', err.message)
  }

  const inquiry = {
    id: serverResult?.id ? `srv-inq-${serverResult.id}` : `inq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    serverId: serverResult?.id || null,
    fullName: serverPayload.fullName,
    email: serverPayload.email,
    phone: serverPayload.phone,
    pharmacyName: serverPayload.pharmacyName,
    city: serverPayload.city || '',
    branchCount: String(serverPayload.branchCount || '1'),
    planId: String(data.planId || serverPlanId),
    planName: String(data.planName || 'Starter Pharmacy').trim(),
    billingCycle: data.billingCycle || 'monthly',
    price: Number(data.price) || 0,
    message: serverPayload.message || '',
    status: serverResult?.status || 'Pending', // 'Pending' | 'Approved' | 'Rejected'
    createdAt: new Date().toISOString(),
  }

  // 3. Persist inquiry locally for Super Admin console
  try {
    const existingRaw = localStorage.getItem(INQUIRIES_STORAGE_KEY)
    const existing = existingRaw ? JSON.parse(existingRaw) : []
    const updatedInquiries = [inquiry, ...(Array.isArray(existing) ? existing : [])]
    localStorage.setItem(INQUIRIES_STORAGE_KEY, JSON.stringify(updatedInquiries))
  } catch (err) {
    console.error('Failed to store inquiry locally', err)
  }

  // 4. Create a high-priority notification for Super Admin
  const notificationItem = {
    id: `inq-noti-${inquiry.id}`,
    inquiryId: inquiry.id,
    title: `New Plan Inquiry: ${inquiry.planName}`,
    message: `${inquiry.fullName} from "${inquiry.pharmacyName}" (${inquiry.city || 'Location not specified'}) has requested the ${inquiry.planName} plan (${inquiry.billingCycle === 'yearly' ? 'Annual Billing' : 'Monthly Billing'}). Phone: ${inquiry.phone} | Email: ${inquiry.email}${inquiry.message ? ` | Note: "${inquiry.message}"` : ''}`,
    status: 'unread',
    isRead: false,
    category: 'plan_inquiry',
    sender: `${inquiry.fullName} (${inquiry.pharmacyName})`,
    senderName: inquiry.fullName,
    recipient: 'Super Admin',
    createdAt: inquiry.createdAt,
    planDetails: {
      planId: inquiry.planId,
      planName: inquiry.planName,
      billingCycle: inquiry.billingCycle,
      price: inquiry.price,
      pharmacyName: inquiry.pharmacyName,
      phone: inquiry.phone,
      email: inquiry.email,
    },
  }

  try {
    const rawNotis = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
    const notis = rawNotis ? JSON.parse(rawNotis) : []
    const updatedNotis = [notificationItem, ...(Array.isArray(notis) ? notis : [])]
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotis))

    // Update unread count for superAdmin
    const unreadCount = updatedNotis.filter((n) => n.status === 'unread' || !n.isRead).length
    const currentTotal = getNotificationCount('superAdmin')
    const nextCount = Math.max(unreadCount, currentTotal + 1)
    setNotificationCount('superAdmin', nextCount)

    window.dispatchEvent(
      new CustomEvent('pms:notifications-updated', {
        detail: { role: 'superAdmin', unreadCount: nextCount },
      })
    )
    window.dispatchEvent(new CustomEvent('pms:new-inquiry-notification', { detail: notificationItem }))
  } catch (err) {
    console.error('Failed to register inquiry notification', err)
  }

  return { success: true, inquiry, serverResult, data: serverResult }
}

export function unwrapRequestsList(response) {
  if (!response) return []
  if (Array.isArray(response)) return response
  if (Array.isArray(response.data)) return response.data
  if (Array.isArray(response.requests)) return response.requests
  if (Array.isArray(response.items)) return response.items
  if (Array.isArray(response.result)) return response.result
  if (Array.isArray(response.subscriptionRequests)) return response.subscriptionRequests
  return []
}

export function normalizeSubscriptionRequest(raw = {}, index = 0) {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw.id ?? raw.subscriptionRequestId ?? raw.requestId ?? raw.Id ?? raw.RequestId ?? `req-${index + 1}`)
  const pharmacyName = String(raw.pharmacyName ?? raw.PharmacyName ?? raw.name ?? 'Pharmacy').trim()
  const fullName = String(raw.fullName ?? raw.contactPerson ?? raw.contactName ?? raw.FullName ?? raw.ContactPerson ?? raw.name ?? 'Contact Person').trim()
  const email = String(raw.email ?? raw.Email ?? raw.contactEmail ?? '').trim()
  const phone = String(raw.phone ?? raw.phoneNumber ?? raw.contactNumber ?? raw.Phone ?? raw.PhoneNumber ?? '').trim()
  const planId = String(raw.planId ?? raw.PlanId ?? 'starter')
  const planName = String(raw.planName ?? raw.PlanName ?? 'Starter Pharmacy')
  const billingCycle = String(raw.billingCycle ?? raw.BillingCycle ?? 'monthly').toLowerCase()
  const price = Number(raw.price ?? raw.Price ?? 0)
  const city = String(raw.city ?? raw.City ?? raw.location ?? '').trim()
  const branchCount = Number(raw.branchCount ?? raw.BranchCount ?? 1)
  const status = String(raw.status ?? raw.Status ?? raw.requestStatus ?? 'pending').toLowerCase()
  const message = String(raw.message ?? raw.notes ?? raw.Message ?? raw.Notes ?? '').trim()
  const createdAt = raw.createdAt ?? raw.CreatedDate ?? raw.createdDate ?? raw.created_at ?? new Date().toISOString()
  const rejectionReason = String(raw.rejectionReason ?? raw.reason ?? raw.RejectionReason ?? '').trim()
  const invitationSentAt = raw.invitationSentAt ?? raw.invitationEmailedAt ?? raw.InvitationSentAt ?? null

  return {
    id,
    pharmacyName,
    fullName,
    email,
    phone,
    planId,
    planName,
    billingCycle,
    price,
    city,
    branchCount,
    status,
    message,
    createdAt,
    rejectionReason,
    invitationSentAt,
  }
}

// 2. Super Admin: List subscription requests
// GET /api/pharmacy-super-admin/subscription-requests
export async function fetchSuperAdminSubscriptionRequests(params = {}, options = {}) {
  const response = await (listSuperAdminSubscriptionRequests ? listSuperAdminSubscriptionRequests(params, options) : getSuperAdminSubscriptionRequests(params))
  const rawList = unwrapRequestsList(response)
  return rawList.map((item, idx) => normalizeSubscriptionRequest(item, idx)).filter(Boolean)
}

// 3. Super Admin: View request details and status
// GET /api/pharmacy-super-admin/subscription-requests/{id}
export async function fetchSuperAdminSubscriptionRequestDetails(id, options = {}) {
  const response = await getSuperAdminSubscriptionRequestDetails(id, options)
  const raw = response?.data || response?.request || response
  return normalizeSubscriptionRequest(raw, 0)
}

// 4. Super Admin: Approve and email the invitation
// POST /api/pharmacy-super-admin/subscription-requests/{id}/approve
export async function approveSubscriptionRequest(id, payload = {}, options = {}) {
  return await approveSuperAdminSubscriptionRequest(id, payload, options)
}

// 5. Super Admin: Reject a pending request
// POST /api/pharmacy-super-admin/subscription-requests/{id}/reject
export async function rejectSubscriptionRequest(id, reason = '', options = {}) {
  const payload = typeof reason === 'object' ? reason : { reason: String(reason || '').trim() }
  return await rejectSuperAdminSubscriptionRequest(id, payload, options)
}

// 6. Super Admin: Replace an unused invitation and resend it
// POST /api/pharmacy-super-admin/subscription-requests/{id}/resend-invitation
export async function resendSubscriptionInvitation(id, payload = {}, options = {}) {
  return await resendSuperAdminSubscriptionInvitation(id, payload, options)
}

// Local Storage & Notification Center helpers
export function getLocalInquiries() {
  try {
    const raw = localStorage.getItem(INQUIRIES_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function getLocalInquiryNotifications(filterStatus = 'all') {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []

    if (filterStatus === 'unread') {
      return list.filter((n) => n.status === 'unread' || !n.isRead)
    }
    if (filterStatus === 'read') {
      return list.filter((n) => n.status === 'read' || n.isRead)
    }
    return list
  } catch {
    return []
  }
}

export function markInquiryNotificationRead(notificationId) {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
    if (!raw) return
    const list = JSON.parse(raw)
    const updated = list.map((item) => {
      if (item.id === notificationId || item.inquiryId === notificationId) {
        return { ...item, status: 'read', isRead: true }
      }
      return item
    })
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated))

    const unread = updated.filter((n) => n.status === 'unread' || !n.isRead).length
    window.dispatchEvent(
      new CustomEvent('pms:notifications-updated', {
        detail: { role: 'superAdmin', unreadCount: unread },
      })
    )
  } catch (err) {
    console.error('Failed to mark inquiry notification read', err)
  }
}

export function markAllInquiryNotificationsRead() {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
    if (!raw) return
    const list = JSON.parse(raw)
    const updated = list.map((item) => ({ ...item, status: 'read', isRead: true }))
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated))

    window.dispatchEvent(
      new CustomEvent('pms:notifications-updated', {
        detail: { role: 'superAdmin', unreadCount: 0 },
      })
    )
  } catch (err) {
    console.error('Failed to mark all inquiry notifications read', err)
  }
}

export function deleteInquiryNotification(notificationId) {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
    if (!raw) return
    const list = JSON.parse(raw)
    const updated = list.filter((item) => item.id !== notificationId && item.inquiryId !== notificationId)
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated))

    const unread = updated.filter((n) => n.status === 'unread' || !n.isRead).length
    window.dispatchEvent(
      new CustomEvent('pms:notifications-updated', {
        detail: { role: 'superAdmin', unreadCount: unread },
      })
    )
  } catch (err) {
    console.error('Failed to delete inquiry notification', err)
  }
}

export async function fetchServerSubscriptionRequests(params = {}) {
  try {
    const res = await getSuperAdminSubscriptionRequests(params)
    return res
  } catch (err) {
    console.warn('Could not fetch subscription requests from server, using local records:', err.message)
    return getLocalInquiries()
  }
}

export async function approveServerSubscriptionRequest(id, payload = {}) {
  return approveSuperAdminSubscriptionRequest(id, payload)
}

export async function rejectServerSubscriptionRequest(id, payload = {}) {
  return rejectSuperAdminSubscriptionRequest(id, payload)
}

export async function resendServerSubscriptionInvitation(id) {
  return resendSuperAdminSubscriptionInvitation(id)
}
