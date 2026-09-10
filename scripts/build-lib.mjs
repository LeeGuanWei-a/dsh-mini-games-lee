// build-lib.mjs — emit host-loadable lib/ artifacts from the readable src/ tree.
//
//   lib/index.js   — node half (plain ESM, empty apply)
//   lib/client.js  — browser half: all modules inlined into the single-scope
//                    window.__ModuleLoader__.load registration form that the
//                    vendored cordis Loader consumes for `dsh.client` packages.
//
// Run `npm run build` after editing src/, then commit lib/.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { root, MODULES, inlineBody, packageName } from './inline.mjs'

const NAME = packageName()

const out = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(NAME)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
${inlineBody()}
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});
`

mkdirSync(join(root, 'lib'), { recursive: true })
writeFileSync(join(root, 'lib/index.js'), readFileSync(join(root, 'src/index.js'), 'utf8'))
writeFileSync(join(root, 'lib/client.js'), out)
console.log(`built lib/index.js + lib/client.js for ${NAME} (${MODULES.length} modules inlined)`)
