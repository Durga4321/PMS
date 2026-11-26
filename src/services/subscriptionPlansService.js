// Shared subscription plans and pricing service for Super Admin and Landing Page
// Supports both direct backend API communication and local caching/fallbacks
import {
  getPublicSubscriptionPlans,
  listSuperAdminSubscriptionPlans,
  getSuperAdminSubscriptionPlan,
  createSuperAdminSubscriptionPlan,
  updateSuperAdminSubscriptionPlan,
  deleteSuperAdminSubscriptionPlan,
} from '../config/api.js'

export const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    id: 'starter',
    name: 'Starter Pharmacy',
    tagline: 'Ideal for independent chemists, standalone clinics & retail pharmacies.',
    monthlyPrice: 1499,
    yearlyPrice: 1199,
    popular: false,
    badge: '',
    features: [
      '1 Pharmacy Branch / Location',
      'Up to 3 Staff Accounts (Pharmacist)',
      'Real-time Medicine Inventory Tracking',
      'Fast POS Billing & Tax Invoices (GST)',
      'Expiry Date & Low-Stock Alerts',
      'Standard Daily Sales & Stock Reports',
      'Email & WhatsApp Support',
    ],
    ctaText: 'Start 14-Day Free Trial',
    ctaLink: '/login',
    active: true,
  },
  {
    id: 'pro',
    name: 'Professional Chain',
    tagline: 'Best for growing multi-branch pharmacy chains and polyclinics.',
    monthlyPrice: 3999,
    yearlyPrice: 3199,
    popular: true,
    badge: '★ Most Popular',
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
    ctaText: 'Get Started with Pro',
    ctaLink: '/login',
    active: true,
  },
  {
    id: 'enterprise',
    name: 'Hospital Network',
    tagline: 'Tailored for large hospital networks, institutional pharmacies & chains.',
    monthlyPrice: 8999,
    yearlyPrice: 7199,
    popular: false,
    badge: 'Enterprise',
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
    ctaText: 'Contact Enterprise',
    ctaLink: '#contact',
    active: true,
  },
]

export const STORAGE_KEY = 'pms_subscription_plans_v2'
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

export function formatRupees(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '-'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount))
}

export function getFallbackCopy(code = '', name = '') {
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
    tagline: 'Comprehensive pharmacy management plan tailored to your business needs.',
    badge: '',
    popular: false,
    features: [
      'Multi-branch inventory and stock management',
      'Real-time POS and prescription dispensing',
      'Tax-compliant invoices and financial reports',
      'Role-based staff and pharmacist permissions',
      'Customer and supplier ledger records',
    ],
  }
}

export function unwrapPlansList(response) {
  if (!response) return []
  if (Array.isArray(response)) return response
  if (Array.isArray(response.data)) return response.data
  if (Array.isArray(response.plans)) return response.plans
  if (Array.isArray(response.items)) return response.items
  if (Array.isArray(response.result)) return response.result
  return []
}
export const unwrapPlansResponse = unwrapPlansList

