// 🕹️ Tetris — game module for the mini-games framework.
//
// Self-contained engine + board view. The framework owns the window chrome,
// theme, drag, collapse and the cross-game leaderboard; this module only
// renders its own area and calls onGameOver once per finished round.
export const TETRIS = (() => {
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
