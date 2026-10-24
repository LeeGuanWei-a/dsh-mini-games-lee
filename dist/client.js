window.__ModuleLoader__.load({
	id: "dsh-mini-games-lee",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");

// ── src/shared/theme.js ──
// Theme palettes shared by every mini game.
const THEMES = {
  dark: {
    windowBg: 'rgba(10,15,30,.52)',
    text: '#e2e8f0',
    border: 'rgba(148,163,184,.42)',
    headerBorder: 'rgba(148,163,184,.28)',
    boardBorder: 'rgba(148,163,184,.3)',
    cellEmpty: 'rgba(255,255,255,.03)',
    cellLine: 'rgba(148,163,184,.18)',
    boardBg: 'rgba(30,41,59,.55)',
    btnBg: 'rgba(148,163,184,.14)',
    btnBorder: 'rgba(148,163,184,.42)',
    sub: 'rgba(226,232,240,.68)',
    overBg: 'rgba(10,15,30,.8)',
    overText: '#f8fafc',
    overBtnBg: '#f8fafc',
    overBtnText: '#0f172a',
    shadow: '0 14px 44px rgba(0,0,0,.5)'
  },
  light: {
    windowBg: 'rgba(250,252,255,.6)',
    text: '#0f172a',
    border: 'rgba(100,116,139,.42)',
    headerBorder: 'rgba(100,116,139,.25)',
    boardBorder: 'rgba(100,116,139,.32)',
    cellEmpty: 'rgba(15,23,42,.03)',
    cellLine: 'rgba(100,116,139,.25)',
    boardBg: 'rgba(253,244,215,.6)',
    btnBg: 'rgba(255,255,255,.7)',
    btnBorder: 'rgba(100,116,139,.42)',
    sub: 'rgba(15,23,42,.62)',
    overBg: 'rgba(248,250,252,.9)',
    overText: '#0f172a',
    overBtnBg: '#0f172a',
    overBtnText: '#f8fafc',
    shadow: '0 14px 44px rgba(15,23,42,.28)'
  }
}


// ── src/shared/records.js ──
// Per-game localStorage leaderboards.
//
// Every game owns its own key: dsh.minigames.records.<gameId> — so switching
// games never mixes scores. Entries are { value, meta, at }:
//   value — the ranked number (score, length, elapsed seconds, …)
//   meta  — human-readable detail shown after the value
//   at    — timestamp, used to highlight the round that just ended
const RECORDS_PREFIX = 'dsh.minigames.records.v1.'

function recordsKey(gameId) {
  return RECORDS_PREFIX + String(gameId)
}

function loadRecords(gameId) {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(recordsKey(gameId))
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(r => r && typeof r.value === 'number').slice(0, 10)
  } catch (err) {
    return []
  }
}

function saveRecords(gameId, list) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(recordsKey(gameId), JSON.stringify(list.slice(0, 10)))
  } catch (err) {}
}

function pushRecord(gameId, entry) {
  const list = loadRecords(gameId)
  list.unshift(entry)
  const trimmed = list.slice(0, 10)
  saveRecords(gameId, trimmed)
  return trimmed
}

function pushRecords(gameId, entry) {
  return pushRecord(gameId, entry)
}

// order: 'desc' (higher is better, default) | 'asc' (lower is better, e.g. time)
function sortRecords(list, order) {
  return list.slice().sort((a, b) => {
    const diff = (b.value || 0) - (a.value || 0)
    const ranked = order === 'asc' ? -diff : diff
    return ranked || ((b.at || 0) - (a.at || 0))
  })
}

function nowTs() {
  return typeof Date !== 'undefined' ? Date.now() : 0
}


// ── src/shared/store.js ──
// Window-level state shared by the launcher button and the floating window.
function makeStore() {
  return {
    open: true,
    theme: 'dark',
    game: 'tetris',
    pos: null,
    listeners: new Set(),
    emit() { this.listeners.forEach(f => f()) },
    sub(f) { this.listeners.add(f); return () => this.listeners.delete(f) },
    toggle() { this.open = !this.open; this.emit() },
    close() { if (this.open) { this.open = false; this.emit() } },
    setPos(x, y) { this.pos = { x, y }; this.emit() },
    setGame(id) { if (this.game !== id) { this.game = id; this.emit() } },
    toggleTheme() { this.theme = this.theme === 'dark' ? 'light' : 'dark'; this.emit() }
  }
}

function useStore(store) {
  const [, force] = React.useState(0)
  React.useEffect(() => store.sub(() => force(n => n + 1)), [])
  return store
}

function winDefaultPos() {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440
  return { x: Math.max(12, Math.round((vw - 340) / 2)), y: 72 }
}


// ── src/shared/ui.js ──
// Floating-window framework shared by every mini game: drag, theme, collapse,
// game tabs, and the cross-game leaderboard overlay.
//
// A game is a plain object:
//   { id, title, icon, short, scoreOrder, View, valueLabel }
// View receives:
//   { timer, th, onGameOver(entry), onOpenRank(), active }
// `timer` is the resolved harness timer service (ctx.get('timer')): a board
// starts its clock with `timer.interval(fn, ms)` and returns the disposer from
// its effect. A host that offers no timer service keeps the plugin inert.
// A View must call onGameOver EXACTLY once per finished round with
//   { value: <ranked number>, meta: '<detail text>' }
const el = React.createElement

function noFocus(e) { e.preventDefault() }

function btnStyle(th, danger) {
  return {
    cursor: 'pointer', margin: 2, padding: '3px 7px', borderRadius: 5, fontSize: 13,
    color: danger ? '#ef4444' : 'inherit',
    border: '1px solid ' + (danger ? 'rgba(239,68,68,.6)' : th.btnBorder),
    background: danger ? 'rgba(239,68,68,.12)' : th.btnBg
  }
}

function MiniGamesWindow(props) {
  const store = props.store
  const timer = props.timer
  const games = props.games
  useStore(store)
  const [mini, setMini] = React.useState(false)
  const [showRank, setShowRank] = React.useState(false)
  const [confirmClear, setConfirmClear] = React.useState(false)
  const [records, setRecords] = React.useState([])
  const [lastAt, setLastAt] = React.useState(0)
  const drag = React.useState({ on: false })[0]
  const open = store.open
  const pos = store.pos || winDefaultPos()
  const th = THEMES[store.theme] || THEMES.dark
  const game = games.filter(g => g.id === store.game)[0] || games[0]

  // Switching games loads that game's board and resets transient view state.
  React.useEffect(() => {
    setRecords(loadRecords(game.id))
    setShowRank(false)
    setConfirmClear(false)
    setLastAt(0)
  }, [game.id])

  const onGameOver = (entry) => {
    const ts = nowTs()
    const updated = pushRecord(game.id, {
      value: Number(entry && entry.value) || 0,
      meta: (entry && entry.meta) || '',
      at: ts
    })
    setRecords(updated)
    setLastAt(ts)
  }

  const clearAll = () => {
    saveRecords(game.id, [])
    setRecords([])
    setLastAt(0)
    setConfirmClear(false)
  }

  const onPointerDown = (e) => {
    e.preventDefault()
    const cur = e.currentTarget
    try { cur.setPointerCapture(e.pointerId) } catch (err) {}
    drag.on = true
    drag.px = e.clientX
    drag.py = e.clientY
    drag.sx = pos.x
    drag.sy = pos.y
  }
  const onPointerMove = (e) => {
    if (!drag.on) return
    const vw = typeof window !== 'undefined' ? window.innerWidth : 4000
    const vh = typeof window !== 'undefined' ? window.innerHeight : 3000
    let nx = drag.sx + (e.clientX - drag.px)
    let ny = drag.sy + (e.clientY - drag.py)
    nx = Math.max(-(340 - 70), Math.min(nx, vw - 70))
    ny = Math.max(0, Math.min(ny, vh - 50))
    store.setPos(nx, ny)
  }
  const onPointerUp = () => { drag.on = false }
  const stopEvt = (e) => { e.stopPropagation(); e.preventDefault() }
  const headerBtn = (label, fn, title) => el('button', {
    onPointerDown: stopEvt, onMouseDown: noFocus, onClick: fn, title,
    style: { cursor: 'pointer', border: 'none', background: 'transparent', fontSize: 15, padding: '2px 6px', color: 'inherit', borderRadius: 5, lineHeight: 1 }
  }, label)

  // ── game tabs ────────────────────────────────────────────────────────────
  // A fixed 4-column grid keeps seven tabs on two tidy rows inside the 340px
  // window; a single nowrap flex row used to overflow it once the roster grew.
  const tabs = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, padding: '6px 8px 0' } },
    games.map(g => el('button', {
      key: g.id,
      onMouseDown: noFocus,
      onClick: () => { setMini(false); store.setGame(g.id) },
      title: g.title,
      style: {
        cursor: 'pointer', padding: '4px 2px', borderRadius: 6, fontSize: 12,
        color: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        border: '1px solid ' + (g.id === game.id ? th.btnBorder : 'transparent'),
        background: g.id === game.id ? th.btnBg : 'transparent',
        opacity: g.id === game.id ? 1 : 0.65
      }
    }, g.icon + ' ' + (g.short || g.title)))
  )

  // ── leaderboard overlay (shared by all games) ────────────────────────────
  const sorted = sortRecords(records, game.scoreOrder)
  const rankRows = sorted.slice(0, 10).map((r, i) => {
    const isNew = lastAt > 0 && r.at === lastAt
    return el('div', {
      key: 'r' + i,
      style: {
        display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12,
        padding: '2px 4px', borderRadius: 4,
        background: isNew ? th.btnBg : 'transparent',
        fontWeight: isNew ? 700 : 400
      }
    },
      el('span', null, '#' + (i + 1) + '  ' + r.value + (isNew ? ' ←' : '')),
      el('span', { style: { opacity: .7 } }, r.meta || '')
    )
  })
  const rankList = el('div', { style: { maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 } },
    sorted.length ? rankRows : el('div', { style: { fontSize: 12, opacity: .7, padding: 4 } }, '暂无记录，去玩一局吧')
  )
  const rankOverlay = el('div', {
    style: { position: 'absolute', inset: 0, zIndex: 9, background: th.overBg, borderRadius: 8, color: th.overText, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }
  },
    el('div', { style: { fontSize: 14, fontWeight: 700 } }, '🏆 ' + game.title + ' · 最近 10 次'),
    el('div', { style: { fontSize: 11, opacity: .65 } }, '数据仅保存在本机浏览器 · 切换游戏各自独立计分'),
    rankList,
    el('div', { style: { marginTop: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 } },
      el('button', { onMouseDown: noFocus, onClick: () => setShowRank(false), style: btnStyle(th) }, '◀ 返回游戏'),
      el('span', { style: { flex: 1 } }),
      el('button', {
        onMouseDown: noFocus,
        onClick: () => confirmClear ? clearAll() : setConfirmClear(true),
        style: btnStyle(th, true)
      }, confirmClear ? '确认清空？' : '🗑 清空')
    )
  )

  // ── header ───────────────────────────────────────────────────────────────
  const header = el('div', {
    onPointerDown, onPointerMove, onPointerUp,
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 10px', cursor: 'grab', userSelect: 'none',
      borderBottom: '1px solid ' + th.headerBorder, fontSize: 13, fontWeight: 600,
      whiteSpace: 'nowrap', overflow: 'hidden'
    }
  },
    el('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, '🕹️ Mini Games'),
    mini
      ? el('div', { style: { display: 'flex', alignItems: 'center', gap: 2 } },
          headerBtn('□ 还原', () => setMini(false), '还原完整界面'),
          headerBtn('✕', () => store.close(), '彻底隐藏（从会话头部 🎮 重新打开）')
        )
      : el('div', { style: { display: 'flex', alignItems: 'center', gap: 2 } },
          headerBtn('▁', () => { setShowRank(false); setMini(true) }, '收起为标题条（自动暂停）'),
          headerBtn('🏆', () => setShowRank(true), '排行榜'),
          headerBtn(store.theme === 'dark' ? '☀️' : '🌙', () => store.toggleTheme(), '切换深浅色'),
          headerBtn('✕', () => { setShowRank(false); setMini(true) }, '收起为标题条（自动暂停）')
        )
  )

  const view = el(game.View, {
    key: game.id, // remount on switch: each game starts fresh and its timers stop
    timer,
    th,
    store,
    active: open && !mini && !showRank,
    onGameOver,
    onOpenRank: () => setShowRank(true)
  })

  const bodyWrap = el('div', { style: { padding: 8, position: 'relative' } },
    tabs,
    view,
    showRank ? rankOverlay : null
  )

  const windowStyle = {
    position: 'fixed', left: 0, top: 0,
    width: 340, transform: 'translate(' + pos.x + 'px,' + pos.y + 'px)',
    background: th.windowBg,
    backdropFilter: 'blur(16px) saturate(150%)',
    WebkitBackdropFilter: 'blur(16px) saturate(150%)',
    color: th.text,
    borderRadius: 12, boxShadow: th.shadow,
    border: '1px solid ' + th.border,
    fontFamily: 'system-ui, sans-serif', zIndex: 2147483000,
    display: open ? 'block' : 'none'
  }

  return el('div', { style: windowStyle },
    header,
    mini ? null : bodyWrap
  )
}

