// Service for managing customer plan inquiries and delivering them to the Super Admin
import { API_BASE_URL } from '../config/api'
import { setNotificationCount, getNotificationCount } from './notificationManager'

const INQUIRIES_STORAGE_KEY = 'pms_super_admin_inquiries'
const NOTIFICATIONS_STORAGE_KEY = 'pms_super_admin_inbox_notis'

export async function submitPlanInquiry(data) {
  const inquiry = {
    id: `inq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fullName: String(data.fullName || '').trim(),
    email: String(data.email || '').trim(),
    phone: String(data.phone || '').trim(),
    pharmacyName: String(data.pharmacyName || '').trim(),
    city: String(data.city || '').trim(),
    branchCount: String(data.branchCount || '1').trim(),
    planId: String(data.planId || 'starter').trim(),
    planName: String(data.planName || 'Starter Pharmacy').trim(),
    billingCycle: String(data.billingCycle || 'monthly').trim(),
    price: Number(data.price) || 0,
    message: String(data.message || '').trim(),
    status: 'new', // 'new' | 'contacted' | 'completed' | 'archived'
    createdAt: new Date().toISOString(),
  }

  // 1. Attempt to send to backend API
  let serverResult = null
  try {
    const url = `${API_BASE_URL ? API_BASE_URL.replace(/\/$/, '') : ''}/api/subscription-inquiries`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(inquiry),
    })
    if (res.ok) {
      serverResult = await res.json()
    }
  } catch (err) {
    // Backend may not have implemented the endpoint yet; we fallback to local storage
    console.warn('Backend subscription-inquiries API not yet available, saving locally for Super Admin:', err.message)
  }

  // 2. Persist inquiry locally for Super Admin console
  try {
    const existingRaw = localStorage.getItem(INQUIRIES_STORAGE_KEY)
    const existing = existingRaw ? JSON.parse(existingRaw) : []
    const updatedInquiries = [inquiry, ...(Array.isArray(existing) ? existing : [])]
    localStorage.setItem(INQUIRIES_STORAGE_KEY, JSON.stringify(updatedInquiries))
  } catch (err) {
    console.error('Failed to store inquiry locally', err)
  }

  // 3. Create a high-priority notification for Super Admin
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

  return { success: true, inquiry, serverResult }
}

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
