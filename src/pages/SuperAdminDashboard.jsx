import { Link } from 'react-router-dom'

const navItems = [
  { label: 'Dashboard', icon: 'dashboard', active: true },
  { label: 'Pharmacies', icon: 'pharmacy' },
  { label: 'Users', icon: 'users' },
  { label: 'Subscriptions', icon: 'payments' },
  { label: 'Reports', icon: 'reports' },
  { label: 'Settings', icon: 'settings' },
]

const stats = [
  { label: 'Total Pharmacies', value: '128', trend: '+12 this month' },
  { label: 'Active Users', value: '2,846', trend: '+8.4% growth' },
  { label: 'Pending Approvals', value: '17', trend: 'Needs review' },
  { label: 'Monthly Revenue', value: '$42.8k', trend: '+15.2% vs last month' },
]

const pharmacies = [
  { name: 'MediCare Plus', owner: 'Rohit Sharma', plan: 'Enterprise', status: 'Active' },
  { name: 'HealthHub Pharmacy', owner: 'Priya Patel', plan: 'Pro', status: 'Review' },
  { name: 'City Life Drugs', owner: 'Amit Verma', plan: 'Starter', status: 'Active' },
  { name: 'Wellness Corner', owner: 'Neha Singh', plan: 'Pro', status: 'Pending' },
]

function Icon({ name }) {
  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    pharmacy: (
      <>
        <path d="M4 10h16" />
        <path d="M5 10l1.2-5h11.6L19 10v10H5V10Z" />
        <path d="M12 13v5" />
        <path d="M9.5 15.5h5" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <path d="M16 11a2.6 2.6 0 1 0 0-5" />
        <path d="M17 15.5a4.5 4.5 0 0 1 3.5 4.5" />
      </>
    ),
    payments: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 15h4" />
      </>
    ),
    reports: (
      <>
        <path d="M5 19V5" />
        <path d="M5 19h14" />
        <rect x="8" y="11" width="2.8" height="5" rx="0.8" />
        <rect x="12" y="8" width="2.8" height="8" rx="0.8" />
        <rect x="16" y="6" width="2.8" height="10" rx="0.8" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3" />
        <path d="M12 18v3" />
        <path d="M4.2 7.5l2.6 1.5" />
        <path d="M17.2 15l2.6 1.5" />
        <path d="M19.8 7.5 17.2 9" />
        <path d="M6.8 15l-2.6 1.5" />
      </>
    ),
    support: (
      <>
        <path d="M4 12a8 8 0 0 1 16 0" />
        <path d="M4 12v4a2 2 0 0 0 2 2h1v-6H4Z" />
        <path d="M20 12v4a2 2 0 0 1-2 2h-1v-6h3Z" />
        <path d="M9 20h3" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="m16 16 4 4" />
      </>
    ),
    bell: (
      <>
        <path d="M6 9a6 6 0 1 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9" />
        <path d="M10 21h4" />
      </>
    ),
    add: (
      <>
        <path d="M4 10h16" />
        <path d="M6 10l1-5h10l1 5v10H6V10Z" />
        <path d="M12 13v5" />
        <path d="M9.5 15.5h5" />
      </>
    ),
    logout: (
      <>
        <path d="M10 6H5v12h5" />
        <path d="M14 8l4 4-4 4" />
        <path d="M8 12h10" />
      </>
    ),
    approve: (
      <>
        <path d="M12 3 5 6v5c0 4.4 2.8 7.7 7 10 4.2-2.3 7-5.6 7-10V6l-7-3Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </>
    ),
  }

  return (
    <svg className="admin-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function SuperAdminDashboard() {
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
          {navItems.map((item) => (
            <a className={`admin-nav-link${item.active ? ' is-active' : ''}`} href="#" key={item.label}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <Icon name="support" />
          <div>
            <strong>Support Desk</strong>
            <small>24/7 system assistance</small>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">Super Admin Dashboard</p>
            <h1>Control center</h1>
          </div>
          <div className="admin-topbar-actions">
            <button className="icon-button" aria-label="Search">
              <Icon name="search" />
            </button>
            <button className="icon-button" aria-label="Notifications">
              <Icon name="bell" />
            </button>
            <div className="admin-profile">
              <span>SA</span>
              <div>
                <strong>Super Admin</strong>
                <small>admin@pms.com</small>
              </div>
            </div>
          </div>
        </header>

        <section className="admin-hero">
          <div>
            <p>Today overview</p>
            <h2>Manage pharmacies, users, subscriptions, and reports from one workspace.</h2>
          </div>
          <button className="admin-primary-action">
            <Icon name="add" />
            Add Pharmacy
          </button>
        </section>

        <section className="admin-stats" aria-label="Dashboard statistics">
          {stats.map((stat) => (
            <article className="admin-stat-card" key={stat.label}>
              <p>{stat.label}</p>
              <strong>{stat.value}</strong>
              <span>{stat.trend}</span>
            </article>
          ))}
        </section>

        <section className="admin-content-grid">
          <div className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <p className="admin-eyebrow">Pharmacies</p>
                <h2>Recent registrations</h2>
              </div>
              <button className="admin-text-button">View all</button>
            </div>
            <div className="admin-table">
              {pharmacies.map((pharmacy) => (
                <div className="admin-table-row" key={pharmacy.name}>
                  <div>
                    <strong>{pharmacy.name}</strong>
                    <span>{pharmacy.owner}</span>
                  </div>
                  <span>{pharmacy.plan}</span>
                  <mark className={`status status-${pharmacy.status.toLowerCase()}`}>
                    {pharmacy.status}
                  </mark>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-panel admin-actions-panel">
            <p className="admin-eyebrow">Quick Actions</p>
            <h2>Navigation</h2>
            <Link to="/login" className="admin-action-link">
              <Icon name="logout" />
              Back to Login
            </Link>
            <a href="#" className="admin-action-link">
              <Icon name="approve" />
              Approve Accounts
            </a>
            <a href="#" className="admin-action-link">
              <Icon name="reports" />
              Open Reports
            </a>
          </div>
        </section>
      </main>
    </div>
  )
}

export default SuperAdminDashboard
