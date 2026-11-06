import './AuthLayout.css'
import ThemeToggle from './ThemeToggle'

function MedicalCross({ className = '' }) {
  return (
    <span className={`medical-cross ${className}`} aria-hidden="true">
      <span />
      <span />
    </span>
  )
}

function AuthLayout({ title, subtitle, children, footer, hideThemePicker = false }) {
  const isLogin = title === 'PMS Login'

  return (
    <div className={`auth-container${isLogin ? ' auth-container--login' : ''}`}>
      <div className="auth-bg" aria-hidden="true" />
      <div className="auth-veil" aria-hidden="true" />

      {isLogin ? (
        <section className="auth-intro" aria-label="Pharmacy Management System introduction">
          <div className="auth-brand">
            <div className="auth-brand-mark"><MedicalCross /></div>
            <div>
              <strong>PMS</strong>
              <span>Pharmacy Management System</span>
            </div>
          </div>
          <p className="auth-kicker">Connected pharmacy operations</p>
          <h1>Manage Your<br />Pharmacy Operations<br /><em>Seamlessly</em></h1>
          <p className="auth-intro-copy">Inventory, dispensing, billing, prescriptions,<br />branches, and reports — all in one secure platform.</p>
          <div className="auth-benefits">
            {['Real-Time Inventory', 'Fast & Accurate Billing', 'Secure & Role-Based Access', 'Multi-Branch Management'].map((benefit) => (
              <span key={benefit}><b>✓</b>{benefit}</span>
            ))}
          </div>
          <div className="auth-product-scene" aria-hidden="true">
            <div className="auth-bottle"><i>+</i><span>MEDICINE</span></div>
            <div className="auth-blister"><i /><i /><i /><i /><i /><i /></div>
            <div className="auth-shield"><MedicalCross /></div>
            <div className="auth-capsule auth-capsule--one" />
            <div className="auth-capsule auth-capsule--two" />
          </div>
        </section>
      ) : null}

      <div className="auth-card auth-card--login-compact">
        <div className="auth-theme-control" hidden={hideThemePicker}><ThemeToggle /></div>
        <div className="auth-logo">
          <MedicalCross />
        </div>
        <h2>{title}</h2>
        <p className="subtitle">{subtitle}</p>

        {children}
        {footer}
      </div>
    </div>
  )
}

export default AuthLayout
