// render-check.mjs — render every game with real React (react-dom/server).
//
// The host loads the browser half in a page we cannot reach from here, so this
// catches render-time errors (undefined helpers, bad element trees, hook misuse)
// by building the same inlined module scope that dist/client.js wraps and
// rendering: LaunchButton, every game View (dark + light), and MiniGamesWindow.
//
// Run: npm run render-check

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { root, inlineBody } from './inline.mjs'

const tmpDir = join(root, '.tmp')
mkdirSync(tmpDir, { recursive: true })
const tmpFile = join(tmpDir, 'render-module.mjs')

writeFileSync(tmpFile, [
  "import * as React from 'react'",
  inlineBody(),
  'export { GAMES, MiniGamesWindow, LaunchButton, THEMES, makeStore }'
].join('\n'))

const mod = await import(pathToFileURL(tmpFile).href)

let failures = 0
function check(label, fn) {
  try {
    const html = fn()
    if (typeof html !== 'string' || html.length === 0) throw new Error('empty output')
    console.log(`ok - ${label} (${html.length} chars)`)
  } catch (err) {
    failures++
    console.error(`FAIL - ${label}: ${err && err.message}`)
  }
}

const timer = { interval: () => () => {} }
const noop = () => {}
const store = mod.makeStore()

check('LaunchButton', () => renderToString(createElement(mod.LaunchButton, { store })))

for (const theme of ['dark', 'light']) {
  for (const game of mod.GAMES) {
    check(`${game.id} view [${theme}]`, () => renderToString(createElement(game.View, {
      timer,
      th: mod.THEMES[theme],
      store,
      active: true,
      onGameOver: noop,
      onOpenRank: noop
    })))
  }
}

check('MiniGamesWindow', () => renderToString(createElement(mod.MiniGamesWindow, { store, timer, games: mod.GAMES })))

console.log(failures ? `\nrender-check: ${failures} FAILED` : '\nrender-check: all views rendered')
process.exitCode = failures ? 1 : 0
