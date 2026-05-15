# 微信小程序 TS 编译、目录分离与 Watch 模式说明

初版：2026-03-28
更新：2026-04-19：补充了路径别名重写的相关说明和新增的脚本说明，优化监听
更新：2026-05-15：补充小程序源码里暂时不要使用 `?.` 和 `??` 的说明，明确这是当前构建链未补产物降级层前的临时约束

## 1. 文档目的

这份文档用来记录当前项目已经落地的工程化方案，重点包括：

- TypeScript 编译链路
- 源码目录和运行目录分离
- 日常开发用的 watch 模式
- 已踩过的问题、根因和修复方式

目标是三件事：

- 后续接手的人能快速看懂
- 换一台机器也能按步骤复现
- 出问题时能按文档排查

## 2. 当前工程结构

### 2.1 源码目录和运行目录

- 源码目录：项目根目录
- 运行目录：dist/

当前约定是：

- 平时只改源码目录里的文件
- 微信开发者工具只运行 dist/
- 源码目录不再承接 TS 页面编译出来的运行时 JS 文件

### 2.2 微信开发者工具项目根目录

配置文件：

- project.config.json
- project.private.config.json

两个文件都设置了：

- miniprogramRoot: dist/

这意味着开发者工具加载的是 dist，而不是源码根目录。

## 3. TypeScript 编译策略

配置文件是 [tsconfig.json](tsconfig.json)。

当前关键配置：

- rootDir: .
- outDir: dist
- module: CommonJS
- allowJs: true
- exclude: dist, node_modules

这套配置的结果是：

- 源码中的 TS 和 JS 会按原目录结构输出到 dist
- 小程序运行时始终从 dist 读取 JS
- 源码目录不会再因为 TS 编译反复生成页面 JS

### 3.1 当前语法约束：暂时不要在小程序源码里写 `?.` 和 `??`

这是当前工程的临时约束，不是语言层面的长期结论。

当前结论：

- `kc-miniprogram` 的源码里，暂时不要使用可选链 `?.` 和空值合并 `??`
- 这里说的“源码”包括：pages、package-card、components、services、utils、view-model 等会进入小程序运行链路的 TS/JS 文件
- 原因不是 TypeScript 不支持，而是当前这条构建链只有 `tsc -> dist -> 微信开发者工具`，中间没有额外的产物语法降级层
- 在当前 `target` 下，TypeScript 会把这类语法原样保留到 dist；一旦微信开发者工具实际解析到对应页面或依赖文件，就可能直接报 `Unexpected token: punc (.)`

当前替代写法：

- 把 `foo?.bar` 改成显式判空，例如 `foo && foo.bar ? foo.bar : undefined` 或先拆变量再判断
- 把 `value ?? fallback` 改成显式判断，例如 `value !== undefined ? value : fallback`
- 如果是数组或字符串链式调用，优先先判断类型或是否存在，再调用对应方法

边界说明：

- 这条约束只针对 `kc-miniprogram` 当前小程序运行链路
- 这不是对 uniapp 项目的约束
- 这不是最终优化方案；后续如果补上产物降级层，可以再重新评估是否放开这条限制

### 3.2 为什么需要官方小程序类型包

相关内容：

- [package.json](package.json)
- [tsconfig.json](tsconfig.json)
- miniprogram-api-typings

当前项目已经接入官方类型包：

- `miniprogram-api-typings`

这个包现在是项目里小程序类型的主来源，负责提供：

- `wx` 全局对象
- `Page` / `Component` / `App`
- `WechatMiniprogram.*` 命名空间
- 常见事件对象、API 参数和返回值类型

在 [tsconfig.json](tsconfig.json) 里已经显式指定：

```json
"types": ["miniprogram-api-typings"]
```

这样做的目的很明确：

- 优先使用官方维护的类型定义
- 避免继续手写零散的 wx 类型
- 让编辑器提示和类型约束更完整、更稳定

### 3.3 为什么还保留 typings/wechat-miniprogram.d.ts

相关文件：

- [typings/wechat-miniprogram.d.ts](typings/wechat-miniprogram.d.ts)

