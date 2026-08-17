import ManagementPage from './ManagementPage'

const clinics = [
  ['City Care Clinic', 'Hyderabad', '8 branches', 'Active'],
  ['Health Plus Clinic', 'Secunderabad', '6 branches', 'Active'],
  ['Life Line Clinic', 'Hyderabad', '4 branches', 'Active'],
  ['Wellness Clinic', 'Hyderabad', '3 branches', 'Active'],
]

export default function Clinics() {
  return <ManagementPage title="Clinics" rows={clinics} />
}