function LaunchButton(props) {
  const store = props.store
  useStore(store)
  const open = store.open
  const style = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', background: 'transparent', border: 'none',
    color: 'inherit', fontSize: 15, lineHeight: 1, padding: '4px 6px',
    borderRadius: 6, opacity: open ? 1 : 0.7
  }
  return el('button', { style, title: open ? '收起小游戏' : '打开小游戏', onClick: () => store.toggle() }, '🎮')
}


// ── src/games/tetris.js ──
// 🕹️ Tetris — game module for the mini-games framework.
//
// Self-contained engine + board view. The framework owns the window chrome,
// theme, drag, collapse and the cross-game leaderboard; this module only
// renders its own area and calls onGameOver once per finished round.
const TETRIS = (() => {
  const COLS = 10
  const ROWS = 20
  const CELL = 18
  const PALETTE = { 1: '#22d3ee', 2: '#facc15', 3: '#a78bfa', 4: '#4ade80', 5: '#f87171', 6: '#60a5fa', 7: '#fb923c' }
  const TYPE_IDX = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 }
  const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
  const SPAWN = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]]
  }
  const SCORE_TABLE = [0, 100, 300, 500, 800]

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0))
  }
  function shuffle(a) {
    const arr = a.slice()
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t
    }
    return arr
  }
  function rotCW(m) {
    const h = m.length, w = m[0].length, out = []
    for (let c = 0; c < w; c++) {
      const row = []
      for (let r = h - 1; r >= 0; r--) row.push(m[r][c])
      out.push(row)
    }
    return out
  }
  function rotCCW(m) { return rotCW(rotCW(rotCW(m))) }
  function collides(board, m, x, y) {
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue
        const xx = x + c, yy = y + r
        if (xx < 0 || xx >= COLS || yy >= ROWS) return true
        if (yy >= 0 && board[yy] && board[yy][xx]) return true
      }
    }
    return false
  }
  function mergeBoard(board, m, x, y, color) {
    const b = board.map(r => r.slice())
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c] && y + r >= 0 && b[y + r]) b[y + r][x + c] = color
      }
    }
    return b
  }
  function speedFor(level) { return Math.max(90, 760 - (level - 1) * 70) }
  function takeType(bag) {
    const nb = bag.slice()
    const type = nb.shift()
    if (nb.length === 0) nb.push(...shuffle(TYPES))
    return { type, bag: nb }
  }
  function spawnState(board, bag, base) {
    const t = takeType(bag)
    const m = SPAWN[t.type]
    const piece = { m: m.map(r => r.slice()), x: Math.floor((COLS - m[0].length) / 2), y: 0, color: PALETTE[TYPE_IDX[t.type]] }
    const over = collides(board, piece.m, piece.x, piece.y)
    return Object.assign({}, base, { board, piece: over ? null : piece, over, bag: t.bag })
  }
  function newGameState() {
    return spawnState(emptyBoard(), shuffle(TYPES), { score: 0, lines: 0, level: 1, paused: false })
  }
  function clearAndSpawn(s, board, extraScore) {
    const kept = []
    let cleared = 0
    for (let y = 0; y < ROWS; y++) {
      const row = board[y] || new Array(COLS).fill(0)
      if (row.every(v => v)) cleared++
      else kept.push(row.slice())
    }
    while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(0))
    const lines = s.lines + cleared
    const level = Math.floor(lines / 10) + 1
    const base = { score: s.score + SCORE_TABLE[cleared] + extraScore, lines, level, paused: s.paused }
    return spawnState(kept, s.bag || shuffle(TYPES), base)
  }
  function lockNow(s) {
    const p = s.piece
    if (!p) return s
    return clearAndSpawn(s, mergeBoard(s.board, p.m, p.x, p.y, p.color), 0)
  }
  function tick(s) {
    if (s.over || s.paused || !s.piece) return s
    const p = s.piece
    if (!collides(s.board, p.m, p.x, p.y + 1)) return Object.assign({}, s, { piece: Object.assign({}, p, { y: p.y + 1 }) })
    return lockNow(s)
  }
  function softDown(s) {
    if (s.over || s.paused || !s.piece) return s
    const p = s.piece
    if (collides(s.board, p.m, p.x, p.y + 1)) return s
    return Object.assign({}, s, { piece: Object.assign({}, p, { y: p.y + 1 }), score: s.score + 1 })
  }
  function tryShift(s, dx) {
    if (!s || s.over || s.paused || !s.piece) return s
    const p = s.piece
    if (collides(s.board, p.m, p.x + dx, p.y)) return s
    return Object.assign({}, s, { piece: Object.assign({}, p, { x: p.x + dx }) })
  }
  function tryRotate(s, dir) {
    if (!s || s.over || s.paused || !s.piece) return s
    const p = s.piece
    const m = dir > 0 ? rotCW(p.m) : rotCCW(p.m)
    const kicks = [0, -1, 1, -2, 2]
    for (let i = 0; i < kicks.length; i++) {
      const off = kicks[i]
      if (!collides(s.board, m, p.x + off, p.y)) return Object.assign({}, s, { piece: Object.assign({}, p, { m, x: p.x + off }) })
    }
    return s
  }
  function hardDrop(s) {
    if (!s || s.over || s.paused || !s.piece) return s
    const p = s.piece
    let y = p.y, d = 0
    while (!collides(s.board, p.m, p.x, y + 1)) { y++; d++ }
    return clearAndSpawn(s, mergeBoard(s.board, p.m, p.x, y, p.color), 2 * d)
  }
  function normState(s) {
    let src = s
    if (!src || typeof src !== 'object') src = {}
    let board = src.board
    if (!Array.isArray(board) || board.length !== ROWS) board = emptyBoard()
    else board = board.map(row => Array.isArray(row) ? row : new Array(COLS).fill(0))
    const bag = Array.isArray(src.bag) && src.bag.length ? src.bag.slice() : shuffle(TYPES)
    return {
      board, bag, piece: src.piece || null,
      score: typeof src.score === 'number' ? src.score : 0,
      lines: typeof src.lines === 'number' ? src.lines : 0,
      level: typeof src.level === 'number' ? src.level : 1,
      paused: !!src.paused,
      over: !!src.over
    }
  }

  const left = (st) => tryShift(st, -1)
  const right = (st) => tryShift(st, 1)
  const rot = (st) => tryRotate(st, 1)
  const rotCC = (st) => tryRotate(st, -1)
  const drop = (st) => hardDrop(st)
  const down = (st) => softDown(st)
  const togglePause = (st) => Object.assign({}, st, { paused: !st.paused })

  function View(props) {
    const timer = props.timer
    const th = props.th
    const active = props.active
    const onGameOver = props.onGameOver
    const [s, setS] = React.useState(newGameState)
    const prevOver = React.useState({ current: false })[0]
    const v = normState(s)

    React.useEffect(() => {
      if (!active || v.over || v.paused || !v.piece) return
      return timer.interval(() => setS(tick), speedFor(v.level))
    }, [active, v.over, v.paused, v.level])

    React.useEffect(() => {
      if (!active) return
      const w = typeof window !== 'undefined' ? window : null
      if (!w) return
      const onKeyDown = (e) => {
        const t = e.target
        const tag = t && t.tagName ? String(t.tagName).toUpperCase() : ''
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return
        const k = e.key
        let handled = true
        if (k === 'ArrowLeft') setS(left)
        else if (k === 'ArrowRight') setS(right)
        else if (k === 'ArrowDown') setS(down)
        else if (k === 'ArrowUp' || k === 'x' || k === 'X') setS(rot)
        else if (k === 'z' || k === 'Z') setS(rotCC)
        else if (k === ' ' || k === 'Spacebar') setS(drop)
        else if (k === 'p' || k === 'P') setS(togglePause)
        else handled = false
        if (handled) e.preventDefault()
      }
      w.addEventListener('keydown', onKeyDown)
      return () => w.removeEventListener('keydown', onKeyDown)
    }, [active])

    React.useEffect(() => {
      if (v.over && !prevOver.current) onGameOver({ value: v.score, meta: v.lines + ' 行 · Lv' + v.level })
      prevOver.current = v.over
    }, [v.over])

    const board = v.board
    const p = v.piece
    const rows = []
    for (let y = 0; y < ROWS; y++) {
      const rowSrc = board[y] || new Array(COLS).fill(0)
      const cells = []
      for (let x = 0; x < COLS; x++) {
        let color = rowSrc[x] || null
        if (p && !v.over && y >= p.y && y < p.y + p.m.length && x >= p.x && x < p.x + p.m[0].length) {
          const cellRow = p.m[y - p.y]
          if (cellRow && cellRow[x - p.x]) color = p.color
        }
        cells.push(el('div', {
          key: y + '-' + x,
          style: {
            width: CELL, height: CELL,
            background: color || th.cellEmpty,
            boxShadow: color ? 'inset 0 0 0 1px rgba(255,255,255,.22)' : 'inset 0 0 0 1px ' + th.cellLine
          }
        }))
      }
      rows.push(el('div', { key: y, style: { display: 'flex' } }, cells))
    }

    const nextType = v.bag.length ? v.bag[0] : 'I'
    const nextM = SPAWN[nextType] || [[1, 1, 1, 1]]
    const nextCells = []
    for (let r = 0; r < nextM.length; r++) {
      const cs = []
      for (let c = 0; c < nextM[r].length; c++) {
        cs.push(el('div', {
          key: c,
          style: {
            width: 12, height: 12,
            background: nextM[r][c] ? PALETTE[TYPE_IDX[nextType]] : 'transparent',
            boxShadow: nextM[r][c] ? 'none' : 'inset 0 0 0 1px ' + th.cellLine
          }
        }))
      }
      nextCells.push(el('div', { key: r, style: { display: 'flex' } }, cs))
    }

    const statStyle = { fontSize: 12, margin: '3px 0', color: th.sub }
    const btn = (label, fn, title) => el('button', {
      onMouseDown: noFocus, onClick: () => setS(fn), title, style: btnStyle(th)
    }, label)

    const panel = el('div', { style: { padding: '10px 12px', minWidth: 108, flex: 1 } },
      el('div', { style: { fontSize: 12, opacity: .65, marginBottom: 2, color: th.sub } }, '分数'),
      el('div', { style: { fontSize: 20, fontWeight: 700, marginBottom: 8 } }, String(v.score)),
      el('div', { style: statStyle }, '等级 ' + v.level),
      el('div', { style: statStyle }, '行数 ' + v.lines),
      el('div', { style: Object.assign({ marginTop: 10, marginBottom: 4 }, statStyle, { opacity: .65 }) }, '下一个'),
      el('div', { style: { display: 'inline-block', padding: 4, border: '1px solid ' + th.cellLine, borderRadius: 6 } }, nextCells),
      el('div', { style: { marginTop: 12 } },
        btn('←', left, '左移'),
        btn('→', right, '右移'),
        btn('↻', rot, '旋转'),
        btn('⤓', drop, '硬降'),
        btn('▼', down, '软降')
      ),
      el('div', { style: { marginTop: 6 } },
        btn(v.paused ? '▶ 继续' : 'Ⅱ 暂停', togglePause, '暂停/继续'),
        btn('↺ 新局', newGameState, '重新开始'),
        el('button', { onMouseDown: noFocus, onClick: props.onOpenRank, title: '排行榜', style: btnStyle(th) }, '🏆')
      )
    )

    const overOverlay = v.over ? el('div', {
      style: { position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: th.overBg, borderRadius: 8, color: th.overText, padding: 14, gap: 8 }
    },
      el('div', { style: { fontSize: 20, fontWeight: 700 } }, '游戏结束'),
      el('div', { style: { fontSize: 14 } }, '最终得分 ' + v.score),
      el('div', { style: { display: 'flex', gap: 4 } },
        el('button', { onMouseDown: noFocus, onClick: () => setS(newGameState()), style: { cursor: 'pointer', padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 14, background: th.overBtnBg, color: th.overBtnText } }, '再来一局'),
        el('button', { onMouseDown: noFocus, onClick: props.onOpenRank, style: btnStyle(th) }, '🏆 排行')
      )
    ) : null

    return el('div', { style: { position: 'relative' } },
      el('div', { style: { display: 'flex', gap: 8 } },
        el('div', { style: { padding: 5, background: 'transparent', border: '1px solid ' + th.boardBorder, borderRadius: 6 } }, rows),
        panel
      ),
      overOverlay
    )
  }

  return {
    id: 'tetris',
    title: '俄罗斯方块',
    icon: '🕹️',
    short: '方块',
    scoreOrder: 'desc',
    View
  }
})()


