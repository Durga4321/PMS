import AdminLayout from './AdminLayout'
import AdminTable from './AdminTable'
import { adminTables, stats } from './adminData'

function AdminDashboard() {
  return (
    <AdminLayout activeLabel="Dashboard" title="Admin Dashboard" subtitle="Admin / Dashboard">
      <section className="branch-dashboard-title">
        <h1>Admin Dashboard</h1>
        <p>Branch-wise operations management for sales, prescriptions, stock, and alerts.</p>
      </section>
      <section className="branch-summary">
        {stats.map(([label, value, note]) => <article key={label}><p>{label}</p><strong>{value}</strong><small>{note}</small></article>)}
      </section>
      <section className="branch-grid">
        <section className="branch-panel branch-chart-panel">
          <div className="branch-panel-heading"><h2>Sales Overview</h2></div>
          <div className="mini-chart"><p>No sales data available.</p></div>
        </section>
        <section className="branch-panel">
          <div className="branch-panel-heading"><h2>Top Medicines</h2></div>
          <div className="top-meds"><p>No medicine data available.</p></div>
        </section>
      </section>
      <section className="branch-grid three">
        <AdminTable {...adminTables.medicines} />
        <AdminTable {...adminTables.stock} />
        <AdminTable {...adminTables.reports} />
      </section>
    </AdminLayout>
  )
}

export default AdminDashboard
