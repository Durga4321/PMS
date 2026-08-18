import { changeStockTransferStatus, createStockTransfer, dispatchStockTransfer, getStockTransfer, listStockTransfers, receiveStockTransfer } from '../../config/api'
import AdminApiScreen from './AdminApiScreen'

export default function StockTransfers() {
  return <AdminApiScreen activeLabel="Stock Transfers" title="Stock Transfers" subtitle="Admin / Stock Transfers" load={listStockTransfers} actions={[{ label: 'Create', fn: (_, body) => createStockTransfer(body) }, { label: 'Get', fn: (id) => getStockTransfer(id) }, { label: 'Dispatch', fn: (id, body) => dispatchStockTransfer(id, body) }, { label: 'Receive', fn: (id, body) => receiveStockTransfer(id, body) }, { label: 'Status', fn: (id, body) => changeStockTransferStatus(id, body) }]} />
}
