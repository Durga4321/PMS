import { useState } from 'react'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import NotificationCenter from '../../components/NotificationCenter'

export default function Notifications() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return <div className={`super-admin-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
    <SuperAdminSidebar activeLabel="Notifications" />
    <main className="super-admin-main">
      <SuperAdminTopbar onMenu={() => setSidebarOpen((value) => !value)} />
      <NotificationCenter role="superAdmin" />
    </main>
  </div>
}