// ── src/games/snake.js ──
// 🐍 Snake — game module for the mini-games framework.
//
// Grid-based, DOM-rendered (no canvas / no requestAnimationFrame), so it stays
// compatible with the dynamic-plugin sandbox as well as the host-resident build.
const SNAKE = (() => {
  const COLS = 15
  const ROWS = 15
  const CELL = 16

  function spawnFood(snake) {
    const free = []
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!snake.some(p => p.x === x && p.y === y)) free.push({ x, y })
      }
    }
    if (free.length === 0) return { x: -1, y: -1 }
    return free[Math.floor(Math.random() * free.length)]
  }

  function newSnakeState() {
    const snake = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }]
    return { snake, dir: { x: 1, y: 0 }, pending: null, food: spawnFood(snake), score: 0, eaten: 0, over: false, paused: false }
  }

  function speedFor(eaten) {
    return Math.max(90, 220 - Math.floor(eaten / 3) * 20)
  }
  function levelFor(eaten) {
    return 1 + Math.floor(eaten / 3)
  }

  function step(s) {
    if (s.over || s.paused) return s
    const dir = s.pending || s.dir
    const head = { x: s.snake[0].x + dir.x, y: s.snake[0].y + dir.y }
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      return Object.assign({}, s, { over: true, dir, pending: null })
    }
    // The tail cell is vacated this tick, so it is not a collision.
    const body = s.snake.slice(0, s.snake.length - 1)
    if (body.some(p => p.x === head.x && p.y === head.y)) {
      return Object.assign({}, s, { over: true, dir, pending: null })
    }
    const ate = head.x === s.food.x && head.y === s.food.y
    const snake = [head].concat(s.snake)
    if (!ate) snake.pop()
    return Object.assign({}, s, {
      snake,
      dir,
      pending: null,
      food: ate ? spawnFood(snake) : s.food,
      score: ate ? s.score + 10 : s.score,
      eaten: ate ? s.eaten + 1 : s.eaten
    })
  }

  function turn(s, x, y) {
    if (s.over || s.paused) return s
    const base = s.pending || s.dir
    if (base.x === -x && base.y === -y) return s // no instant reversal
    if (base.x === x && base.y === y) return s
    return Object.assign({}, s, { pending: { x, y } })
  }

  const togglePause = (st) => Object.assign({}, st, { paused: !st.paused })

  function View(props) {
    const timer = props.timer
    const th = props.th
    const active = props.active
    const onGameOver = props.onGameOver
    const [s, setS] = React.useState(newSnakeState)
    const prevOver = React.useState({ current: false })[0]
    const v = s

    React.useEffect(() => {
      if (!active || v.over || v.paused) return
      return timer.interval(() => setS(step), speedFor(v.eaten))
    }, [active, v.over, v.paused, v.eaten])

    React.useEffect(() => {
      if (!active) return
      const w = typeof window !== 'undefined' ? window : null
      if (!w) return
      const onKeyDown = (e) => {
        const t = e.target
        const tag = t && t.tagName ? String(t.tagName).toUpperCase() : ''
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return
        const k = e.key
        let handled = true
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') setS(st => turn(st, -1, 0))
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') setS(st => turn(st, 1, 0))
        else if (k === 'ArrowUp' || k === 'w' || k === 'W') setS(st => turn(st, 0, -1))
        else if (k === 'ArrowDown' || k === 's' || k === 'S') setS(st => turn(st, 0, 1))
        else if (k === ' ' || k === 'Spacebar' || k === 'p' || k === 'P') setS(togglePause)
        else handled = false
        if (handled) e.preventDefault()
      }
      w.addEventListener('keydown', onKeyDown)
      return () => w.removeEventListener('keydown', onKeyDown)
    }, [active])

    React.useEffect(() => {
      if (v.over && !prevOver.current) {
        onGameOver({ value: v.score, meta: '长度 ' + v.snake.length + ' · Lv' + levelFor(v.eaten) })
      }
      prevOver.current = v.over
    }, [v.over])

    const snakeSet = {}
    v.snake.forEach((p, i) => { snakeSet[p.x + ',' + p.y] = i })
    const rows = []
    for (let y = 0; y < ROWS; y++) {
      const cells = []
      for (let x = 0; x < COLS; x++) {
        const idx = snakeSet[x + ',' + y]
        const isHead = idx === 0
        const isBody = typeof idx === 'number' && idx > 0
        const isFood = v.food.x === x && v.food.y === y
        cells.push(el('div', {
          key: x,
          style: {
            width: CELL, height: CELL,
            borderRadius: isFood ? '50%' : (isHead || isBody ? 3 : 0),
            background: isHead ? '#22c55e' : (isBody ? '#4ade80' : (isFood ? '#f87171' : th.cellEmpty)),
            boxShadow: (isHead || isBody || isFood) ? 'none' : 'inset 0 0 0 1px ' + th.cellLine
          }
        }))
      }
      rows.push(el('div', { key: y, style: { display: 'flex' } }, cells))
    }

    const statStyle = { fontSize: 12, margin: '3px 0', color: th.sub }
    const btn = (label, fn, title) => el('button', {
      onMouseDown: noFocus, onClick: () => setS(fn), title, style: btnStyle(th)
    }, label)

    const panel = el('div', { style: { padding: '10px 12px', flex: 1 } },
      el('div', { style: { fontSize: 12, opacity: .65, marginBottom: 2, color: th.sub } }, '分数'),
      el('div', { style: { fontSize: 20, fontWeight: 700, marginBottom: 8 } }, String(v.score)),
      el('div', { style: statStyle }, '长度 ' + v.snake.length),
      el('div', { style: statStyle }, '速度 Lv' + levelFor(v.eaten)),
      el('div', { style: { marginTop: 12 } },
        btn('↑', st => turn(st, 0, -1), '上'),
        btn('←', st => turn(st, -1, 0), '左'),
        btn('↓', st => turn(st, 0, 1), '下'),
        btn('→', st => turn(st, 1, 0), '右')
      ),
      el('div', { style: { marginTop: 6 } },
        btn(v.paused ? '▶ 继续' : 'Ⅱ 暂停', togglePause, '暂停/继续'),
        btn('↺ 新局', newSnakeState, '重新开始'),
        el('button', { onMouseDown: noFocus, onClick: props.onOpenRank, title: '排行榜', style: btnStyle(th) }, '🏆')
      )
    )

    const overOverlay = v.over ? el('div', {
      style: { position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: th.overBg, borderRadius: 8, color: th.overText, padding: 14, gap: 8 }
    },
      el('div', { style: { fontSize: 20, fontWeight: 700 } }, '游戏结束'),
      el('div', { style: { fontSize: 14 } }, '得分 ' + v.score + ' · 长度 ' + v.snake.length),
      el('div', { style: { display: 'flex', gap: 4 } },
        el('button', { onMouseDown: noFocus, onClick: () => setS(newSnakeState()), style: { cursor: 'pointer', padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 14, background: th.overBtnBg, color: th.overBtnText } }, '再来一局'),
        el('button', { onMouseDown: noFocus, onClick: props.onOpenRank, style: btnStyle(th) }, '🏆 排行')
      )
    ) : null

    return el('div', { style: { position: 'relative' } },
      el('div', { style: { display: 'flex', gap: 8 } },
        el('div', { style: { padding: 5, background: 'transparent', border: '1px solid ' + th.boardBorder, borderRadius: 6 } }, rows),
        panel
      ),
      overOverlay
    )
  }

  return {
    id: 'snake',
    title: '贪吃蛇',
    icon: '🐍',
    short: '贪吃蛇',
    scoreOrder: 'desc',
    View
  }
})()


