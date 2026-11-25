// Subscription plans and pricing service - connected to real backend APIs
import {
  getPublicSubscriptionPlans,
  listSuperAdminSubscriptionPlans,
  getSuperAdminSubscriptionPlan,
  createSuperAdminSubscriptionPlan,
  updateSuperAdminSubscriptionPlan,
  deleteSuperAdminSubscriptionPlan,
} from '../config/api.js'

export const EVENT_KEY = 'pms:subscription-plans-updated'

export function cleanFeatureText(text) {
  return String(text || '')
    .replace(/\s*\+\s*Cashier/gi, '')
    .replace(/\bCashier\b/gi, '')
    .replace(/\(\s*Pharmacist\s*\)/gi, '(Pharmacist)')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function calculateSavingsPercent(monthly, yearly) {
  const m = Number(monthly)
  const y = Number(yearly)
  if (!Number.isFinite(m) || !Number.isFinite(y) || m <= 0 || y <= 0) return 0
  const annualMonthlyRate = y > m * 1.5 ? y / 12 : y
  if (annualMonthlyRate >= m) return 0
  return Math.round(((m - annualMonthlyRate) / m) * 100)
}

function getFallbackCopy(code = '', name = '') {
  const key = `${code} ${name}`.toLowerCase()
  if (key.includes('starter')) {
    return {
      tagline: 'Ideal for independent chemists, standalone clinics & retail pharmacies.',
      badge: '',
      popular: false,
      features: [
        '1 Pharmacy Branch / Location',
        'Up to 3 Staff Accounts (Pharmacist)',
        'Real-time Medicine Inventory Tracking',
        'Fast POS Billing & Tax Invoices (GST)',
        'Expiry Date & Low-Stock Alerts',
        'Standard Daily Sales & Stock Reports',
        'Email & WhatsApp Support',
      ],
    }
  }
  if (key.includes('pro')) {
    return {
      tagline: 'Best for growing multi-branch pharmacy chains and polyclinics.',
      badge: '★ Most Popular',
      popular: true,
      features: [
        'Up to 5 Pharmacy Branches',
        'Unlimited Staff & Pharmacist Accounts',
        'Prescription Queue & Rapid Dispensing',
        'Inter-Branch Stock Transfers & Approvals',
        'Medicine Returns, Cancellations & Refunds',
        'Split Payments (Cash, UPI & Card)',
        'Advanced Profit, Sales & Audit Analytics',
        'Priority 24/7 Phone & Technical Support',
      ],
    }
  }
  if (key.includes('enterprise') || key.includes('hospital')) {
    return {
      tagline: 'Tailored for large hospital networks, institutional pharmacies & chains.',
      badge: 'Enterprise',
      popular: false,
      features: [
        'Unlimited Branches & Central Warehouses',
        'Granular Role-Based Access Controls',
        'Supplier Purchase Orders & Batch Quarantine',
        'Automated Stock Reordering Logic',
        'Complete Audit Logs & Activity Trails',
        'Custom HMIS / EHR API Integrations',
        'Dedicated Account Manager & 99.9% SLA',
        'On-site Staff Training & Data Migration',
      ],
    }
  }
  return {
    tagline: 'Standard pharmacy subscription plan.',
    badge: '',
    popular: false,
    features: [
      'Pharmacy Branch Management',
      'Staff Accounts & Access Controls',
      'Medicine Inventory Tracking',
      'POS Billing & Tax Invoices',
    ],
  }
}

export function normalizeSubscriptionPlan(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw.id ?? raw.planId ?? raw.Id ?? raw.PlanId ?? raw.code ?? raw.Code ?? `plan-${index + 1}`)
  const code = String(raw.code ?? raw.Code ?? raw.id ?? raw.Id ?? '').trim().toUpperCase()
  const name = String(raw.name ?? raw.planName ?? raw.Name ?? raw.PlanName ?? raw.title ?? raw.Title ?? `Plan ${index + 1}`).trim()

  const fallback = getFallbackCopy(code, name)

  const tagline = String(raw.tagline ?? raw.Tagline ?? raw.description ?? raw.Description ?? fallback.tagline).trim()

  // monthlyAmountPaise and annualAmountPaise handling (for public plans API)
  const hasMonthlyPaise = raw.monthlyAmountPaise !== undefined || raw.MonthlyAmountPaise !== undefined
  const hasAnnualPaise = raw.annualAmountPaise !== undefined || raw.AnnualAmountPaise !== undefined

  const rawMonthlyPaise = raw.monthlyAmountPaise ?? raw.MonthlyAmountPaise
  const rawAnnualPaise = raw.annualAmountPaise ?? raw.AnnualAmountPaise

  let monthlyAmountPaise = null
  if (rawMonthlyPaise !== undefined && rawMonthlyPaise !== null && rawMonthlyPaise !== '') {
    monthlyAmountPaise = Number(rawMonthlyPaise)
  }

  let annualAmountPaise = null
  if (rawAnnualPaise !== undefined && rawAnnualPaise !== null && rawAnnualPaise !== '') {
    annualAmountPaise = Number(rawAnnualPaise)
  }

  // Display price in rupees: monthlyAmountPaise / 100 and annualAmountPaise / 100
  // If an amount is null, treat that billing option as unavailable.
  let monthlyPrice = null
  let yearlyPrice = null

  if (hasMonthlyPaise || hasAnnualPaise) {
    monthlyPrice = monthlyAmountPaise != null ? monthlyAmountPaise / 100 : null
    yearlyPrice = annualAmountPaise != null ? annualAmountPaise / 100 : null
  } else {
    // Fallback for Super Admin API endpoints where amountPaise and billingIntervalMonths are returned
    let amountPaise = null
    if (raw.amountPaise != null && raw.amountPaise !== '') {
      amountPaise = Number(raw.amountPaise)
    } else if (raw.AmountPaise != null && raw.AmountPaise !== '') {
      amountPaise = Number(raw.AmountPaise)
    } else if (raw.monthlyPrice != null && raw.monthlyPrice !== '') {
      amountPaise = Math.round(Number(raw.monthlyPrice) * 100)
    }

    const interval = Number(
      raw.billingIntervalMonths ?? raw.BillingIntervalMonths ?? (raw.billingInterval === 'yearly' ? 12 : 1)
    ) === 12 ? 12 : 1

    if (amountPaise != null) {
      if (interval === 12) {
        yearlyPrice = amountPaise / 100
        monthlyPrice = null
      } else {
        monthlyPrice = amountPaise / 100
        yearlyPrice = null
      }
    }
  }

  const amountPaise = raw.amountPaise != null && raw.amountPaise !== ''
    ? Number(raw.amountPaise)
    : (monthlyAmountPaise ?? annualAmountPaise)

  const billingIntervalMonths = Number(
    raw.billingIntervalMonths ?? raw.BillingIntervalMonths ?? (yearlyPrice != null && monthlyPrice == null ? 12 : 1)
  ) === 12 ? 12 : 1

  const priceRupees = monthlyPrice ?? yearlyPrice ?? (amountPaise != null ? amountPaise / 100 : 0)

  const branchLimit = raw.branchLimit != null && raw.branchLimit !== ''
    ? Number(raw.branchLimit)
    : (raw.BranchLimit != null && raw.BranchLimit !== '' ? Number(raw.BranchLimit) : null)

  const popular = Boolean(raw.popular ?? raw.Popular ?? raw.isPopular ?? raw.IsPopular ?? fallback.popular)
  const badge = String(raw.badge ?? raw.Badge ?? (popular ? '★ Most Popular' : (fallback.badge || ''))).trim()

  let features = []
  const rawFeatures = raw.features ?? raw.Features ?? raw.inclusions ?? raw.Inclusions
  if (Array.isArray(rawFeatures)) {
    features = rawFeatures
      .map((f) => (typeof f === 'string' ? f : (f?.name || f?.feature || f?.title || '')))
      .map(cleanFeatureText)
      .filter(Boolean)
  } else if (typeof rawFeatures === 'string') {
    features = rawFeatures
      .split(/\r?\n|,/)
      .map(cleanFeatureText)
      .filter(Boolean)
  }

  if (features.length === 0) {
    features = fallback.features
  }

  const ctaText = String(raw.ctaText ?? raw.CtaText ?? 'Get Started').trim()
  const ctaLink = String(raw.ctaLink ?? raw.CtaLink ?? `/plan-inquiry?plan=${encodeURIComponent(id)}`).trim()

  let isPublished = true
  if (raw.isPublished !== undefined) isPublished = Boolean(raw.isPublished)
  else if (raw.IsPublished !== undefined) isPublished = Boolean(raw.IsPublished)
  else if (raw.published !== undefined) isPublished = Boolean(raw.published)
  else if (raw.Published !== undefined) isPublished = Boolean(raw.Published)
  else if (raw.active !== undefined) isPublished = Boolean(raw.active)
  else if (raw.isActive !== undefined) isPublished = Boolean(raw.isActive)
  else if (raw.status !== undefined) isPublished = String(raw.status).toLowerCase() === 'active'

  return {
    id,
    code,
    name,
    amountPaise,
    monthlyAmountPaise,
    annualAmountPaise,
    priceRupees,
    billingIntervalMonths,
    branchLimit,
    isPublished,
    active: isPublished, // UI alias for publish status
    tagline,
    monthlyPrice,
    yearlyPrice,
    popular,
    badge,
    features,
    ctaText,
    ctaLink,
  }
}

