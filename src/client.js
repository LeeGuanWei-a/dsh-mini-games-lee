// Browser half entry: registers the launcher entry and the floating window,
// and owns the game roster.
import { MiniGamesWindow, LaunchButton } from './shared/ui.js'
import { makeStore } from './shared/store.js'
import { TETRIS } from './games/tetris.js'
import { SNAKE } from './games/snake.js'
import { G2048 } from './games/g2048.js'
import { MINESWEEPER } from './games/minesweeper.js'

const GAMES = [TETRIS, SNAKE, G2048, MINESWEEPER]

export const inject = ['timer']

export function apply(ctx) {
  const slots = ctx.get('slots')
  if (slots === undefined) return
  const store = makeStore()

  // Entry sits in the session header's right-aligned utilities row (an icon
  // strip) rather than the shared sidebar footer row, which other plugins
  // already crowd.
  slots.inject('conversation.session.header.utilities', () => slots.register(
    { name: 'conversation.session.header.utilities', id: 'minigames-launch', order: 20, label: '小游戏' },
    () => el(LaunchButton, { store })
  ))

  slots.inject('shell.overlay', () => slots.register(
    { name: 'shell.overlay', id: 'minigames-window', order: 10, label: '小游戏' },
    () => el(MiniGamesWindow, { store, ctx, games: GAMES })
  ))
}
