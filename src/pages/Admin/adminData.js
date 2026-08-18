export const stats = [
  ['Today Sales', '$5,230', '12% vs yesterday'],
  ['Prescriptions', '45', '8 pending review'],
  ['Low Stock', '8', '3 critical medicines'],
  ['Expiry Alerts', '5', 'Within 30 days'],
]

export const adminTables = {
  users: {
    title: 'Users',
    action: '+ Add User',
    headers: ['Name', 'Role', 'Status', 'Action'],
    rows: [['John Doe', 'Admin', 'Active', 'Edit'], ['Jane Smith', 'Pharmacist', 'Active', 'Edit'], ['Mike Johnson', 'Supervisor', 'Active', 'Edit'], ['Sarah Wilson', 'Pharmacist', 'Inactive', 'Edit']],
  },
  medicines: {
    title: 'Medicines',
    action: '+ Add Medicine',
    headers: ['Name', 'Category', 'Strength', 'Unit', 'Action'],
    rows: [['Paracetamol', 'Tablet', '500mg', 'Strip', 'Edit'], ['Amoxicillin', 'Capsule', '250mg', 'Strip', 'Edit'], ['Cetirizine', 'Tablet', '10mg', 'Strip', 'Edit'], ['Omeprazole', 'Capsule', '20mg', 'Strip', 'Edit']],
  },
  stock: {
    title: 'Stock Management',
    action: '+ Stock In',
    headers: ['Medicine', 'Batch No.', 'Qty', 'Expiry Date', 'Status'],
    rows: [['Paracetamol', 'B001', '200', '31-12-2025', 'In Stock'], ['Amoxicillin', 'B002', '150', '30-11-2025', 'In Stock'], ['Cetirizine', 'B003', '30', '15-01-2026', 'Low Stock'], ['Insulin', 'B004', '0', '20-10-2025', 'Out of Stock']],
  },
  prescriptions: {
    title: 'Prescriptions',
    action: 'View All',
    headers: ['Rx No.', 'Patient', 'Doctor', 'Status'],
    rows: [['RX1001', 'John Doe', 'Dr. Smith', 'Dispensed'], ['RX1002', 'Mary Johnson', 'Dr. Brown', 'Pending'], ['RX1003', 'Robert Lee', 'Dr. Smith', 'Dispensed']],
  },
  dispensing: {
    title: 'Dispense Medicine',
    action: 'Dispense',
    headers: ['Prescription', 'Patient', 'Medicine', 'Qty'],
    rows: [['RX1001', 'John Doe', 'Paracetamol 500mg', '10'], ['RX1002', 'Mary Johnson', 'Amoxicillin 250mg', '6'], ['RX1003', 'Robert Lee', 'Cetirizine 10mg', '8']],
  },
  expiryAlerts: {
    title: 'Expiry Alerts',
    action: 'Export',
    headers: ['Medicine', 'Batch No.', 'Expiry Date', 'Qty', 'Status'],
    rows: [['Paracetamol 500mg', 'B001', '31-12-2025', '80', 'Active'], ['Amoxicillin 250mg', 'B002', '30-11-2025', '15', 'Low Stock'], ['Cetirizine 10mg', 'B003', '15-01-2026', '0', 'Out of Stock']],
  },
  reports: {
    title: 'Reports',
    action: 'Generate',
    headers: ['Report', 'Type', 'Created By', 'Status'],
    rows: [['Sales Report', 'Daily', 'Admin', 'Ready'], ['Stock Report', 'Weekly', 'Supervisor', 'Ready'], ['Expiry Report', 'Monthly', 'Admin', 'Pending']],
  },
  settings: {
    title: 'Settings',
    action: 'Save',
    headers: ['Setting', 'Scope', 'Value', 'Status'],
    rows: [['Branch Profile', 'Branch A', 'Configured', 'Active'], ['Low Stock Rule', 'Inventory', 'Qty below 40', 'Active'], ['Notifications', 'Email', 'Enabled', 'Active']],
  },
}
