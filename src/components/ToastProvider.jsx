import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import './ToastProvider.css'

const ToastContext = createContext(null)

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((message, type = 'success') => {
    const id = crypto.randomUUID()

    setToasts((currentToasts) => [...currentToasts, { id, message, type }])
    window.setTimeout(() => removeToast(id), 3500)
  }, [removeToast])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast toast-${toast.type}`} key={toast.id}>
            <span>{toast.type === 'error' ? 'Error' : 'Success'}</span>
            <p>{toast.message}</p>
            <button type="button" onClick={() => removeToast(toast.id)} aria-label="Close message">
              x
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider')
  }

  return context
}

export default ToastProvider
