// inline.mjs — the one place that knows how src/ maps into a single scope.
//
// Both build-lib.mjs (ModuleLoader browser half) and render-check.mjs (real
// React render test) consume this, so they can never drift apart.
//
// Conventions accepted here:
//   import ... from 'react'        -> dropped (caller provides React)
//   import { a, b } from './x.js'  -> dropped (all modules share one scope)
//   export const/function          -> const/function
// Module order matters: dependencies first (shared -> games -> entry).

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export const MODULES = [
  'src/shared/theme.js',
  'src/shared/records.js',
  'src/shared/store.js',
  'src/shared/ui.js',
  'src/games/tetris.js',
  'src/games/snake.js',
  'src/games/g2048.js',
  'src/games/minesweeper.js',
  'src/client.js'
]

function strip(text) {
  return text
    .split('\n')
    .filter(line => !/^\s*import\b.*\bfrom\b.*$/.test(line))
    .map(line => line.replace(/^export\s+/, ''))
    .join('\n')
}

export function inlineBody() {
  return MODULES
    .map(rel => '\n// ── ' + rel + ' ──\n' + strip(readFileSync(join(root, rel), 'utf8')))
    .join('\n')
}

export function packageName() {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name
}
