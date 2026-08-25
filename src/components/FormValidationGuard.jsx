import { useEffect } from 'react'

const phoneWords = ['phone', 'mobile', 'contact number', 'contact no', 'whatsapp']
const numberWords = ['quantity', 'qty', 'price', 'amount', 'cost', 'stock', 'gst', 'tax', 'port', 'level', 'reorder', 'minimum', 'maximum', 'duration']
const personNameWords = ['full name', 'patient name', 'doctor name', 'pharmacist name', 'admin name', 'sender name']

const onlyDigits = (value) => String(value || '').replace(/\D/g, '')
const onlyLetters = (value) => String(value || '').replace(/[^A-Za-z .'-]/g, '')
const excludedTextTypes = ['button', 'checkbox', 'color', 'date', 'datetime-local', 'email', 'file', 'hidden', 'month', 'number', 'password', 'radio', 'range', 'reset', 'submit', 'time', 'url', 'week']

function fieldText(input) {
  const label = input.closest('label')?.innerText || ''
  return [input.name, input.id, input.placeholder, input.getAttribute('aria-label'), label].filter(Boolean).join(' ').toLowerCase()
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word))
}

function isEmail(input, text) {
  return input.type === 'email' || text.includes('email') || text.includes('mail')
}

function isPassword(input, text) {
  return input.type === 'password' || text.includes('password')
}

function isPhone(text) {
  return hasAny(text, phoneWords)
}

function isNumeric(input, text) {
  if (input.type === 'number') return true
  if (isPhone(text)) return false
  return hasAny(text, numberWords)
}

function isPersonName(text) {
  return personNameWords.some((word) => text.includes(word)) || /^name\b/.test(text)
}

function shouldCapitalize(input, text) {
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) return false
  if (isEmail(input, text) || isPassword(input, text) || isPhone(text) || isNumeric(input, text)) return false
  if (input instanceof HTMLInputElement && excludedTextTypes.includes(input.type)) return false
  return !input.readOnly && !input.disabled
}

function capitalizeStartingLetters(value) {
  return String(value || '').replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
}

function sanitize(input) {
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) return
  const text = fieldText(input)
  const cursor = input.selectionStart
  const current = input.value
  let next = current

  if (input instanceof HTMLInputElement && isPhone(text)) next = onlyDigits(current).slice(0, 10)
  else if (input instanceof HTMLInputElement && isPersonName(text)) next = onlyLetters(current)
  else if (shouldCapitalize(input, text)) next = capitalizeStartingLetters(current)

  if (next !== current) {
    input.value = next
    input.dispatchEvent(new Event('input', { bubbles: true }))
    try { input.setSelectionRange(Math.min(cursor, next.length), Math.min(cursor, next.length)) } catch { /* Some input types do not support selection ranges. */ }
  }
}

export default function FormValidationGuard() {
  useEffect(() => {
    function onInput(event) {
      sanitize(event.target)
    }

    document.addEventListener('input', onInput, true)
    document.addEventListener('change', onInput, true)
    return () => {
      document.removeEventListener('input', onInput, true)
      document.removeEventListener('change', onInput, true)
    }
  }, [])

  return null
}
