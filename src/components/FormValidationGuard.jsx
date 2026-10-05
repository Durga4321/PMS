import { useEffect } from 'react'

const phoneWords = ['phone', 'mobile', 'mobile number', 'mbl', 'contact number', 'contact no', 'contact phone', 'supplier contact', 'whatsapp']
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


function validatePhoneField(input) {
  if (!(input instanceof HTMLInputElement)) return true
  if (!isPhone(fieldText(input))) return true

  const digits = onlyDigits(input.value).slice(0, 10)
  if (digits !== input.value) {
    input.value = digits
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const valid = digits.length === 0 || digits.length === 10
  input.setCustomValidity(valid ? '' : 'Phone or mobile number must be exactly 10 digits.')
  return valid
}

function validateForm(form) {
  const phoneInputs = [...form.querySelectorAll('input')].filter((input) => isPhone(fieldText(input)))
  const invalidInput = phoneInputs.find((input) => !validatePhoneField(input))
  if (invalidInput) {
    invalidInput.reportValidity()
    invalidInput.focus()
    return false
  }
  return true
}
function sanitize(input) {
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) return
  const text = fieldText(input)
  const cursor = input.selectionStart
  const current = input.value
  let next = current

  if (input instanceof HTMLInputElement && isPhone(text)) {
    next = onlyDigits(current).slice(0, 10)
    input.maxLength = 10
    input.inputMode = 'numeric'
    input.pattern = '[0-9]{10}'
  }
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

    function onSubmit(event) {
      if (!validateForm(event.target)) event.preventDefault()
    }

    document.addEventListener('input', onInput, true)
    document.addEventListener('change', onInput, true)
    document.addEventListener('submit', onSubmit, true)
    return () => {
      document.removeEventListener('input', onInput, true)
      document.removeEventListener('change', onInput, true)
      document.removeEventListener('submit', onSubmit, true)
    }
  }, [])

  return null
}
