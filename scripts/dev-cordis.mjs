// =============================================================================
// dsh-mini-games-lee — thin wrapper around the shared cordis dev server.
// =============================================================================

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const shared = join(__dirname, '..', '..', 'asar-extract', 'dev-cordis-shared.mjs')

const result = spawnSync(process.execPath, [
  shared,
  join(projectRoot, 'dist'),
  'dsh-mini-games-lee'
], { stdio: 'inherit' })

process.exit(result.status ?? 0)
