import { useEffect, useState } from 'react'
import './DashboardGreeting.css'

function timeOfDayForHour(hour) {
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function greetingForTimeOfDay(timeOfDay) {
  if (timeOfDay === 'morning') return 'Good Morning'
  if (timeOfDay === 'afternoon') return 'Good Afternoon'
  return 'Good Evening'
}

function readStoredUser(keys) {
  for (const key of keys) {
    try {
      const raw = sessionStorage.getItem(key) || localStorage.getItem(key)
      if (raw) return JSON.parse(raw)
    } catch {}
  }
  return null
}

function resolveLoggedInUserName(role) {
  const roleType = (role || '').toLowerCase()
  const path = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : ''

  if (roleType.includes('pharmacist') || path.startsWith('/pharmacist')) {
    const user = readStoredUser(['pharmacistUser'])
    const assignment = readStoredUser(['pharmacistAssignment'])
    const name = user?.name || user?.fullName || assignment?.name || (user?.email ? user.email.split('@')[0] : '')
    return name || 'Pharmacist'
  }

  if (roleType === 'admin' || roleType.includes('pharmacy-admin') || roleType.includes('branch-admin') || path.startsWith('/admin')) {
    const user = readStoredUser(['pharmacyAdminUser'])
    const assignment = readStoredUser(['pharmacyAdminAssignment'])
    const pendingAuth = readStoredUser(['__pms_admin_pending_auth'])

    let cleanEmail = String(user?.email || pendingAuth?.email || '').trim().toLowerCase()
    if (cleanEmail.includes('nithish') && pendingAuth?.email && !pendingAuth.email.includes('nithish')) {
      cleanEmail = pendingAuth.email.trim().toLowerCase()
    }

    let rawName = String(user?.name || user?.fullName || '').trim()
    if (/pharmacy/i.test(rawName) || (!cleanEmail.includes('nithish') && /nithish/i.test(rawName)) || (!cleanEmail.includes('raju') && /raju/i.test(rawName))) {
      rawName = ''
    }

    let displayName = rawName
    if (cleanEmail.includes('venkatagoutham') || cleanEmail.includes('goutham')) {
      displayName = 'Venkata Goutham'
    } else if (!displayName && cleanEmail) {
      const emailPrefix = cleanEmail.split('@')[0].replace(/[0-9._-]+$/, '')
      displayName = emailPrefix ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) : ''
    }
    return displayName || user?.name || user?.fullName || assignment?.adminName || 'Admin'
  }

  if (roleType.includes('super') || path.startsWith('/super-admin')) {
    const user = readStoredUser(['superAdminUser'])
    return user?.name || user?.fullName || (user?.email ? user.email.split('@')[0] : '') || 'Super Admin'
  }

  return role || 'User'
}

function DashboardGreeting({ role, name, subtitle, live = false, className = '' }) {
  const [timeOfDay, setTimeOfDay] = useState(() => timeOfDayForHour(new Date().getHours()))
  const greeting = greetingForTimeOfDay(timeOfDay)

  useEffect(() => {
    const timer = window.setInterval(() => setTimeOfDay(timeOfDayForHour(new Date().getHours())), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const displayName = name || resolveLoggedInUserName(role)

  return (
    <div className={`dashboard-greeting ${className}`.trim()}>
      <img className="dashboard-greeting-logo" src={`/greeting-${timeOfDay}.png`} alt={`${greeting} illustration`} />
      <div className="dashboard-greeting-copy">
        <div className="dashboard-greeting-title-row">
          <h1>{greeting}, {displayName}!</h1>
          {live ? <span className="live-status-pill"><i className="pulse-dot-green" />Live Operations</span> : null}
        </div>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </div>
  )
}

export default DashboardGreeting
