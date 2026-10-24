// 🧱 Breakout — game module for the mini-games framework.
//
// DOM-rendered arcade board (no canvas / no requestAnimationFrame): a fixed-step
// timer moves the ball, the paddle follows held arrow keys, and each cleared
// level rebuilds the wall with a bonus. Losing all three balls ends the round.
export const BREAKOUT = (() => {
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
