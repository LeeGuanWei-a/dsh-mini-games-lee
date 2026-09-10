// 🐍 Snake — game module for the mini-games framework.
//
// Grid-based, DOM-rendered (no canvas / no requestAnimationFrame), so it stays
// compatible with the dynamic-plugin sandbox as well as the host-resident build.
export const SNAKE = (() => {
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
    const ctx = props.ctx
    const th = props.th
    const active = props.active
    const onGameOver = props.onGameOver
    const [s, setS] = React.useState(newSnakeState)
    const prevOver = React.useState({ current: false })[0]
    const v = s

    React.useEffect(() => {
      if (!active || v.over || v.paused) return
      return ctx.interval(() => setS(step), speedFor(v.eaten))
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