这个文件现在已经不再负责声明微信 API 本身，而是降级为“项目补充声明文件”。

当前它只保留一项内容：

- `declare module '*.json'`

原因是：

- 微信小程序 API 类型已经交给官方包处理
- 但项目内部仍然有 JSON 模块导入的类型需求
- 这类声明不属于微信官方 API，本地保留一份补充更合理

所以现在的职责分工是：

- 官方类型包：负责 wx / Page / WechatMiniprogram 等官方能力
- 本地 d.ts：只负责项目自己的补充类型

## 4. package.json 脚本与依赖说明

相关文件：

- [package.json](package.json)

这个文件在当前方案里承担两类职责：

- 定义构建和开发命令
- 管理本地开发依赖

### 4.1 scripts 字段说明

`clean`

- 作用：尝试删除 dist 目录
- 目的：避免旧产物残留影响结果
- 特殊处理：对 Windows 下常见的 `EBUSY` 做了容错，因为微信开发者工具可能锁住 dist

`build:ts`

- 作用：执行 TypeScript 编译
- 实际命令：`tsc -p tsconfig.json`
- 结果：把源码中的 TS/JS 编译输出到 dist

`build:assets`

- 作用：同步静态资源到 dist
- 实际命令：`node scripts/copy-static.mjs`
- 结果：~~把 json、wxml、wxss、图片等非 TS 编译产物同步到运行目录~~，把 app.json、app.wxss、sitemap.json、assets、components、constants、data、package-card 等非 TS 编译产物同步到运行目录，并生成 data 目录下对应的运行时 JS 模块

`rewrite:paths`

- 作用：把 dist 里的路径别名引入重写为相对路径
- 实际命令：`node scripts/rewrite-path-aliases.mjs`
- 结果：把 `@/` 形式的导入转换成运行时更稳妥的相对路径

`build`

- 作用：一次性完整构建
- 执行顺序：~~`clean -> build:ts -> build:assets`~~ `clean -> build:assets -> build:ts -> rewrite:paths`
- 适用场景：首次构建、重置产物、CI 或手动全量编译

`watch:ts`

- 作用：持续监听 TS 变更
- 实际命令：`tsc -p tsconfig.json -w --preserveWatchOutput`
- 结果：源码一变化，dist 中对应编译产物自动更新

`watch:assets`

- 作用：持续监听静态资源变化
- 实际命令：`node scripts/copy-static-watch.mjs`
- 结果：~~wxml、wxss、json、assets 等变化后自动同步到 dist~~，app、wxml、wxss、json、assets、package-card 等变化后自动同步到 dist，并同步维护 data 目录下的运行时 JS 模块

`watch:paths`

- 作用：持续监听 dist 中的编译产物并重写路径别名
- 实际命令：`node scripts/rewrite-path-aliases.mjs --watch`
- 结果：当 dist 里的 JS 产物变化时，自动把 `@/` 导入重写为相对路径

`dev`

- 作用：开发态一键启动
- 实际命令：~~`concurrently "npm:watch:ts" "npm:watch:assets"`~~ `concurrently "npm:watch:ts" "npm:watch:assets" "npm:watch:paths"`
- 结果：同时拉起 TS watcher、静态资源 watcher 和路径重写 watcher

### 4.2 devDependencies 字段说明

`typescript`

- 作用：提供 TS 编译器
- 为什么需要：没有它就不能执行 `tsc`，也就没有 dist 编译产物

`chokidar`

- 作用：文件监听库
- 为什么需要：Node 原生监听在跨平台和复杂目录场景下稳定性一般，这里用它做静态资源 watch 更稳
- 在当前方案中的职责：驱动 [scripts/copy-static-watch.mjs](scripts/copy-static-watch.mjs)

`concurrently`

- 作用：并行运行多个命令
- 为什么需要：~~开发态要同时跑 `watch:ts` 和 `watch:assets`~~ 开发态要同时跑 `watch:ts`、`watch:assets` 和 `watch:paths`
- 为什么不用自己手写 Node 启动器：之前已经遇到过 `spawn EINVAL`，所以改成成熟工具接管并行调度

`miniprogram-api-typings`

