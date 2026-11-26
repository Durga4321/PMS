import { isValidElement, useEffect, useMemo, useState } from 'react'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import './SuperAdminModulePage.css'

function searchableText(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(searchableText).join(' ')
  if (isValidElement(value)) return searchableText(value.props.children)
  return ''
}

function SuperAdminModulePage({ title, headers = [], rows = [], loading = false, error = '', action = null, children = null }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 5
  const tableHeaders = headers.length ? headers : ['Name', 'Details', 'Status']

  useEffect(() => {
    setPage(1)
  }, [query])

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return rows
    return rows.filter((row) => row.map(searchableText).join(' ').toLowerCase().includes(normalizedQuery))
  }, [query, rows])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className={`super-admin-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
      <SuperAdminSidebar activeLabel={title} />

      <main className="super-admin-main">
        <SuperAdminTopbar onMenu={() => setSidebarOpen((value) => !value)} />

        <div className="super-admin-content">
          <section className="super-admin-module-heading">
            <p className="super-admin-eyebrow">Super Admin</p>
            <h1>{title}</h1>
          </section>

          <section className="super-admin-panel super-admin-module-panel">
            <div className="super-admin-module-header">
              <div className="super-admin-module-title-wrap">
                <h2>{title}</h2>
                <p>{loading ? 'Loading data...' : error || ''}</p>
              </div>
              <div className="super-admin-module-controls">
                <div className="super-admin-module-filter">
                  <svg className="super-admin-filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={`Search ${title.toLowerCase()}...`}
                    aria-label={`Search ${title.toLowerCase()}`}
                  />
                  {query ? (
                    <button type="button" className="super-admin-filter-clear" onClick={() => setQuery('')} aria-label="Clear search">
                      &times;
                    </button>
                  ) : null}
                </div>
                {action}
              </div>
            </div>

            <div className="super-admin-module-table">
              <table>
                <thead>
                  <tr>{tableHeaders.map((header) => <th key={header}>{header}</th>)}</tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={tableHeaders.length}>Loading data...</td></tr>
                  ) : visibleRows.length ? (
                    visibleRows.map((row, rowIndex) => (
                      <tr key={`${title}-${(currentPage - 1) * pageSize + rowIndex}`}>
                        {tableHeaders.map((header, cellIndex) => <td key={header}>{row[cellIndex] ?? '-'}</td>)}
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={tableHeaders.length}>No data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredRows.length > pageSize ? (
              <div className="super-admin-module-pagination">
                <div className="super-admin-module-pagination-info">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length} entries
                </div>
                <div className="super-admin-module-pagination-actions">
                  <button type="button" disabled={currentPage === 1} onClick={() => setPage(1)}>First</button>
                  <button type="button" disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={p === currentPage ? 'is-current' : ''}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                  <button type="button" disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
                  <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(totalPages)}>Last</button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>
      {children}
    </div>
  )
}

export default SuperAdminModulePage
