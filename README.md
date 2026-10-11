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
| `@deepseek-ai/dsh`（Harness CLI / Web GUI） | **`0.2.0-rc.2`**（已实测） |
| 插件形态 | **profile bundle**（`dsh.bundle.patch` + `dsh.client`），经 `plugin_manager` 安装 |
| 客户端硬依赖 | `slots`（两个槽位）、`timer`（各游戏时钟） |
| 占用槽位 | `conversation.session.header.utilities`（右上角）、`shell.overlay`（悬浮层） |

## 🚀 安装

### 推荐：作为 bundle 安装（重启后仍在）

让 Harness 里的模型执行一次：

```
plugin_manager({ action: "install_bundle", target: "F:\\Projects\\dsh-mini-games-lee" })
```

安装后 profile 的 `dsh.profile.bundles` 会登记本包，`cordis.patch.yml` 插入的那一行由 Loader 挂载，浏览器半区通过包清单里的 `dsh.client` 被发现。返回 `application: applied` 且 `warnings` 为空即表示已生效；会话标题栏**右上角**出现 🎮，页面中央出现游戏窗口。

> 📍 **🎮 的位置**：在 `conversation.session.header.utilities`（会话标题栏右对齐工具条，即页面右上角），`order: 20` 排在自带条目之后、贴着右边缘。
> 这一槽是 **Session 作用域**：空白 Hero 页没有标题栏，也就没有 🎮；但游戏窗口本身在 root 作用域的 `shell.overlay` 里，已经打开的窗口不受影响。
> 没有选隔壁的 `conversation.session.header.corner`：那是 `single` 且 `replaceRisk: shadows-shipped-ui`，并且已被自带控件占用，注册进去会**顶掉**那个控件。

### 备用：`cordis_define` 动态插件

`dist/cordis-plugin.code.txt` 里按 `<<<HOST>>>` / `<<<CLIENT>>>` 分好了两半，可直接粘进 `cordis_define` 工具的 `code.host` / `code.client`。这条路不写入 profile，刷新页面即失效，适合临时试用或无法安装 bundle 的 profile。

首次加载会弹 client approval；批准后窗口出现。

## 🧱 两个半区怎么合起来

DSH 的 bundle 是**一个包、两个半区**，两者互不 import：

```
profile 的 dsh.profile.bundles
        │
        ├─ cordis.patch.yml ──► insert 一行
        │                         id:   dsh-mini-games-lee
        │                         name: ./dist/index.js   ← Host 半区（相对本 patch 文件定位）
        │
        └─ package.json 的 dsh.client
                 platform: "web"                  ← 声明这是 web 客户端插件
                 immediately: true                ← 开机即激活，不等 Session
                 inject: [ui-sidebar, ui-layout]  ← 只影响激活顺序
                 │
                 └─ exports["./client"] ──► dist/client.js  ← 浏览器半区
```

Host 半区 `dist/index.js` 只导出空的 `apply()`：它唯一的职责是让这一行在 Loader 里激活。浏览器半区 `dist/client.js` 才是全部逻辑，以 Client 模块表的 `window.__ModuleLoader__.load({ id, factory })` 形式注册，`React` 由模块表的 `require('react')` 提供。

