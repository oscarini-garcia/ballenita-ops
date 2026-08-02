import { chromium } from 'playwright'
const D = '/tmp/claude-0/-home-user-ballenita-ops/e1722585-36f0-586e-86e5-99c4754a6974/scratchpad/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
p.on('pageerror', (e) => console.log('ERROR:', String(e).slice(0, 300)))
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle' })
await p.getByText(/Cargar ejemplo/).click(); await p.waitForTimeout(1200)
await p.getByRole('button', { name: /Ajustes/ }).last().click(); await p.waitForTimeout(500)
await p.getByText('El grupo', { exact: true }).click(); await p.waitForTimeout(400)
await p.locator('.pastilla').first().click(); await p.waitForTimeout(400)
await p.screenshot({ path: D + 'h-hoja.png' })
await p.locator('.modal-bg').click({ position: { x: 195, y: 40 } }); await p.waitForTimeout(300)
// La ficha entera, rodando hasta el final para ver Sueltos y el botón.
await p.locator('.btn.block').last().scrollIntoViewIfNeeded(); await p.waitForTimeout(300)
await p.screenshot({ path: D + 'h-final.png' })
