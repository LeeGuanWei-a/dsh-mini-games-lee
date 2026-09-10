# 🎮 dsh-mini-games — DeepSeek Harness 小游戏合集

在 **DeepSeek Harness Web GUI** 上运行的小游戏合集：一个毛玻璃悬浮窗，内含 **4 个游戏**，可随时切换、拖动、收起。

| 游戏 | 玩法 | 排行榜 |
|---|---|---|
| 🕹️ **俄罗斯方块** | 7-bag 出块、墙踢旋转、消行计分、逐级加速、下一块预览 | 分数（高→低） |
| 🐍 **贪吃蛇** | 15×15 网格，吃食物变长、撞墙/自撞结束、每 3 个加速一级 | 分数（高→低） |
| 🔢 **2048** | 4×4 合并到 2048，键盘或屏幕方向键 | 分数（高→低） |
| 💣 **扫雷** | 初级 9×9/10 雷、中级 12×12/24 雷，左键翻开 / 右键标记，首点安全 | 用时（低→高） |

共性：
- ☀️/🌙 深浅色主题一键切换，毛玻璃背景
- 窗口可拖到页面任意位置，`▁`/`✕` 收起为标题条（自动暂停），`□` 还原
- **每个游戏独立排行榜**（最近 10 局，localStorage 持久化、可清空）
- 键盘全局操作（打开期间无需点击窗口），同时提供屏幕按钮，输入框打字不受影响

## ✅ 运行环境（版本标识）

| 组件 | 版本 |
|---|---|
| `@deepseek-ai/dsh`（Harness CLI / Web GUI） | **`0.1.2-rc.1`**（开发与实测版本） |
| Web GUI 地址 | `http://127.0.0.1:3080` |
| 宿主接口依赖 | `shell.overlay`、`conversation.session.header.utilities`、`timer`（`inject: ['timer']`） |
| 插件形态 | Host-resident Client Plugin（node 半区空 apply + 浏览器半区 `./client`） |

> ⚠️ `dsh.client` 元数据、`window.__ModuleLoader__.load` 浏览器产物与宿主 roster 扫描机制**绑定本版本 harness**。换版本装配前请核对插槽名与 `timer` 契约。

## 🚀 安装（一条命令）

仓库根目录即 npm 包，`lib/` 已构建并提交，可直接从 GitHub 安装：

```sh
dsh plugin --profile web add github:LeeGuanWei-a/dsh-mini-games
```

安装时包内 `dsh.bundle.patch`（`cordis.patch.yml`）会把插件行自动插入 profile 层叠：

```yaml
- insert:
    - id: dsh-mini-games
      name: 'dsh-mini-games'
```

重启 Web 后：页面中央出现小游戏窗口；会话头部右侧工具区出现 🎮 入口（用来重新打开）。

**升级 / 回滚**：

```sh
dsh plugin --profile web remove dsh-mini-games
dsh plugin --profile web add github:LeeGuanWei-a/dsh-mini-games
```

## 🎮 操作

窗口顶部是一排 **游戏标签**，点击切换（切换会开始新的一局）。

**俄罗斯方块**

| 键盘 | 屏幕按钮 | 操作 |
|---|---|---|
| `←` / `→` | ← → | 左右移动 |
| `↓` | ▼ | 软降（+1/格） |
| `↑` 或 `X` | ↻ | 旋转（带墙踢） |
| `Z` | — | 反向旋转 |
| `空格` | ⤓ | 硬降（+2/格） |
| `P` | Ⅱ | 暂停 / 继续 |

**贪吃蛇**：`←`/`→`/`↑`/`↓`（或 `WASD`）转向，`空格`/`P` 暂停；反向输入会被忽略。
**2048**：`←`/`→`/`↑`/`↓`（或 `WASD`）滑动合并，`P` 暂停。
**扫雷**：左键翻开、右键插旗；先点第一格才布雷（该格及周围保证无雷）；初级/中级按钮切换难度。

## 📦 仓库结构

```
dsh-mini-games/
├── package.json            # npm 包：dsh.bundle.patch + dsh.client 元数据 + exports
├── cordis.patch.yml        # 自注册插件行（安装自动插入 profile）
├── src/
│   ├── index.js            # node 半区：空 apply（纯 UI 插件）
│   ├── client.js           # 浏览器半区入口：游戏注册表 + apply
│   ├── shared/
│   │   ├── theme.js        # 深浅色板
│   │   ├── records.js      # 按游戏分库的 localStorage 排行榜
│   │   ├── store.js        # 窗口状态（open/theme/pos/game）
│   │   └── ui.js           # 悬浮窗框架：拖拽、游戏标签、通用排行榜、入口按钮
│   └── games/
│       ├── tetris.js       # 🕹️ 俄罗斯方块
│       ├── snake.js        # 🐍 贪吃蛇
│       ├── g2048.js        # 🔢 2048
│       └── minesweeper.js  # 💣 扫雷
├── lib/                    # 已构建产物（提交在仓库，克隆即装）
│   ├── index.js
│   └── client.js           # 全部模块内联 + ModuleLoader 注册形态
└── scripts/build-lib.mjs   # src → lib 内联打包（改源码后 npm run build）
```

### 加一个新游戏

1. 在 `src/games/` 新建模块，导出一个游戏对象：

```js
export const MYGAME = (() => {
  function View(props) {           // props: { ctx, th, active, onGameOver, onOpenRank }
    // 用 el(...) 渲染；props.th 提供当前主题色；
    // props.active 为 false 时不要跑时钟/键盘；
    // 一局结束时调用一次 onGameOver({ value: 分数, meta: '说明文字' })
  }
  return { id: 'mygame', title: '我的游戏', icon: '🎯', short: '短名', scoreOrder: 'desc', View }
})()
```

2. 在 `src/client.js` 的 `GAMES` 数组里加入它；
3. 把新文件加到 `scripts/build-lib.mjs` 的 `MODULES` 列表（放在 `client.js` 之前）；
4. `npm run build` 重新生成 `lib/`（记得提交）。

## 🏆 排行榜说明

- 每个游戏独立存储：`dsh.minigames.records.v1.<gameId>`；
- 每局结束自动记录（扫雷只记胜利局），保留最近 10 条；
- 排序：多数游戏按分数降序，扫雷按用时升序；
- 数据保存在**本机浏览器** localStorage，清站点数据 / 无痕 / 换浏览器会丢；
- 排行榜视图内可两次点击清空当前游戏的记录。

## 📄 许可证

MIT。
