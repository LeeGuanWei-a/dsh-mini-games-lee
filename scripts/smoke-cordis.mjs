// =============================================================================
// dsh-mini-games-lee — cordis_define payload verification.
//
// `plugin_manager install_bundle` is the primary install path, but the repo also
// ships dist/cordis-plugin.code.txt for profiles where the model-driven
// `cordis_define` tool is what is available. That payload is text with two
// delimited halves, so nothing else in the build would notice if the markers,
// the host body, or the trailing `return { inject, apply }` drifted.
//
// This evaluates the client half against real React exactly the way the dynamic
// runner does — as a function body with `React` supplied as a parameter — and
// asserts the two halves of dist/cordis-plugin.js agree with it.
//
// Run: node scripts/smoke-cordis.mjs
// =============================================================================

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as React from 'react'
import { inlineBody } from './inline.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fail = (msg) => { console.error('FAIL: ' + msg); process.exitCode = 1 }
const ok = (msg) => console.log('ok - ' + msg)

const codeTxt = readFileSync(join(root, 'dist/cordis-plugin.code.txt'), 'utf8')

// ------------------------------------------------------------------ delimiters
function section(text, open, close) {
  const start = text.indexOf(open)
  const end = text.indexOf(close)
  if (start < 0 || end < 0 || end < start) return null
  return text.slice(start + open.length, end)
}

const hostBody = section(codeTxt, '<<<HOST>>>', '<<<END HOST>>>')
const clientBody = section(codeTxt, '<<<CLIENT>>>', '<<<END CLIENT>>>')

if (hostBody === null) fail('code.txt is missing the <<<HOST>>> … <<<END HOST>>> section')
else {
  ok('code.txt carries a HOST section')
  if (!/export\s+function\s+apply/.test(hostBody)) fail('host half must export an apply function')
  else ok('host half exports apply')
}

if (clientBody === null) {
  fail('code.txt is missing the <<<CLIENT>>> … <<<END CLIENT>>> section')
} else {
  ok('code.txt carries a CLIENT section')
  if (!/return\s*\{\s*inject\s*,\s*apply\s*\}/.test(clientBody)) {
    fail('client half must end with `return { inject, apply }` for cordis_define')
  } else ok('client half returns { inject, apply }')

  // Evaluate the half as the dynamic runner does: a function body whose only
  // free name is React.
  let plugin = null
  try {
    plugin = new Function('React', clientBody)(React)
  } catch (err) {
    fail('client half threw while evaluating: ' + (err && err.message))
  }

  if (plugin) {
    if (typeof plugin.apply !== 'function') fail('evaluated client half has no apply')
    else ok('evaluated client half exposes apply')
    for (const dep of ['slots', 'timer']) {
      if (!Array.isArray(plugin.inject) || plugin.inject.indexOf(dep) < 0) {
        fail(`evaluated client half should inject ${dep}`)
      }
    }
    ok('evaluated client half inject = ' + JSON.stringify(plugin.inject))

    // Drive it once so a throw inside apply cannot hide behind a passing parse.
    const seen = []
    try {
      plugin.apply({
        get: (name) => (name === 'slots'
          ? { inject: (n, cb) => { cb(); return () => {} }, register: (o) => { seen.push(o); return () => {} } }
          : name === 'timer' ? { interval: () => () => {} } : undefined),
        effect: (fn) => { fn(); return () => {} }
      })
    } catch (err) {
      fail('evaluated apply(ctx) threw: ' + (err && err.message))
    }
    if (seen.length === 2) ok('evaluated apply registered 2 slots')
    else fail(`evaluated apply registered ${seen.length} slots, expected 2`)
  }
}

// ------------------------------------------------- dist/cordis-plugin.js parity
//
// All three artifacts are generated from one `inlineBody()` call, so the real
// invariant is that each still carries that exact flat body. Asserting against
// a freshly computed body is what catches a build that emitted a stale or
// partially-wrapped scope; comparing the artifacts only to each other would not.
const body = inlineBody()

const payload = await import(new URL('../dist/cordis-plugin.js', import.meta.url).href)
if (typeof payload.host !== 'string' || typeof payload.client !== 'string') {
  fail('dist/cordis-plugin.js must export string `host` and `client`')
} else {
  ok('dist/cordis-plugin.js exports host + client')
  if (hostBody !== null && payload.host.trim() !== hostBody.trim()) {
    fail('dist/cordis-plugin.js host half has drifted from code.txt')
  } else ok('payload host half matches code.txt')
  if (!payload.client.includes(body)) fail('dist/cordis-plugin.js client half does not carry the current flat body')
  else ok('payload client half carries the current flat body')
}

const artifactBodies = [['dist/client.js', readFileSync(join(root, 'dist/client.js'), 'utf8')]]
if (clientBody !== null) artifactBodies.push(['code.txt client half', clientBody])
for (const [label, text] of artifactBodies) {
  if (!text.includes(body)) fail(`${label} does not carry the current flat body`)
  else ok(`${label} carries the current flat body`)
}

console.log(process.exitCode ? '\nsmoke-cordis: FAILED' : '\nsmoke-cordis: all checks passed')
