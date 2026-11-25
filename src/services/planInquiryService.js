// Service for pharmacy subscription requests and Super Admin management
// Connected directly to fresh backend APIs without local or session storage
import {
  submitSubscriptionRequest,
  listSuperAdminSubscriptionRequests,
  getSuperAdminSubscriptionRequestDetails,
  approveSuperAdminSubscriptionRequest,
  rejectSuperAdminSubscriptionRequest,
  resendSuperAdminSubscriptionInvitation,
} from '../config/api.js'

// 1. Public: Submit the plan and contact details
// POST /api/public/pharmacy-subscription-requests
export async function submitPlanInquiry(data, options = {}) {
  const payload = {
    planId: String(data.planId || 'starter').trim(),
    planName: String(data.planName || 'Starter Pharmacy').trim(),
    fullName: String(data.fullName || '').trim(),
    email: String(data.email || '').trim(),
    phone: String(data.phone || '').trim(),
    pharmacyName: String(data.pharmacyName || '').trim(),
    city: String(data.city || '').trim(),
    branchCount: Number(data.branchCount) || 1,
    billingCycle: String(data.billingCycle || 'monthly').trim(),
    price: Number(data.price) || 0,
    message: String(data.message || '').trim(),
  }

  // Directly transmit to backend endpoint
  const response = await submitSubscriptionRequest(payload, options)
  return {
    success: true,
    data: response?.data || response,
    response,
  }
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
  const response = await listSuperAdminSubscriptionRequests(params, options)
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

// Compatibility helpers (no local storage persistence)
export function getLocalInquiries() {
  return []
}

export function getLocalInquiryNotifications() {
  return []
}

export function markInquiryNotificationRead() {}
export function markAllInquiryNotificationsRead() {}
export function deleteInquiryNotification() {}
