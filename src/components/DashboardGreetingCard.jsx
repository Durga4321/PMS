import DashboardGreeting from './DashboardGreeting'
import './DashboardGreetingCard.css'

export default function DashboardGreetingCard({ role, subtitle }) {
  return (<section className="dashboard-hero-card dashboard-greeting-card">
          <div className="dashboard-hero-left">
            <DashboardGreeting role={role} subtitle={subtitle} />
          </div>
          <div className="dashboard-hero-illustration">
            <div className="hero-clinic-illustration">
              <svg viewBox="0 0 160 80" width="160" height="80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="40" y="25" width="80" height="50" rx="8" fill="#60A5FA" opacity="0.2"/>
                <path d="M35 30 L80 10 L125 30 Z" fill="#3B82F6" opacity="0.35"/>
                <rect x="70" y="30" width="20" height="45" fill="#3B82F6" opacity="0.5"/>
                <rect x="76" y="38" width="8" height="8" rx="1" fill="#FFFFFF"/>
                <rect x="76" y="50" width="8" height="8" rx="1" fill="#FFFFFF"/>
                <path d="M80 34 V42 M76 38 H84" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="25" cy="55" r="12" fill="#10B981" opacity="0.35"/>
                <rect x="23" y="60" width="4" height="15" fill="#059669" opacity="0.45"/>
                <circle cx="135" cy="55" r="12" fill="#10B981" opacity="0.35"/>
                <rect x="133" y="60" width="4" height="15" fill="#059669" opacity="0.45"/>
              </svg>
              <span className="hero-script-tag">
                <span>Better</span>
                <span>Healthcare</span>
                <span>Together</span>
              </span>
            </div>
          </div>
        </section>)
}
