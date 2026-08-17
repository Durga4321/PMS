import ManagementPage from './ManagementPage'

const branches = [
  ['Branch 1', 'City Care Clinic', 'Kukatpally', 'Active'],
  ['Branch 2', 'Health Plus Clinic', 'Ameerpet', 'Active'],
  ['Branch 3', 'Life Line Clinic', 'Banjara Hills', 'Active'],
  ['Branch 4', 'Wellness Clinic', 'Dilsukhnagar', 'Active'],
]

export default function Branches() {
  return <ManagementPage title="Branches" rows={branches} />
}
