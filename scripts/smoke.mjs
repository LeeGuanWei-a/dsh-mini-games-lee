// smoke.mjs — offline sanity check for the built browser half.
//
// Mocks the two things the host provides at load time (window.__ModuleLoader__
// and require('react')), then asserts that lib/client.js loads, exports the
// plugin surface, and registers its slots through apply(ctx).
//
// Run: node scripts/smoke.mjs

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fail = (msg) => { console.error('FAIL: ' + msg); process.exitCode = 1 }
const ok = (msg) => console.log('ok - ' + msg)

// ---------------------------------------------------------------- game modules
const mods = ['tetris', 'snake', 'g2048', 'minesweeper'].map(async (name) => {
  const url = pathToFileURL(join(root, 'src/games', name + '.js')).href
  const m = await import(url)
  const key = Object.keys(m)[0]
  const game = m[key]
  if (!game) return fail(`${name}: no export`)
  for (const field of ['id', 'title', 'icon', 'scoreOrder', 'View']) {
    if (game[field] === undefined) fail(`${name}: missing ${field}`)
  }
  if (typeof game.View !== 'function') fail(`${name}: View is not a function`)
  if (game.scoreOrder !== 'asc' && game.scoreOrder !== 'desc') fail(`${name}: bad scoreOrder`)
  ok(`game module ${name} -> id=${game.id} order=${game.scoreOrder}`)
  return game
})
const games = await Promise.all(mods)

// ------------------------------------------------------------------ client.js
const code = readFileSync(join(root, 'lib/client.js'), 'utf8')
let def = null
const windowMock = { __ModuleLoader__: { load: (d) => { def = d } } }
const reactStub = { createElement: (type, props, ...kids) => ({ type, props, kids }) }
const requireMock = (id) => {
  if (id === 'react') return reactStub
  throw new Error('unexpected require: ' + id)
}

new Function('window', 'require', code)(windowMock, requireMock)
if (!def) fail('lib/client.js did not call window.__ModuleLoader__.load')
else ok(`ModuleLoader registration id=${def.id}`)

const exported = def.factory(requireMock)
if (typeof exported.apply !== 'function') fail('exports.apply missing')
else ok('exports.apply present')
if (!Array.isArray(exported.inject) || exported.inject.indexOf('timer') < 0) fail('exports.inject should include timer')
else ok('exports.inject = ' + JSON.stringify(exported.inject))

// ------------------------------------------------------------------ apply(ctx)
const registrations = []
const fakeSlots = {
  inject: (name, cb) => { cb() },
  register: (options) => { registrations.push(options); return () => {} }
}
const ctx = { get: (name) => (name === 'slots' ? fakeSlots : undefined) }
try {
  exported.apply(ctx)
} catch (err) {
  fail('apply(ctx) threw: ' + (err && err.message))
}
const names = registrations.map(r => r.name)
for (const want of ['conversation.session.header.utilities', 'shell.overlay']) {
  if (names.indexOf(want) < 0) fail('slot not registered: ' + want)
  else ok('registered slot ' + want)
}
const overlay = registrations.filter(r => r.name === 'shell.overlay')[0]
const launcher = registrations.filter(r => r.name === 'conversation.session.header.utilities')[0]
if (overlay && overlay.id !== 'minigames-window') fail('overlay id = ' + (overlay && overlay.id))
if (launcher && launcher.id !== 'minigames-launch') fail('launcher id = ' + (launcher && launcher.id))

// games roster count (declared in src/client.js)
const src = readFileSync(join(root, 'src/client.js'), 'utf8')
const roster = (src.match(/const GAMES = \[(.*?)\]/s) || [])[1] || ''
const rosterCount = roster.split(',').filter(s => s.trim()).length
if (rosterCount !== games.length) fail(`roster has ${rosterCount} games but ${games.length} modules checked`)
else ok(`roster contains ${rosterCount} games`)

console.log(process.exitCode ? '\nsmoke: FAILED' : '\nsmoke: all checks passed')