> ⚠️ **`name` 为什么是 `./dist/index.js` 而不是裸包名 `dsh-mini-games-lee`**
> 相对路径以 patch 文件为基准定位，跟着 checkout 走；裸包名只能通过 profile 的 `node_modules` 解析。用裸包名安装时 Loader 拿不到 fiber，`install_bundle` 会报 `failed to import`。相对路径两种位置都能用，而且照样能让 `dsh-client-modules` 找到正确的 `package.json` —— 解析路径型行名时会从解析出的文件向上找最近的 manifest，也就是本包自己。

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
├── package.json            # bundle 清单：dsh.bundle.patch + dsh.client + exports
├── cordis.patch.yml        # 插入 Host 行（name: ./dist/index.js）
├── icon.svg                # Plugin Manager 卡片图标
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
│       └── minesweeper.js  # 💣 扫雷
├── dist/                   # 构建产物（`npm run build` 生成）
│   ├── index.js            #   Host 半区 —— Loader 挂载的就是它
│   ├── client.js           #   浏览器半区 —— exports["./client"]
│   ├── cordis-plugin.js    #   两半区合并成 `{ host, client }`，供工具/归档消费
│   └── cordis-plugin.code.txt  # 两半区分段文本，供 cordis_define 粘贴
└── scripts/
    ├── inline.mjs          # 【关键】模块顺序 + import/export 剥离，唯一的平铺作用域权威
    ├── build-cordis.mjs    # 唯一的构建脚本：平铺体 → 上面 4 个产物
    ├── smoke.mjs           # 按模块表方式加载 dist/client.js，断言两槽位注册正确
    ├── smoke-cordis.mjs    # 断言 code.txt 两半区完整、可求值，且与 dist 产物同源
    ├── render-check.mjs    # 真实 React 渲染每个组件（深浅两色）
    ├── dev-cordis.mjs      # 本地替身外壳，肉眼确认 4 个游戏可玩
    └── build-lib.mjs       # 归档（旧的 src → lib 内联打包）
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
5. 重新 `install_bundle`（包以 `link:` 安装，改完 `dist/` 后重装一次，让 Loader 拿到新的模块代）。

## 🏆 排行榜说明

- 每个游戏独立存储：`dsh.minigames.records.v1.<gameId>`；
- 每局结束自动记录（扫雷只记胜利局），保留最近 10 条；
- 排序：多数游戏按分数降序，扫雷按用时升序；
- 数据保存在**本机浏览器** localStorage，清站点数据 / 无痕 / 换浏览器会丢；
- 排行榜视图内可两次点击清空当前游戏的记录。

## 🛠️ 本地校验（无需宿主）

```sh
npm install
npm run check       # build + smoke:cordis + smoke + render-check
```

- `npm run build` —— 把 `scripts/inline.mjs` 列出的 9 个模块按依赖顺序拼成**单一扁平作用域**，再包成 Host 半区、模块表浏览器半区、合并载荷、`cordis_define` 文本四份产物
- `npm run smoke` —— 按模块表方式加载 `dist/client.js`，断言两个槽位以正确的 id 注册、`apply` 交回 disposer、缺 `timer` 服务时保持惰性
- `npm run smoke:cordis` —— 断言 `code.txt` 两半区分隔完整，客户端半区可按动态 runner 的方式求值，并确认各产物出自同一个平铺体
- `npm run render-check` —— 用 real React + `react-dom/server` **真实渲染**每个注册的组件（深浅两色），抓"能注册但一渲染就崩"的故障（例如 `el is not defined`）
- `npm run dev:cordis` —— 起一个本地替身外壳（默认 http://127.0.0.1:5188/ ），用本包自带的 React UMD 跑 `dist/client.js`，肉眼确认 4 个游戏都可玩

> ⚠️ **不要把这些源码交给 esbuild 之类的 ESM 打包器**。`src/` 是"扁平共享作用域"写法：模块之间互相引用 `el`、`useStore`、`THEMES` 等声明而**不写 import**，模块顺序由 `scripts/inline.mjs` 的 `MODULES` 决定。真 ESM 打包会给每个模块单独作用域，于是 `useStore is not defined`；而且 esbuild 会把 `el` 改名成 `el2` 却漏改其它模块里的 `el(...)` 调用点，于是 `el is not defined`。两个故障都实测出现过。新增/移动模块时改 `MODULES` 顺序即可。

## 🔄 回滚

```
plugin_manager({ action: "remove_bundle", target: "dsh-mini-games-lee" })
```

用 `cordis_define` 装的则执行 `cordis_undefine({ pluginId: "minig.<id>" })`。

## 📄 许可证

MIT。