// ── src/games/g2048.js ──
// 🔢 2048 — game module for the mini-games framework.
//
// 4×4 grid, DOM-rendered, keyboard + on-screen direction buttons.
const G2048 = (() => {
  const N = 4
  const CELL = 54
  const TILE_BG = {
    2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563',
    32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61',
    512: '#edc850', 1024: '#edc53f', 2048: '#edc22e'
  }
  const TILE_FG = { 2: '#776e65', 4: '#776e65' }

  function emptyGrid() { return new Array(N * N).fill(0) }

  function addRandom(g) {
    const free = []
    for (let i = 0; i < g.length; i++) if (!g[i]) free.push(i)
    if (free.length === 0) return g
    const idx = free[Math.floor(Math.random() * free.length)]
    const out = g.slice()
    out[idx] = Math.random() < 0.9 ? 2 : 4
    return out
  }

  function newState() {
    const grid = addRandom(addRandom(emptyGrid()))
    return { grid, score: 0, over: false, paused: false, won: false }
  }

  // Collapse one line of 4 toward index 0 (direction handled by the caller).
  function collapseLine(vals) {
    const nums = vals.filter(v => v)
    const out = []
    let gained = 0
    for (let i = 0; i < nums.length; i++) {
      if (nums[i] === nums[i + 1]) {
        const merged = nums[i] * 2
        out.push(merged)
        gained += merged
        i++
      } else {
        out.push(nums[i])
      }
    }
    while (out.length < N) out.push(0)
    return { line: out, gained }
  }

  function canMove(g) {
    if (g.some(v => v === 0)) return true
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const v = g[r * N + c]
        if (c + 1 < N && g[r * N + c + 1] === v) return true
        if (r + 1 < N && g[(r + 1) * N + c] === v) return true
      }
    }
    return false
  }

  function move(s, dir) {
    if (s.over || s.paused) return s
    const g = s.grid
    const next = new Array(N * N).fill(0)
    let gained = 0
    let moved = false
    for (let i = 0; i < N; i++) {
      const idxs = []
      for (let j = 0; j < N; j++) {
        if (dir === 'left') idxs.push(i * N + j)
        else if (dir === 'right') idxs.push(i * N + (N - 1 - j))
        else if (dir === 'up') idxs.push(j * N + i)
        else idxs.push((N - 1 - j) * N + i)
      }
      const vals = idxs.map(k => g[k])
      const r = collapseLine(vals)
      gained += r.gained
      r.line.forEach((val, j) => { next[idxs[j]] = val })
      if (r.line.some((val, j) => val !== vals[j])) moved = true
    }
    if (!moved) return s
    const filled = addRandom(next)
    const score = s.score + gained
    const maxTile = filled.reduce((m, v) => Math.max(m, v), 0)
    return Object.assign({}, s, {
      grid: filled,
      score,
      over: !canMove(filled),
      won: s.won || maxTile >= 2048
    })
  }

  const togglePause = (st) => Object.assign({}, st, { paused: !st.paused })

  function View(props) {
    const th = props.th
    const active = props.active
    const onGameOver = props.onGameOver
    const [s, setS] = React.useState(newState)
    const prevOver = React.useState({ current: false })[0]

    React.useEffect(() => {
      if (!active) return
      const w = typeof window !== 'undefined' ? window : null
      if (!w) return
      const onKeyDown = (e) => {
        const t = e.target
        const tag = t && t.tagName ? String(t.tagName).toUpperCase() : ''
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return
        const k = e.key
        let handled = true
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') setS(st => move(st, 'left'))
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') setS(st => move(st, 'right'))
        else if (k === 'ArrowUp' || k === 'w' || k === 'W') setS(st => move(st, 'up'))
        else if (k === 'ArrowDown' || k === 's' || k === 'S') setS(st => move(st, 'down'))
        else if (k === 'p' || k === 'P') setS(togglePause)
        else handled = false
        if (handled) e.preventDefault()
      }
      w.addEventListener('keydown', onKeyDown)
      return () => w.removeEventListener('keydown', onKeyDown)
    }, [active])

    React.useEffect(() => {
      if (s.over && !prevOver.current) {
        const maxTile = s.grid.reduce((m, v) => Math.max(m, v), 0)
        onGameOver({ value: s.score, meta: '最大 ' + maxTile + (s.won ? ' · 达成 2048' : '') })
      }
      prevOver.current = s.over
    }, [s.over])

    const rows = []
    for (let r = 0; r < N; r++) {
      const cells = []
      for (let c = 0; c < N; c++) {
        const val = s.grid[r * N + c]
        cells.push(el('div', {
          key: c,
          style: {
            width: CELL, height: CELL, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, fontWeight: 700, fontSize: val >= 1024 ? 18 : (val >= 128 ? 20 : 22),
            background: val ? TILE_BG[val] || '#3c3a32' : th.cellEmpty,
            color: val ? (TILE_FG[val] || '#f9f6f2') : 'inherit',
            boxShadow: val ? 'none' : 'inset 0 0 0 1px ' + th.cellLine
          }
        }, val ? String(val) : ''))
      }
      rows.push(el('div', { key: r, style: { display: 'flex', gap: 4 } }, cells))
    }

    const statStyle = { fontSize: 12, margin: '3px 0', color: th.sub }
    const btn = (label, fn, title) => el('button', {
      onMouseDown: noFocus, onClick: () => setS(fn), title, style: btnStyle(th)
    }, label)

    const panel = el('div', { style: { padding: '10px 12px', flex: 1 } },
      el('div', { style: { fontSize: 12, opacity: .65, marginBottom: 2, color: th.sub } }, '分数'),
      el('div', { style: { fontSize: 20, fontWeight: 700, marginBottom: 8 } }, String(s.score)),
      el('div', { style: statStyle }, '最大 ' + s.grid.reduce((m, v) => Math.max(m, v), 0)),
      el('div', { style: { marginTop: 10 } },
        btn('↑', st => move(st, 'up'), '上'),
        btn('←', st => move(st, 'left'), '左'),
        btn('↓', st => move(st, 'down'), '下'),
        btn('→', st => move(st, 'right'), '右')
      ),
      el('div', { style: { marginTop: 6 } },
        btn(s.paused ? '▶ 继续' : 'Ⅱ 暂停', togglePause, '暂停/继续'),
        btn('↺ 新局', newState, '重新开始'),
        el('button', { onMouseDown: noFocus, onClick: props.onOpenRank, title: '排行榜', style: btnStyle(th) }, '🏆')
      )
    )

    const overOverlay = s.over ? el('div', {
      style: { position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: th.overBg, borderRadius: 8, color: th.overText, padding: 14, gap: 8 }
    },
      el('div', { style: { fontSize: 20, fontWeight: 700 } }, s.won ? '达成 2048！' : '无路可走'),
      el('div', { style: { fontSize: 14 } }, '得分 ' + s.score),
      el('div', { style: { display: 'flex', gap: 4 } },
        el('button', { onMouseDown: noFocus, onClick: () => setS(newState()), style: { cursor: 'pointer', padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 14, background: th.overBtnBg, color: th.overBtnText } }, '再来一局'),
        el('button', { onMouseDown: noFocus, onClick: props.onOpenRank, style: btnStyle(th) }, '🏆 排行')
      )
    ) : null

    return el('div', { style: { position: 'relative' } },
      el('div', { style: { display: 'flex', gap: 8 } },
        el('div', { style: { padding: 5, background: 'transparent', border: '1px solid ' + th.boardBorder, borderRadius: 6 } }, rows),
        panel
      ),
      overOverlay
    )
  }

  return {
    id: '2048',
    title: '2048',
    icon: '🔢',
    short: '2048',
    scoreOrder: 'desc',
    View
  }
})()


