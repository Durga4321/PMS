export const stats = [
  ['Today Sales', '0', 'No data available'],
  ['Prescriptions', '0', 'No data available'],
  ['Low Stock', '0', 'No data available'],
  ['Expiry Alerts', '0', 'No data available'],
]

export const adminTables = {
  users: {
    title: 'Users',
    action: '+ Add User',
    headers: ['Name', 'Role', 'Status', 'Action'],
    rows: [],
  },
  medicines: {
    title: 'Medicines',
    action: '+ Add Medicine',
    headers: ['Name', 'Category', 'Strength', 'Unit', 'Action'],
    rows: [],
  },
  stock: {
    title: 'Stock Management',
    action: '+ Stock In',
    headers: ['Medicine', 'Batch No.', 'Qty', 'Expiry Date', 'Status'],
    rows: [],
  },
  prescriptions: {
    title: 'Prescriptions',
    action: 'View All',
    headers: ['Rx No.', 'Patient', 'Doctor', 'Status'],
    rows: [],
  },
  dispensing: {
    title: 'Dispense Medicine',
    action: 'Dispense',
    headers: ['Prescription', 'Patient', 'Medicine', 'Qty'],
    rows: [],
  },
  expiryAlerts: {
    title: 'Expiry Alerts',
    action: 'Export',
    headers: ['Medicine', 'Batch No.', 'Expiry Date', 'Qty', 'Status'],
    rows: [],
  },
  reports: {
    title: 'Reports',
    action: 'Generate',
    headers: ['Report', 'Type', 'Created By', 'Status'],
    rows: [],
  },
  settings: {
    title: 'Settings',
    action: 'Save',
    headers: ['Setting', 'Scope', 'Value', 'Status'],
    rows: [],
  },
}
