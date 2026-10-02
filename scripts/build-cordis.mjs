// =============================================================================
// dsh-mini-games-lee — build the cordis_define payload from the flat-scope src/.
//
// The src/ tree is a "shared flat scope": modules reference each other's
// declarations without importing them. `scripts/inline.mjs` is the single
// authority on module order + import/export stripping, and it is also what the
// legacy `lib/` build and `render-check.mjs` consume — so all three can never
// drift apart.
//
// This script hands that flat body to the shared emitter, which wraps it as a
// cordis_define client half (`React` is the dsh closure's first parameter, so
// no shim is needed) and writes dist/cordis-plugin.{code.txt,js}.
// =============================================================================

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inlineBody, MODULES, packageName } from './inline.mjs'
import { emitCordisPayload } from '../../asar-extract/build-cordis-lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const scratchDir = join(projectRoot, '.tmp')
mkdirSync(scratchDir, { recursive: true })

// Materialize the flat body for inspection / debugging, then emit.
const bodyPath = join(scratchDir, 'cordis-client-body.js')
const body = inlineBody()
writeFileSync(bodyPath, body, 'utf8')

const result = emitCordisPayload({
  body,
  outDir: join(projectRoot, 'dist'),
  hostBody: 'export function apply() {}',
})

console.log(`build-cordis: ${packageName()} — ${MODULES.length} module(s) inlined`)
console.log(`build-cordis: flat body at ${bodyPath}`)
console.log(`build-cordis: wrote ${result.codePath}`)
console.log(`build-cordis: wrote ${result.payloadPath}`)
console.log(`build-cordis: host=${result.hostBytes}B, client=${result.clientBytes}B`)
