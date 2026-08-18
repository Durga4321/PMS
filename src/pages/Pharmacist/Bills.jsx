import { cancelBill, getBill, listBills, refundPayment } from '../../config/api'
import PharmacistApiScreen from './PharmacistApiScreen'

export default function Bills() {
  return <PharmacistApiScreen activeLabel="Bills" title="Bills, Cancellation and Refunds" subtitle="Pharmacist / Bills" load={listBills} actions={[{ label: 'Get Bill', fn: (id) => getBill(id) }, { label: 'Cancel Bill', fn: (id, body) => cancelBill(id, body) }, { label: 'Refund Payment', fn: (id, body) => refundPayment(id, body) }]} />
}
