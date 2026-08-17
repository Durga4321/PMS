import { FiBell, FiClipboard, FiGrid, FiMapPin, FiPackage, FiSettings, FiTrendingUp, FiUserCheck, FiUsers } from 'react-icons/fi'
import { HiOutlineBuildingOffice2 } from 'react-icons/hi2'

const item = (label, path, Icon, iconName) => ({ label, path, icon: <Icon aria-hidden="true" />, Icon, iconName })

export const superAdminNavigation = [
  item('Dashboard', '/super-admin/dashboard', FiGrid, 'dashboard'),
  item('Admins', '/super-admin/admins', FiUserCheck, 'admins'),
  item('Clinics', '/super-admin/clinics', HiOutlineBuildingOffice2, 'clinics'),
  item('Branches', '/super-admin/branches', FiMapPin, 'branches'),
  item('Users & Permissions', '/super-admin/users-permissions', FiUsers, 'roles'),
  item('Medicines', '/super-admin/medicines', FiPackage, 'medicines'),
  item('System Settings', '/super-admin/system-settings', FiSettings, 'settings'),
  item('Reports', '/super-admin/reports', FiTrendingUp, 'reports'),
  item('Audit Logs', '/super-admin/audit-logs', FiClipboard, 'audit'),
  item('Notifications', '/super-admin/notifications', FiBell, 'notifications'),
]
