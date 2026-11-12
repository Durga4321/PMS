import './ConfirmAction.css'
import { getLanguage, translate } from '../i18n/language'

let pendingConfirmation = null

// Shared themed confirmation for destructive actions in Admin and Pharmacist.
export function confirmAction(message, options = {}) {
  const deleting = /\bdelete\b/i.test(message)
  const { title = deleting ? 'Delete record?' : 'Confirm action', confirmLabel = deleting ? 'Delete' : 'Confirm' } = options
  if (pendingConfirmation) return Promise.resolve(false)
  return new Promise((resolve) => {
    const previousFocus = document.activeElement
    const dialog = document.createElement('dialog')
    dialog.className = 'pms-action-confirm-dialog'
    dialog.setAttribute('aria-labelledby', 'pms-action-confirm-title')
    dialog.setAttribute('aria-describedby', 'pms-action-confirm-description')
    dialog.innerHTML = '<div class="pms-action-confirm-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></svg></div><h2 id="pms-action-confirm-title"></h2><p id="pms-action-confirm-description"></p><div class="pms-action-confirm-actions"><button type="button" autofocus>Cancel</button><button type="button" class="pms-action-confirm-confirm"></button></div>'
    dialog.querySelector('h2').textContent = translate(title, getLanguage())
    dialog.querySelector('p').textContent = translate(message, getLanguage())
    const [cancelButton, confirmButton] = dialog.querySelectorAll('button')
    cancelButton.textContent = translate('Cancel', getLanguage())
    confirmButton.textContent = translate(confirmLabel, getLanguage())
    let settled = false
    function finish(confirmed) {
      if (settled) return
      settled = true
      dialog.close()
      dialog.remove()
      pendingConfirmation = null
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
      resolve(confirmed)
    }
    pendingConfirmation = dialog
    cancelButton.addEventListener('click', () => finish(false))
    confirmButton.addEventListener('click', () => finish(true))
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(false) })
    dialog.addEventListener('close', () => finish(false))
    document.body.appendChild(dialog)
    dialog.showModal()
    cancelButton.focus()
  })
}
