import { Link } from 'react-router-dom'
import './PmsLanding.css'

const modules = [
  ['Inventory', 'Track medicines, stock movement, low-stock alerts, and expiry checks.'],
  ['Billing', 'Create clean pharmacy bills with patient and branch context.'],
  ['Admin Control', 'Manage hospitals, branches, roles, users, reports, and audit access.'],
  ['Dispensing', 'Handle prescription queues and pharmacist workflows with less noise.'],
]

function PmsLanding() {
  return (
    <main className="pms-landing">
      <section className="pms-landing-hero">
        <div className="pms-landing-overlay" />
        <header className="pms-landing-nav">
          <Link className="pms-landing-brand" to="/">
            <span>PMS</span>
            <div>
              <strong>PMS</strong>
              <small>Pharmacy Management System</small>
            </div>
          </Link>
          <nav>
            <Link to="/login">Staff Login</Link>
          </nav>
        </header>

        <div className="pms-landing-content">
          <span className="pms-landing-pill">Connected pharmacy operations</span>
          <h1>PMS</h1>
          <p>
            Run hospitals, branches, pharmacy stock, dispensing, billing, reports,
            and role-based access from one calm workspace.
          </p>
          <div className="pms-landing-actions">
            <Link className="pms-landing-primary" to="/login">Login</Link>
          </div>
        </div>
      </section>

      <section className="pms-landing-modules" aria-label="PMS modules">
        <div>
          <span>Everything in its place</span>
          <h2>Built for daily pharmacy work</h2>
        </div>
        <div className="pms-landing-grid">
          {modules.map(([title, text]) => (
            <article key={title}>
              <i aria-hidden="true">+</i>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default PmsLanding
