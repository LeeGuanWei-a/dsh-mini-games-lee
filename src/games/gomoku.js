// 🀄 Gomoku — game module for the mini-games framework.
//
// 13×13 DOM board. The player always holds black and moves first; white is a
// heuristic opponent that weighs its own threats against the player's. A win is
// scored by elapsed seconds (lower is better), so the leaderboard reads as the
// fastest wins.
export const GOMOKU = (() => {
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
