// =============================================================================
// dsh-mini-games-lee — standalone browser preview.
//
// The real host loads the browser half inside the Harness Web shell, which is
// not reachable from a terminal. This serves a minimal stand-in shell so you can
// play all four games against the *actual* built artifact:
//
//   node scripts/dev-cordis.mjs [--port 5188]
//
// What it stands in for, and nothing more:
//   - window.__ModuleLoader__.load()  → captures the registration, runs the
//                                       factory with react from the module table
//   - ctx.get('slots' / 'timer')      → a two-slot registry plus real timers
//   - sidebar.footer.action           → the strip at the sidebar foot
//   - shell.overlay                   → the floating layer above the page
//
// React and ReactDOM come from this package's own node_modules UMD builds, so
// what renders here is the same code path the page runs.
//
// (This script used to shell out to a shared helper in a sibling `asar-extract`
// checkout that no longer exists, which is why it silently stopped working.)
// =============================================================================

import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const portArg = process.argv.indexOf('--port')
const PORT = portArg >= 0 ? Number(process.argv[portArg + 1]) : Number(process.env.PORT || 5188)

function readFirst(candidates) {
  for (const rel of candidates) {
    try { return readFileSync(join(root, rel), 'utf8') } catch { /* try next */ }
  }
  throw new Error('none of these exist: ' + candidates.join(', '))
}

const VENDOR = {
  '/vendor/react.js': ['node_modules/react/umd/react.development.js'],
  '/vendor/react-dom.js': ['node_modules/react-dom/umd/react-dom.development.js']
}

const PAGE = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>${pkg.name} — preview</title>
<style>
  html,body { margin:0; height:100%; font-family: system-ui, sans-serif; }
  body { background:#0f172a; color:#e2e8f0; }
  #shell { display:flex; height:100%; }
  #sidebar { width:260px; border-right:1px solid rgba(148,163,184,.28); display:flex; flex-direction:column; padding:12px; box-sizing:border-box; }
  #sidebar h1 { font-size:13px; opacity:.6; font-weight:600; margin:0 0 10px; }
  #sidebar .spacer { flex:1 }
  #sidebar-footer { display:flex; align-items:center; gap:6px; border-top:1px solid rgba(148,163,184,.28); padding-top:10px; }
  #sidebar-footer .label { font-size:13px; opacity:.7 }
  #main { flex:1; padding:28px; box-sizing:border-box; }
  #main h2 { margin:0 0 6px; font-size:18px; }
  #main p { opacity:.65; font-size:13px; line-height:1.6; max-width:60ch }
  #boot-error { color:#f87171; font-size:13px; white-space:pre-wrap; }
</style>
</head>
<body>
<div id="shell">
  <div id="sidebar">
    <h1>DeepSeek Harness（预览替身）</h1>
    <div class="spacer"></div>
    <div id="sidebar-footer"><span class="label">设置</span><span id="slot-footer"></span></div>
  </div>
  <div id="main">
    <h2>小游戏合集 · 预览</h2>
    <p>这是 ${pkg.name} 浏览器半区的本地替身外壳：侧栏底部应出现 🎮 入口，页面中央应出现可拖动的毛玻璃游戏窗口。真实 DSH 中的槽位渲染与主题由宿主负责，这里只验证插件自身的注册与渲染。</p>
    <div id="boot-error"></div>
  </div>
</div>
<div id="slot-overlay"></div>

<script src="/vendor/react.js"></script>
<script src="/vendor/react-dom.js"></script>
<script>
(function () {
  var registrations = [];
  var root = null;

  // ── the two services the plugin asks for ────────────────────────────────
  var slots = {
    inject: function (key, callback) { callback(); return function () {}; },
    register: function (options, factory) {
      registrations.push({ options: options, factory: factory });
      render();
      return function () {};
    }
  };
  var timer = {
    interval: function (fn, ms) {
      var id = setInterval(fn, ms);
      return function () { clearInterval(id); };
    }
  };

  var ctx = {
    get: function (name) {
      if (name === 'slots') return slots;
      if (name === 'timer') return timer;
      return undefined;
    },
    effect: function (fn) { var d = fn(); return typeof d === 'function' ? d : function () {}; }
  };

  // ── the module table ────────────────────────────────────────────────────
  window.__ModuleLoader__ = {
    load: function (definition) {
      try {
        var plugin = definition.factory(function (spec) {
          if (spec === 'react') return window.React;
          throw new Error('preview: unknown module "' + spec + '"');
        });
        plugin.apply(ctx);
      } catch (err) {
        document.getElementById('boot-error').textContent = 'load failed: ' + (err && err.message) + '\\n' + (err && err.stack || '');
        throw err;
      }
    }
  };

  function Host(props) {
    return props.children === undefined ? null : props.children;
  }

  function render() {
    var byKey = {};
    registrations.forEach(function (r) { if (!byKey[r.options.name]) byKey[r.options.name] = []; byKey[r.options.name].push(r); });

    function mount(hostId) {
      var host = document.getElementById(hostId);
      if (!host) return;
      var entries = byKey[hostId] || [];
      var children = entries.map(function (r) {
        return React.createElement(Host, { key: r.options.id }, r.factory());
      });
      ReactDOM.createRoot(host).render(React.createElement(React.Fragment, null, children));
    }
    mount('slot-footer');
    mount('slot-overlay');
  }
})();
</script>
<script src="/client.js"></script>
</body>
</html>
`

const server = createServer((req, res) => {
  const path = (req.url || '/').split('?')[0]
  const send = (type, body) => { res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body) }
  try {
    if (path === '/' || path === '/index.html') return send('text/html; charset=utf-8', PAGE)
    if (path === '/client.js') return send('text/javascript; charset=utf-8', readFileSync(join(root, 'dist/client.js'), 'utf8'))
    if (VENDOR[path]) return send('text/javascript; charset=utf-8', readFirst(VENDOR[path]))
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    return res.end(String(err && err.message))
  }
  res.writeHead(404, { 'content-type': 'text/plain' })
  res.end('not found: ' + path)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`dev-cordis: ${pkg.name} preview on http://127.0.0.1:${PORT}/`)
  console.log('dev-cordis: serving dist/client.js — run `npm run build` first if you edited src/')
})
