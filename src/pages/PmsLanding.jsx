/* eslint-disable no-irregular-whitespace */
import { Link } from 'react-router-dom'
import './PmsLanding.css'
import ThemeToggle from '../components/ThemeToggle'

const modules = [
  ['▣', 'Inventory', 'Track medicines, stock movement, and availability across all branches.'],
  ['₹', 'Billing', 'Create accurate pharmacy bills with patient and branch context.'],
  ['⌑', 'Admin Control', 'Manage settings, branches, users, roles, and access permissions.'],
  ['↗', 'Dispensing', 'Handle prescription queues, validate medicines, and dispense quickly.'],
  ['▥', 'Reports & Analytics', 'Get insights into sales, stock, expiry, dispensing, and branches.'],
  ['♧', 'Expiry & Low Stock Alerts', 'Stay informed about near-expiry and low-stock medicines.'],
  ['♙', 'Role-Based Access', 'Assign role-specific permissions for controlled operations.'],
  ['▤', 'Branch Management', 'Manage branch-wise stock, billing, operations, and performance.'],
]

const roles = [
  ['♕', 'Super Admin', 'Platform oversight, branches, roles, settings, and reports.'],
  ['⚙', 'Admin', 'Day-to-day operations, users, and configuration.'],
  ['♙', 'Pharmacist', 'Prescription review, medicine validation, and dispensing.'],
  ['₹', 'Billing Staff', 'Billing, payments, and transaction records.'],
  ['▣', 'Inventory Staff', 'Stock entry, movement, expiry, and replenishment.'],
  ['▤', 'Branch Manager', 'Branch operations, staff, inventory, and reports.'],
]

function Logo({ light = false }) {
  return <Link className={`pms-logo${light ? ' pms-logo--light' : ''}`} to="/">
    <span className="pms-logo-mark">+</span><span><strong>PMS</strong><small>Pharmacy Management System</small></span>
  </Link>
}

function DashboardMockup({ compact = false }) {
  return <div className={`pms-dashboard-mockup${compact ? ' pms-dashboard-mockup--compact' : ''}`} aria-label="Illustrative PMS dashboard preview">
    <div className="pms-dashboard-sidebar"><b><span>+</span> PMS</b><i className="active">▦ Dashboard</i><i>▣ Inventory</i><i>↗ Dispensing</i><i>₹ Billing</i><i>▤ Reports</i><i>⌘ Branches</i><i>⚙ Settings</i></div>
    <div className="pms-dashboard-body"><div className="pms-dashboard-head"><strong>{compact ? 'Inventory Overview' : 'Good Afternoon, Pharmacist 👋'}</strong><small>All branches⌄</small></div><div className="pms-metric-row"><span><small>Total Stock</small><b>12,840</b></span><span><small>Prescriptions</small><b>1,268</b></span><span><small>Today's Billing</small><b>₹46,600</b></span></div><div className="pms-chart-row"><div className="pms-chart"><b>Dispensing Trend</b><div className="pms-chart-line" /></div><div className="pms-stock"><b>Low Stock Items</b><i>● Amoxicillin <em>(12)</em></i><i>● Paracetamol <em>(18)</em></i><i>● Omeprazole <em>(24)</em></i></div></div></div>
  </div>
}

