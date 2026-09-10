// 🔢 2048 — game module for the mini-games framework.
//
// 4×4 grid, DOM-rendered, keyboard + on-screen direction buttons.
export const G2048 = (() => {
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
