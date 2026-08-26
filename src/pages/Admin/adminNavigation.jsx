import SidebarIcon from '../../components/SidebarIcon'

const item = (label, path, iconName, color) => ({
  label,
  path,
  icon: <SidebarIcon name={iconName} />,
  color,
})

export const adminNavigation = [
  item('Dashboard', '/admin/dashboard', 'dashboard', 'blue'),
  item('Users', '/admin/users', 'users', 'pink'),
  item('Medicines', '/admin/medicines', 'medicines', 'emerald'),
  item('Stock', '/admin/stock', 'package', 'sky'),
  item('Suppliers', '/admin/suppliers', 'truck', 'teal'),
  item('Purchase Orders', '/admin/purchase-orders', 'shoppingCart', 'green'),
  item('Stock Transfers', '/admin/stock-transfers', 'arrowLeftRight', 'orange'),
  item('Prescriptions', '/admin/prescriptions', 'fileText', 'green'),
  item('Dispensing', '/admin/dispensing', 'clipboardCheck', 'violet'),
  item('Expiry Alerts', '/admin/expiry-alerts', 'triangleAlert', 'orange'),
  item('Reports', '/admin/reports', 'barChart3', 'teal'),
  item('Settings', '/admin/settings', 'cog', 'amber'),
  item('CMS Integration', '/admin/cms-integration', 'globe', 'teal'),
]
