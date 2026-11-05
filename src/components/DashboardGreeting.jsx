import { useEffect, useState } from 'react'
import './DashboardGreeting.css'

function timeOfDayForHour(hour) {
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function greetingForTimeOfDay(timeOfDay) {
  if (timeOfDay === 'morning') return 'Good Morning'
  if (timeOfDay === 'afternoon') return 'Good Afternoon'
  return 'Good Evening'
}

function DashboardGreeting({ role, subtitle, live = false, className = '' }) {
  const [timeOfDay, setTimeOfDay] = useState(() => timeOfDayForHour(new Date().getHours()))
  const greeting = greetingForTimeOfDay(timeOfDay)

  useEffect(() => {
    const timer = window.setInterval(() => setTimeOfDay(timeOfDayForHour(new Date().getHours())), 60000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className={`dashboard-greeting ${className}`.trim()}>
      <img className="dashboard-greeting-logo" src={`/greeting-${timeOfDay}.png`} alt={`${greeting} illustration`} />
      <div className="dashboard-greeting-copy">
        <div className="dashboard-greeting-title-row">
          <h1>{greeting}, {role}!</h1>
          {live ? <span className="live-status-pill"><i className="pulse-dot-green" />Live Operations</span> : null}
        </div>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </div>
  )
}

export default DashboardGreeting
