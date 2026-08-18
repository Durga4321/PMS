import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { superAdminNavigation } from '../../components/superAdminNavigation'

function ManagementPage({ title, rows }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return rows
    return rows.filter((row) => row.join(' ').toLowerCase().includes(normalizedQuery))
  }, [query, rows])

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Super admin navigation">
        <div className="admin-brand">
          <span className="admin-brand-mark">P</span>
          <div>
            <strong>Pharmacy PMS</strong>
            <small>Super Admin</small>
          </div>
        </div>

        <nav className="admin-nav">
          {superAdminNavigation.map(({ label, path, icon }) => (
            <button
              type="button"
              className={`admin-nav-link${label === title ? ' is-active' : ''}`}
              onClick={() => navigate(path)}
              key={label}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">Super Admin</p>
            <h1>{title}</h1>
          </div>
          <div className="admin-topbar-actions">
            <input
              className="admin-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${title.toLowerCase()}`}
            />
          </div>
        </header>

        <section className="admin-panel">
          <div className="admin-table">
            {filteredRows.map((row) => (
              <div className="admin-table-row" key={row.join('-')}>
                <div>
                  <strong>{row[0]}</strong>
                  <span>{row[1]}</span>
                </div>
                <span>{row[2]}</span>
                <mark className={`status status-${String(row[3]).toLowerCase()}`}>{row[3]}</mark>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default ManagementPage