- 作用：提供微信小程序官方类型声明
- 为什么需要：让 `wx`、`Page`、`Component`、`WechatMiniprogram.*` 等类型直接走官方定义
- 当前定位：这是项目的小程序主类型来源，不再靠手写 wx 声明兜底

## 5. 构建命令与开发命令

命令定义在 [package.json](package.json)。

当前有这些脚本：

- clean
- build:ts
- build:assets
- build
- watch:ts
- watch:assets
- dev
- watch:paths（新增）
- rewrite:paths（新增）
- lint（新增）
- format（新增）
- format:check（新增）
- typecheck（新增）
- check（新增）

### 5.1 一次性构建

执行：

```bash
npm run build
```

执行顺序：

1. clean：尽量删除 dist
2. build:assets：先把静态资源和运行时依赖同步到 dist
3. build:ts：把源码编译到 dist
4. rewrite:paths：把 dist 中的路径别名重写为相对路径

### 5.2 日常开发 watch 模式

执行：

```bash
npm run dev
```

这个命令会并行启动三个常驻进程：

1. watch:ts
2. watch:assets
3. watch:paths（新增）

正常启动时应该能看到类似输出：

- TypeScript: Starting compilation in watch mode
- TypeScript: Found 0 errors. Watching for file changes.
- 静态资源监听： [copy-static-watch] watching static assets...

## 6. 静态资源同步规则

相关脚本：

- [scripts/copy-static.mjs](scripts/copy-static.mjs)
- [scripts/copy-static-watch.mjs](scripts/copy-static-watch.mjs)

会同步到 dist 的内容包括：

- app.json
- app.wxss
- sitemap.json
- assets/
- components/
- constants/
- data/
- package-card/
- pages/

其中 package-card/package.json 会被保留，用来声明子包运行时依赖；主包和子包的 miniprogram_npm 目录会由同步脚本单独维护。

同步时的过滤规则：

- 不复制 dist 自己
- 不复制 ts 文件
- 如果一个 js 文件旁边存在同名 ts 文件，则不复制这个源码 js
  原因：运行时应当优先使用 TS 编译结果
- ~~data/_.js 不通过静态同步复制到 dist，原因：避免和 TS watcher 对 dist/data/_.js 的输出发生竞争~~ data/_.js 不通过静态同步按源文件直接复制到 dist
  原因：这些文件由同步脚本根据 data/_.json 自动生成，避免和源数据不一致

## 7. data 目录下 JSON 到 JS 的同步机制

### 7.1 为什么需要这层同步

这套 dist + TS 编译链路落地后，微信运行时出现过下面这个错误：

- module data/cards.json.js is not defined

根因不是 JSON 内容错，而是运行时在这套模块加载链路下，对 JSON 模块解析不稳定。

### 7.2 当前解决方案

对于运行时要直接读取的数据文件，当前做法是自动生成对应 JS 模块：

- data/cards.json -> data/cards.js
- data/category.json -> data/category.js

注意：

- JSON 仍然是数据源
- JS 是自动生成的运行时模块
- 不需要手动维护这些 JS 文件

### 7.3 自动生成时机

构建时：

- [scripts/copy-static.mjs](scripts/copy-static.mjs) 会先根据 JSON 重新生成 JS，再做静态资源同步

监听时：

- [scripts/copy-static-watch.mjs](scripts/copy-static-watch.mjs) 监听到 data/\*.json 变化后，会立刻重建对应 JS 模块

额外说明：

- 源码目录里的 data/\*.js 会被自动更新
- ~~dist/data/\*.js 由 TypeScript watcher 负责输出，静态资源 watcher 不再复制这部分，避免并发冲突~~ dist/data/\*.js 由静态资源同步脚本负责生成和维护，避免和源数据脱节

### 7.4 代码导入方式

服务层里不要再直接写 `.json` 后缀导入，而是使用无后缀模块路径：

```ts
import cards from '../data/cards';
import categories from '../data/category';
```

## 8. 从零复现步骤

### 8.1 环境要求

- Node.js 18+
- npm
- 微信开发者工具

### 8.2 操作步骤

1. 安装依赖

