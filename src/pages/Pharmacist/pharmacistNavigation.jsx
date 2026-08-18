import SidebarIcon from '../../components/SidebarIcon'

const item = (label, path, iconName, color) => ({ label, path, icon: <SidebarIcon name={iconName} />, color })

export const pharmacistNavigation = [
  item('Dashboard', '/pharmacist/dashboard', 'dashboard', 'blue'),
  item('Pending', '/pharmacist/pending', 'reports', 'green'),
  item('Dispensing', '/pharmacist/dispensing', 'clinics', 'violet'),
  item('Bills', '/pharmacist/bills', 'audit', 'sky'),
  item('Returns', '/pharmacist/returns', 'notifications', 'orange'),
  item('Reports', '/pharmacist/reports', 'reports', 'teal'),
]