// ── src/games/minesweeper.js ──
// 💣 Minesweeper — game module for the mini-games framework.
//
// Two difficulties, DOM grid, left-click reveal / right-click flag.
// Ranked by elapsed seconds (lower is better) on a win.
const MINESWEEPER = (() => {
  const DIFFS = {
    easy: { key: 'easy', name: '初级', cols: 9, rows: 9, mines: 10, cell: 19 },
    medium: { key: 'medium', name: '中级', cols: 12, rows: 12, mines: 24, cell: 15 }
  }
  const NUM_COLORS = ['', '#3b82f6', '#16a34a', '#dc2626', '#7c3aed', '#b45309', '#0891b2', '#334155', '#9d174d']

  function neighbors(s, idx) {
    const x = idx % s.cols
    const y = Math.floor(idx / s.cols)
    const out = []
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= s.cols || ny < 0 || ny >= s.rows) continue
        out.push(ny * s.cols + nx)
      }
    }
    return out
  }

  function newState(diffKey) {
    const d = DIFFS[diffKey] || DIFFS.easy
    const cells = []
    for (let i = 0; i < d.cols * d.rows; i++) cells.push({ mine: false, revealed: false, flagged: false, adj: 0 })
    return { cols: d.cols, rows: d.rows, mines: d.mines, cell: d.cell, diffKey: d.key, diffName: d.name, cells, phase: 'ready', elapsed: 0, seeded: false, boom: -1 }
  }

  // First click is always safe (its whole neighbourhood is mine-free).
  function seed(s, firstIdx) {
    const cells = s.cells.map(c => Object.assign({}, c))
    const safe = {}
    safe[firstIdx] = true
    neighbors(s, firstIdx).forEach(i => { safe[i] = true })
    const pool = []
    for (let i = 0; i < cells.length; i++) if (!safe[i]) pool.push(i)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t
    }
    const count = Math.min(s.mines, pool.length)
    for (let i = 0; i < count; i++) cells[pool[i]].mine = true
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].mine) continue
      cells[i].adj = neighbors(s, i).filter(k => cells[k].mine).length
    }
    return Object.assign({}, s, { cells, seeded: true, phase: 'playing', boom: -1 })
  }

  function reveal(s, idx) {
    if (s.phase === 'lost' || s.phase === 'won') return s
    const st = s.seeded ? s : seed(s, idx)
    if (st.cells[idx].flagged || st.cells[idx].revealed) return st
    const cells = st.cells.map(c => Object.assign({}, c))
    if (cells[idx].mine) {
      cells[idx].revealed = true
      return Object.assign({}, st, { cells, phase: 'lost', boom: idx })
    }
    const stack = [idx]
    while (stack.length > 0) {
      const i = stack.pop()
      const c = cells[i]
      if (c.revealed || c.flagged) continue
      c.revealed = true
      if (c.adj === 0) neighbors(st, i).forEach(k => { if (!cells[k].revealed) stack.push(k) })
    }
    const won = cells.every(c => c.mine || c.revealed)
    return Object.assign({}, st, { cells, phase: won ? 'won' : 'playing' })
  }

  function toggleFlag(s, idx) {
    if (s.phase === 'lost' || s.phase === 'won') return s
    if (s.cells[idx].revealed) return s
    const cells = s.cells.map(c => Object.assign({}, c))
    cells[idx].flagged = !cells[idx].flagged
    return Object.assign({}, s, { cells })
  }

  function flagCount(s) {
    let n = 0
    s.cells.forEach(c => { if (c.flagged) n++ })
    return n
  }

  function View(props) {
    const timer = props.timer
    const th = props.th
    const active = props.active
    const onGameOver = props.onGameOver
    const [s, setS] = React.useState(() => newState('easy'))
    const prevPhase = React.useState({ current: 'ready' })[0]

    React.useEffect(() => {
      if (!active || s.phase !== 'playing') return
      return timer.interval(() => {
        setS(st => st.phase === 'playing' ? Object.assign({}, st, { elapsed: st.elapsed + 1 }) : st)
      }, 1000)
    }, [active, s.phase])

    React.useEffect(() => {
      if (s.phase === 'won' && prevPhase.current !== 'won') {
        onGameOver({ value: s.elapsed, meta: s.diffName + ' · ' + s.mines + ' 雷' })
      }
      prevPhase.current = s.phase
    }, [s.phase])

    const rows = []
    for (let r = 0; r < s.rows; r++) {
      const cells = []
      for (let c = 0; c < s.cols; c++) {
        const i = r * s.cols + c
        const cell = s.cells[i] || { mine: false, revealed: false, flagged: false, adj: 0 }
        const showMine = cell.mine && (s.phase === 'lost' || cell.revealed)
        const isBoom = s.boom === i
        cells.push(el('div', {
          key: c,
          onClick: () => setS(st => reveal(st, i)),
          onContextMenu: (e) => { e.preventDefault(); setS(st => toggleFlag(st, i)) },
          title: cell.flagged ? '已标记' : '',
          style: {
            width: s.cell, height: s.cell, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: s.cell - 8, fontWeight: 700, cursor: 'pointer', userSelect: 'none',
            color: cell.revealed && !cell.mine && cell.adj > 0 ? NUM_COLORS[cell.adj] : 'inherit',
            background: isBoom ? '#dc2626' : (cell.revealed ? th.cellEmpty : th.btnBg),
            boxShadow: 'inset 0 0 0 1px ' + th.cellLine,
            borderRadius: 3
          }
        }, cell.flagged ? '🚩' : (showMine ? '💣' : (cell.revealed && cell.adj > 0 ? String(cell.adj) : ''))))
      }
      rows.push(el('div', { key: r, style: { display: 'flex', gap: 1 } }, cells))
    }

    const statStyle = { fontSize: 12, margin: '3px 0', color: th.sub }
    const btn = (label, fn, title) => el('button', {
      onMouseDown: noFocus, onClick: fn, title, style: btnStyle(th)
    }, label)

    const panel = el('div', { style: { padding: '10px 12px', minWidth: 104, flex: 1 } },
      el('div', { style: { fontSize: 12, opacity: .65, marginBottom: 2, color: th.sub } }, '剩余雷数'),
      el('div', { style: { fontSize: 20, fontWeight: 700, marginBottom: 8 } }, String(s.mines - flagCount(s))),
      el('div', { style: statStyle }, '用时 ' + s.elapsed + 's'),
      el('div', { style: statStyle }, s.diffName + ' ' + s.cols + '×' + s.rows),
      el('div', { style: { marginTop: 10 } },
        btn('初级', () => setS(newState('easy')), '初级 9×9 / 10 雷'),
        btn('中级', () => setS(newState('medium')), '中级 12×12 / 24 雷')
      ),
      el('div', { style: { marginTop: 6 } },
        btn('↺ 新局', () => setS(st => newState(st.diffKey)), '重新开始'),
        el('button', { onMouseDown: noFocus, onClick: props.onOpenRank, title: '排行榜', style: btnStyle(th) }, '🏆')
      ),
      el('div', { style: { fontSize: 11, opacity: .6, marginTop: 8, lineHeight: 1.5 } },
        '左键翻开 · 右键标记'
      )
    )

    const overOverlay = (s.phase === 'won' || s.phase === 'lost') ? el('div', {
      style: { position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: th.overBg, borderRadius: 8, color: th.overText, padding: 14, gap: 8 }
    },
      el('div', { style: { fontSize: 20, fontWeight: 700 } }, s.phase === 'won' ? '扫雷成功！' : '踩雷了'),
      el('div', { style: { fontSize: 14 } }, s.phase === 'won' ? '用时 ' + s.elapsed + ' 秒（' + s.diffName + '）' : '用时 ' + s.elapsed + ' 秒'),
      el('div', { style: { display: 'flex', gap: 4 } },
        el('button', { onMouseDown: noFocus, onClick: () => setS(st => newState(st.diffKey)), style: { cursor: 'pointer', padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 14, background: th.overBtnBg, color: th.overBtnText } }, '再来一局'),
        el('button', { onMouseDown: noFocus, onClick: props.onOpenRank, style: btnStyle(th) }, '🏆 排行')
      )
    ) : null

    return el('div', { style: { position: 'relative' } },
      el('div', { style: { display: 'flex', gap: 8 } },
        el('div', { style: { padding: 5, background: 'transparent', border: '1px solid ' + th.boardBorder, borderRadius: 6 } }, rows),
        panel
      ),
      overOverlay
    )
  }

  return {
    id: 'minesweeper',
    title: '扫雷',
    icon: '💣',
    short: '扫雷',
    scoreOrder: 'asc',
    View
  }
})()