```bash
npm install
```

2. 执行一次完整构建

```bash
npm run build
```

3. 打开微信开发者工具

确认项目读取的是 dist/

4. 启动 watch 模式

```bash
npm run dev
```

5. 修改文件并验证

- 改 pages、services、utils 下的 ts 文件，确认 dist 对应 js 会更新
- 改 data 下的 json 文件，确认对应 js 会自动更新
- 改任意使用 `@/` 的源码文件，确认 dist 中对应 JS 的路径会被重写（新增）
- 回到微信开发者工具，确认预览来自 dist 的最新内容

## 9. 已遇到的问题与修复记录

### 问题 A：页面源码目录里反复出现 index.js

现象：

- pages/index/index.js 每次编译后又出现

根因：

- 编译产物直接输出到了源码目录

修复：

- tsconfig.json 设置 outDir 为 dist
- 微信开发者工具的 miniprogramRoot 改为 dist/

### 问题 B：module data/cards.json.js is not defined

现象：

- 运行时报找不到 data/cards.json.js

根因：

- JSON 模块在当前运行链路下解析不稳定

修复：

- 自动生成 data/cards.js 和 data/category.js
- 服务层改为导入无后缀模块路径

### 问题 C：Windows 下 clean 删除 dist 失败，报 EBUSY

现象：

- rmSync dist 失败

根因：

- 微信开发者工具或其它进程占用了 dist

修复：

- clean 脚本对 EBUSY 做容错，不再因此中断整个构建

### 问题 D：自定义 Node 并行启动脚本报 EINVAL

现象：

- 用 child_process.spawn 自己拉两个 watcher 时失败

根因：

- 当前环境下 spawn 参数处理不稳定

修复：

- ~~改用单独的 Node spawn 启动器~~ 改用 concurrently 做多进程编排
- 开发态同时拉起 TS、静态资源和路径重写三条 watcher

### 问题 E：watch 启动时因 ENOENT 退出

现象：

- watch:assets 在启动阶段报 ENOENT: chmod dist/data/cards.js

根因：

- 静态资源复制和 data 目录运行时 JS 模块生成发生竞态

修复：

- ~~data/\*.js 不再通过静态同步复制到 dist~~ data/\*.js 改由同步脚本按 JSON 自动生成
- watch 事件处理加了错误隔离，对瞬时 ENOENT/EBUSY 不直接退出

### 问题 F：微信预览报 `Unexpected token: punc (.)`

现象：

- 预览或上传时，页面 JS 报 `Unexpected token: punc (.)`
- 报错文件通常落在 `package-card`、`pages` 或它们依赖到的 `services` / `utils` / `view-model` 里

根因：

- 当前构建链没有对 dist 产物做二次语法降级
- `?.`、`??` 等现代语法在当前配置下会原样进入 dist
- 微信开发者工具当前解析链路对这类语法不稳定，命中对应文件时就会直接报错

当前处理原则：

- 暂不调整 `tsconfig` 的 `target`
- 暂不引入额外产物降级层
- 因此在小程序源码层面，先禁止新增 `?.` 和 `??`
- 一旦预览报这类错误，先检查报错页及其直接依赖文件里是否引入了这两类语法

## 10. 验证清单

完成配置后，至少确认下面几项：

- npm run build 能成功退出
- npm run dev 能同时启动两个 watcher
- dist/pages/index/index.js 存在
- 源码目录 pages/index 下是 index.ts，而不是编译产物 index.js
- 修改 data/cards.json 后，data/cards.js 会自动更新
- 微信开发者工具项目根目录确实指向 dist/
- 小程序源码里没有新增 `?.` 和 `??`

## 11. 日常使用注意事项

- data 目录里的 JSON 才是数据源
- 不要手动改自动生成的 data/\*.js
- 如果运行结果看起来还是旧的，先看 watch 是否还活着，再回微信开发者工具重新编译
- 如果 dist 因为被占用删不掉，先关闭相关预览或占用进程，再重新构建
- 在当前小程序工程里，先不要写 `?.` 和 `??`；这不是长期方案，只是当前构建链未补产物降级层前的临时约束