export function unwrapPlansResponse(response) {
  if (!response) return []
  if (Array.isArray(response)) return response
  if (Array.isArray(response.data)) return response.data
  if (Array.isArray(response.plans)) return response.plans
  if (Array.isArray(response.items)) return response.items
  if (Array.isArray(response.result)) return response.result
  if (Array.isArray(response.subscriptionPlans)) return response.subscriptionPlans
  return []
}

// 1. Public: Load published plans and monthly or annual prices
// GET /api/public/pharmacy-subscription-plans
export async function fetchSubscriptionPlans(options = {}) {
  const response = await getPublicSubscriptionPlans(options)
  const rawList = unwrapPlansResponse(response)
  const plans = rawList.map((item, idx) => normalizeSubscriptionPlan(item, idx)).filter(Boolean)
  return plans
}

// 2. Super Admin: List all plans, including hidden
// GET /api/pharmacy-subscriptions/plans
export async function fetchSuperAdminSubscriptionPlans(options = {}) {
  const response = await listSuperAdminSubscriptionPlans(options)
  const rawList = unwrapPlansResponse(response)
  const plans = rawList.map((item, idx) => normalizeSubscriptionPlan(item, idx)).filter(Boolean)
  return plans
}

// 3. Super Admin: Get full plan for editing
// GET /api/pharmacy-subscriptions/plans/{id}
export async function fetchSuperAdminSubscriptionPlan(id, options = {}) {
  const response = await getSuperAdminSubscriptionPlan(id, options)
  const raw = response?.data ?? response?.plan ?? response
  return normalizeSubscriptionPlan(raw, 0)
}

