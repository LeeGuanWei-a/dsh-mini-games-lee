// 🃏 Memory — game module for the mini-games framework.
//
// 5×4 board of face-down pairs. Two mismatched cards flip back after a beat; a
// cleared board is scored by elapsed seconds (lower is better) with the number
// of pair attempts kept in the record's meta.
export const MEMORY = (() => {
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
