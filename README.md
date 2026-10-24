# 🎮 dsh-mini-games-lee — DeepSeek Harness 小游戏合集

在 **DeepSeek Harness Web GUI** 上运行的小游戏合集：一个毛玻璃悬浮窗，内含 **7 个游戏**，可随时切换、拖动、收起。

| 游戏 | 玩法 | 排行榜 |
|---|---|---|
| 🕹️ **俄罗斯方块** | 7-bag 出块、墙踢旋转、消行计分、逐级加速、下一块预览 | 分数（高→低） |
| 🐍 **贪吃蛇** | 15×15 网格，吃食物变长、撞墙/自撞结束、每 3 个加速一级 | 分数（高→低） |
| 🔢 **2048** | 4×4 合并到 2048，键盘或屏幕方向键 | 分数（高→低） |
| 💣 **扫雷** | 初级 9×9/10 雷、中级 12×12/24 雷，左键翻开 / 右键标记，首点安全 | 用时（低→高） |
| 🧱 **打砖块** | 300×200 弹球台，7×4 砖墙、挡板控角、逐关加速与奖励分、三条命 | 分数（高→低） |
| 🀄 **五子棋** | 13×13 棋盘，你执黑先手，启发式白棋 AI（会连五也会封四），可悔棋 | 用时（低→高） |
| 🃏 **记忆翻牌** | 5×4 共 10 对，翻错 0.65s 自动盖回 | 用时（低→高） |

共性：
- ☀️/🌙 深浅色主题一键切换，毛玻璃背景
- 窗口可拖到页面任意位置，`▁`/`✕` 收起为标题条（自动暂停），`□` 还原
- **每个游戏独立排行榜**（最近 10 局，localStorage 持久化、可清空）
- 键盘全局操作（打开期间无需点击窗口），同时提供屏幕按钮，输入框打字不受影响

## ✅ 运行环境

| 组件 | 版本 |
|---|---|
| `@deepseek-ai/dsh`（Desktop / Web GUI） | **`0.2.1-rc.2`**（当前安装版，已实测） |
| 前一版 | `0.2.0-rc.2`（同一套 API，仍兼容） |
| 插件形态 | **profile bundle**（`dsh.bundle.patch` + `dsh.client`），经 Plugin Manager 安装 |
| 客户端硬依赖 | `slots`（两个槽位）、`timer`（各游戏时钟）、平台模块 `react` |
| 占用槽位 | `conversation.session.header.utilities`（`list` / `session`）、`shell.overlay`（`list` / `root`） |
| 已不再使用 | `cordis_define` / `cordis_run`（见下） |

> 📌 **0.2.1 的槽位契约**（取自宿主自带的 slot catalog，`cordis_inspect_query` 同源）：
>
> ```
> conversation.session.header.utilities   kind: list   scope: session
>                                         replaceRisk: none
>                                         options: id(required) / order / label
> shell.overlay                           kind: list   scope: root
> ```
>
> 注册形态与该 catalog 的官方示例逐字一致，本包不需要任何迁移代码。

## 🆕 0.6.0：又加了三款

- 🧱 **打砖块**：16ms 固定步长计时器驱动，仍是纯 DOM（不用 canvas / rAF）；挡板按住方向键连续移动，逐关加速与奖励分，三条命耗尽才计分。
- 🀄 **五子棋**：13×13，你执黑先手；白棋 AI 用四方向「连子长度 + 开口数」评分，攻击权重略高于防守（自己的五连优先于封堵），可悔棋；赢棋按用时计榜。
- 🃏 **记忆翻牌**：5×4 共 10 对，翻错 0.65s 自动盖回，通关按用时计榜并记录步数。
- **标签栏从单行 flex 改成 4 列 grid**：7 个游戏在 340px 窗口里排成整齐两行，不再溢出窗口边缘。
- `smoke` / `render-check` 覆盖全部 7 款游戏；`locale` 卡片描述同步为七款。

## 🔄 0.5.0 为 0.2.1 做了什么

对着**已安装**的 0.2.1-rc.2 逐项核对后，结论是：**0.4.0 的运行时用法本来就兼容 0.2.1**，真正过时的是"另一条安装通道"和文档。因此这一版做的是收口与验证，而不是改游戏逻辑：

