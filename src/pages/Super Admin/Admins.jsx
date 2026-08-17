import ManagementPage from './ManagementPage'

const admins = [
  ['John Doe', 'Super Admin', 'Head Office', 'Active'],
  ['Jane Smith', 'Admin', 'City Care Clinic', 'Active'],
  ['Mike Brown', 'Admin', 'Life Line Clinic', 'Active'],
  ['Sarah Wilson', 'Admin', 'Health Plus Clinic', 'Active'],
]

export default function Admins() {
  return <ManagementPage title="Admins" rows={admins} />
}