// ── src/games/breakout.js ──
// 🧱 Breakout — game module for the mini-games framework.
//
// DOM-rendered arcade board (no canvas / no requestAnimationFrame): a fixed-step
// timer moves the ball, the paddle follows held arrow keys, and each cleared
// level rebuilds the wall with a bonus. Losing all three balls ends the round.
const BREAKOUT = (() => {
  const W = 300
  const H = 200
  const R = 4
  const PADDLE_W = 54
  const PADDLE_H = 8
  const PADDLE_Y = H - 16
  const COLS = 7
  const BRICK_W = 38
  const BRICK_H = 12
  const GAP_X = 2
  const GAP_Y = 4
  const OFFSET_X = 6
  const OFFSET_Y = 26
  const ROW_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6']

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

  function buildBricks() {
    const bricks = []
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < COLS; col++) {
        bricks.push({
          x: OFFSET_X + col * (BRICK_W + GAP_X),
          y: OFFSET_Y + row * (BRICK_H + GAP_Y),
          color: ROW_COLORS[row % ROW_COLORS.length],
          alive: true
        })
      }
    }
    return bricks
  }

  function newState(level) {
    const startLevel = level || 1
    return {
      phase: 'ready',
      score: 0,
      lives: 3,
      level: startLevel,
      paddle: (W - PADDLE_W) / 2,
      ball: { x: W / 2, y: PADDLE_Y - R, vx: 0, vy: 0 },
      bricks: buildBricks(),
      notice: ''
    }
  }

  // Serve from wherever the paddle currently is; a hit near the edge leaves at
  // an angle rather than straight up.
  function launch(s) {
    const speed = 2.7 + Math.min(1, (s.level - 1) * 0.25)
    const rel = clamp((s.ball.x - (s.paddle + PADDLE_W / 2)) / (PADDLE_W / 2), -1, 1)
    const angle = rel * 0.7
    return Object.assign({}, s, {
      phase: 'playing',
      ball: { x: s.ball.x, y: s.ball.y, vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed },
      notice: ''
    })
  }

  function readyAt(s, paddle) {
    return Object.assign({}, s, {
      phase: 'ready',
      paddle,
      ball: { x: paddle + PADDLE_W / 2, y: PADDLE_Y - R, vx: 0, vy: 0 },
      notice: ''
    })
  }

  function step(s, keys) {
    if (s.phase !== 'ready' && s.phase !== 'playing') return s

    let paddle = s.paddle
    if (keys.left) paddle -= 4.6
    if (keys.right) paddle += 4.6
    paddle = clamp(paddle, 0, W - PADDLE_W)

    if (s.phase === 'ready') {
      return Object.assign({}, s, {
        paddle,
        ball: { x: paddle + PADDLE_W / 2, y: PADDLE_Y - R, vx: 0, vy: 0 }
      })
    }

    let { x, y, vx, vy } = s.ball
    const prevY = y
    x += vx
    y += vy

    if (x < R) { x = R; vx = Math.abs(vx) }
    else if (x > W - R) { x = W - R; vx = -Math.abs(vx) }
    if (y < R) { y = R; vy = Math.abs(vy) }

    // Paddle: bounce with an angle taken from the hit offset, then keep a
    // bounded speed so long rallies stay controllable.
    if (vy > 0 && y + R >= PADDLE_Y && y + R <= PADDLE_Y + PADDLE_H + R && x >= paddle - R && x <= paddle + PADDLE_W + R) {
      const speed = Math.min(6, Math.hypot(vx, vy) * 1.02)
      const rel = clamp((x - (paddle + PADDLE_W / 2)) / (PADDLE_W / 2), -1, 1)
      const angle = rel * 0.9
      vx = Math.sin(angle) * speed
      vy = -Math.cos(angle) * speed
      y = PADDLE_Y - R
    }

    // One brick bounce per tick: pick the first overlap and decide the axis from
    // where the ball was on the previous frame.
    let bricks = s.bricks
    let score = s.score
    let hit = false
    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i]
      if (!b.alive) continue
      if (x + R < b.x || x - R > b.x + BRICK_W || y + R < b.y || y - R > b.y + BRICK_H) continue
      bricks = bricks.slice()
      bricks[i] = Object.assign({}, b, { alive: false })
      score += 10
      if (prevY + R <= b.y || prevY - R >= b.y + BRICK_H) vy = -vy
      else vx = -vx
      hit = true
      break
    }
    if (hit) {
      const speed = Math.min(6, Math.hypot(vx, vy) * 1.012)
      const norm = Math.hypot(vx, vy) || 1
      vx = (vx / norm) * speed
      vy = (vy / norm) * speed
    }

    // Cleared the wall: bonus, next level, same score and lives.
    if (hit && bricks.every(b => !b.alive)) {
      const level = s.level + 1
      return Object.assign(readyAt(s, paddle), {
        level,
        score: score + 50 * s.level,
        bricks: buildBricks(),
        notice: '第 ' + level + ' 关'
      })
    }

    // Lost the ball.
    if (y - R > H) {
      const lives = s.lives - 1
      if (lives <= 0) {
        return Object.assign({}, s, { phase: 'over', paddle, bricks, score, ball: { x, y, vx, vy } })
      }
      return Object.assign(readyAt(s, paddle), { lives, score, bricks })
    }

    return Object.assign({}, s, { paddle, bricks, score, ball: { x, y, vx, vy } })
  }

  function View(props) {
    const timer = props.timer
    const th = props.th
    const active = props.active
    const onGameOver = props.onGameOver
    const [s, setS] = React.useState(() => newState(1))
    const keys = React.useRef({ left: false, right: false })
    const prevOver = React.useRef(false)

    React.useEffect(() => {
      if (!active || (s.phase !== 'ready' && s.phase !== 'playing')) return
      return timer.interval(() => setS(st => step(st, keys.current)), 16)
    }, [active, s.phase])

    React.useEffect(() => {
      if (!active) return
      const w = typeof window !== 'undefined' ? window : null
      if (!w) return
      const typing = (target) => {
        const tag = target && target.tagName ? String(target.tagName).toUpperCase() : ''
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (target && target.isContentEditable)
      }
      const onKeyDown = (e) => {
        if (typing(e.target)) return
        const k = e.key
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.current.left = true; e.preventDefault() }
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.current.right = true; e.preventDefault() }
        else if (k === ' ' || k === 'Spacebar' || k === 'p' || k === 'P') {
          e.preventDefault()
          setS(st => st.phase === 'ready'
            ? launch(st)
            : st.phase === 'playing'
              ? Object.assign({}, st, { phase: 'paused' })
              : st.phase === 'paused'
                ? Object.assign({}, st, { phase: 'playing' })
                : st)
        }
      }
      const onKeyUp = (e) => {
        const k = e.key
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.current.left = false
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.current.right = false
      }
      const onBlur = () => { keys.current.left = false; keys.current.right = false }
      w.addEventListener('keydown', onKeyDown)
      w.addEventListener('keyup', onKeyUp)
      w.addEventListener('blur', onBlur)
      return () => {
        w.removeEventListener('keydown', onKeyDown)
        w.removeEventListener('keyup', onKeyUp)
        w.removeEventListener('blur', onBlur)
      }
    }, [active])

    React.useEffect(() => {
      if (s.phase === 'over' && !prevOver.current) {
        onGameOver({ value: s.score, meta: '第 ' + s.level + ' 关' })
      }
      prevOver.current = s.phase === 'over'
    }, [s.phase])

    const bricks = s.bricks.map((b, i) => b.alive ? el('div', {
      key: i,
      style: {
        position: 'absolute', left: b.x, top: b.y, width: BRICK_W, height: BRICK_H,
        background: b.color, borderRadius: 2, opacity: .9
      }
    }) : null)

    const board = el('div', {
      style: {
        position: 'relative', width: W, height: H, overflow: 'hidden',
        border: '1px solid ' + th.boardBorder, borderRadius: 8, background: th.cellEmpty
      }
    },
      bricks,
      el('div', {
        style: {
          position: 'absolute', left: s.ball.x - R, top: s.ball.y - R, width: R * 2, height: R * 2,
          borderRadius: '50%', background: th.text
        }
      }),
      el('div', {
        style: {
          position: 'absolute', left: s.paddle, top: PADDLE_Y, width: PADDLE_W, height: PADDLE_H,
          borderRadius: 4, background: th.overBtnBg
        }
      }),
      s.phase === 'ready'
        ? el('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 30, textAlign: 'center', fontSize: 12, color: th.sub } }, '空格 / 点击发球')
        : null,
      s.phase === 'paused' ? el('div', {
        style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.overBg, color: th.overText, fontSize: 18, fontWeight: 700 }
      }, '已暂停') : null,
      s.phase === 'over' ? el('div', {
        style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: th.overBg, color: th.overText, gap: 8 }
      },
        el('div', { style: { fontSize: 20, fontWeight: 700 } }, '游戏结束'),
        el('div', { style: { fontSize: 14 } }, '得分 ' + s.score),
        el('div', { style: { display: 'flex', gap: 4 } },
          el('button', {
            onMouseDown: noFocus, onClick: () => setS(newState(1)),
            style: { cursor: 'pointer', padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 14, background: th.overBtnBg, color: th.overBtnText }
          }, '再来一局'),
          el('button', { onMouseDown: noFocus, onClick: props.onOpenRank, style: btnStyle(th) }, '🏆 排行')
        )
      ) : null
    )

    const statStyle = { fontSize: 12, margin: '2px 0', color: th.sub }
    const statRow = el('div', { style: { display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 6, whiteSpace: 'nowrap' } },
      el('span', { style: { fontSize: 20, fontWeight: 700 } }, String(s.score)),
      el('span', { style: statStyle }, '❤️'.repeat(Math.max(0, s.lives)) + '♡'.repeat(Math.max(0, 3 - s.lives))),
      el('span', { style: statStyle }, '第 ' + s.level + ' 关'),
      s.notice ? el('span', { style: statStyle }, s.notice) : null
    )

    const btn = (label, fn, title) => el('button', { onMouseDown: noFocus, onClick: fn, title, style: btnStyle(th) }, label)

    const controls = el('div', { style: { marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 2 } },
      btn('‹', () => { keys.current.left = true; setTimeout(() => { keys.current.left = false }, 90) }, '左移'),
      btn('›', () => { keys.current.right = true; setTimeout(() => { keys.current.right = false }, 90) }, '右移'),
      btn('发球', () => setS(st => st.phase === 'ready' ? launch(st) : st), '发球（空格）'),
      btn(s.phase === 'paused' ? '▶' : 'Ⅱ', () => setS(st => st.phase === 'playing' ? Object.assign({}, st, { phase: 'paused' }) : st.phase === 'paused' ? Object.assign({}, st, { phase: 'playing' }) : st), '暂停/继续（P）'),
      btn('↺', () => setS(newState(1)), '重新开始'),
      el('button', { onMouseDown: noFocus, onClick: props.onOpenRank, title: '排行榜', style: btnStyle(th) }, '🏆')
    )

    return el('div', null, statRow, board, controls,
      el('div', { style: { fontSize: 11, opacity: .55, marginTop: 6, lineHeight: 1.5 } }, '← → 移动挡板 · 空格发球 / 暂停'))
  }

  return {
    id: 'breakout',
    title: '打砖块',
    icon: '🧱',
    short: '砖块',
    scoreOrder: 'desc',
    View
  }
})()