1. **移除 `cordis_define` 通道**。0.2.1 的 `@deepseek-ai/dsh-tool-cordis` 只暴露 `cordis_inspect_list` / `cordis_inspect_query`，模型侧已经没有 `cordis_define` / `cordis_run`；`dist/cordis-plugin.js`、`dist/cordis-plugin.code.txt`、`scripts/smoke-cordis.mjs` 一并删除。**bundle 现在是唯一安装路径。**
2. **新增 `scripts/check-host-contract.mjs`**：直接读取已安装的 `app.asar`（自带 asar 解析，不需要 Electron），核对两个槽位的 `kind/scope`、`timer` 服务、平台模块表里的 `react`、以及 `dsh.client.inject` 里每个包是否还在。DSH 升级后跑一次就知道有没有漂。
3. **`npm run smoke` 扩展为清单校验**：`cordis.patch.yml` 的裸包名行、`dsh.client.platform/immediately/inject`、`exports["./client"]`、`locale/*.json` 的 `meta.title/description`、`icon.svg` ≤ 256 KiB。
4. **`package.json` 增加 `dsh.compatibility.dshReleases`**：明确标注 `0.2.0-rc.2` / `0.2.1-rc.2` 为 compatible（Plugin Manager 的卡片用它显示兼容性）。
5. **清理**：`lib/` 与 `scripts/build-lib.mjs`（旧的内联归档）、`exports["./payload"]`、`cordis_define` 关键词。
6. **`npm run dev` 预览修正**：替身外壳把 `conversation.session.header.utilities` 的注册显示在侧栏工具条里（真实宿主里它在会话标题栏右上角）。
7. **版本号 0.4.0 → 0.5.0**。

## 🚀 安装

### 推荐：Plugin Manager（Web / Desktop）

在 GUI 里：**设置 → 插件 → 添加插件**，输入 `github:LeeGuanWei-a/dsh-mini-games-lee`。

或让模型调用：

```
plugin_manager({ action: "install_bundle", target: "github:LeeGuanWei-a/dsh-mini-games-lee" })
```

等价的 CLI（推荐给 `desktop` / `web` profile）：

```sh
dsh plugin --profile desktop add github:LeeGuanWei-a/dsh-mini-games-lee
```

> ✅ `github:owner/repo`、`https://github.com/owner/repo`、registry 包名、`.tgz` 都可以；它们都会在 `node_modules` 里得到**真实目录副本**。
>
> ❗ **不要用本地路径装**（`target: "F:\\Projects\\dsh-mini-games-lee"`）。那会产出 `link:` 依赖，profile 里的目录是个 junction；Node 会把它解析到真实位置，而本包的裸包名行**在真实位置之上解析不到**，Loader 拿不到 fiber，`install_bundle` 报 `failed to import`。git / registry / tarball 规格才是受支持的安装方式（`@deepseek-ai` 自带的 bundle 也是这么装的）。

安装后 profile 的 `dsh.profile.bundles` 会登记本包，`cordis.patch.yml` 插入的那一行由 Loader 挂载，浏览器半区通过包清单里的 `dsh.client` 被发现。

**什么时候生效**：Plugin Manager 在 0.2.1 里会按 profile 是否带 HMR 决定。带 `dsh.profile.patchReload: live` 的 profile 当场重算；当前 `desktop` profile 没开 HMR，所以安装后会得到 `restart-required`，**重启 DeepSeek Harness 后**会话标题栏右上角出现 🎮。

> 📍 **🎮 的位置**：`conversation.session.header.utilities`（会话标题栏右对齐工具条，即页面右上角），`order: 20` 排在自带条目之后——实测紧挨在右侧栏开关左边。
> 这一槽是 **Session 作用域**：空白 Hero 页没有标题栏，也就没有 🎮；但游戏窗口本身在 root 作用域的 `shell.overlay` 里，已经打开的窗口不受影响。
> 没有选隔壁的 `conversation.session.header.corner`：那是 `single` 且已被自带控件占用，注册进去会**顶掉**那个控件。

### 备用：给开发中的源码做本地联调

```sh
npm install
npm run build
npm run dev        # http://127.0.0.1:5188/ 的替身外壳，4 个游戏都能玩
```

## 🧱 两个半区怎么合起来

DSH 的 bundle 是**一个包、两个半区**，两者互不 import：

```
profile 的 dsh.profile.bundles
        │
        ├─ cordis.patch.yml ──► insert 一行
        │                         id:   dsh-mini-games-lee
        │                         name: dsh-mini-games-lee   ← 裸包名，必须是裸包名
        │
        └─ package.json 的 dsh.client
                 platform: "web"                  ← 声明这是 web 客户端插件
                 immediately: true                ← 开机即激活，不等 Session
                 inject: [ui-sidebar, ui-layout]  ← 只影响到达顺序
                 │
                 └─ exports["./client"] ──► dist/client.js  ← 浏览器半区
```

