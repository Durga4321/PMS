import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import UserProfileMenu from '../../components/UserProfileMenu'
import ThemeToggle from '../../components/ThemeToggle'
import { superAdminNavigation } from '../../components/superAdminNavigation'
import NotificationBell from '../../components/NotificationBell'
import './SuperAdminTopbar.css'

function Icon({ children }) {
  return <svg className="super-admin-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>
}

function SuperAdminTopbar({ onMenu, placeholder = 'Search dashboard, pharmacies, admins, reports...' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const headerRef = useRef(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('pms_super_admin_sidebar_collapsed') === 'true' } catch { return false }
  })

  useEffect(() => {
    const shell = headerRef.current?.closest('.super-admin-shell, .admins-page-shell, .profile-super-admin-shell')
    shell?.classList.toggle('sidebar-collapsed', sidebarCollapsed)
    try { localStorage.setItem('pms_super_admin_sidebar_collapsed', String(sidebarCollapsed)) } catch {}
  }, [sidebarCollapsed, location.pathname])

  function toggleSidebar() {
    if (window.matchMedia('(max-width: 640px)').matches) {
      onMenu?.()
      return
    }
    setSidebarCollapsed((value) => !value)
  }
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)

  const results = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return superAdminNavigation
    return superAdminNavigation.filter((item) => item.label.toLowerCase().includes(value))
  }, [query])

  function goTo(path) {
    setQuery('')
    setShowResults(false)
    navigate(path)
  }

  function submitSearch(event) {
    event.preventDefault()
    if (results[0]) goTo(results[0].path)
  }

  return (
    <header className="super-admin-topbar" ref={headerRef}>
      <button className="super-admin-topbar-menu" type="button" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!sidebarCollapsed}>
        <Icon><path d="M4 6h16M4 12h16M4 18h16" /></Icon>
      </button>


      <form
        className="super-admin-topbar-search"
        onSubmit={submitSearch}
        onBlur={() => window.setTimeout(() => setShowResults(false), 120)}
      >
        <Icon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setShowResults(true)
          }}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
        />
        {showResults ? (
          <div className="super-admin-topbar-results">
            {results.length ? results.slice(0, 7).map((item) => (
              <button
                type="button"
                key={item.path}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => goTo(item.path)}
              >
                {item.label}
              </button>
            )) : <span>No matching module</span>}
          </div>
        ) : null}
      </form>

      <div className="super-admin-topbar-right">
        <ThemeToggle />
        <NotificationBell role="superAdmin" path="/super-admin/notifications" className="super-admin-topbar-notification" iconClassName="super-admin-icon" />
        <UserProfileMenu roleType="super-admin" />
      </div>
    </header>
  )
}

export default SuperAdminTopbar