function PmsLanding() {
  return <main className="pms-landing">
    <section className="pms-hero" id="home">
      <div className="pms-hero-glow" />
      <header className="pms-nav"><Logo /><nav><a href="#home">Home</a><a href="#features">Features</a><a href="#modules">Modules⌄</a><a href="#roles">Roles</a><a href="#reports">Reports</a><a href="#contact">Contact</a></nav><div className="pms-nav-actions"><ThemeToggle /><a className="pms-demo-link" href="#contact">Request Demo</a><Link className="pms-login-link" to="/login">♙ Staff Login</Link></div></header>
      <div className="pms-hero-content"><div className="pms-hero-copy"><span className="pms-eyebrow">⌁ Connected pharmacy operations</span><h1>Smarter Pharmacy Management for <em>Hospitals, Branches, and Billing</em></h1><p>Manage inventory, dispensing, prescriptions, billing, branches, reports, and role-based access from one platform.</p><div className="pms-actions"><Link className="pms-primary" to="/login">Get Started →</Link></div><div className="pms-trust"><span>✦ Secure</span><span>⌁ Scalable</span><span>▱ Multi-Branch</span><span>♙ Role-Based Access</span></div></div><div className="pms-hero-visual"><div className="pms-capsule pms-capsule--one" /><div className="pms-capsule pms-capsule--two" /><div className="pms-shield">+</div><DashboardMockup /><div className="pms-phone"><b>✚ PMS</b><strong>Today’s Queue</strong><span>▤ Prescriptions</span><span>↗ Dispense</span><span>▣ Inventory</span><span>₹ Billing</span></div><div className="pms-bottle"><b>+</b><small>MEDICINE</small></div><div className="pms-blister"><i /><i /><i /><i /><i /><i /></div></div></div>
      <div className="pms-stats"><span><b>▣</b><strong>8+</strong><small>Branches Managed</small></span><span><b>▧</b><strong>1,20,000+</strong><small>Prescriptions Processed</small></span><span><b>⚠</b><strong>320+</strong><small>Low-Stock Alerts</small></span><span><b>◎</b><strong>99.8%</strong><small>Billing Accuracy</small></span></div>
    </section>

    <section className="pms-section pms-features" id="features"><div className="pms-section-heading"><span className="pms-eyebrow">Everything in its place</span><h2>Built for daily pharmacy work</h2></div><div className="pms-module-grid" id="modules">{modules.map(([icon, title, text]) => <article className="pms-module-card" key={title}><span className="pms-card-icon">{icon}</span><div><h3>{title}</h3><p>{text}</p></div><b className="pms-card-arrow">→</b></article>)}</div></section>

    <section className="pms-section pms-workflow"><div className="pms-section-heading pms-centered"><h2>How PMS Works</h2><p>A simple, connected workflow for complete pharmacy operations.</p></div><div className="pms-steps">{[['01','Track Stock','Maintain real-time inventory with stock movement and alerts.'],['02','Dispense Safely','Process prescriptions, validate medicines, and dispense right.'],['03','Bill Instantly','Generate accurate bills with patient and branch details.'],['04','Monitor Branches','View performance, stock, and operations in one place.']].map(([number,title,text]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div><b>→</b></article>)}</div></section>

    <section className="pms-roles" id="roles"><div className="pms-section pms-roles-inner"><div className="pms-role-intro"><span className="pms-eyebrow">People at the core</span><h2>Roles &<br /><em>Responsibilities</em></h2><p>A clear and flexible role structure to run your pharmacy operations smoothly and securely.</p></div><div className="pms-role-grid">{roles.map(([icon,title,text]) => <article key={title}><span>{icon}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

    <section className="pms-section pms-showcase" id="reports"><div className="pms-showcase-copy"><span className="pms-eyebrow">A closer look</span><h2>PMS in Action</h2><p>A powerful, all-in-one solution to manage your pharmacy end-to-end, from stock to dispensing, billing, and multi-branch operations.</p><ul><li>Live inventory & stock movement</li><li>Fast & accurate billing</li><li>Dispensing queue & prescription history</li><li>Branch-wise insights & reports</li></ul></div><div className="pms-showcase-visual"><DashboardMockup compact /><div className="pms-showcase-bottle pms-bottle"><b>+</b><small>MEDICINE</small></div></div><div className="pms-insights"><article><b>₹</b><span>Billing Summary<strong>₹46,600　<em>+12.4%</em></strong></span></article><article><b>▱</b><span>Branch Insights<strong>8 Branches　<em>+18.9%</em></strong></span></article><article><b>⌁</b><span>Dispensing Queue<strong>16 Pending　<em>Live</em></strong></span></article></div></section>

    <section className="pms-section pms-testimonials"><div className="pms-section-heading"><span className="pms-eyebrow">Trusted by healthcare teams</span><h2>What Our Users Say</h2><p>Example feedback from teams using a connected pharmacy workflow.</p></div><div className="pms-testimonial-grid">{[['DR','Dr. Ramesh Roy','City Care Hospital','“Fewer stock errors and smoother dispensing. PMS has made our pharmacy operations much more organized.”'],['MS','Dr. Meera Dev','Sunrise Multi-Speciality','“Billing is faster, prescription handling is seamless, and we get real-time reports across branches.”'],['AK','Dr. Arun Kumar','HealthFirst Hospital','“A complete and reliable system for our hospital pharmacy. The role-based access and branch control work really well.”']].map(([avatar,name,org,quote]) => <article key={name}><span className="pms-avatar">{avatar}</span><div><b>★★★★★</b><p>{quote}</p><strong>{name}</strong><small>{org}</small></div></article>)}</div></section>

    <section className="pms-cta" id="contact"><div><span className="pms-eyebrow">Ready to get started?</span><h2>Ready to modernize your<br />pharmacy operations?</h2><p>Streamline inventory, dispensing, billing, and multi-branch management with PMS.</p></div><div className="pms-cta-actions"><Link className="pms-primary" to="/login">Start with PMS →</Link><a className="pms-secondary" href="mailto:sales@example.com">☎ Contact Sales</a></div><div className="pms-cta-medicines"><div className="pms-bottle"><b>+</b></div><div className="pms-blister"><i /><i /><i /><i /><i /><i /></div></div></section>

    <footer className="pms-footer"><div><Logo light /><p>A complete, secure, and easy-to-use platform<br />to manage pharmacy inventory, dispensing,<br />billing, and more.</p><small>© 2026 PMS — Pharmacy Management System. All rights reserved.</small></div><div className="pms-footer-links"><div><b>Product</b><a href="#features">Overview</a><a href="#features">Features</a><a href="#contact">Pricing</a><a href="#contact">Request Demo</a></div><div><b>Modules</b><a href="#modules">Inventory</a><a href="#modules">Dispensing</a><a href="#modules">Billing</a><a href="#reports">Reports & Analytics</a></div><div><b>Company</b><a href="#home">About Us</a><a href="#contact">Contact</a><a href="#contact">Careers</a><a href="#contact">Privacy Policy</a></div><div><b>Support</b><a href="#contact">Help Center</a><a href="#contact">Documentation</a><a href="#contact">FAQs</a><a href="#contact">Release Notes</a></div></div></footer>
  </main>
}

export default PmsLanding
