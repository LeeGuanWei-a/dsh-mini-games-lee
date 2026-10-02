// =============================================================================
// dsh-mini-games-lee — cordis payload verification.
//
// Runs the shared REAL-RENDER test: it evaluates dist/cordis-plugin.code.txt
// against the dsh client closure surface (React is the first parameter), then
// renders every registered component with actual react-dom/server. That catches
// runtime faults the register-only check could not — e.g. an `el is not
// defined` or `useStore is not defined` thrown while rendering.
//
// It also asserts the expected slot:id registrations are present.
// =============================================================================

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const shared = join(__dirname, '..', '..', 'asar-extract', 'render-cordis-shared.mjs')

const result = spawnSync(process.execPath, [
  shared,
  join(projectRoot, 'dist'),
  'conversation.session.header.utilities:minigames-launch',
  'shell.overlay:minigames-window',
  '--project', projectRoot
], { stdio: 'inherit' })

process.exit(result.status ?? 1)