// ── src/games/gomoku.js ──
// 🀄 Gomoku — game module for the mini-games framework.
//
// 13×13 DOM board. The player always holds black and moves first; white is a
// heuristic opponent that weighs its own threats against the player's. A win is
// scored by elapsed seconds (lower is better), so the leaderboard reads as the
// fastest wins.
const GOMOKU = (() => {
  const N = 13
  const CELL = 22
  const EMPTY = 0
  const BLACK = 1
  const WHITE = 2
  const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]]
  const STARS = {}
  ;[[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]].forEach(([x, y]) => { STARS[y * N + x] = true })

  const inBounds = (x, y) => x >= 0 && x < N && y >= 0 && y < N

  function emptyBoard() { return new Array(N * N).fill(EMPTY) }

  function newState() {
    return { board: emptyBoard(), phase: 'playing', elapsed: 0, moves: [], last: -1 }
  }

  // Five or more contiguous stones through `idx` for `player`?
  function fiveAt(board, idx, player) {
    const x = idx % N
    const y = (idx - x) / N
    for (const [dx, dy] of DIRECTIONS) {
      let count = 1
      for (const sign of [1, -1]) {
        let k = 1
        while (true) {
          const nx = x + dx * k * sign
          const ny = y + dy * k * sign
          if (!inBounds(nx, ny) || board[ny * N + nx] !== player) break
          count++
          k++
        }
      }
      if (count >= 5) return true
    }
    return false
  }

  // How valuable `player` would find the empty point (x, y): per direction, the
  // run length it would join and whether the run is open on each side.
  function lineScore(board, x, y, player, dx, dy) {
    let total = 1
    let openA = 0
    let openB = 0
    let k = 1
    while (true) {
      const nx = x + dx * k
      const ny = y + dy * k
      if (!inBounds(nx, ny)) break
      const v = board[ny * N + nx]
      if (v === player) { total++; k++ } else { if (v === EMPTY) openA = 1; break }
    }
    k = 1
    while (true) {
      const nx = x - dx * k
      const ny = y - dy * k
      if (!inBounds(nx, ny)) break
      const v = board[ny * N + nx]
      if (v === player) { total++; k++ } else { if (v === EMPTY) openB = 1; break }
    }
    const open = openA + openB
    if (total >= 5) return 10000000
    if (total === 4) return open === 2 ? 1000000 : (open === 1 ? 10000 : 0)
    if (total === 3) return open === 2 ? 5000 : (open === 1 ? 200 : 0)
    if (total === 2) return open === 2 ? 120 : (open === 1 ? 10 : 0)
    return open === 2 ? 5 : 1
  }

  function pointScore(board, idx, player) {
    const x = idx % N
    const y = (idx - x) / N
    let score = 0
    for (const [dx, dy] of DIRECTIONS) score += lineScore(board, x, y, player, dx, dy)
    // Mild centre preference: an empty corner is worth less than an empty middle.
    return score + 4 - Math.abs(x - 6) - Math.abs(y - 6)
  }

  function chooseAiMove(board) {
    let best = -1
    let bestScore = -Infinity
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== EMPTY) continue
      // Attack slightly ahead of defence so an own five is taken over a block,
      // while a live four is still answered.
      const score = pointScore(board, i, WHITE) * 1.08 + pointScore(board, i, BLACK) + Math.random() * 3
      if (score > bestScore) { bestScore = score; best = i }
    }
    return best
  }

  function afterMove(s, board, moves, idx, player) {
    if (fiveAt(board, idx, player)) {
      return Object.assign({}, s, {
        board, moves, last: idx, phase: player === BLACK ? 'won' : 'lost'
      })
    }
    if (board.every(v => v !== EMPTY)) {
      return Object.assign({}, s, { board, moves, last: idx, phase: 'draw' })
    }
    return Object.assign({}, s, { board, moves, last: idx })
  }

  function place(s, idx) {
    if (s.phase !== 'playing' || s.board[idx] !== EMPTY) return s
    const board = s.board.slice()
    board[idx] = BLACK
    const moves = s.moves.concat(idx)
    const afterPlayer = afterMove(s, board, moves, idx, BLACK)
    if (afterPlayer.phase !== 'playing') return afterPlayer

    const aiIdx = chooseAiMove(board)
    if (aiIdx < 0) return Object.assign({}, afterPlayer, { phase: 'draw' })
    const nextBoard = board.slice()
    nextBoard[aiIdx] = WHITE
    return afterMove(afterPlayer, nextBoard, moves.concat(aiIdx), aiIdx, WHITE)
  }

  function undo(s) {
    if (s.phase !== 'playing' || s.moves.length < 2) return s
    const moves = s.moves.slice(0, s.moves.length - 2)
    const board = emptyBoard()
    moves.forEach((m, i) => { board[m] = i % 2 === 0 ? BLACK : WHITE })
    return Object.assign({}, s, { board, moves, last: moves.length ? moves[moves.length - 1] : -1 })
  }

  function View(props) {
    const timer = props.timer
    const th = props.th
    const active = props.active
    const onGameOver = props.onGameOver
    const [s, setS] = React.useState(newState)
    const prevPhase = React.useRef('playing')

    React.useEffect(() => {
      if (!active || s.phase !== 'playing') return
      return timer.interval(() => {
        setS(st => st.phase === 'playing' ? Object.assign({}, st, { elapsed: st.elapsed + 1 }) : st)
      }, 1000)
    }, [active, s.phase])

    React.useEffect(() => {
      if (s.phase === 'won' && prevPhase.current !== 'won') {
        onGameOver({ value: s.elapsed, meta: '执黑 · ' + s.moves.length + ' 手' })
      }
      prevPhase.current = s.phase
    }, [s.phase])

    const cells = []
    for (let i = 0; i < s.board.length; i++) {
      const v = s.board[i]
      const isLast = s.last === i
      cells.push(el('div', {
        key: i,
        onClick: () => setS(st => place(st, i)),
        title: v === EMPTY ? '落子' : (v === BLACK ? '你的黑子' : '对手的白子'),
        style: {
          width: CELL, height: CELL, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'inset -1px -1px 0 ' + th.boardBorder,
          cursor: v === EMPTY && s.phase === 'playing' ? 'pointer' : 'default'
        }
      },
        v === EMPTY
          ? (STARS[i] ? el('div', { style: { width: 4, height: 4, borderRadius: '50%', background: th.sub, opacity: .55 } }) : null)
          : el('div', {
            style: {
              width: CELL - 5, height: CELL - 5, borderRadius: '50%',
              background: v === BLACK ? '#0f172a' : '#f8fafc',
              border: '1px solid ' + (v === BLACK ? 'rgba(248,250,252,.35)' : 'rgba(15,23,42,.35)'),
              boxShadow: isLast ? '0 0 0 2px ' + (v === BLACK ? '#38bdf8' : '#f59e0b') : 'none'
            }
          })
      ))
    }

    const rows = []
    for (let r = 0; r < N; r++) {
      rows.push(el('div', { key: r, style: { display: 'flex' } }, cells.slice(r * N, r * N + N)))
    }

    const statStyle = { fontSize: 12, margin: '2px 0', color: th.sub }
    const btn = (label, fn, title) => el('button', { onMouseDown: noFocus, onClick: fn, title, style: btnStyle(th) }, label)

    const panel = el('div', { style: { marginTop: 8 } },
      el('div', { style: { display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 6 } },
        el('span', { style: { fontSize: 20, fontWeight: 700 } }, s.elapsed + 's'),
        el('span', { style: statStyle }, s.moves.length + ' 手'),
        el('span', { style: statStyle }, '你执黑 · 先手')
      ),
      btn('悔棋', () => setS(undo), '撤销一回合'),
      btn('↺ 新局', () => setS(newState()), '重新开始'),
      el('button', { onMouseDown: noFocus, onClick: props.onOpenRank, title: '排行榜', style: btnStyle(th) }, '🏆')
    )

    const over = s.phase === 'playing' ? null : el('div', {
      style: {
        position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: th.overBg,
        borderRadius: 8, color: th.overText, padding: 14, gap: 8
      }
    },
      el('div', { style: { fontSize: 20, fontWeight: 700 } },
        s.phase === 'won' ? '五子连珠！' : s.phase === 'lost' ? '白棋连成五子' : '棋盘已满'),
      el('div', { style: { fontSize: 14 } }, '用时 ' + s.elapsed + ' 秒 · ' + s.moves.length + ' 手'),
      el('div', { style: { display: 'flex', gap: 4 } },
        el('button', {
          onMouseDown: noFocus, onClick: () => setS(newState()),
          style: { cursor: 'pointer', padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 14, background: th.overBtnBg, color: th.overBtnText }
        }, '再来一局'),
        el('button', { onMouseDown: noFocus, onClick: props.onOpenRank, style: btnStyle(th) }, '🏆 排行')
      )
    )

    return el('div', { style: { position: 'relative' } },
      el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
        el('div', {
          style: {
            padding: 5, border: '1px solid ' + th.boardBorder, borderRadius: 8,
            background: th.boardBg, display: 'flex', flexDirection: 'column'
          }
        }, rows)
      ),
      panel,
      over
    )
  }

  return {
    id: 'gomoku',
    title: '五子棋',
    icon: '🀄',
    short: '五子',
    scoreOrder: 'asc',
    View
  }
})()


