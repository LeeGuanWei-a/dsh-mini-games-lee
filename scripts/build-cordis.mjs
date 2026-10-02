// =============================================================================
// dsh-mini-games-lee — thin wrapper around the shared cordis_define builder.
// Bundles src/client.js into a single async-function body that dsh 0.2.0-rc.2+
// can run as the client half of a dynamic Plugin via `cordis_define`.
// =============================================================================

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const sharedBuilder = join(__dirname, '..', '..', 'asar-extract', 'build-cordis-shared.mjs')

const result = spawnSync(process.execPath, [
  sharedBuilder,
  join(projectRoot, 'src', 'client.js'),
  join(projectRoot, 'dist'),
  // HOST body: pure-UI plugin — empty apply so the row activates in the host
  // composition / Loader, so the client half has something to be loaded against.
  'export function apply() {}'
], { stdio: 'inherit' })

process.exit(result.status ?? 0)
