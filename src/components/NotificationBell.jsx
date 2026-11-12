import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationApis } from '../config/api'
import { notificationBody } from './notificationModel'
import './NotificationBell.css'

export default function NotificationBell({ role, path, className = 'branch-admin-notification', iconClassName = 'branch-admin-icon' }) {
  const navigate = useNavigate()
  const [count, setCount] = useState(0)
  useEffect(() => {
    let active = true
    let sequence = 0
    const controller = new AbortController()
    async function sync() {
      const request = ++sequence
      try {
        const response = await notificationApis[role].unreadCount({ signal: controller.signal })
        const unread = Number(notificationBody(response).unreadCount)
        if (active && request === sequence) setCount(Number.isFinite(unread) ? Math.max(0, unread) : 0)
      } catch { if (active && request === sequence) setCount(0) }
    }
    function onChange(event) {
      if (event.detail?.role !== role) return
      if (typeof event.detail.unreadCount === 'number') { sequence++; setCount(Math.max(0, event.detail.unreadCount)) }
      else sync()
    }
    function refreshVisible() { if (document.visibilityState !== 'hidden') sync() }
    sync()
    const timer = window.setInterval(refreshVisible, 60000)
    window.addEventListener('pms:notifications-updated', onChange)
    window.addEventListener('focus', refreshVisible)
    return () => { active = false; controller.abort(); window.clearInterval(timer); window.removeEventListener('pms:notifications-updated', onChange); window.removeEventListener('focus', refreshVisible) }
  }, [role])
  return <button className={`${className} notification-bell`} type="button" aria-label="Notifications" title="Notifications" onClick={() => navigate(path)}><svg className={iconClassName} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9M10 21h4" /></svg>{count > 0 ? <b className="notification-bell-count">{count > 99 ? '99+' : count}</b> : null}</button>
}
