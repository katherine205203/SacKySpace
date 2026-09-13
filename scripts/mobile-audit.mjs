import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const browser = resolve(root, 'node_modules/.bin/agent-browser')
const baseUrl = process.env.MOBILE_AUDIT_BASE_URL ?? 'http://127.0.0.1:5173'
const namespace = 'sacky-mobile-audit'
const session = 'mobile-audit'
const initScript = resolve(root, 'artifacts/mobile-audit/audit-init.js')
const artifactRoot = resolve(root, 'artifacts/mobile-audit')
const widths = [320, 360, 390, 430]
const routes = [
  ['home', '/'],
  ['checkin', '/checkin'],
  ['checkin-emotion', '/checkin/emotion'],
  ['checkin-unknown', '/checkin/unknown'],
  ['checkin-secondary', '/checkin/secondary-emotions'],
  ['checkin-needs', '/checkin/needs'],
  ['checkin-contexts', '/checkin/contexts'],
  ['checkin-review', '/checkin/review'],
  ['checkin-history', '/checkin/history'],
  ['diary', '/diary'],
  ['diary-editor', '/diary?view=editor'],
  ['diary-read', '/diary?view=read'],
  ['diary-history', '/diary?view=history'],
  ['journey', '/journey'],
  ['journey-setup', '/journey?view=setup'],
  ['action-space', '/action-space'],
  ['action-history', '/action-space?view=history&lens=timeline'],
  ['future-letter', '/future-letter'],
  ['future-letter-write', '/future-letter?view=write'],
  ['future-letter-trigger', '/future-letter?view=trigger'],
  ['future-letter-decorate', '/future-letter?view=decorate'],
  ['future-letter-preview', '/future-letter?view=preview'],
  ['future-letter-history', '/future-letter?view=history'],
  ['gift', '/gift-for-tmr'],
  ['gift-history', '/gift-for-tmr?view=history'],
  ['more', '/more'],
]

const run = (args) => execFileSync(browser, ['--namespace', namespace, '--session', session, ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const decodeEval = (output) => {
  const line = output.trim().split('\n').at(-1) ?? '{}'
  try {
    const first = JSON.parse(line)
    return typeof first === 'string' ? JSON.parse(first) : first
  } catch {
    return { error: output.trim() }
  }
}

mkdirSync(artifactRoot, { recursive: true })
run(['--init-script', initScript, 'open', `${baseUrl}/`])
run(['wait', '--load', 'networkidle'])

const metrics = []
for (const [name, route] of routes) {
  for (const width of widths) {
    const height = width === 320 || width === 360 ? 760 : width === 390 ? 844 : 932
    const dir = resolve(artifactRoot, name)
    mkdirSync(dir, { recursive: true })
    run(['open', `${baseUrl}${route}`])
    run(['wait', 250])
    run(['set', 'viewport', String(width), String(height)])
    run(['wait', 150])
    const screenshot = resolve(dir, `${width}.png`)
    run(['screenshot', '--full', screenshot])
    const raw = run(['eval', `JSON.stringify((() => {
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      const all = [...document.querySelectorAll('*')]
      const rect = (element) => element.getBoundingClientRect()
      const overflows = all.filter((element) => { const r = rect(element); return r.width > viewport.width + 1 || r.left < -1 || r.right > viewport.width + 1 }).slice(0, 25).map((element) => ({ tag: element.tagName, className: String(element.className || '').slice(0, 100), left: Math.round(rect(element).left), right: Math.round(rect(element).right), width: Math.round(rect(element).width) }))
      const controls = [...document.querySelectorAll('button, a, input, select, textarea')].map((element) => { const r = rect(element); return { tag: element.tagName, label: String(element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 80), width: Math.round(r.width), height: Math.round(r.height), horizontallyOffscreen: r.left < -1 || r.right > viewport.width + 1, belowViewport: r.top > viewport.height + 1 } })
      return { route: ${JSON.stringify(route)}, width: viewport.width, height: viewport.height, documentScrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > viewport.width + 1, overflows, undersizedControls: controls.filter((control) => control.width > 0 && (control.width < 40 || control.height < 40)), horizontallyOffscreenControls: controls.filter((control) => control.horizontallyOffscreen), belowViewportControls: controls.filter((control) => control.belowViewport), bodyText: document.body.innerText.trim().slice(0, 240) }
    })())`])
    metrics.push({ name, width, screenshot: screenshot.replace(`${root}/`, ''), ...decodeEval(raw) })
  }
}

writeFileSync(resolve(artifactRoot, 'metrics.json'), JSON.stringify(metrics, null, 2))
run(['close'])
console.log(`Mobile audit captured ${metrics.length} route/viewport combinations under ${artifactRoot}`)
