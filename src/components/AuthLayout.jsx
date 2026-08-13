import './AuthLayout.css'

function LogoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 3.5 7.25v6.5L12 21l8.5-7.25v-6.5L12 3Z" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  )
}

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-container">
      <div className="auth-bg" aria-hidden="true" />
      <div className="auth-veil" aria-hidden="true" />

      <div className="auth-card auth-card--login-compact">
        <div className="auth-logo">
          <LogoIcon />
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
