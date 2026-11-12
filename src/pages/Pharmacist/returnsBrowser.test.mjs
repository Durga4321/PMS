import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'

const chrome = process.env.PMS_TEST_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
test('browser: return tablets, retry approval, and show confirmed medicine stock', { skip: !existsSync(chrome), timeout: 90000 }, async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, open: false } })
  let browser, socket
  try {
    await server.listen()
    const port = server.httpServer.address().port
    browser = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${mkdtempSync(path.join(tmpdir(), 'pms-returns-browser-'))}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
    const endpoint = await new Promise((resolve, reject) => {
      let output = ''
      const timer = setTimeout(() => reject(new Error('Chrome test connection unavailable')), 15000)
      browser.once('error', reject)
      browser.stderr.on('data', (chunk) => { output += chunk; const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]) } })
    })
    socket = new WebSocket(endpoint)
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
    let serial = 0
    const pending = new Map()
    socket.addEventListener('message', (event) => { const message = JSON.parse(event.data); if (!message.id) return; const request = pending.get(message.id); pending.delete(message.id); clearTimeout(request?.timer); if (message.error) request?.reject(new Error(message.error.message)); else request?.resolve(message.result) })
    function call(method, params = {}, sessionId) { return new Promise((resolve, reject) => { const id = ++serial; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)) }, 20000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })) }) }
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true })
    const command = (method, params) => call(method, params, sessionId)
    await command('Page.enable')
    await command('Runtime.enable')
    await command('Emulation.setDeviceMetricsOverride', { width: 1640, height: 900, deviceScaleFactor: 1, mobile: false })
    function fixture() {
      sessionStorage.setItem('pharmacistToken', 'browser-test-token')
      sessionStorage.setItem('pharmacistUser', JSON.stringify({ id: 'pharmacist-demo', name: 'Pharmacist', email: 'pharmacist@example.com', pharmacyId: 'pharmacy-demo', branchId: 'branch-demo' }))
      sessionStorage.setItem('pharmacistAssignment', JSON.stringify({ pharmacyId: 'pharmacy-demo', branchId: 'branch-demo', branchName: 'Main Branch' }))
      localStorage.setItem('pms_language', 'en')
      window.__calls = []; window.__stock = 20; window.__returns = []; window.__stockReadsAfterCatalogue = 0
      const original = window.fetch.bind(window)
      window.fetch = async (url, options = {}) => {
        const address = new URL(typeof url === 'string' ? url : url.url, location.origin)
        if (!address.pathname.startsWith('/api/')) return original(url, options)
        const payload = options.body ? JSON.parse(options.body) : null
        window.__calls.push({ path: address.pathname, method: options.method || 'GET', payload, headers: options.headers })
        let data = { unreadCount: 0, items: [] }
        const medicine = { id: 7, medicineId: 7, name: 'Medicine A', medicineName: 'Medicine A', branchId: 'branch-demo', pharmacyId: 'pharmacy-demo', branchName: 'Main Branch', batchNumber: 'B-1', batchId: 11, expiryDate: '2030-12-31', status: 'Active', quantity: window.__stock, stock: window.__stock }
        if (address.pathname === '/api/inventory') { data = { items: [medicine] }; if (window.__catalogueRead) window.__stockReadsAfterCatalogue++ }
        if (address.pathname === '/api/medicine') { data = [{ ...medicine, stock: 20, quantity: 20 }]; window.__catalogueRead = true }
        if (address.pathname.endsWith('/batches')) data = { items: [{ batchId: 11, batchNumber: 'B-1', expiryDate: '2030-12-31' }] }
        if (address.pathname.endsWith('/branches')) data = [{ id: 'branch-demo', pharmacyId: 'pharmacy-demo', name: 'Main Branch' }]
        if (address.pathname === '/api/pharmacy/returns' && options.method !== 'POST') data = { items: window.__returns }
        if (address.pathname === '/api/pharmacy/returns' && options.method === 'POST') { const record = { ...payload, returnId: 'return-1', status: 'Pending' }; window.__returns.push(record); data = record }
        if (address.pathname.endsWith('/return-1/approve')) {
          if (window.__failApprove) return new Response(JSON.stringify({ message: 'Approval could not be confirmed.' }), { status: 422, headers: { 'Content-Type': 'application/json' } })
          const record = window.__returns[0]
          if (record.status !== 'Approved') window.__stock += record.quantity
          record.status = 'Approved'; data = record
        }
        return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
    }
    await command('Page.addScriptToEvaluateOnNewDocument', { source: `(${fixture.toString()})()` })
    async function evaluate(expression) { const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value }
    async function waitFor(expression) { const end = Date.now() + 15000; while (Date.now() < end) { try { if (await evaluate(`Boolean(${expression})`)) return } catch (error) { if (!/navigated|context|closed/i.test(error.message)) throw error } await new Promise((resolve) => setTimeout(resolve, 100)) } throw new Error(`Timed out waiting for UI: ${expression}`) }
    const click = (text) => evaluate(`(() => { const button = [...document.querySelectorAll('.pr-returns button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!button) throw new Error('Missing button'); button.click(); })()`)
    const fill = (selector, value) => evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); if (!input) throw new Error('Missing input'); Object.getOwnPropertyDescriptor(input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`)
    await command('Page.navigate', { url: `http://127.0.0.1:${port}/pharmacist/returns` })
    await waitFor("document.querySelector('.pr-returns datalist')?.options.length > 0")
    assert.equal(await evaluate("document.body.textContent.includes('REQUEST PAYLOAD')"), false)
    await fill('.pr-details label:nth-child(1) input', 'Example Patient')
    await fill('.pr-details label:nth-child(2) input', '42')
    await fill('.pr-details select', 'Unused medicines')
    await fill('[aria-label="Medicine 1"]', 'med')
    assert.equal(await evaluate("document.querySelector('.pr-returns datalist').options[0].value"), 'Medicine A')
    await fill('[aria-label="Medicine 1"]', 'Unknown medicine')
    await waitFor("document.querySelector('.pr-returns datalist').options.length === 0")
    await fill('[aria-label="Medicine 1"]', 'medicine a')
    await waitFor("document.querySelector('[aria-label=\"Batch 1\"]')?.tagName === 'SELECT'")
    await fill('[aria-label="Batch 1"]', 'B-1')
    await fill('[aria-label="Returned quantity 1"]', '3')
    await click('Return & Add to Stock')
    await waitFor("document.querySelector('.pr-error')?.textContent.includes('inspected')")
    assert.equal(await evaluate("window.__calls.filter(c => c.method === 'POST').length"), 0)
    await evaluate("document.querySelector('.pr-check input').click(); window.__failApprove = true")
    await click('Return & Add to Stock')
    await waitFor("document.querySelector('.pr-error')?.textContent.includes('could not be confirmed')")
    assert.equal(await evaluate('window.__stock'), 20)
    assert.equal(await evaluate("window.__calls.filter(c => c.path === '/api/pharmacy/returns' && c.method === 'POST').length"), 1)
    await evaluate('window.__failApprove = false')
    await click('Return & Add to Stock')
    await waitFor("document.querySelector('.pr-status')?.textContent === 'Recorded'")
    assert.equal(await evaluate('window.__stock'), 23)
    assert.equal(await evaluate("window.__calls.filter(c => c.path === '/api/pharmacy/returns' && c.method === 'POST').length"), 1)
    const created = await evaluate("window.__calls.find(c => c.path === '/api/pharmacy/returns' && c.method === 'POST')")
    assert.equal(created.payload.medicineId, 7)
    assert.equal(created.payload.quantity, 3)
    assert.equal(created.headers.Authorization, 'Bearer browser-test-token')
    await click('Return History')
    await waitFor("document.querySelector('.pr-returns tbody')?.textContent.includes('Approved')")
    await click('New Return')
    const image = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    mkdirSync('artifacts', { recursive: true })
    writeFileSync('artifacts/pharmacist-medicine-returns.png', Buffer.from(image.data, 'base64'))
    await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
    await waitFor("document.querySelector('.pr-returns').getBoundingClientRect().width <= 390")
    assert.equal(await evaluate("document.querySelector('.pr-table-scroll').scrollWidth > document.querySelector('.pr-table-scroll').clientWidth"), true)
    await command('Emulation.setDeviceMetricsOverride', { width: 1640, height: 900, deviceScaleFactor: 1, mobile: false })
    await evaluate("document.querySelector('.pr-tabs a').click()")
    await waitFor("window.__stockReadsAfterCatalogue > 0 && [...document.querySelectorAll('tbody tr')].some(row => row.textContent.includes('Medicine A') && row.cells[10]?.textContent.trim() === '23')")
  } finally { socket?.close(); browser?.kill(); server.httpServer?.closeAllConnections(); await server.close() }
})
