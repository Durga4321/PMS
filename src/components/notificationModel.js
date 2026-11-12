export const NOTIFICATION_AUDIENCES = {
  superAdmin: [
    ['all-admins', 'All Admins'],
    ['specific-admin', 'Specific Admin'],
    ['all-pharmacists', 'All Pharmacists'],
    ['specific-pharmacist', 'Specific Pharmacist'],
    ['specific-branch', 'Specific Branch'],
  ],
  pharmacyAdmin: [['specific-pharmacist', 'Specific Pharmacist']],
  pharmacist: [],
}

export function notificationList(response) {
  if (Array.isArray(response)) return response
  if (!response || typeof response !== 'object') return []
  for (const key of ['notifications', 'items', 'records', 'results', 'recipients', 'data']) {
    const value = response[key]
    if (Array.isArray(value)) return value
    if (value && typeof value === 'object') {
      const nested = notificationList(value)
      if (nested.length) return nested
    }
  }
  return []
}

export function notificationBody(response) {
  return response?.data && !Array.isArray(response.data) ? response.data : response || {}
}

export function normalizeNotification(item, folder = 'inbox') {
  const id = item.id ?? item.notificationId ?? item._id
  const state = String(item.status ?? item.state ?? '').toLowerCase()
  const read = item.isRead ?? item.read ?? (state === 'read')
  const sent = folder === 'sent' || state === 'sent'
  const receivedAt = [item.receivedAt, item.received_at, item.ReceivedAt, item.deliveredAt, item.delivered_at, item.DeliveredAt, item.receipt?.receivedAt, item.receipt?.deliveredAt].find((value) => value != null && value !== '')
  const timestamp = (sent ? item.sentAt ?? item.sent_at : receivedAt) || item.createdAt || item.created_at || item.sentAt || item.timestamp || ''
  return {
    id: id == null ? '' : String(id),
    title: item.title ?? item.subject ?? 'Pharmacy System Notification',
    message: item.message ?? item.body ?? item.content ?? item.description ?? '',
    status: folder === 'sent' || state === 'sent' ? 'sent' : (read === true || read === 1 || read === 'true' ? 'read' : 'unread'),
    createdAt: notificationTimestamp(timestamp),
    sender: item.senderName ?? item.sender?.name ?? '',
    recipient: item.recipientName ?? item.recipient?.name ?? item.audienceLabel ?? '',
  }
}

export function notificationTimestamp(value) {
  if (value == null || value === '') return ''
  // Legacy server timestamps omit their UTC offset. Interpret those ISO/SQL
  // datetime values as UTC; preserve any explicitly supplied Z or offset.
  const source = typeof value === 'string' ? value.trim() : value
  const normalized = typeof source === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(source)
    ? `${source.replace(' ', 'T')}Z` : source
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export function recipientRole(audience) {
  return audience === 'specific-admin' ? 'pharmacy-admin' : audience === 'specific-branch' ? 'branch' : 'pharmacist'
}

export function notificationPayload(role, form) {
  if (!NOTIFICATION_AUDIENCES[role]?.some(([value]) => value === form.audience)) throw new Error('This audience is not available for your role.')
  const title = form.title.trim()
  const message = form.message.trim()
  if (!title || !message) throw new Error('Enter a title and message.')
  if (title.length > 200 || message.length > 5000) throw new Error('The title or message exceeds the allowed length.')
  const payload = { title, message, audience: form.audience }
  if (role === 'pharmacyAdmin' && form.sourceNotificationId) payload.sourceNotificationId = String(form.sourceNotificationId)
  if (form.audience.startsWith('specific-')) {
    if (!form.recipientId) throw new Error('Select a recipient before sending.')
    if (form.audience === 'specific-branch') payload.branchId = String(form.recipientId)
    else {
      payload.recipientIds = [String(form.recipientId)]
      payload.recipientRole = recipientRole(form.audience)
    }
  }
  return payload
}

export function notificationError(error, operation = '') {
  if (error?.status === 404 || error?.status === 405 || error?.status === 501) {
    return operation === 'recipients' ? 'Unable to load recipients. Please try again later.' : 'Unable to complete this notification request. Please try again later.'
  }
  return error?.message || 'Unable to load notifications.'
}