// 4. Super Admin: Create plan (expects 201)
// POST /api/pharmacy-subscriptions/plans
// Payload sends: code, name, amountPaise, billingIntervalMonths, branchLimit, isPublished
export async function createSuperAdminPlan(planData, options = {}) {
  let amountPaise = null
  if (planData.amountPaise != null && planData.amountPaise !== '') {
    amountPaise = Number(planData.amountPaise)
  } else if (planData.priceRupees != null && planData.priceRupees !== '') {
    amountPaise = Math.round(Number(planData.priceRupees) * 100)
  } else if (planData.monthlyPrice != null && planData.monthlyPrice !== '') {
    amountPaise = Math.round(Number(planData.monthlyPrice) * 100)
  }

  const payload = {
    code: String(planData.code || '').trim().toUpperCase(),
    name: String(planData.name || '').trim(),
    amountPaise,
    billingIntervalMonths: Number(planData.billingIntervalMonths) === 12 ? 12 : 1,
    branchLimit: planData.branchLimit != null && planData.branchLimit !== '' ? Number(planData.branchLimit) : null,
    isPublished: planData.isPublished !== undefined ? Boolean(planData.isPublished) : (planData.active !== undefined ? Boolean(planData.active) : true),
  }

  return await createSuperAdminSubscriptionPlan(payload, options)
}

// 5. Super Admin: Update plan (expects 204)
// PUT /api/pharmacy-subscriptions/plans/{id}
// Payload sends: name, amountPaise, billingIntervalMonths, branchLimit, isPublished (NO code!)
export async function updateSuperAdminPlan(id, planData, options = {}) {
  let amountPaise = null
  if (planData.amountPaise != null && planData.amountPaise !== '') {
    amountPaise = Number(planData.amountPaise)
  } else if (planData.priceRupees != null && planData.priceRupees !== '') {
    amountPaise = Math.round(Number(planData.priceRupees) * 100)
  } else if (planData.monthlyPrice != null && planData.monthlyPrice !== '') {
    amountPaise = Math.round(Number(planData.monthlyPrice) * 100)
  }

  const payload = {
    name: String(planData.name || '').trim(),
    amountPaise,
    billingIntervalMonths: Number(planData.billingIntervalMonths) === 12 ? 12 : 1,
    branchLimit: planData.branchLimit != null && planData.branchLimit !== '' ? Number(planData.branchLimit) : null,
    isPublished: planData.isPublished !== undefined ? Boolean(planData.isPublished) : (planData.active !== undefined ? Boolean(planData.active) : true),
  }

  return await updateSuperAdminSubscriptionPlan(id, payload, options)
}

// 6. Super Admin: Permanently delete plan (expects 204)
// DELETE /api/pharmacy-subscriptions/plans/{id}
export async function deleteSuperAdminPlan(id, options = {}) {
  return await deleteSuperAdminSubscriptionPlan(id, options)
}

// 7. Super Admin: Hide/Show Toggle
// Fetches the current plan by ID and sends a full PUT payload with only isPublished changed
export async function toggleSuperAdminPlanPublish(id, options = {}) {
  const currentRaw = await getSuperAdminSubscriptionPlan(id, options)
  const current = currentRaw?.data ?? currentRaw?.plan ?? currentRaw
  const norm = normalizeSubscriptionPlan(current, 0)
  const nextPublished = !norm.isPublished

  const payload = {
    name: norm.name,
    amountPaise: norm.amountPaise,
    billingIntervalMonths: norm.billingIntervalMonths,
    branchLimit: norm.branchLimit,
    isPublished: nextPublished,
  }

  await updateSuperAdminSubscriptionPlan(id, payload, options)
  return { success: true, isPublished: nextPublished }
}

// Empty initial state helper for synchronous component mounts (no local or session storage)
export function getSubscriptionPlans() {
  return []
}

export function saveSubscriptionPlans() {
  return {
    success: false,
    message: 'Direct synchronous saving is deprecated. Use createSuperAdminPlan or updateSuperAdminPlan.',
  }
}

export function resetSubscriptionPlans() {
  return []
}
