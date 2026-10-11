// Browser half entry: registers the launcher entry and the floating window,
// and owns the game roster.
import { MiniGamesWindow, LaunchButton } from './shared/ui.js'
import { makeStore } from './shared/store.js'
import { TETRIS } from './games/tetris.js'
import { SNAKE } from './games/snake.js'
import { G2048 } from './games/g2048.js'
import { MINESWEEPER } from './games/minesweeper.js'

const GAMES = [TETRIS, SNAKE, G2048, MINESWEEPER]

// Hard dependencies. `slots` seats our two registrations; `timer` supplies the
// disposers the game boards run their clocks through.
export const inject = ['slots', 'timer']

export function apply(ctx) {
  // `ctx.get(name)` is a lifecycle verb, so it works both under the bundle
  // Client Loader's own context and under the restricted facade the dynamic
  // `cordis_define` half receives. Reading `ctx.slots` directly would only
  // work in the first case.
  const slots = ctx.get('slots')
  const timer = ctx.get('timer')
  if (slots === undefined || timer === undefined) return
  const store = makeStore()

  // The launcher sits in the Session header's right-aligned utilities row — the
  // page's top-right corner. Two things make it the right seat:
  //   - it is a `list` with replaceRisk "none", so a fresh id is ADDED beside the
  //     shipped entries (open-in-app, session-log-download) instead of replacing
  //     one. The sibling `conversation.session.header.corner` is a `single` with
  //     replaceRisk "shadows-shipped-ui" and is already occupied, so registering
  //     there would hide a shipped control.
  //   - `order: 20` sorts it after the shipped entries, at the row's right edge.
  //
  // This slot is Session-scoped: on the blank/Hero screen there is no header and
  // therefore no launcher. The window itself lives in `shell.overlay`, which is
  // root-scoped, so a game already open stays open across that transition.
  ctx.effect(() => slots.inject('conversation.session.header.utilities', () => slots.register(
    { name: 'conversation.session.header.utilities', id: 'minigames-launch', order: 20, label: '小游戏' },
    () => el(LaunchButton, { store })
  )))

  // `shell.overlay` is the frame-wide floating layer above every column, which
  // is where a draggable game window belongs.
  ctx.effect(() => slots.inject('shell.overlay', () => slots.register(
    { name: 'shell.overlay', id: 'minigames-window', order: 10, label: '小游戏' },
    () => el(MiniGamesWindow, { store, games: GAMES, timer })
  )))
}
