// Browser half entry: registers the launcher entry and the floating window,
// and owns the game roster.
import { MiniGamesWindow, LaunchButton } from './shared/ui.js'
import { makeStore } from './shared/store.js'
import { TETRIS } from './games/tetris.js'
import { SNAKE } from './games/snake.js'
import { G2048 } from './games/g2048.js'
import { MINESWEEPER } from './games/minesweeper.js'
import { BREAKOUT } from './games/breakout.js'
import { GOMOKU } from './games/gomoku.js'
import { MEMORY } from './games/memory.js'

const GAMES = [TETRIS, SNAKE, G2048, MINESWEEPER, BREAKOUT, GOMOKU, MEMORY]

// Hard dependencies. `slots` seats our two registrations; `timer` supplies the
// disposers the game boards run their clocks through.
export const inject = ['slots', 'timer']

export function apply(ctx) {
  // `ctx.get(name)` is a lifecycle verb, so it works both under the bundle
  // Client Loader's own context and under the restricted facade a dynamic
  // runner hands a plugin. Reading `ctx.slots` directly would only work in the
  // first case.
  const slots = ctx.get('slots')
  const timer = ctx.get('timer')
  if (slots === undefined || timer === undefined) return
  const store = makeStore()

  // The launcher sits in the Session header's right-aligned utilities row — the
  // page's top-right corner. In the dsh 0.2.1 slot catalog this seat is:
  //
  //   conversation.session.header.utilities   kind: list, scope: session,
  //                                           replaceRisk: none,
  //                                           options: id (required), order, label
  //
  // A fresh id is ADDED beside the shipped entries (open-in-app,
  // schedule-catalog, session-log-download) instead of replacing one. The
  // sibling `conversation.session.header.corner` is a `single` and already
  // occupied, so registering there would hide a shipped control.
  // `order: 20` sorts it after the shipped entries, at the row's right edge.
  //
  // This slot is Session-scoped: on the blank/Hero screen there is no header and
  // therefore no launcher. The window itself lives in `shell.overlay`, which is
  // root-scoped, so a game already open stays open across that transition.
  ctx.effect(() => slots.inject('conversation.session.header.utilities', () => slots.register(
    { name: 'conversation.session.header.utilities', id: 'minigames-launch', order: 20, label: '小游戏' },
    () => el(LaunchButton, { store })
  )))

  // `shell.overlay` is the frame-wide floating layer above every column
  // (kind: list, scope: root in 0.2.1), which is where a draggable game window
  // belongs. Filling it does not reserve layout space, so it never disturbs the
  // three-column frame.
  ctx.effect(() => slots.inject('shell.overlay', () => slots.register(
    { name: 'shell.overlay', id: 'minigames-window', order: 10, label: '小游戏' },
    () => el(MiniGamesWindow, { store, games: GAMES, timer })
  )))
}