// ── src/games/memory.js ──
// 🃏 Memory — game module for the mini-games framework.
//
// 5×4 board of face-down pairs. Two mismatched cards flip back after a beat; a
// cleared board is scored by elapsed seconds (lower is better) with the number
// of pair attempts kept in the record's meta.
const MEMORY = (() => {
  const COLS = 5
  const ROWS = 4
  const CARD = 52
  const FACES = ['🍎', '🍇', '🍋', '🍉', '🍓', '🥑', '🍒', '🍑', '🌽', '🍄']

  function newState() {
    const deck = []
    FACES.forEach((face, k) => { deck.push({ k, face }); deck.push({ k, face }) })
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const swap = deck[i]
      deck[i] = deck[j]
      deck[j] = swap
    }
    return {
      cards: deck.map(c => ({ k: c.k, face: c.face, up: false, matched: false })),
      open: [],
      moves: 0,
      elapsed: 0,
      phase: 'playing',
      locked: false
    }
  }

  function flip(s, idx) {
    if (s.phase !== 'playing' || s.locked) return s
    const card = s.cards[idx]
    if (!card || card.up || card.matched) return s

    const cards = s.cards.slice()
    cards[idx] = Object.assign({}, card, { up: true })
    const open = s.open.concat(idx)

    if (open.length < 2) return Object.assign({}, s, { cards, open })

    const moves = s.moves + 1
    const [a, b] = open
    if (cards[a].k === cards[b].k) {
      cards[a] = Object.assign({}, cards[a], { matched: true })
      cards[b] = Object.assign({}, cards[b], { matched: true })
      const cleared = cards.every(c => c.matched)
      return Object.assign({}, s, { cards, open: [], moves, phase: cleared ? 'won' : 'playing' })
    }
    // Keep both faces visible until the caller's timer flips them back.
    return Object.assign({}, s, { cards, open, moves, locked: true })
  }

  function closePair(s) {
    if (!s.locked) return s
    const cards = s.cards.map(c => (c.matched || !c.up ? c : Object.assign({}, c, { up: false })))
    return Object.assign({}, s, { cards, open: [], locked: false })
  }

  function View(props) {
    const timer = props.timer
    const th = props.th
    const active = props.active
    const onGameOver = props.onGameOver
    const [s, setS] = React.useState(newState)
    const prevPhase = React.useRef('playing')

    React.useEffect(() => {
      if (!active || s.phase !== 'playing') return
      return timer.interval(() => {
        setS(st => st.phase === 'playing' ? Object.assign({}, st, { elapsed: st.elapsed + 1 }) : st)
      }, 1000)
    }, [active, s.phase])

    // Flip a mismatched pair back after a short beat; the cleanup cancels the
    // pending flip when the component unmounts or another pair is opened.
    React.useEffect(() => {
      if (!s.locked) return
      const w = typeof window !== 'undefined' ? window : null
      if (!w) return
      const id = w.setTimeout(() => setS(closePair), 650)
      return () => w.clearTimeout(id)
    }, [s.locked, s.open.length])

    React.useEffect(() => {
      if (s.phase === 'won' && prevPhase.current !== 'won') {
        onGameOver({ value: s.elapsed, meta: '步数 ' + s.moves })
      }
      prevPhase.current = s.phase
    }, [s.phase])

    const cards = s.cards.map((c, i) => el('div', {
      key: i,
      onClick: () => setS(st => flip(st, i)),
      title: c.matched ? '已配对' : (c.up ? c.face : '翻开'),
      style: {
        width: CARD, height: CARD, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, userSelect: 'none', borderRadius: 8, cursor: c.matched ? 'default' : 'pointer',
        background: c.up || c.matched ? th.cellEmpty : th.btnBg,
        border: '1px solid ' + (c.matched ? 'transparent' : th.btnBorder),
        opacity: c.matched ? .45 : 1,
        transition: 'background .12s, opacity .12s'
      }
    }, c.up || c.matched ? c.face : '?'))

    const rows = []
    for (let r = 0; r < ROWS; r++) {
      rows.push(el('div', { key: r, style: { display: 'flex', gap: 6, marginBottom: 6 } }, cards.slice(r * COLS, r * COLS + COLS)))
    }

    const statStyle = { fontSize: 12, margin: '2px 0', color: th.sub }
    const btn = (label, fn, title) => el('button', { onMouseDown: noFocus, onClick: fn, title, style: btnStyle(th) }, label)

    const matched = s.cards.filter(c => c.matched).length / 2
    const panel = el('div', { style: { marginTop: 6 } },
      el('div', { style: { display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 6 } },
        el('span', { style: { fontSize: 20, fontWeight: 700 } }, s.elapsed + 's'),
        el('span', { style: statStyle }, s.moves + ' 步'),
        el('span', { style: statStyle }, matched + '/' + FACES.length + ' 对')
      ),
      btn('↺ 新局', () => setS(newState()), '重新开始'),
      el('button', { onMouseDown: noFocus, onClick: props.onOpenRank, title: '排行榜', style: btnStyle(th) }, '🏆')
    )

    const over = s.phase === 'won' ? el('div', {
      style: {
        position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: th.overBg,
        borderRadius: 8, color: th.overText, padding: 14, gap: 8
      }
    },
      el('div', { style: { fontSize: 20, fontWeight: 700 } }, '全部配对！'),
      el('div', { style: { fontSize: 14 } }, '用时 ' + s.elapsed + ' 秒 · ' + s.moves + ' 步'),
      el('div', { style: { display: 'flex', gap: 4 } },
        el('button', {
          onMouseDown: noFocus, onClick: () => setS(newState()),
          style: { cursor: 'pointer', padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 14, background: th.overBtnBg, color: th.overBtnText }
        }, '再来一局'),
        el('button', { onMouseDown: noFocus, onClick: props.onOpenRank, style: btnStyle(th) }, '🏆 排行')
      )
    ) : null

    return el('div', { style: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' } },
      rows,
      panel,
      over
    )
  }

  return {
    id: 'memory',
    title: '记忆翻牌',
    icon: '🃏',
    short: '翻牌',
    scoreOrder: 'asc',
    View
  }
})()


// ── src/client.js ──
// Browser half entry: registers the launcher entry and the floating window,
// and owns the game roster.

const GAMES = [TETRIS, SNAKE, G2048, MINESWEEPER, BREAKOUT, GOMOKU, MEMORY]

// Hard dependencies. `slots` seats our two registrations; `timer` supplies the
// disposers the game boards run their clocks through.
const inject = ['slots', 'timer']

function apply(ctx) {
  // `ctx.get(name)` is a lifecycle verb, so it works both under the bundle
  // Client Loader's own context and under the restricted facade a dynamic
  // runner hands a plugin. Reading `ctx.slots` directly would only work in the
  // first case.
  const slots = ctx.get('slots')
  const timer = ctx.get('timer')
  if (slots === undefined || timer === undefined) return
  const store = makeStore()

  // The launcher sits in the Session header's right-aligned utilities row — the
  // page's top-right corner. In the dsh 0.2.1 slot catalog this seat is:
  //
  //   conversation.session.header.utilities   kind: list, scope: session,
  //                                           replaceRisk: none,
  //                                           options: id (required), order, label
  //
  // A fresh id is ADDED beside the shipped entries (open-in-app,
  // schedule-catalog, session-log-download) instead of replacing one. The
  // sibling `conversation.session.header.corner` is a `single` and already
  // occupied, so registering there would hide a shipped control.
  // `order: 20` sorts it after the shipped entries, at the row's right edge.
  //
  // This slot is Session-scoped: on the blank/Hero screen there is no header and
  // therefore no launcher. The window itself lives in `shell.overlay`, which is
  // root-scoped, so a game already open stays open across that transition.
  ctx.effect(() => slots.inject('conversation.session.header.utilities', () => slots.register(
    { name: 'conversation.session.header.utilities', id: 'minigames-launch', order: 20, label: '小游戏' },
    () => el(LaunchButton, { store })
  )))

  // `shell.overlay` is the frame-wide floating layer above every column
  // (kind: list, scope: root in 0.2.1), which is where a draggable game window
  // belongs. Filling it does not reserve layout space, so it never disturbs the
  // three-column frame.
  ctx.effect(() => slots.inject('shell.overlay', () => slots.register(
    { name: 'shell.overlay', id: 'minigames-window', order: 10, label: '小游戏' },
    () => el(MiniGamesWindow, { store, games: GAMES, timer })
  )))
}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
