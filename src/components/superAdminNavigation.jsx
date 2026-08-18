import SidebarIcon from './SidebarIcon'

const item = (label, path, iconName, color) => ({
  label,
  path,
  icon: <SidebarIcon name={iconName} />,
  iconName,
  color,
})

export const superAdminNavigation = [
  item('Dashboard', '/super-admin/dashboard', 'dashboard', 'blue'),
  item('Clinics', '/super-admin/clinics', 'clinics', 'violet'),
  item('Branches', '/super-admin/branches', 'branches', 'orange'),
  item('Medicines', '/super-admin/medicines', 'medicines', 'emerald'),
  item('Admins', '/super-admin/admins', 'admins', 'teal'),
  item('Users & Permissions', '/super-admin/users-permissions', 'roles', 'pink'),
  item('System Settings', '/super-admin/system-settings', 'settings', 'amber'),
  item('Reports', '/super-admin/reports', 'reports', 'green'),
  item('Audit Logs', '/super-admin/audit-logs', 'audit', 'sky'),
  item('Notifications', '/super-admin/notifications', 'notifications', 'purple'),
]
