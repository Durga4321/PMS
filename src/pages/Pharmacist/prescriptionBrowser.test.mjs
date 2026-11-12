import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'

const chrome = process.env.PMS_TEST_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

test('browser: camera, draft recovery, medicine entry, bill and payment', { skip: !existsSync(chrome), timeout: 90000 }, async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, open: false } })
  let browser
  let socket
  try {
    await server.listen()
    const port = server.httpServer.address().port
    browser = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=0', `--user-data-dir=${mkdtempSync(path.join(tmpdir(), 'pms-rx-browser-'))}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
    const endpoint = await new Promise((resolve, reject) => {
      let output = ''
      const timer = setTimeout(() => reject(new Error('Chrome did not expose its test connection.')), 15000)
      browser.once('error', reject)
      browser.stderr.on('data', (chunk) => { output += chunk.toString(); const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]) } })
    })
    socket = new WebSocket(endpoint)
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
    let serial = 0
    const pending = new Map()
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (!message.id) return
      const request = pending.get(message.id)
      pending.delete(message.id)
      clearTimeout(request?.timer)
      if (message.error) request?.reject(new Error(message.error.message)); else request?.resolve(message.result)
    })
    function call(method, params = {}, sessionId) {
      return new Promise((resolve, reject) => { const id = ++serial; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)) }, method === 'Runtime.evaluate' ? 20000 : 10000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })) })
    }
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true })
    const command = (method, params) => call(method, params, sessionId)
    await command('Page.enable')
    await command('Runtime.enable')
    await command('Emulation.setDeviceMetricsOverride', { width: 1640, height: 1150, deviceScaleFactor: 1, mobile: false })
    function fixture() {
      sessionStorage.setItem('pharmacistToken', 'browser-test-token')
      sessionStorage.setItem('pharmacistUser', JSON.stringify({ id: 'pharmacist-demo', name: 'Pharmacist', email: 'pharmacist@example.com', pharmacyId: 'pharmacy-demo', branchId: 'branch-demo' }))
      sessionStorage.setItem('pharmacistAssignment', JSON.stringify({ pharmacyId: 'pharmacy-demo', branchId: 'branch-demo' }))
      localStorage.setItem('pms_language', 'en')
      window.__rxCalls = JSON.parse(sessionStorage.getItem('__rxCalls') || '[]')
      const fetchOriginal = window.fetch.bind(window)
      window.fetch = async (url, options = {}) => {
        const address = new URL(typeof url === 'string' ? url : url.url, location.origin)
        if (!address.pathname.startsWith('/api/')) return fetchOriginal(url, options)
        const payload = options.body ? JSON.parse(options.body) : null
        window.__rxCalls.push({ path: address.pathname, method: options.method || 'GET', payload })
        sessionStorage.setItem('__rxCalls', JSON.stringify(window.__rxCalls))
        let data = { unreadCount: 0, items: [] }
        if (address.pathname.endsWith('/prescriptions/manual')) {
          if (payload.medicines.some((medicine) => ['morning', 'afternoon', 'evening'].some((key) => typeof medicine[key] !== 'boolean'))) return new Response(JSON.stringify({ message: 'The JSON value could not be converted to System.Boolean.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
          data = { prescriptionId: 'rx-demo-1' }
        }
        if (address.pathname.endsWith('/generate-bill')) {
          if (window.__failBill) return new Response(JSON.stringify({ message: 'Billing is temporarily unavailable.' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
          data = { billId: 'bill-demo-1', totalAmount: payload.totalAmount }
        }
        if (address.pathname.endsWith('/payment')) {
          if (window.__failPayment) return new Response(JSON.stringify({ message: 'Payment could not be confirmed.' }), { status: 422, headers: { 'Content-Type': 'application/json' } })
          data = { paymentId: 'payment-demo-1', status: 'Paid' }
        }
        return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
    }
    await command('Page.addScriptToEvaluateOnNewDocument', { source: `(${fixture.toString()})()` })
    async function evaluate(expression) {
      const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result.value
    }
    async function waitFor(expression) {
      const end = Date.now() + 15000
      while (Date.now() < end) {
        try { if (await evaluate(`Boolean(${expression})`)) return }
        catch (error) { if (!/navigated|context|closed/i.test(error.message)) throw error }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error(`Timed out waiting for UI: ${expression}`)
    }
    const click = (text) => evaluate(`(() => { const button = [...document.querySelectorAll('.rx-workspace button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!button) throw new Error('Missing button: ' + ${JSON.stringify(text)}); button.click(); })()`)
    const fill = (selector, value) => evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); if (!input) throw new Error('Missing input ' + ${JSON.stringify(selector)}); const prototype = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`)
    await command('Page.navigate', { url: `http://127.0.0.1:${port}/pharmacist/dispensing` })
    await waitFor("document.querySelector('.rx-workspace input[name=patientName]')")
    await fill('[name=patientName]', 'Example Patient')
    await fill('[name=doctorName]', 'Example Doctor')
    await fill('[name=patientPhone]', '9876543210')
    assert.equal(await evaluate("Boolean(document.querySelector('.rx-medicines'))"), false)
    await click('Take Photo')
    await waitFor("document.querySelector('.rx-camera-frame video')?.videoWidth > 0")
    await click('Capture Photo')
    await waitFor("document.querySelector('.rx-attached')")
    await click('Next: Add Medicines')
    await waitFor("document.querySelector('.rx-medicines')")
    assert.equal(await evaluate("Boolean(document.querySelector('.rx-details-grid'))"), false)
    await fill('[aria-label="medicineName 1"]', 'Medicine A')
    await fill('[aria-label="morning 1"]', '1')
    await fill('[aria-label="evening 1"]', '1')
    await fill('[aria-label="days 1"]', '5')
    await fill('[aria-label="unitPrice 1"]', '10')
    assert.equal(await evaluate('document.querySelector(\'[aria-label="quantity 1"]\').value'), '10')
    await click('Add Medicine')
    await fill('[aria-label="medicineName 2"]', 'Medicine B')
    await fill('[aria-label="afternoon 2"]', '1')
    await fill('[aria-label="days 2"]', '5')
    await fill('[aria-label="unitPrice 2"]', '10')
    await click('Save Draft')
    await waitFor("document.querySelector('.rx-message')?.textContent.includes('saved on this device')")
    const firstDocument = await evaluate('performance.timeOrigin')
    await command('Page.reload')
    await waitFor(`performance.timeOrigin !== ${firstDocument} && document.querySelector('.rx-medicines tbody tr')`)
    assert.equal(await evaluate("document.querySelectorAll('.rx-medicines tbody tr').length"), 2)
    await click('Add Medicine')
    await click('Add Medicine')
    await waitFor("document.querySelector('[aria-label=\"medicineName 4\"]')")
    assert.equal(await evaluate("document.querySelectorAll('.rx-medicines tbody tr').length"), 1)
    await click('Previous')
    assert.equal(await evaluate("document.querySelectorAll('.rx-medicines tbody tr').length"), 3)
    await click('Next')
    await evaluate("document.querySelector('[aria-label=\"Remove medicine 4\"]').click()")
    await evaluate("document.querySelector('[aria-label=\"Remove medicine 3\"]').click()")
    assert.equal(await evaluate("document.querySelectorAll('.rx-medicines tbody tr').length"), 2)
    await click('Back')
    await waitFor("document.querySelector('.rx-attached') && document.querySelector('[name=patientName]')?.value === 'Example Patient'")
    await command('Emulation.setDeviceMetricsOverride', { width: 1640, height: 768, deviceScaleFactor: 1, mobile: false })
    assert.equal(await evaluate("document.querySelector('.rx-footer').getBoundingClientRect().bottom <= window.innerHeight"), true)
    const metrics = await command('Page.getLayoutMetrics')
    const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: metrics.cssContentSize.width, height: metrics.cssContentSize.height, scale: 1 } })
    mkdirSync('artifacts', { recursive: true })
    writeFileSync('artifacts/pharmacist-prescription-workspace.png', Buffer.from(screenshot.data, 'base64'))
    await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
    await waitFor("document.querySelector('.rx-workspace').getBoundingClientRect().width <= 390")
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.rx-details-grid')).gridTemplateColumns.split(' ').length"), 1)
    await command('Emulation.setDeviceMetricsOverride', { width: 1640, height: 768, deviceScaleFactor: 1, mobile: false })
    await click('Next: Add Medicines')
    await waitFor("document.querySelector('.rx-medicines')")
    assert.equal(await evaluate("document.querySelector('.rx-footer').getBoundingClientRect().bottom <= window.innerHeight"), true)
    await evaluate('window.__failBill = true')
    await click('Proceed to Payment')
    await waitFor("document.querySelector('.rx-error')?.textContent.includes('unavailable')")
    assert.equal(await evaluate("window.__rxCalls.filter(c => c.path.endsWith('/prescriptions/manual')).length"), 1)
    await evaluate('window.__failBill = false')
    await click('Proceed to Payment')
    await waitFor("document.querySelector('.rx-payment-grid')")
    assert.equal(await evaluate("window.__rxCalls.filter(c => c.path.endsWith('/prescriptions/manual')).length"), 1)
    await fill('.rx-payment-grid select', 'UPI')
    await fill('.rx-payment-grid input', 'TXN-123')
    await evaluate('window.__failPayment = true')
    await click('Confirm Payment')
    await waitFor("document.querySelector('.rx-error')?.textContent.includes('could not be confirmed')")
    assert.equal(await evaluate("Boolean(document.querySelector('.rx-complete'))"), false)
    await evaluate('window.__failPayment = false')
    await click('Confirm Payment')
    await waitFor("document.querySelector('.rx-complete')")
    const payment = await evaluate("window.__rxCalls.find(c => c.path.endsWith('/payment'))")
    assert.equal(payment.payload.amount, 150)
    assert.equal(payment.payload.paymentMethod, 'UPI')
    assert.equal(payment.payload.transactionReference, 'TXN-123')
    const paidDocument = await evaluate('performance.timeOrigin')
    await command('Page.reload')
    await waitFor(`performance.timeOrigin !== ${paidDocument} && document.querySelector('.rx-complete')`)
    assert.equal(await evaluate("window.__rxCalls.filter(c => c.path.endsWith('/payment')).length"), 2)
    assert.equal(await evaluate("new Set(window.__rxCalls.filter(c => c.path.endsWith('/payment')).map(c => c.payload.clientRequestId)).size"), 1)
  } finally {
    socket?.close()
    browser?.kill()
    server.httpServer?.closeAllConnections()
    await server.close()
  }
})