Host 半区 `dist/index.js` 只导出空的 `apply()`：它唯一的职责是让这一行在 Loader 里激活。浏览器半区 `dist/client.js` 才是全部逻辑，以 Client 模块表的 `window.__ModuleLoader__.load({ id, factory })` 形式注册。

> **平台模块表（0.2.1 实测）**：壳层冻结的 seed 只有
> `react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、`zod`、`@tanstack/react-virtual`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-dockkit`。
> 本包只 `require("react")`，所以**不需要** `dsh.client.external`（那个字段只用于非基座请求）。

> ⚠️ **`name` 必须是裸包名 `dsh-mini-games-lee`，不能用相对路径** —— 两件事都靠它：
>
> **① 解析。** bundle patch 插入的行以**bundle 自己的目录**为解析基准，不是 profile。从 `node_modules/dsh-mini-games-lee/` 向上一级就能命中包名。**唯一会失败的情况是 `link:` / 本地路径安装**。所以要用 **git / registry / tarball 规格**安装。
>
> **② 显示元数据。** `@deepseek-ai/dsh-app-boot` 的 `readPluginMeta` 第一行就是 `if (barePackageName(specifier) === void 0) return void 0`。行名写成路径 → **元数据整块放弃**：Plugin Manager 退回把解析后的模块 URL 当作组件名打印，本包的 `icon.svg` 和 `locale/*.json` 里的标题/描述**一个都不会被读**。裸包名是这一切的前置条件。

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

### 🧱 打砖块

| 操作 | 按键 / 屏幕按钮 |
|---|---|
| 左右移动挡板 | 按住 `←` / `→`（或 `A` / `D`），或按住 ‹ › |
| 发球 | `空格`，或 发球 |
| 暂停 / 继续 | `P` 或 `空格`（球已在飞时），或 Ⅱ |
| 重新开始 | ↺ |

### 🀄 五子棋

| 操作 | 按键 / 屏幕按钮 |
|---|---|
| 落子（你执黑先手，之后白棋 AI 自动应一手） | 鼠标点击空交叉点 |
| 撤销一整回合（你 + AI 各一手） | 悔棋 |
| 重新开始 | ↺ 新局 |

### 🃏 记忆翻牌

| 操作 | 按键 / 屏幕按钮 |
|---|---|
| 翻开一张牌（同时翻开两张后判定，翻错 0.65s 盖回） | 鼠标点击牌面 |
| 重新开始 | ↺ 新局 |

## 📦 仓库结构

```
dsh-mini-games-lee/
├── package.json            # bundle 清单：dsh.bundle.patch + dsh.compatibility + dsh.client + exports
├── cordis.patch.yml        # 插入 Host 行（name: dsh-mini-games-lee，裸包名）
├── icon.svg                # Plugin Manager 卡片图标（package.json 的 icon 字段）
├── locale/
│   ├── en.json             # 卡片显示元数据：meta.title / meta.description
│   └── zh.json             #   语言文件必须叫语言 id（本宿主内置的只有 zh / en）
├── src/
│   ├── index.js            # Host 半区：空 apply（纯 UI 插件）
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
│       ├── minesweeper.js  # 💣 扫雷
│       ├── breakout.js     # 🧱 打砖块
│       ├── gomoku.js       # 🀄 五子棋
│       └── memory.js       # 🃏 记忆翻牌
├── dist/                   # 构建产物（`npm run build` 生成）
│   ├── index.js            #   Host 半区 —— Loader 挂载的就是它
│   └── client.js           #   浏览器半区 —— exports["./client"]
└── scripts/
    ├── inline.mjs          # 【关键】模块顺序 + import/export 剥离，唯一的平铺作用域权威
    ├── build-cordis.mjs    # 唯一的构建脚本：平铺体 → dist/index.js + dist/client.js
    ├── smoke.mjs           # 按模块表方式加载 dist/client.js + 校验 bundle 清单
    ├── render-check.mjs    # 真实 React 渲染每个组件（深浅两色）
    ├── check-host-contract.mjs  # 对着已安装的 app.asar 核对槽位/服务/平台模块
    └── dev-cordis.mjs      # 本地替身外壳，肉眼确认 4 个游戏可玩
```

### 加一个新游戏

