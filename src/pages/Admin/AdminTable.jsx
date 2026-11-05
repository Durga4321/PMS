function formatDisplayValue(val) {
  if (val === null || val === undefined || val === '') return '-'
  if (typeof val === 'object') {
    if (val instanceof Date) return val.toLocaleDateString()
    return val.name || val.categoryName || val.title || val.medicineName || val.userName || val.status || val.label || '-'
  }
  return String(val)
}

function Status({ value }) {
  const displayVal = formatDisplayValue(value)
  const str = displayVal.toLowerCase()
  let statusClass = 'status-default'
  if (str.includes('active') || str.includes('in stock') || str.includes('ready')) statusClass = 'status-success'
  else if (str.includes('low') || str.includes('pending') || str.includes('processing')) statusClass = 'status-warning'
  else if (str.includes('out') || str.includes('expired') || str.includes('failed')) statusClass = 'status-danger'
  else if (str.includes('near')) statusClass = 'status-amber'

  return <span className={`table-status-badge ${statusClass}`}>{displayVal}</span>
}

function AdminTable({ title, action, headers, rows, onActionClick }) {
  return (
    <section className="branch-panel">
      <div className="branch-panel-heading">
        <h2>{title}</h2>
        {action ? (
          <button type="button" className="btn-table-action" onClick={onActionClick}>
            {action}
          </button>
        ) : null}
      </div>
      <div className="branch-table-wrap">
        <table className="branch-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>
                      {cIdx === row.length - 1 ? <Status value={cell} /> : formatDisplayValue(cell)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length}>
                  <div className="table-empty-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="empty-box-icon">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                    <span>No data available in {title.toLowerCase()}</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AdminTable