export function normalizeSubscriptionPlan(raw = {}, index = 0) {
  if (!raw || typeof raw !== 'object') return null

  const rawId = raw.id !== undefined && raw.id !== null ? raw.id : index + 1
  const id = String(rawId)
  const code = String(raw.code ?? raw.planCode ?? raw.Code ?? `plan-${id}`).trim()
  const name = String(raw.name ?? raw.planName ?? raw.Name ?? 'Subscription Plan').trim()

  const rawMonthlyPaise = raw.monthlyAmountPaise ?? (raw.billingIntervalMonths === 1 ? raw.amountPaise : null)
  const rawAnnualPaise = raw.annualAmountPaise ?? (raw.billingIntervalMonths === 12 ? raw.amountPaise : null)

  const monthlyPrice =
    rawMonthlyPaise !== null && rawMonthlyPaise !== undefined && !Number.isNaN(Number(rawMonthlyPaise))
      ? Math.round(Number(rawMonthlyPaise) / 100)
      : raw.monthlyPrice !== undefined
        ? Number(raw.monthlyPrice)
        : null

  const yearlyPrice =
    rawAnnualPaise !== null && rawAnnualPaise !== undefined && !Number.isNaN(Number(rawAnnualPaise))
      ? Math.round(Number(rawAnnualPaise) / 100)
      : raw.yearlyPrice !== undefined
        ? Number(raw.yearlyPrice)
        : null

  const amountPaise = raw.amountPaise !== undefined ? raw.amountPaise : (monthlyPrice !== null ? monthlyPrice * 100 : null)
  const priceRupees = amountPaise !== null && amountPaise !== undefined ? Math.round(Number(amountPaise) / 100) : (monthlyPrice ?? yearlyPrice)
  const billingIntervalMonths = raw.billingIntervalMonths !== undefined ? Number(raw.billingIntervalMonths) : 1
  const branchLimit = raw.branchLimit !== undefined && raw.branchLimit !== null ? Number(raw.branchLimit) : null
  const isPublished = raw.isPublished !== undefined ? Boolean(raw.isPublished) : true

  const fallback = getFallbackCopy(code, name)
  const features = Array.isArray(raw.features) && raw.features.length > 0
    ? raw.features.map(cleanFeatureText)
    : fallback.features

  return {
    id,
    code,
    name,
    tagline: raw.tagline || fallback.tagline,
    priceRupees,
    monthlyPrice,
    yearlyPrice,
    amountPaise,
    billingIntervalMonths,
    branchLimit,
    isPublished,
    active: isPublished,
    popular: raw.popular !== undefined ? Boolean(raw.popular) : fallback.popular,
    badge: raw.badge !== undefined ? raw.badge : fallback.badge,
    features,
    ctaText: raw.ctaText || 'Get Started',
    ctaLink: raw.ctaLink || '/login',
    savingsPercent: calculateSavingsPercent(monthlyPrice, yearlyPrice),
    raw,
  }
}

// 1. Public: Load published plans and monthly or annual prices
// GET /api/public/pharmacy-subscription-plans
export async function fetchSubscriptionPlans(options = {}) {
  const response = await getPublicSubscriptionPlans(options)
  const rawList = unwrapPlansList(response)
  const normalized = rawList.map((item, idx) => normalizeSubscriptionPlan(item, idx)).filter(Boolean)
  if (normalized.length > 0) {
    try {
      saveSubscriptionPlans(normalized)
    } catch {}
  }
  return normalized
}

export async function fetchSubscriptionPlansFromServer() {
  try {
    const plans = await fetchSubscriptionPlans()
    if (Array.isArray(plans) && plans.length > 0) {
      return plans
    }
  } catch (err) {
    console.warn('Could not fetch plans from server, using local/cached plans:', err?.message || err)
  }
  return getSubscriptionPlans()
}

// 2. Super Admin: List all plans, including hidden
// GET /api/pharmacy-subscriptions/plans
export async function fetchSuperAdminSubscriptionPlans(options = {}) {
  const response = await listSuperAdminSubscriptionPlans(options)
  const rawList = unwrapPlansList(response)
  return rawList.map((item, idx) => normalizeSubscriptionPlan(item, idx)).filter(Boolean)
}

// 3. Super Admin: Get the full plan for editing
// GET /api/pharmacy-subscriptions/plans/{id}
export async function getSuperAdminPlanById(id, options = {}) {
  const response = await getSuperAdminSubscriptionPlan(id, options)
  const raw = response?.data || response?.plan || response
  return normalizeSubscriptionPlan(raw, 0)
}
export const fetchSuperAdminSubscriptionPlan = getSuperAdminPlanById

// 4. Super Admin: Create plan
// POST /api/pharmacy-subscriptions/plans
export async function createSuperAdminPlan(formData = {}, options = {}) {
  const priceRupees = formData.priceRupees !== undefined && formData.priceRupees !== '' ? Number(formData.priceRupees) : null
  const amountPaise = priceRupees !== null && !Number.isNaN(priceRupees) ? Math.round(priceRupees * 100) : (formData.amountPaise ?? null)
  const branchLimit = formData.branchLimit !== undefined && formData.branchLimit !== '' ? Number(formData.branchLimit) : null
  const billingIntervalMonths = formData.billingIntervalMonths !== undefined ? Number(formData.billingIntervalMonths) : 1

  const payload = {
    code: String(formData.code || '').trim(),
    name: String(formData.name || '').trim(),
    amountPaise,
    billingIntervalMonths,
    branchLimit,
    isPublished: Boolean(formData.isPublished),
  }

  return await createSuperAdminSubscriptionPlan(payload, options)
}