1. 在 `src/games/` 新建模块，导出一个游戏对象：

   ```js
   export const MYGAME = (() => {
     function View(props) {           // props: { timer, th, active, onGameOver, onOpenRank }
       // 用 el(...) 渲染；props.th 提供当前主题色；
       // props.active 为 false 时不要跑时钟/键盘；
       // 需要时钟就用 props.timer.interval(fn, ms)，并在 effect 里返回它的 disposer；
       // 一局结束时调用一次 onGameOver({ value: 分数, meta: '说明文字' })
     }
     return { id: 'mygame', title: '我的游戏', icon: '🎯', short: '短名', scoreOrder: 'desc', View }
   })()
   ```

2. 在 `src/client.js` 的 `GAMES` 数组里加入它；
3. 在 `scripts/inline.mjs` 的 `MODULES` 里把新文件加在 `src/client.js` **之前**（顺序 = 扁平作用域里的依赖顺序）；
4. `npm run check` 校验，然后 `npm run build` 重新生成 `dist/`；
5. 重新装一次（git / registry 规格），让 Loader 拿到新的模块代与 patch。

## 🧪 本地校验（无需宿主）

```sh
npm install
npm run check       # build + smoke + render-check
```

- `npm run build` —— 把 `scripts/inline.mjs` 列出的模块按依赖顺序拼成**单一扁平作用域**，再包成 Host 半区与模块表浏览器半区
- `npm run smoke` —— 按模块表方式加载 `dist/client.js`，断言两个槽位以正确的 id 注册、`apply` 交回 disposer、缺 `timer` 服务时保持惰性；并校验 bundle 清单（patch 行 / platform / immediately / exports / locale / icon）
- `npm run render-check` —— 用 real React + `react-dom/server` **真实渲染**每个注册的组件（深浅两色），抓"能注册但一渲染就崩"的故障
- `npm run dev` —— 起本地替身外壳（默认 http://127.0.0.1:5188/），肉眼确认 4 个游戏都可玩

### 对着已安装的 DSH 核对契约

升级 DSH 之后跑一次，确认槽位/服务/平台模块还在：

```sh
npm run build
npm run check:host -- --asar "E:\SoftWare\DeepSeek Harness\resources\app.asar"
```

输出（0.2.1-rc.2 实测）：

```
ok - host runtime: @deepseek-ai/dsh 0.2.1-rc.2 (…\app.asar)
ok - slot "conversation.session.header.utilities" declared list/session in @deepseek-ai/dsh-client-ui-conversation
ok - slot "shell.overlay" declared list/root in @deepseek-ai/dsh-client-ui-layout
ok - service "timer" (interval/timeout/…) provided by cordis-plugin-timer
ok - platform-module seed table exposes "react"
ok - dsh.client.inject @deepseek-ai/dsh-client-ui-sidebar present (0.2.1-rc.2)
ok - dsh.client.inject @deepseek-ai/dsh-client-ui-layout present (0.2.1-rc.2)
ok - manifest: main + exports["./client"] point at built halves
```

也可以指到一个装着 `@deepseek-ai/*` 包的目录：`--dsh-root <dir>/node_modules`。不给参数时它只打印一行 skip，不会失败。

> ⚠️ **不要把 `src/` 交给 esbuild 之类的 ESM 打包器**。`src/` 是"扁平共享作用域"写法：模块之间互相引用 `el`、`useStore`、`THEMES` 等声明而**不写 import**，模块顺序由 `scripts/inline.mjs` 的 `MODULES` 决定。真 ESM 打包会给每个模块单独作用域，于是 `useStore is not defined`；而且 esbuild 会把 `el` 改名成 `el2` 却漏改其它模块里的 `el(...)` 调用点，于是 `el is not defined`。两个故障都实测出现过。新增/移动模块时改 `MODULES` 顺序即可。

## 🏆 排行榜说明

- 每个游戏独立存储：`dsh.minigames.records.v1.<gameId>`；
- 每局结束自动记录（扫雷只记胜利局，五子棋只记赢棋，记忆翻牌只记通关），保留最近 10 条；
- 排序：俄罗斯方块 / 贪吃蛇 / 2048 / 打砖块按分数降序；扫雷 / 五子棋 / 记忆翻牌按用时升序；
- 数据保存在**本机浏览器** localStorage，清站点数据 / 无痕 / 换浏览器会丢；
- 排行榜视图内可两次点击清空当前游戏的记录。

## 🔄 回滚

```
plugin_manager({ action: "remove_bundle", target: "dsh-mini-games-lee" })
```

或：

```sh
dsh plugin --profile desktop remove dsh-mini-games-lee
```

## 📄 许可证

MIT。
