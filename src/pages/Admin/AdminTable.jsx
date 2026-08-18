function Status({ value }) {
  return <span className={`branch-status ${String(value).toLowerCase().replaceAll(' ', '-')}`}>{value}</span>
}

function AdminTable({ title, action, headers, rows }) {
  return (
    <section className="branch-panel">
      <div className="branch-panel-heading">
        <h2>{title}</h2>
        {action ? <button type="button">{action}</button> : null}
      </div>
      <div className="branch-table-wrap">
        <table className="branch-table">
          <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={row.join('-')}>
                {row.map((cell, index) => <td key={`${cell}-${index}`}>{index === row.length - 1 ? <Status value={cell} /> : cell}</td>)}
              </tr>
            )) : <tr><td colSpan={headers.length}>No data available.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AdminTable