// 5. Super Admin: Update plan
// PUT /api/pharmacy-subscriptions/plans/{id}
export async function updateSuperAdminPlan(id, formData = {}, options = {}) {
  const priceRupees = formData.priceRupees !== undefined && formData.priceRupees !== '' ? Number(formData.priceRupees) : null
  const amountPaise = priceRupees !== null && !Number.isNaN(priceRupees) ? Math.round(priceRupees * 100) : (formData.amountPaise ?? null)
  const branchLimit = formData.branchLimit !== undefined && formData.branchLimit !== '' ? Number(formData.branchLimit) : null
  const billingIntervalMonths = formData.billingIntervalMonths !== undefined ? Number(formData.billingIntervalMonths) : 1

  const payload = {
    name: String(formData.name || '').trim(),
    amountPaise,
    billingIntervalMonths,
    branchLimit,
    isPublished: Boolean(formData.isPublished),
  }

  return await updateSuperAdminSubscriptionPlan(id, payload, options)
}

// 6. Super Admin: Delete plan
// DELETE /api/pharmacy-subscriptions/plans/{id}
export async function deleteSuperAdminPlan(id, options = {}) {
  return await deleteSuperAdminSubscriptionPlan(id, options)
}

// 7. Super Admin: Hide/Show Toggle
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

export function getSubscriptionPlans() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return []
  try {
    try {
      const oldStorage = localStorage.getItem('pms_subscription_plans')
      if (oldStorage) {
        localStorage.removeItem('pms_subscription_plans')
      }
    } catch {}

    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, index) => {
          const fallback = DEFAULT_SUBSCRIPTION_PLANS[index] || {}
          const rawFeatures = Array.isArray(item.features) ? item.features.filter(Boolean) : (fallback.features || [])
          const features = rawFeatures.map(cleanFeatureText)
          return {
            id: item.id || `plan-${Date.now()}-${index}`,
            serverId: item.serverId,
            name: item.name || fallback.name || 'Custom Plan',
            tagline: item.tagline || fallback.tagline || '',
            monthlyPrice: Number(item.monthlyPrice) >= 0 ? Number(item.monthlyPrice) : (fallback.monthlyPrice || 0),
            yearlyPrice: Number(item.yearlyPrice) >= 0 ? Number(item.yearlyPrice) : (fallback.yearlyPrice || 0),
            popular: Boolean(item.popular),
            badge: item.badge !== undefined ? item.badge : (fallback.badge || ''),
            features,
            ctaText: item.ctaText || fallback.ctaText || 'Get Started',
            ctaLink: item.ctaLink || fallback.ctaLink || '/login',
            active: item.active !== false && item.active !== 'false',
            branchLimit: item.branchLimit,
          }
        })
      }
    }
  } catch (err) {
    console.error('Failed to read subscription plans from localStorage', err)
  }
  return []
}

export function saveSubscriptionPlans(plans) {
  try {
    const sanitized = plans.map((p, i) => ({
      id: p.id || `plan-${Date.now()}-${i}`,
      serverId: p.serverId,
      name: String(p.name || '').trim() || 'Untitled Plan',
      tagline: String(p.tagline || '').trim(),
      monthlyPrice: Math.max(0, Math.round(Number(p.monthlyPrice) || 0)),
      yearlyPrice: Math.max(0, Math.round(Number(p.yearlyPrice) || 0)),
      popular: Boolean(p.popular),
      badge: String(p.badge || '').trim(),
      features: Array.isArray(p.features)
        ? p.features.map((f) => cleanFeatureText(String(f).trim())).filter(Boolean)
        : [],
      ctaText: String(p.ctaText || '').trim() || 'Get Started',
      ctaLink: String(p.ctaLink || '').trim() || '/login',
      active: p.active !== false && p.active !== 'false',
      branchLimit: p.branchLimit,
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized))
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: sanitized }))
    return { success: true, plans: sanitized }
  } catch (err) {
    console.error('Failed to save subscription plans', err)
    return { success: false, error: err.message }
  }
}

export function resetSubscriptionPlans() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('pms_subscription_plans')
    const defaults = JSON.parse(JSON.stringify(DEFAULT_SUBSCRIPTION_PLANS))
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: defaults }))
    return defaults
  } catch (err) {
    console.error('Failed to reset subscription plans', err)
    return DEFAULT_SUBSCRIPTION_PLANS
  }
}
