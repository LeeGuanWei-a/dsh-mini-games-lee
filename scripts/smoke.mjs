// smoke.mjs — offline sanity check for the built browser half and the manifest.
//
// The browser half is the artifact the Client Loader actually mounts, so this
// test loads dist/client.js exactly the way the page does: a fake
// `window.__ModuleLoader__` captures the registration, the factory is invoked
// with a stubbed `require` (react is the only platform module we ask for), and
// the returned plugin is driven through apply(ctx) with fake slots/timer
// services. That is the whole load path short of a real browser.
//
// The tail of the file checks the bundle manifest `plugin_manager` reads:
// dsh.bundle.patch, dsh.client, exports["./client"], icon and locale metadata.
//
// Run: node scripts/smoke.mjs

import { readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fail = (msg) => { console.error('FAIL: ' + msg); process.exitCode = 1 }
const ok = (msg) => console.log('ok - ' + msg)

// Slots this plugin must occupy. Kept in one place so the assertion and the
// message can never disagree.
const EXPECTED = [
  { name: 'conversation.session.header.utilities', id: 'minigames-launch' },
  { name: 'shell.overlay', id: 'minigames-window' }
]

// ---------------------------------------------------------------- game modules
const games = await Promise.all(['tetris', 'snake', 'g2048', 'minesweeper'].map(async (name) => {
  const url = pathToFileURL(join(root, 'src/games', name + '.js')).href
  const m = await import(url)
  const key = Object.keys(m)[0]
  const game = m[key]
  if (!game) { fail(`${name}: no export`); return null }
  for (const field of ['id', 'title', 'icon', 'scoreOrder', 'View']) {
    if (game[field] === undefined) fail(`${name}: missing ${field}`)
  }
  if (typeof game.View !== 'function') fail(`${name}: View is not a function`)
  if (game.scoreOrder !== 'asc' && game.scoreOrder !== 'desc') fail(`${name}: bad scoreOrder`)
  ok(`game module ${name} -> id=${game.id} order=${game.scoreOrder}`)
  return game
}))

// ---------------------------------------------------------------- dist/client.js
const code = readFileSync(join(root, 'dist/client.js'), 'utf8')
let def = null
const windowMock = { __ModuleLoader__: { load: (d) => { def = d } } }
const reactStub = { createElement: (type, props, ...kids) => ({ type, props, kids }) }
const requireMock = (id) => {
  if (id === 'react') return reactStub
  throw new Error('unexpected require: ' + id)
}

new Function('window', code)(windowMock)
if (!def) fail('dist/client.js did not call window.__ModuleLoader__.load')
else ok(`ModuleLoader registration id=${def.id}`)

if (def && def.id !== 'dsh-mini-games-lee') fail('module id must equal the package name, got ' + def.id)

const exported = def.factory(requireMock)
if (typeof exported.apply !== 'function') fail('exports.apply missing')
else ok('exports.apply present')
for (const dep of ['slots', 'timer']) {
  if (!Array.isArray(exported.inject) || exported.inject.indexOf(dep) < 0) fail(`exports.inject should include ${dep}`)
}
ok('exports.inject = ' + JSON.stringify(exported.inject))

// ------------------------------------------------------------------ apply(ctx)
const registrations = []
const disposers = []
const fakeSlots = {
  inject: (name, cb) => { cb(); return () => {} },
  register: (options) => { registrations.push(options); return () => {} }
}
const fakeTimer = { interval: () => () => {} }
const ctx = {
  get: (name) => (name === 'slots' ? fakeSlots : name === 'timer' ? fakeTimer : undefined),
  effect: (fn) => { const d = fn(); if (typeof d === 'function') disposers.push(d); return () => {} }
}
try {
  exported.apply(ctx)
} catch (err) {
  fail('apply(ctx) threw: ' + (err && err.message))
}

const names = registrations.map(r => r.name)
for (const want of EXPECTED) {
  if (names.indexOf(want.name) < 0) { fail('slot not registered: ' + want.name); continue }
  ok('registered slot ' + want.name)
  const entry = registrations.filter(r => r.name === want.name)[0]
  if (entry && entry.id !== want.id) fail(`${want.name} id = ${entry && entry.id}, expected ${want.id}`)
}
if (disposers.length !== EXPECTED.length) {
  fail(`apply should hand back ${EXPECTED.length} disposers via ctx.effect, got ${disposers.length}`)
} else ok(`apply registered ${disposers.length} disposable effects`)

// A host without the timer service must stay inert rather than throw.
const bareRegistrations = []
try {
  exported.apply({
    get: (name) => (name === 'slots' ? { inject: (n, cb) => cb(), register: (o) => { bareRegistrations.push(o); return () => {} } } : undefined),
    effect: (fn) => { fn(); return () => {} }
  })
  if (bareRegistrations.length !== 0) fail('apply registered slots without a timer service')
  else ok('apply stays inert when the timer service is absent')
} catch (err) {
  fail('apply threw without a timer service: ' + (err && err.message))
}

// games roster count (declared in src/client.js)
const src = readFileSync(join(root, 'src/client.js'), 'utf8')
const roster = (src.match(/const GAMES = \[(.*?)\]/s) || [])[1] || ''
const rosterCount = roster.split(',').filter(s => s.trim()).length
if (rosterCount !== games.length) fail(`roster has ${rosterCount} games but ${games.length} modules checked`)
else ok(`roster contains ${rosterCount} games`)

// ------------------------------------------------- bundle manifest (dsh 0.2.1)
//
// `plugin_manager` reads exactly these fields: dsh.bundle.patch for the layer,
// dsh.client for the browser roster, exports["./client"] for the served bundle,
// and icon + locale for the card. A plugin that passes the load path above can
// still be un-installable if any of them drifts, so assert them here too.
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

if (pkg.name !== 'dsh-mini-games-lee') fail(`package name is ${pkg.name}`)
if (pkg.main !== 'dist/index.js') fail(`main is ${pkg.main}, expected dist/index.js`)
else if (!readFileSync(join(root, 'dist/index.js'), 'utf8').includes('export function apply')) {
  fail('dist/index.js does not export apply')
} else ok('host half: main -> dist/index.js exporting apply')

if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') fail('dsh.bundle.patch is missing or moved')
else {
  const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
  const row = new RegExp(`-\\s+insert:\\s*\\n\\s+-\\s+id:\\s*${pkg.name}\\s*\\n\\s+name:\\s*${pkg.name}\\b`)
  if (!row.test(patch)) fail(`cordis.patch.yml does not insert a row named ${pkg.name}`)
  else ok(`bundle patch inserts row "${pkg.name}" by bare package name`)
}

const client = pkg.dsh?.client
if (client?.platform !== 'web') fail(`dsh.client.platform is ${client?.platform}, expected "web"`)
else if (client.immediately !== true) fail('dsh.client.immediately must be true for boot-time activation')
else if (!Array.isArray(client.inject) || client.inject.length === 0) fail('dsh.client.inject must list the package rows we load after')
else if (pkg.exports?.['./client']?.default !== './dist/client.js') fail('exports["./client"] must resolve to ./dist/client.js')
else ok(`browser half: platform=web immediately=true inject=${client.inject.length} -> dist/client.js`)

if (pkg.exports?.['./payload'] !== undefined) {
  fail('exports["./payload"] is a leftover from the removed cordis_define path')
}

const releases = pkg.dsh?.compatibility?.dshReleases ?? {}
if (!Object.prototype.hasOwnProperty.call(releases, '0.2.1-rc.2')) {
  fail('dsh.compatibility.dshReleases no longer claims 0.2.1-rc.2')
} else ok(`compatibility: ${Object.keys(releases).join(', ')}`)

for (const lang of ['en', 'zh']) {
  let dict
  try { dict = JSON.parse(readFileSync(join(root, 'locale', `${lang}.json`), 'utf8')) } catch (err) {
    fail(`locale/${lang}.json is unreadable: ${err.message}`)
    continue
  }
  if (!dict.meta?.title || !dict.meta?.description) fail(`locale/${lang}.json must carry meta.title and meta.description`)
  else ok(`locale/${lang}.json: "${dict.meta.title}"`)
}

const icon = join(root, 'icon.svg')
if (!existsSync(icon)) fail('icon.svg is missing (Plugin Manager card icon)')
else if (statSync(icon).size > 256 * 1024) fail('icon.svg exceeds the 256 KiB metadata limit')
else ok('icon: icon.svg within the 256 KiB limit')

console.log(process.exitCode ? '\nsmoke: FAILED' : '\nsmoke: all checks passed')
