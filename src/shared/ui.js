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
export const el = React.createElement

export function noFocus(e) { e.preventDefault() }

export function btnStyle(th, danger) {
  return {
    cursor: 'pointer', margin: 2, padding: '3px 7px', borderRadius: 5, fontSize: 13,
    color: danger ? '#ef4444' : 'inherit',
    border: '1px solid ' + (danger ? 'rgba(239,68,68,.6)' : th.btnBorder),
    background: danger ? 'rgba(239,68,68,.12)' : th.btnBg
  }
}

export function MiniGamesWindow(props) {
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

export function LaunchButton(props) {
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
