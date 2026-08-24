import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UserProfileMenu from '../../components/UserProfileMenu'
import PharmacistSidebar from './PharmacistSidebar'
import { pharmacistNavigation } from './pharmacistNavigation'
import './PharmacistTopbar.css'
import './pharmacist.css'

function Icon({ children }) { return <svg className="pharmacist-topbar-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg> }

function PharmacistLayout({ activeLabel, title, subtitle, children }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const results = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return pharmacistNavigation
    return pharmacistNavigation.filter((item) => item.label.toLowerCase().includes(value))
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
    <div className={`pharmacist-page${open ? ' sidebar-open' : ''}`}>
      <PharmacistSidebar activeLabel={activeLabel} />
      <main className="pharmacist-main">
        <header className="pharmacist-header">
          <button className="pharmacist-topbar-menu" type="button" onClick={() => setOpen(!open)} aria-label="Open sidebar">
            <Icon><path d="M4 6h16M4 12h16M4 18h16" /></Icon>
          </button>
          <form className="pharmacist-search" onSubmit={submitSearch} onBlur={() => window.setTimeout(() => setShowResults(false), 120)}>
            <Icon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setShowResults(true)
              }}
              onFocus={() => setShowResults(true)}
              placeholder="Search dashboard, pending, dispensing, reports..."
            />
            {showResults ? (
              <div className="pharmacist-search-results">
                {results.length ? results.slice(0, 7).map((item) => (
                  <button type="button" key={item.path} onMouseDown={(event) => event.preventDefault()} onClick={() => goTo(item.path)}>
                    {item.label}
                  </button>
                )) : <span>No matching module</span>}
              </div>
            ) : null}
          </form>
          <button className="pharmacist-bell" type="button" aria-label="Notifications">
            <Icon><path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9" /><path d="M10 21h4" /></Icon>
            <b>3</b>
          </button>
          <UserProfileMenu roleType="pharmacist" />
        </header>
        <div className="pharmacist-content is-dashboard">
          {children}
        </div>
      </main>
    </div>
  )
}

export default PharmacistLayout
