import SidebarIcon from '../../components/SidebarIcon'

const item = (label, path, iconName, color) => ({
  label,
  path,
  icon: <SidebarIcon name={iconName} />,
  color,
})

export const adminNavigation = [
  item('Dashboard', '/admin/dashboard', 'dashboard', 'blue'),
  item('Users', '/admin/users', 'roles', 'pink'),
  item('Medicines', '/admin/medicines', 'medicines', 'emerald'),
  item('Stock', '/admin/stock', 'audit', 'sky'),
  item('Suppliers', '/admin/suppliers', 'admins', 'teal'),
  item('Purchase Orders', '/admin/purchase-orders', 'reports', 'green'),
  item('Stock Transfers', '/admin/stock-transfers', 'branches', 'orange'),
  item('Prescriptions', '/admin/prescriptions', 'reports', 'green'),
  item('Dispensing', '/admin/dispensing', 'clinics', 'violet'),
  item('Expiry Alerts', '/admin/expiry-alerts', 'notifications', 'orange'),
  item('Reports', '/admin/reports', 'reports', 'teal'),
  item('Settings', '/admin/settings', 'settings', 'amber'),
]
