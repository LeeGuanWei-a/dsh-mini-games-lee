// =============================================================================
// dsh-mini-games-lee — one self-contained build for the bundle's two halves.
//
// The src/ tree is a "shared flat scope": modules reference each other's
// declarations without importing them. `scripts/inline.mjs` is the single
// authority on module order + import/export stripping, so every emitter below
// is guaranteed to agree on what the plugin's single scope contains.
//
// Emits (both under dist/, both packaged by `files`):
//
//   index.js   the host half — the module the Loader imports for the row that
//              cordis.patch.yml inserts. Pure UI plugins still need it: the row
//              must activate, and `plugin_manager` reports on that row.
//
//   client.js  the browser half in the module-table form `dsh-client-modules`
//              serves for a `dsh.client` package. This is what
//              exports["./client"] resolves to, i.e. the only artifact the page
//              ever loads.
//
// dsh 0.2.1 removed the model-driven `cordis_define` / `cordis_run` tools from
// `@deepseek-ai/dsh-tool-cordis` (it now exposes `cordis_inspect_list` and
// `cordis_inspect_query` only), so the bundle is the one supported install path
// and there is no delimited paste-in-text artifact to generate any more.
// Version 0.4.0 was the last release that shipped `cordis-plugin.code.txt`.
// =============================================================================

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { root, MODULES, inlineBody, packageName } from './inline.mjs'

const NAME = packageName()
const distDir = join(root, 'dist')
mkdirSync(distDir, { recursive: true })

const body = inlineBody()

// ---------------------------------------------------------------------------
// 0. dist/index.js — the HOST half.
//
// This is what the Loader imports for the row this bundle's patch inserts, so
// it must export `apply` (or a service class). It is a straight copy of
// src/index.js: the host half is a pure-UI no-op, and keeping one source file
// means the two can never disagree.
//
// exports["."] pointing at a combined {host, client} payload instead is what
// made `install_bundle` report "failed to import": that payload is a data
// artifact, not a plugin.
// ---------------------------------------------------------------------------
const hostEntry = readFileSync(join(root, 'src/index.js'), 'utf8')

// ---------------------------------------------------------------------------
// 1. dist/client.js — `window.__ModuleLoader__.load` bundle.
//
// The factory body mirrors what every shipped `@deepseek-ai/dsh-client-ui-*`
// package emits: declare the module/exports pair, take React from the platform
// module table, splice in the flat body, then hang `apply` and `inject` off the
// exports object. The Loader reads exactly those two names.
//
// `react` is one of the frozen platform-module seeds in dsh 0.2.1
// (react, react/jsx-runtime, react-dom, react-dom/client, @deepseek-ai/cordis,
// zod, @tanstack/react-virtual, @deepseek-ai/dsh-client-store,
// @deepseek-ai/dsh-client-ui-slots, @deepseek-ai/dsh-client-ui-primitives,
// @deepseek-ai/dsh-client-ui-dockkit), so it needs no `dsh.client.external`
// entry — that field is only for non-baseline requests.
// ---------------------------------------------------------------------------
const clientBundle = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(NAME)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
${body}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
`

writeFileSync(join(distDir, 'index.js'), hostEntry, 'utf8')
writeFileSync(join(distDir, 'client.js'), clientBundle, 'utf8')

console.log(`build-cordis: ${NAME} — ${MODULES.length} module(s) inlined`)
console.log(`build-cordis: wrote dist/index.js (${hostEntry.length}B) — the host half the Loader imports`)
console.log(`build-cordis: wrote dist/client.js (${clientBundle.length}B) — the ./client bundle`)
