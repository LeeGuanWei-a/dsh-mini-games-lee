// Window-level state shared by the launcher button and the floating window.
export function makeStore() {
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

export function useStore(store) {
  const [, force] = React.useState(0)
  React.useEffect(() => store.sub(() => force(n => n + 1)), [])
  return store
}

export function winDefaultPos() {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440
  return { x: Math.max(12, Math.round((vw - 340) / 2)), y: 72 }
}
