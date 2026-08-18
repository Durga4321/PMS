import AdminLayout from './AdminLayout'
import AdminTable from './AdminTable'
import { adminTables, stats } from './adminData'

function AdminDashboard() {
  return (
    <AdminLayout activeLabel="Dashboard" title="Admin Dashboard (Branch A)" subtitle="Admin / Dashboard">
      <section className="branch-dashboard-title">
        <h1>Admin Dashboard (Branch A)</h1>
        <p>Branch-wise operations management for sales, prescriptions, stock, and alerts.</p>
      </section>
      <section className="branch-summary">
        {stats.map(([label, value, note]) => <article key={label}><p>{label}</p><strong>{value}</strong><small>{note}</small></article>)}
      </section>
      <section className="branch-grid">
        <section className="branch-panel branch-chart-panel">
          <div className="branch-panel-heading"><h2>Sales Overview</h2></div>
          <div className="mini-chart"><svg viewBox="0 0 520 170" preserveAspectRatio="none"><path d="M10 120 L70 92 L130 118 L190 72 L250 86 L310 55 L370 76 L430 135 L500 40" fill="none" stroke="#2563eb" strokeWidth="4" /><path d="M10 120 L70 92 L130 118 L190 72 L250 86 L310 55 L370 76 L430 135 L500 40 L500 165 L10 165Z" fill="#dbeafe" /></svg><div><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div>
        </section>
        <section className="branch-panel">
          <div className="branch-panel-heading"><h2>Top Medicines</h2></div>
          <div className="top-meds"><p><b>Paracetamol 500mg</b><span>120</span></p><p><b>Amoxicillin 250mg</b><span>85</span></p><p><b>Cetirizine 10mg</b><span>70</span></p></div>
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
