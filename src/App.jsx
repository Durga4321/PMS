import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import ForgotPassword from './pages/ForgotPassword'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import SuperAdminDashboard from './pages/Super Admin/SuperAdminDashboard'
import UsersPermissions from './pages/Super Admin/UsersPermissions'
import Medicines from './pages/Super Admin/Medicines'
import SystemSettings from './pages/Super Admin/SystemSettings'
import Reports from './pages/Super Admin/Reports'
import ActivityLogs from './pages/Super Admin/Audit Logs'
import Notifications from './pages/Super Admin/Notifications'
import Admins from './pages/Super Admin/Admins'
import Clinics from './pages/Super Admin/Clinics'
import Branches from './pages/Super Admin/Branches'
import VerifyOTP from './pages/VerifyOTP'
import { superAdminNavigation } from './components/superAdminNavigation'
import './App.css'
import './Topbar.css'
import './ProfileMenu.css'
import './SidebarIcon.css'

function SuperAdminNavigationHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    const navigateToPage = (event) => {
      const button = event.target.closest('button')
      const sidebar = button?.closest('.admin-nav, .users-sidebar nav, .med-sidebar nav, .settings-sidebar nav, .reports-sidebar nav, .activity-sidebar nav, .notification-sidebar nav')
      if (!sidebar) return
      const label = button.lastChild?.textContent?.trim()
      const page = superAdminNavigation.find((item) => item.label === label)
      if (page) navigate(page.path)
    }
    document.addEventListener('click', navigateToPage)
    return () => document.removeEventListener('click', navigateToPage)
  }, [navigate])

  return null
}

function CompleteSuperAdminSidebars() {
  const location = useLocation()
  useEffect(() => {
    const paths = { dashboard: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', admins: 'M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 21v-2a6 6 0 0 1 12 0v2m2-10 2 2 3-4m-5 9h4', clinics: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M2 21h20M8 7h4M8 11h4M8 15h4M17 8h2M17 12h2', branches: 'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', roles: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm9 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM2.5 21v-1a5.5 5.5 0 0 1 11 0v1m.5-1a4 4 0 0 1 7.5-2', medicines: 'm14.5 4.5 5 5a4.24 4.24 0 0 1-6 6l-5-5a4.24 4.24 0 0 1 6-6ZM10 9l5 5', settings: 'M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z', reports: 'M5 3h10l4 4v14H5zM15 3v5h5M8 17v-4m4 4V9m4 8v-2', audit: 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5m2 2 1.5 1.5L20 15', notifications: 'M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2-2-9m6 12h4' }
    document.querySelectorAll('.activity-sidebar nav, .settings-sidebar nav, .reports-sidebar nav, .notification-sidebar nav').forEach((sidebar) => {
      const sample = sidebar.querySelector('button')
      const iconTag = sample?.firstElementChild?.tagName?.toLowerCase() || 'i'
      sidebar.replaceChildren(...superAdminNavigation.map(({ label, path, iconName }) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = window.location.pathname === path ? 'active' : ''
        const icon = document.createElement(iconTag)
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('viewBox', '0 0 24 24')
        svg.setAttribute('fill', 'none')
        svg.setAttribute('stroke', 'currentColor')
        svg.setAttribute('stroke-width', '2')
        svg.setAttribute('stroke-linecap', 'round')
        svg.setAttribute('stroke-linejoin', 'round')
        svg.classList.add('sidebar-icon')
        paths[iconName].split('M').filter(Boolean).forEach((pathData) => {
          const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          pathElement.setAttribute('d', `M${pathData}`)
          svg.append(pathElement)
        })
        icon.append(svg)
        button.append(icon, document.createTextNode(label))
        return button
      }))
    })
  }, [location.pathname])
  return null
}

function SharedProfileMenu() {
  const navigate = useNavigate()
  const [position, setPosition] = useState(null)

  useEffect(() => {
    const showProfileMenu = (event) => {
      const profile = event.target.closest('.med-head-right>strong, .users-header-right>span:last-child, .settings-header>div:last-child>strong')
      if (!profile) return
      const rect = profile.getBoundingClientRect()
      setPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
    }
    const closeProfileMenu = (event) => {
      if (event.target.closest('.med-head-right>strong, .users-header-right>span:last-child, .settings-header>div:last-child>strong')) return
      if (!event.target.closest('.shared-profile-menu')) setPosition(null)
    }
    document.addEventListener('click', showProfileMenu)
    document.addEventListener('click', closeProfileMenu)
    return () => {
      document.removeEventListener('click', showProfileMenu)
      document.removeEventListener('click', closeProfileMenu)
    }
  }, [])

  if (!position) return null
  return <div className="shared-profile-menu" style={position} role="menu">
    <div className="profile-menu-summary"><div className="profile-menu-avatar">SA</div><div><strong>Super Admin</strong><small>superadmin@gmail.com</small><em>Super Admin</em></div></div>
    <div className="profile-menu-actions">
      <button type="button" role="menuitem"><i className="profile-menu-icon user-icon" aria-hidden="true" /><span><b>My Profile</b><small>View and edit your profile</small></span><b className="profile-menu-arrow">›</b></button>
      <button type="button" role="menuitem"><i className="profile-menu-icon password-icon" aria-hidden="true" /><span><b>Change Password</b><small>Update your password</small></span><b className="profile-menu-arrow">›</b></button>
      <button className="profile-menu-logout" type="button" role="menuitem" onClick={() => navigate('/login')}><i className="profile-menu-icon logout-icon" aria-hidden="true" /><span><b>Logout</b><small>Sign out from your account</small></span></button>
    </div>
  </div>
}

function App() {
  return (
    <BrowserRouter>
      <SuperAdminNavigationHandler />
      <CompleteSuperAdminSidebars />
      <SharedProfileMenu />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
        <Route path="/super-admin/admins" element={<Admins />} />
        <Route path="/super-admin/clinics" element={<Clinics />} />
        <Route path="/super-admin/branches" element={<Branches />} />
        <Route path="/super-admin/users-permissions" element={<UsersPermissions />} />
        <Route path="/super-admin/medicines" element={<Medicines />} />
        <Route path="/super-admin/system-settings" element={<SystemSettings />} />
        <Route path="/super-admin/reports" element={<Reports />} />
        <Route path="/super-admin/audit-logs" element={<ActivityLogs />} />
        <Route path="/super-admin/activity-logs" element={<Navigate to="/super-admin/audit-logs" replace />} />
        <Route path="/super-admin/notifications" element={<Notifications />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
