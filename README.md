# 🎮 dsh-mini-games-lee — DeepSeek Harness 小游戏合集

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

## ✅ 运行环境（DSH 版本标识）

| 组件 | 版本 |
|---|---|
| `@deepseek-ai/dsh-desktop-runtime`（DeepSeek Harness Desktop） | **`0.2.0-rc.2`**（已实测） |
| `@deepseek-ai/dsh`（Harness CLI / Web GUI） | **`0.2.0-rc.2`**（已实测） |
| 宿主接口依赖 | `shell.overlay`、`conversation.session.header.utilities`、`timer`（`inject: ['timer']`） |
| 插件形态 | **`cordis_define` 动态 Plugin**（模型 / 用户 / panel 触发均可） |

> ⚠️ v0.2.0-rc.2 改用 `cordis_define` 动态 plugin 模型（旧的 `exports["./client"]` + `cordis.patch.yml` bundle 注册机制已被弃用）。本仓库现在提供 `dist/cordis-plugin.code.txt`（可直接粘贴进 `cordis_define` 工具调用），桌面端与 Web 端都能用 —— 二者共用 dsh-web-app 的 `__DSH_BOOT__` 注入链路。

> 🔧 **为什么还保留 `cordis.patch.yml` 和 `dsh.bundle.patch`**：DSH 0.2.0-rc.2 的 `loadProfileDirectory` 在 `pnpm add` 时**强制**读取 `dsh.bundle.patch` 指向的文件（缺失就抛 ENOENT）。本仓库把 `cordis.patch.yml` 内容改为空数组 `[]`，通过验证但不向 profile layer stack 插入任何东西；实际 plugin 行通过 `cordis_define` 注册。

## 🚀 安装（DSH 0.2.0-rc.2+）

1. **构建 cordis 载荷**：

   ```sh
   npm install
   npm run build:cordis
   ```

   生成：
   - `dist/cordis-plugin.code.txt` —— 人读可粘贴进 `cordis_define` 工具的 `code.host` / `code.client`
   - `dist/cordis-plugin.js` —— CommonJS 导出 (`{ host, client }`)

2. **加载到 DSH**（任选其一）：

   a. **present 文件**：把 `dist/cordis-plugin.code.txt` 拖到 DeepSeek Harness Web GUI，让模型用 `present` 工具读它，然后请模型 `cordis_define` 加载。

   b. **手动 cordis_define**：在 DSH 任意会话里，让模型执行：

   ```json
   cordis_define({
     "name": "小游戏合集",
     "purpose": "DSH 毛玻璃悬浮小游戏合集：俄罗斯方块 / 贪吃蛇 / 2048 / 扫雷",
     "plugin": { "kind": "new", "idPrefix": "minig" },
     "code": {
       "host": "<<<见 cordis-plugin.code.txt 的 <<<HOST>>> 段>>>",
       "client": "<<<见 cordis-plugin.code.txt 的 <<<CLIENT>>> 段>>>"
     }
   })
   ```

   首次加载会弹出 client approval；批准后页面中央出现小游戏窗口，会话头部右侧工具区出现 🎮 入口。

   c. **PNPM / NPM 安装**（**仅是占位** —— 真要用仍需走 `cordis_define`）：

   ```sh
   pnpm add github:LeeGuanWei-a/dsh-mini-games-lee
   # 或本地：pnpm add F:\Projects\dsh-mini-games-lee
   ```

   安装会被 DSH 接受（`cordis.patch.yml` 是合法的空 patch list），但**不会自动挂载** —— 你仍需在 DSH 里跑一次 `cordis_define` 触发 client 半区加载。

3. **回滚**：

   ```sh
   cordis_undefine({ pluginId: "minig.<id>" })
   # 卸载 npm 安装：
   pnpm remove dsh-mini-games-lee
   ```

## 🎮 操作

窗口顶部是一排 **游戏标签**，点击切换（切换会开始新的一局）。

### 🕹️ 俄罗斯方块

| 操作 | 按键 / 屏幕按钮 |
|---|---|
| 左右移动 | `←` / `→`，或 ← → |
| 软降（+1/格） | `↓`，或 ▼ |
| 旋转（带墙踢） | `↑` 或 `X`，或 ↻ |
| 反向旋转 | `Z` |
| 硬降（+2/格） | `空格`，或 ⤓ |
| 暂停 / 继续 | `P`，或 Ⅱ |

### 🐍 贪吃蛇

| 操作 | 按键 / 屏幕按钮 |
|---|---|
| 转向（反向输入被忽略） | `←` `→` `↑` `↓` 或 `WASD`，或 ↑ ← ↓ → |
| 暂停 / 继续 | `空格` 或 `P`，或 Ⅱ |

### 🔢 2048

| 操作 | 按键 / 屏幕按钮 |
|---|---|
| 滑动合并 | `←` `→` `↑` `↓` 或 `WASD`，或 ↑ ← ↓ → |
| 暂停 / 继续 | `P`，或 Ⅱ |

### 💣 扫雷

| 操作 | 按键 / 屏幕按钮 |
|---|---|
| 翻开格子（首次点击才布雷，该格及周围保证无雷） | 鼠标左键 |
| 插旗 / 取消插旗 | 鼠标右键 |
| 切换难度（初级 9×9 · 中级 12×12） | 初级 / 中级 |
| 重新开始 | ↺ 新局 |

## 📦 仓库结构

```
dsh-mini-games-lee/
├── package.json            # npm 包：cordis_define 产物 + cordis.patch.yml (归档)
├── cordis.patch.yml        # 归档（DSH 0.1.x bundle patch 模型，本版本不再走它）
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
├── dist/                   # cordis_define 产物（`npm run build:cordis` 生成）
│   ├── cordis-plugin.code.txt
│   └── cordis-plugin.js
└── scripts/
    ├── build-cordis.mjs    # src → cordis_define 文本（esbuild）
    ├── smoke-cordis.mjs    # happy-dom 闭包烟测
    ├── dev-cordis.mjs      # 浏览器 visual smoke
    ├── build-lib.mjs       # 归档（旧的 src → lib 内联打包）
    ├── smoke.mjs           # 旧 store 模型断言（保留）
    ├── render-check.mjs    # 旧 React DOM 渲染检查（保留）
    └── ...
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
3. `npm run build:cordis` 重新生成 `dist/` 并粘贴进 `cordis_define`。

## 🏆 排行榜说明

- 每个游戏独立存储：`dsh.minigames.records.v1.<gameId>`；
- 每局结束自动记录（扫雷只记胜利局），保留最近 10 条；
- 排序：多数游戏按分数降序，扫雷按用时升序；
- 数据保存在**本机浏览器** localStorage，清站点数据 / 无痕 / 换浏览器会丢；
- 排行榜视图内可两次点击清空当前游戏的记录。

## 🛠️ 本地校验（无需宿主）

```sh
npm install
npm run check       # build:cordis + smoke:cordis + smoke + render-check
```

- `npm run build:cordis` —— esbuild 把 `src/client.js` 与 `src/shared/*`、`src/games/*` 打包成 cordis_define 用的 client 半区
- `npm run smoke:cordis` —— 用 happy-dom + 真实 dsh `cordis-client-runner` 闭包签名执行 client 半区，断言两个 slot 都被注册
- `npm run dev:cordis` —— 起一个本地 dev server，浏览器加载 client 半区代码，模拟 dsh 渲染，肉眼确认 4 个游戏都可玩

## 📄 许可证

MIT。
