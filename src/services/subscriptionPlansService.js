// Shared subscription plans and pricing service for Super Admin and Landing Page
import { getPublicSubscriptionPlans } from '../config/api'

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

const STORAGE_KEY = 'pms_subscription_plans_v2'
const EVENT_KEY = 'pms:subscription-plans-updated'

function cleanFeatureText(text) {
  return String(text || '')
    .replace(/\s*\+\s*Cashier/gi, '')
    .replace(/\bCashier\b/gi, '')
    .replace(/\(\s*Pharmacist\s*\)/gi, '(Pharmacist)')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function getSubscriptionPlans() {
  try {
    // Purge any legacy storage key containing outdated cashier references
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
        const result = parsed.map((item, index) => {
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
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(result))
        } catch {}
        return result
      }
    }
  } catch (err) {
    console.error('Failed to read subscription plans from localStorage', err)
  }
  return JSON.parse(JSON.stringify(DEFAULT_SUBSCRIPTION_PLANS))
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

export function calculateSavingsPercent(monthly, yearly) {
  const m = Number(monthly) || 0
  const y = Number(yearly) || 0
  if (m <= 0 || y >= m) return 0
  return Math.round(((m - y) / m) * 100)
}

export async function fetchSubscriptionPlansFromServer() {
  try {
    const serverPlans = await getPublicSubscriptionPlans()
    if (Array.isArray(serverPlans) && serverPlans.length > 0) {
      const existingPlans = getSubscriptionPlans()
      const matchedLocalIds = new Set()

      const merged = serverPlans.map((sp, idx) => {
        const planCodeOrId = sp.code || (sp.id === 1 ? 'starter' : sp.id === 2 ? 'pro' : sp.id === 3 ? 'enterprise' : String(sp.id))

        // Find existing plan to preserve Super Admin customizations (active/hidden flag, edited features, etc.)
        const existing = existingPlans.find((p) =>
          (sp.id && (p.serverId === sp.id || p.id === String(sp.id))) ||
          p.id === planCodeOrId ||
          (p.name && sp.name && p.name.trim().toLowerCase() === sp.name.trim().toLowerCase()) ||
          p.id === (idx === 0 ? 'starter' : idx === 1 ? 'pro' : idx === 2 ? 'enterprise' : undefined)
        )

        if (existing) {
          matchedLocalIds.add(existing.id)
        }

        const fallback = DEFAULT_SUBSCRIPTION_PLANS[idx] || DEFAULT_SUBSCRIPTION_PLANS[0]
        const monthly = Math.round(Number(sp.monthlyAmountPaise || 0) / 100) || fallback.monthlyPrice
        const yearlyAnnual = Math.round(Number(sp.annualAmountPaise || 0) / 100)
        const yearlyMonthly = Math.round(yearlyAnnual / 12) || fallback.yearlyPrice

        // CRITICAL: Preserve Super Admin's hidden / active setting
        const isActive = existing ? (existing.active !== false && existing.active !== 'false') : true

        return {
          id: existing?.id || planCodeOrId,
          serverId: sp.id,
          name: existing?.name || sp.name || fallback.name,
          tagline: existing?.tagline || fallback.tagline || '',
          monthlyPrice: existing?.monthlyPrice !== undefined && existing?.monthlyPrice !== null ? existing.monthlyPrice : monthly,
          yearlyPrice: existing?.yearlyPrice !== undefined && existing?.yearlyPrice !== null ? existing.yearlyPrice : yearlyMonthly,
          popular: existing?.popular !== undefined ? existing.popular : (sp.code === 'professional' || sp.id === 2 || fallback.popular),
          badge: existing?.badge !== undefined ? existing.badge : (fallback.badge || ''),
          features: Array.isArray(existing?.features) && existing.features.length > 0 ? existing.features : (fallback.features || []),
          ctaText: existing?.ctaText || fallback.ctaText || 'Get Started',
          ctaLink: existing?.ctaLink || fallback.ctaLink || '/login',
          active: isActive,
          branchLimit: sp.branchLimit,
        }
      })

      // Preserve any custom plans created by Super Admin that are not in serverPlans
      const customPlans = existingPlans.filter((p) => !matchedLocalIds.has(p.id))
      const combined = [...merged, ...customPlans]

      saveSubscriptionPlans(combined)
      return combined
    }
  } catch (err) {
    console.warn('Could not fetch plans from server, using local/cached plans:', err?.message || err)
  }
  return getSubscriptionPlans()
}
