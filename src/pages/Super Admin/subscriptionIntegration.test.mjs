import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  apiUrl,
  API_BASE_URL,
  authTokenFor,
  getPublicSubscriptionPlans,
  submitSubscriptionRequest,
  acceptSubscriptionInvitation,
  listSuperAdminSubscriptionPlans,
  getSuperAdminSubscriptionPlan,
  createSuperAdminSubscriptionPlan,
  updateSuperAdminSubscriptionPlan,
  deleteSuperAdminSubscriptionPlan,
  listSuperAdminSubscriptionRequests,
  getSuperAdminSubscriptionRequestDetails,
  approveSuperAdminSubscriptionRequest,
  rejectSuperAdminSubscriptionRequest,
  resendSuperAdminSubscriptionInvitation,
} from '../../config/api.js'
import {
  fetchSubscriptionPlans,
  fetchSuperAdminSubscriptionPlans,
  fetchSuperAdminSubscriptionPlan,
  createSuperAdminPlan,
  updateSuperAdminPlan,
  deleteSuperAdminPlan,
  toggleSuperAdminPlanPublish,
  normalizeSubscriptionPlan,
  unwrapPlansResponse,
  calculateSavingsPercent,
  getSubscriptionPlans,
} from '../../services/subscriptionPlansService.js'
import {
  submitPlanInquiry,
  normalizeSubscriptionRequest,
  unwrapRequestsList,
  fetchSuperAdminSubscriptionRequests,
  fetchSuperAdminSubscriptionRequestDetails,
  approveSubscriptionRequest,
  rejectSubscriptionRequest,
  resendSubscriptionInvitation,
} from '../../services/planInquiryService.js'

test('[Subscription Plans API] endpoint URLs and formatting', () => {
  assert.equal(apiUrl('public/pharmacy-subscription-plans'), `${API_BASE_URL}/api/public/pharmacy-subscription-plans`)
  assert.equal(apiUrl('pharmacy-subscriptions/plans'), `${API_BASE_URL}/api/pharmacy-subscriptions/plans`)
  assert.equal(apiUrl('pharmacy-subscriptions/plans/pro-1'), `${API_BASE_URL}/api/pharmacy-subscriptions/plans/pro-1`)
  assert.equal(apiUrl('public/pharmacy-subscription-requests'), `${API_BASE_URL}/api/public/pharmacy-subscription-requests`)
  assert.equal(apiUrl('public/pharmacy-subscription-invitations/accept'), `${API_BASE_URL}/api/public/pharmacy-subscription-invitations/accept`)
  assert.equal(apiUrl('pharmacy-super-admin/subscription-requests'), `${API_BASE_URL}/api/pharmacy-super-admin/subscription-requests`)
  assert.equal(apiUrl('pharmacy-super-admin/subscription-requests/42'), `${API_BASE_URL}/api/pharmacy-super-admin/subscription-requests/42`)
  assert.equal(apiUrl('pharmacy-super-admin/subscription-requests/42/approve'), `${API_BASE_URL}/api/pharmacy-super-admin/subscription-requests/42/approve`)
  assert.equal(apiUrl('pharmacy-super-admin/subscription-requests/42/reject'), `${API_BASE_URL}/api/pharmacy-super-admin/subscription-requests/42/reject`)
  assert.equal(apiUrl('pharmacy-super-admin/subscription-requests/42/resend-invitation'), `${API_BASE_URL}/api/pharmacy-super-admin/subscription-requests/42/resend-invitation`)
})

test('[Subscription Plans] normalizeSubscriptionPlan extracts and standardizes backend plan fields', () => {
  const backendRecord = {
    id: 12,
    code: 'PRO_CHAIN',
    name: 'Professional Chain',
    amountPaise: 399900, // ₹3,999 in paise
    billingIntervalMonths: 1,
    branchLimit: 5,
    isPublished: true,
  }

  const normalized = normalizeSubscriptionPlan(backendRecord, 0)
  assert.equal(normalized.id, '12')
  assert.equal(normalized.code, 'PRO_CHAIN')
  assert.equal(normalized.name, 'Professional Chain')
  assert.equal(normalized.amountPaise, 399900)
  assert.equal(normalized.priceRupees, 3999) // Display saved amounts divided by 100
  assert.equal(normalized.monthlyPrice, 3999)
  assert.equal(normalized.billingIntervalMonths, 1)
  assert.equal(normalized.branchLimit, 5)
  assert.equal(normalized.isPublished, true)
  assert.equal(normalized.active, true)
  // Preserves display fallback features and popular status
  assert.ok(Array.isArray(normalized.features))
  assert.ok(normalized.features.length > 0)
  assert.equal(normalized.popular, true)
})

