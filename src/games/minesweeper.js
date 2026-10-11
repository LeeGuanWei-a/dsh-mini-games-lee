// 💣 Minesweeper — game module for the mini-games framework.
//
// Two difficulties, DOM grid, left-click reveal / right-click flag.
// Ranked by elapsed seconds (lower is better) on a win.
export const MINESWEEPER = (() => {
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
