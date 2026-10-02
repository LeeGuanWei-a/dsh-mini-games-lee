// =============================================================================
// dsh-mini-games-lee — thin wrapper around the shared cordis smoke test.
// =============================================================================

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const shared = join(__dirname, '..', '..', 'asar-extract', 'smoke-cordis-shared.mjs')

const result = spawnSync(process.execPath, [
  shared,
  join(projectRoot, 'dist'),
  'conversation.session.header.utilities:minigames-launch',
  'shell.overlay:minigames-window'
], { stdio: 'inherit' })

process.exit(result.status ?? 0)