test('[Subscription Plans] handles annual billingIntervalMonths (12) and null branchLimit', () => {
  const annualPlan = {
    id: 'hosp-net',
    code: 'HOSPITAL',
    name: 'Hospital Network',
    amountPaise: 899900,
    billingIntervalMonths: 12,
    branchLimit: null, // Unlimited / unset
    isPublished: false, // Hidden
  }

  const normalized = normalizeSubscriptionPlan(annualPlan, 0)
  assert.equal(normalized.code, 'HOSPITAL')
  assert.equal(normalized.priceRupees, 8999)
  assert.equal(normalized.billingIntervalMonths, 12)
  assert.equal(normalized.branchLimit, null)
  assert.equal(normalized.isPublished, false)
  assert.equal(normalized.active, false)
})

test('[Subscription Plans] normalizes public plans with monthlyAmountPaise and annualAmountPaise', () => {
  const publicPlan = {
    id: 1,
    name: 'Starter Pharmacy',
    monthlyAmountPaise: 199900,
    annualAmountPaise: 1999000,
    isPublished: true,
  }

  const normalized = normalizeSubscriptionPlan(publicPlan, 0)
  assert.equal(normalized.id, '1')
  assert.equal(normalized.name, 'Starter Pharmacy')
  assert.equal(normalized.monthlyPrice, 1999)
  assert.equal(normalized.yearlyPrice, 19990)
  assert.equal(calculateSavingsPercent(normalized.monthlyPrice, normalized.yearlyPrice), 17)
})

test('[Subscription Plans] treats null monthly or annual amount as unavailable', () => {
  const planWithNullAnnual = {
    id: 2,
    name: 'Special Campaign Plan',
    monthlyAmountPaise: 299900,
    annualAmountPaise: null,
    isPublished: true,
  }

  const normalized = normalizeSubscriptionPlan(planWithNullAnnual, 0)
  assert.equal(normalized.monthlyPrice, 2999)
  assert.equal(normalized.yearlyPrice, null)
  assert.equal(calculateSavingsPercent(normalized.monthlyPrice, normalized.yearlyPrice), 0)
})

test('[Subscription Plans] unwrapPlansResponse handles nested envelope structures', () => {
  assert.deepEqual(unwrapPlansResponse([{ id: 'p1' }]), [{ id: 'p1' }])
  assert.deepEqual(unwrapPlansResponse({ data: [{ id: 'p2' }] }), [{ id: 'p2' }])
  assert.deepEqual(unwrapPlansResponse({ plans: [{ id: 'p3' }] }), [{ id: 'p3' }])
  assert.deepEqual(unwrapPlansResponse({ items: [{ id: 'p4' }] }), [{ id: 'p4' }])
  assert.deepEqual(unwrapPlansResponse(null), [])
})

test('[Subscription Plans] getSubscriptionPlans returns empty initial state and does not use localStorage', () => {
  const initial = getSubscriptionPlans()
  assert.ok(Array.isArray(initial))
  assert.equal(initial.length, 0)
})

test('[Subscription Requests] normalizeSubscriptionRequest extracts request details', () => {
  const rawReq = {
    Id: 101,
    PharmacyName: 'Apollo Care',
    FullName: 'Dr. Ramesh',
    Email: 'ramesh@apollocare.com',
    Phone: '9876543210',
    PlanId: 'pro',
    PlanName: 'Professional Chain',
    BillingCycle: 'Yearly',
    Price: 3199,
    City: 'Hyderabad',
    BranchCount: 3,
    Status: 'pending',
    Notes: 'Need urgent multi-branch setup',
    CreatedDate: '2026-11-24T10:00:00Z',
  }

  const req = normalizeSubscriptionRequest(rawReq, 0)
  assert.equal(req.id, '101')
  assert.equal(req.pharmacyName, 'Apollo Care')
  assert.equal(req.fullName, 'Dr. Ramesh')
  assert.equal(req.email, 'ramesh@apollocare.com')
  assert.equal(req.phone, '9876543210')
  assert.equal(req.planId, 'pro')
  assert.equal(req.planName, 'Professional Chain')
  assert.equal(req.billingCycle, 'yearly')
  assert.equal(req.price, 3199)
  assert.equal(req.city, 'Hyderabad')
  assert.equal(req.branchCount, 3)
  assert.equal(req.status, 'pending')
  assert.equal(req.message, 'Need urgent multi-branch setup')
})

test('[Subscription Requests] unwrapRequestsList unwraps various server responses', () => {
  assert.deepEqual(unwrapRequestsList([{ id: 'r1' }]), [{ id: 'r1' }])
  assert.deepEqual(unwrapRequestsList({ data: [{ id: 'r2' }] }), [{ id: 'r2' }])
  assert.deepEqual(unwrapRequestsList({ requests: [{ id: 'r3' }] }), [{ id: 'r3' }])
  assert.deepEqual(unwrapRequestsList({ items: [{ id: 'r4' }] }), [{ id: 'r4' }])
  assert.deepEqual(unwrapRequestsList(null), [])
})
