import SidebarIcon from '../../components/SidebarIcon'

const item = (label, path, iconName, color) => ({ label, path, icon: <SidebarIcon name={iconName} />, color })

export const pharmacistNavigation = [
  item('Dashboard', '/pharmacist/dashboard', 'dashboard', 'blue'),
  item('Pending', '/pharmacist/pending', 'clock', 'green'),
  item('Dispensing', '/pharmacist/dispensing', 'clipboardCheck', 'violet'),
  item('Bills', '/pharmacist/bills', 'receipt', 'sky'),
  item('Returns', '/pharmacist/returns', 'rotateCcw', 'orange'),
  item('Reports', '/pharmacist/reports', 'barChart3', 'teal'),
]
