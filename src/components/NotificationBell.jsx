import { useNavigate } from 'react-router-dom'
import { useNotificationCount } from '../services/notificationManager'
import './NotificationBell.css'

export default function NotificationBell({ role, path, className = 'branch-admin-notification', iconClassName = 'branch-admin-icon' }) {
  const navigate = useNavigate()
  const count = useNotificationCount(role)

  return (
    <button
      className={`${className} notification-bell`}
      type="button"
      aria-label="Notifications"
      title="Notifications"
      onClick={() => navigate(path)}
    >
      <svg className={iconClassName} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9M10 21h4" />
      </svg>
      {count > 0 ? <b className="notification-bell-count">{count > 99 ? '99+' : count}</b> : null}
    </button>
  )
}
