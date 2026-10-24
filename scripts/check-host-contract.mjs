// =============================================================================
// dsh-mini-games-lee — host-contract check against an installed DSH.
//
// smoke.mjs proves the browser half registers what *this repo* expects. This
// script proves the *host* still provides those things, which is the part that
// silently changes between DSH releases:
//
//   - the two slot names, and their kind/scope
//       conversation.session.header.utilities   list (session)
//       shell.overlay                           list (root)
//   - the `timer` service (board clocks run through timer.interval)
//   - `react` as a platform-module seed (the only require() the bundle makes)
//   - every package named in `dsh.client.inject`
//
// Point it at the installed app's app.asar, or at a directory that holds the
// `@deepseek-ai/*` packages (a checkout's node_modules):
//
//   node scripts/check-host-contract.mjs --asar "E:\…\resources\app.asar"
//   node scripts/check-host-contract.mjs --dsh-root <dir-with-@deepseek-ai>
//   DSH_ASAR=… node scripts/check-host-contract.mjs
//
// With no target it prints a SKIP and exits 0, so `npm run check:host` is safe
// to run anywhere.
// =============================================================================

import { openSync, readSync, closeSync, readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const fail = (msg) => { console.error('FAIL: ' + msg); process.exitCode = 1 }
const ok = (msg) => console.log('ok - ' + msg)
const skip = (msg) => console.log('skip - ' + msg)

// ------------------------------------------------------------------ arguments
function argValue(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const asarPath = argValue('--asar') ?? process.env.DSH_ASAR
const dshRoot = argValue('--dsh-root') ?? process.env.DSH_HOST_PACKAGES

// ------------------------------------------------------------------- accessors
// The installed desktop app keeps its runtime in app.asar, which Node cannot
// read directly; the archive is a 16-byte header plus a JSON directory plus the
// concatenated file bodies. This reader handles exactly that layout — the same
// one @electron/asar writes.
function openAsar(path) {
  const fd = openSync(path, 'r')
  const head = Buffer.alloc(16)
  readSync(fd, head, 0, 16, 0)
  const jsonLength = head.readUInt32LE(12)
  const headerBuf = Buffer.alloc(jsonLength)
  readSync(fd, headerBuf, 0, jsonLength, 16)
  const header = JSON.parse(headerBuf.toString('utf8'))
  const dataStart = 16 + jsonLength

  const find = (parts) => {
    let node = header
    for (const part of parts) {
      const files = node?.files
      if (!files) return undefined
      let next = files[part]
      if (!next) {
        const match = Object.keys(files).find((key) => key.toLowerCase() === part.toLowerCase())
        if (!match) return undefined
        next = files[match]
      }
      node = next
    }
    return node
  }

  const read = (parts) => {
    const node = find(parts)
    if (!node || node.files || typeof node.size !== 'number' || typeof node.offset !== 'string') return undefined
    const buf = Buffer.alloc(node.size)
    readSync(fd, buf, 0, node.size, dataStart + Number(node.offset))
    return buf.toString('utf8')
  }

  return { read, list: (parts) => Object.keys(find(parts)?.files ?? {}), close: () => closeSync(fd) }
}

function directoryReader(baseDir) {
  const read = (parts) => {
    const file = join(baseDir, ...parts)
    try { return statSync(file).isFile() ? readFileSync(file, 'utf8') : undefined } catch { return undefined }
  }
  return {
    read,
    list: (parts) => {
      try { return readdirSync(join(baseDir, ...parts)) } catch { return [] }
    },
    close: () => {}
  }
}

// DSH packages sit under app.asar's dsh/node_modules; a plain checkout puts them
// under node_modules. Package names arrive scope-qualified (`@scope/name`), so
// split them back into path segments.
const pkgParts = (pkg) => pkg.split('/')
let host
let label
if (asarPath && existsSync(asarPath)) {
  const asar = openAsar(asarPath)
  host = {
    readPackageFile: (pkg, file) => asar.read(['dsh', 'node_modules', ...pkgParts(pkg), ...file.split('/')]),
    listAssets: (pkg, dir) => asar.list(['dsh', 'node_modules', ...pkgParts(pkg), ...dir.split('/')]),
    close: () => asar.close()
  }
  label = asarPath
} else if (dshRoot && existsSync(dshRoot)) {
  const dir = directoryReader(dshRoot)
  host = {
    readPackageFile: (pkg, file) => dir.read([...pkgParts(pkg), ...file.split('/')]),
    listAssets: (pkg, dirName) => dir.list([...pkgParts(pkg), ...dirName.split('/')]),
    close: () => dir.close()
  }
  label = dshRoot
} else {
  skip('no DSH installation given: pass --asar <app.asar>, --dsh-root <dir> or set DSH_ASAR')
  process.exit(process.exitCode ?? 0)
}

const pkgJson = (pkg) => {
  const text = host.readPackageFile(pkg, 'package.json')
  if (!text) return undefined
  try { return JSON.parse(text) } catch { return undefined }
}

// --------------------------------------------------------------- runtime version
const runtime = pkgJson('@deepseek-ai/dsh')
if (!runtime?.version) fail('could not read @deepseek-ai/dsh/package.json from ' + label)
else ok(`host runtime: @deepseek-ai/dsh ${runtime.version} (${label})`)

// ----------------------------------------------------------------- slot contract
const expectedSlots = [
  {
    pkg: '@deepseek-ai/dsh-client-ui-conversation',
    file: 'lib/client.js',
    slot: 'conversation.session.header.utilities',
    kind: 'list',
    scope: 'session'
  },
  {
    pkg: '@deepseek-ai/dsh-client-ui-layout',
    file: 'lib/client.js',
    slot: 'shell.overlay',
    kind: 'list',
    scope: 'root'
  }
]

// Read one slot's declared kind/scope out of a JS bundle. The declaration is a
// literal object (`"name": { kind: "list", scope: "root" }`), but a release may
// add fields or reorder them, so look inside the object body instead of
// assuming adjacency.
const slotDeclaration = (source, name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const head = source.match(new RegExp(`"${escaped}"\\s*:\\s*\\{`))
  if (!head) return undefined
  const body = source.slice(head.index, head.index + 240)
  const kind = body.match(/kind:\s*"(\w+)"/)
  const scope = body.match(/scope:\s*"(\w+)"/)
  return kind && scope ? { kind: kind[1], scope: scope[1] } : undefined
}

for (const want of expectedSlots) {
  const source = host.readPackageFile(want.pkg, want.file)
  if (!source) { fail(`cannot read ${want.pkg}/${want.file} — package renamed or dropped?`); continue }
  const declared = slotDeclaration(source, want.slot)
  if (!declared) { fail(`${want.pkg} no longer declares slot "${want.slot}"`); continue }
  if (declared.kind !== want.kind || declared.scope !== want.scope) {
    fail(`slot "${want.slot}" is ${declared.kind}/${declared.scope}, plugin registers assuming ${want.kind}/${want.scope}`)
    continue
  }
  ok(`slot "${want.slot}" declared ${declared.kind}/${declared.scope} in ${want.pkg}`)
}

// ---------------------------------------------------------------- timer service
const timerSource = host.readPackageFile('@deepseek-ai/cordis-plugin-timer', 'lib/index.js')
if (!timerSource) fail('cannot read @deepseek-ai/cordis-plugin-timer/lib/index.js')
else if (!/super\(ctx,\s*"timer"\)/.test(timerSource) || !/interval\(/.test(timerSource)) {
  fail('cordis-plugin-timer no longer provides the "timer" service with interval()')
} else ok('service "timer" (interval/timeout/…) provided by cordis-plugin-timer')

// ------------------------------------------------------------ platform modules
// The frozen seed table lives in the built shell bundle. Its presence is what
// lets `require("react")` resolve inside the plugin factory without a
// dsh.client.external declaration.
const frontendAssets = host.listAssets('@deepseek-ai/dsh-web-frontend', 'dist/assets')
const shellBundle = frontendAssets.find((name) => /^index-.*\.js$/.test(name))
const shellSource = shellBundle
  ? host.readPackageFile('@deepseek-ai/dsh-web-frontend', `dist/assets/${shellBundle}`)
  : undefined
if (!shellSource) fail('cannot read the web shell bundle to inspect the platform-module seed table')
// The built shell is minified, so the seed table's key may or may not be quoted
// (`{react:x,"react/jsx-runtime":y,…}`). Accept both spellings.
else if (!/[{,]\s*"?react"?\s*:\s*[\w$]/.test(shellSource)) fail('the platform-module seed table no longer exposes "react"')
else ok('platform-module seed table exposes "react"')

// ------------------------------------------------------ dsh.client.inject names
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const inject = manifest.dsh?.client?.inject ?? []
for (const name of inject) {
  const pkg = pkgJson(name)
  if (!pkg) fail(`dsh.client.inject names ${name}, which is not installed in this host`)
  else ok(`dsh.client.inject ${name} present (${pkg.version})`)
}

// ------------------------------------------------------------ manifest sanity
if (manifest.dsh?.client?.platform !== 'web') fail(`dsh.client.platform is ${manifest.dsh?.client?.platform}, expected "web"`)
if (manifest.dsh?.client?.immediately !== true) fail('dsh.client.immediately must be true for boot-time activation')
if (manifest.main !== 'dist/index.js') fail(`main is ${manifest.main}, expected dist/index.js`)
const built = ['dist/index.js', 'dist/client.js'].map((rel) => [rel, existsSync(new URL(`../${rel}`, import.meta.url))])
for (const [rel, present] of built) {
  if (!present) fail(`${rel} is missing — run \`npm run build\``)
}
if (built.every(([, present]) => present)) ok('manifest: main + exports["./client"] point at built halves')

host.close()
console.log(process.exitCode ? '\ncheck-host-contract: FAILED' : '\ncheck-host-contract: all checks passed')
