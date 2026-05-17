## 项目定位

这个项目是另一个同名 uniapp 项目的原生微信小程序版。

- 核心业务逻辑保持一致，页面和交互目标对齐原项目；
- 由于 uniapp 和原生小程序语法、组件能力、运行机制不一致，部分实现做了适配和细节处理；
- 补齐了原项目在原生小程序里需要的工程化能力，包括 TypeScript 编译、目录分离、watch 构建、路径重写；
- 另外补了小程序特有的分包处理和运行时依赖同步，确保在微信开发者工具里可以稳定开发和预览。

**03.27**

原生微信小程序项目初始化

- 初始化项目配置文件，添加基本结构，并创建相应页面；
- 在types为卡片、类别和服务定义类型；
- 在utils新增了用于对数组进行随机排序以及生成 UUID 的等实用函数；
- 实现tabbar并添加assets静态资源；
- 在service实现卡片和类别服务；
- 完成首页样式。

**03.28**

1、确保写的TS文件可以被微信开发者工具正确编译；

关键改动：

- 补了最小可用的 TypeScript 工程配置 tsconfig.json。
- 补了小程序运行时声明 wechat-miniprogram.d.ts，让现有的 wx、Page、JSON 导入能被 TS 识别。

2、用TS写代码，分离源码目录和输出目录，源码留在当前目录，运行时产物统一输出到 dist

关键改动：

- project.config.json 和 project.private.config.json 加了 miniprogramRoot: dist/，所以- 开发者工具会把 dist 当成小程序目录。
- tsconfig.json 现在用了 outDir: dist，所以 TypeScript 不会再往源码目录生成 JS。
- 删掉了源码目录里的 pages/index/index.js，首页源码只保留 index.ts。
- 加了 package.json 和 copy-static.mjs，构建时会先编译 TS，再把 app.json、wxml、wxss、图片、数据这些静态资源复制到 dist。
- 为了让整条 TS 链能编过，补全了 wechat-miniprogram.d.ts 里已有代码用到的 wx 类型。

3、完成首页(index)和列表页(cardList)

关键改动：

- 视图处理逻辑全放到view-model/card-view

4、修复 cardList 页面“筛选状态 undefined、列表异常渲染”

根因：

- 模板循环指令误写为 wx-for（短横线），正确语法应为 wx:for（冒号）。
- 误写后不会建立 item 循环上下文，导致 item.value/item.label 等字段显示 undefined。

修复：

- 将 pages/cardList/index.wxml 中相关循环统一改为 wx:for。
- 保留必要的数据结构修正（statusTabs 由函数生成，active 状态由数据层计算）。

**03.29**

1、添加测验设置组件，支持选择测验类型和练习模式，入口在首页和列表页

关键改动：

- components/quiz-setup-sheet：新增测验设置组件，支持选择测验类型和练习模式，入口在首页和列表页。

2、实现分类管理功能CURD(categoryManage + categoryEdit)

3、补充“我的”页面，完成导出功能

关键改动：

- exportService：实现了导出数据的功能，包含数据序列化、文件生成和下载逻辑。

**03.30**

1、添加 Markdown 编辑器组件，支持多种格式的快速插入；

2、添加Markdown内容展示组件（markdown-content），引入依赖markdown-it。

3、更改脚本，新的依赖包自动根据 package.json 的 dependencies 同步到 dist/miniprogram_npm

**03.31**

1、做分包进行拆分，避免主包引入markdown-it导致体积过大。为组件添加本地 wrapper，让组件通过相对路径优先加载运行时文件，规避部分运行时解析问题。

关键改动：

- markdown-content对markdown-it的引入换成了markdown-it.ts，markdown-it.ts指向markdown-it的文件，脚本直接复制markdown-it，暂时不走分包依赖（走小程序的分包依赖失败了，后续考虑切换构建工具）。

2、style: 将 Markdown 样式从 markdown-content 组件移至全局样式app.wxss文件，以避免在组件的 wxss 文件中使用标签选择器

**04.01**

完成测验页(quiz)和测验结果页(quizResult)。

**04.02**

完成卡片编辑页（cardEdit）。

关键改动：

- 组件markdown-tool小工具的问题修复
- markdown全局样式生效问题：样式靠 app.wxss 里的后代选择器去穿透 rich-text在小程序里并不稳定，尤其是:first-child 伪类，最容易失效。解决方法是把常见 markdown 元素的样式改成在渲染阶段直接写到 HTML 节点上。文件：markdown-content/index.ts

**04.03**

优化构建脚本和监听脚本。

关键改动：

- data下面的JSON都复制，data目录保留JS，dist/data只留JS，删除/修改JSON时更新对应的两份JS。
- 重构vendor，删掉依赖应该移除小程序的依赖，即同步 vendor 前先清理或比对删除旧依赖。
- 抽共享工具模块share.mjs，集中管理依赖和路径处理。

**04.05**

1、完成数据导入功能，支持从 JSON 文件恢复卡片与分类

关键改动：

- importService：实现了从 JSON 文件导入数据的功能，包含数据解析、验证、与现有数据的合并逻辑。

2、完成base-dialog组件，完善Markdown工具栏的弹层交互

3、优化依赖同步逻辑，复制时获取依赖实际会发布的文件列表，单独处理markdown-it

关键改动：

- copy-static.shared.mjs：新增 runNpmPackDryRunJson 函数，通过 npm pack --dry-run 获取某个依赖实际会发布哪些文件，避免复制整个包体积过大。
- copyDependencyTree 函数新增递归复制子依赖的逻辑，确保分包依赖的完整性。
- 白名单中单独处理 markdown-it，直接复制到分包目录，规避分包依赖解析问题。

4、优化小程序滚动体验，添加 -webkit-overflow-scrolling: touch。删除没用到的样式和变量。将分包会用到的utils函数移到分包目录，避免主包引入过多无用代码。

关键改动：

- app.wxss 和 quiz-setup-sheet/index.wxss：在需要滚动的容器上添加 -webkit-overflow-scrolling: touch，提升滚动流畅度。

**04.06**

1、工程化配置，借助 ESLint 和 Prettier 来优化开发环境设置

关键改动：

- 添加了 ESLint 和 Prettier 来保证代码质量和格式。
- 更新了 package.json 中的脚本，用于代码检查、格式化和类型检查。
- 优化了 TypeScript 配置以进行更严格的类型检查。
- 添加了 .prettierignore 和 .prettierrc.json 用于 Prettier 配置。
- 创建了 eslint.config.ts 用于针对该项目定制的 ESLint 配置。

2、修复markdown-it复制失败在分包中找不到的问题

关键改动：

- copy-static.shared.mjs：新增报错提示，分包依赖声明了，但源码解析不到时直接报错，不再静默跳过
- 确认node_modules中是否存在markdown-it，不存在则npm install markdown-it@14.1.1 --no-save

**04.08**

实现cardList页面的分页加载功能。

关键改动：

- cardList/index.ts：新增分页参数 page 和 pageSize
- card-view 新增 loadCardPage 函数以支持分页加载，因为该文件主要处理卡片和分类的视图逻辑，其余服务函数如 getCards 仍然保持不变，而hasMore等参数的计算逻辑由页面自己负责（暂定）。

**04.11**

1、实现卡片批量操作功能，包括批量删除和批量转移分类

关键改动：

- cardList/index.ts：新增 selectedCards 数组用于存储当前选中的卡片 ID，新增 isEditMode 布尔值用于控制是否进入编辑模式。新增 onCardClick 和 onEdit 函数分别处理卡片点击和长按事件，在编辑模式下点击卡片会切换选中状态，长按会进入编辑模式。
- cardList/index.wxml：修改卡片项的样式以反映选中状态，新增卡片项的 bindtap 和 bindlongpress 事件绑定。新增批量操作的底部栏，根据 isEditMode 显示批量删除和转移分类的按钮。
- categoryManage/index.ts：新增 deleteCards 和 transferCards 函数分别处理批量删除和批量转移分类的逻辑。
- card-view/index.ts：新增 applySelectionState 函数用于根据 selectedCards 列表更新 cardViewList 中的 isSelected 字段，新增 syncTransferCategoryState 函数用于同步转移分类的选择状态，确保在分类列表变化时 selectedTransferCategoryId 始终有效。
- 注意loadData函数更新data时需要根据 reset 参数设置 selectedCards 和 isEditMode，以避免在数据更新后仍然保留之前的选择状态。

2、增加导入数据的统计信息，包括新增、覆盖和跳过的分类和卡片数量

关键改动：

- importService.ts：新增 countTotal 对象用于统计导入过程中的新增、覆盖和跳过的分类和卡片数量。在导入分类和卡片的逻辑中，根据实际情况更新 countTotal 的相应字段。

3、新增路径别名重写脚本，添加文件监视功能，在开发模式下自动监听源码文件的变更并重新执行路径别名重写

关键改动：

- rewrite-path-aliases.mjs：新增 watch 模式的支持，使用 chokidar 监听 src 目录下的文件变更事件，在文件发生变化时执行路径别名重写操作。添加了防抖处理，避免在短时间内多次变更时重复执行重写操作。监听 SIGINT 信号，在按 Ctrl+C 时优雅地关闭文件监视器并退出进程。

**04.20**

修复开发模式下 dist 产物的路径解析问题，确保微信开发者工具可以正常运行

关键改动：

- 将 TypeScript 升级到 6.0.3，并同步调整 tsconfig.json，消除编辑器里关于 `ignoreDeprecations`、`moduleResolution` 和 `baseUrl` 的红线告警。
- 补齐 cardEdit 页面在 TS 6 下暴露出来的隐式 any 类型问题，避免构建阶段新增类型错误。
- 调整 rewrite-path-aliases.mjs 的重写逻辑，统一处理本地模块的别名引用和裸模块引用，确保 dist 里的 JS 运行时路径能够被小程序正确解析。
- 重新验证 `npm run build` 和 `npm run watch:ts`，确认构建链路和监听模式都恢复正常。

**05.14**

主要迁移功能：学习统计、导入导出调整、分类主题。拖拽暂时不做。调整整体文案，修复一些细节问题。

关键改动：

- 补数据模型和存储迁移，收口服务层，排序只同步“非拖拽部分”，统计页单独落一页，导入导出补齐排序、学习统计、主题的兼容。
- 修复卡片查询的根因问题：`cardService.getMatchedCards` 里把 `page` / `pageSize` 从精确过滤字段中剔除，避免分页参数误参与卡片字段筛选，导致分类列表和详情链路出现“明明有数据却被筛空”的问题。
- 继续对齐卡片列表页和 uni-app 的卡片结构与样式：卡片主体收敛为“顶部信息行 + 题面 + 答案 + 底部标签行”四层结构，标签从顶部分类旁移到底部，并在无标签时补上“暂无标签”占位；同时补齐卡片最小高度、内边距、题面单行截断、答案两行截断和底部标签行样式，让卡片高度和信息层级更稳定。
- 修正列表空态语义冲突：空结果时只显示“没有找到相关卡片”，只有在已有结果且翻页到底时才显示“没有更多了”，不再同时出现两种互斥提示。
- 收口一批文案和反馈细节：导入成功提示改成更短的结果摘要并补上确认按钮；文件选择取消不再直接透传 `chooseMessageFile:fail cancel` 作为失败弹窗，而是改成轻量提示；首页、分类编辑、测验设置、Markdown 工具栏等页面同步调整了一轮文案。
- 调整 Markdown 工具栏插入代码块的默认语言：先统一默认代码块语言标识，再进一步把默认值从简写 `ts` 改成 `typescript`，减少默认插入内容和高亮标识之间的歧义。

**05.15**

今日主要是对小程序端整体功能和细节的调整和优化，确保在真机预览的功能完整性。放弃了之前计划的拖拽功能，直接使用上下移动的方式实现卡片排序，简化交互的同时也避免了拖拽在小程序端可能存在的兼容性问题。

关键改动：

- 统计页加上每日测验提醒和结果跳转。
- 添加每日测验状态失效逻辑，确保覆盖导入时题库和结果统计的准确性，现在覆盖导入会清空当日测验结果并重置当日测验状态，避免题库变动后统计数据的严重偏差。
- 优化卡片答案区预览格式，统一状态“未知”的背景颜色，拖拽模式禁用排序选择
- 添加卡片排序功能，支持上下移动和自定义排序模式。同步图标系统，调整样式细节。
- 真机预览修复：修复真机上卡片列表出现搜索结果的问题，直接用wx:if和wx:else明确互斥；修改样式，提高真机展示效果；修改代码中的可选链和空值合并操作使用，避免小程序构建时的兼容性问题。

**05.17**

1、同步 uni-app 侧的每日测验续答修复，补齐 storage 安全读取模式。

关键改动：

- 小程序端补齐 storage 安全读取链路：utils/storage 新增通用 JSON 安全解析与类型保护，cardService 和 categoryService 切到安全读取模式；当本地卡片或分类 storage 被污染时，服务层会回退到可用默认数据并立即回写，避免页面或服务初始化时报错。
- DailyQuizSession 增加 querySignature，getDailyQuizSession 现在会同时校验日期、查询签名、题量和题集有效性；如果当天题集对应的卡片分类、题面、答案或笔记发生变化，则不再复用旧 session，而是按最新卡片内容重建当日题集。
- 同步测验设置弹层提示文案和样式，明确说明今日题集的重建条件：分类、问题、答案、笔记变动会触发重建，仅标签变动不会打断续答。
- 调整测验结果页数据源隔离：今日测验结果改为读取当天已有的 DailyQuizSession，自由测验结果才读取单独缓存，避免两个入口共用一份 quizResult storage 时发生串源。
- 收紧测验页推进条件：当前题目失效或状态更新失败时，不再继续累加结果并切到下一题；同时自由测验完成后才写 quizResult 缓存，每日测验结果完全以 session 为准，保持两类测验的状态来源一致。

2、同步 uniapp 侧的分类管理改动，补上分类上下移动能力。

关键改动：

- `services/categoryService.ts`：新增 `moveCategoryUp` / `moveCategoryDown`，通过交换 `sort` 值实现分类排序调整，未分类和系统分类不允许移动。
- `view-model/card-view.ts` 和 `types/card.ts`：分类视图补齐 `canMoveUp` / `canMoveDown`，页面只在可移动时显示可点击状态，避免误操作。
- `pages/categoryManage/index.ts` / `index.wxml` / `index.wxss`：分类管理页增加上下移动按钮，移动成功后重新加载数据，静默成功，样式与现有卡片管理页保持一致。
- `assets/actions`：补齐编辑、删除、上移、下移图标资源，避免页面继续使用纯文本按钮。

3、其他问题修复和业务调整：

- markdown 渲染时只保留明确的链接识别，关闭容易误判的模糊链接规则，同步 uni-app 侧的 markdown-it 配置。
- 更新卡片的初始默认数据，附带说明和示例。
- 修复每日测验数量错误的问题，确保每日测验不参与分类过滤，抽全题库。
- 分类名限制调整为 20 字，不能重名，排序不填则放到最后。

4、重构小程序端 Markdown 展示组件，修复 rich-text 在真机上的块级样式失效问题。

背景说明：

- 小程序 `rich-text` 不是完整浏览器渲染器，对 HTML 标签、外部 wxss 穿透、`overflow-x`、`hr`、`blockquote`、列表缩进和表格布局的支持都不稳定。
- 之前直接把 markdown-it 生成的整段 HTML 交给 `rich-text`，在 H5 / App 侧表现正常，但在小程序真机里会出现标题行高和上下间距过紧、分割线不显示、列表前导间隔过宽、引用块样式失效且内容拥挤等问题。
- 后续尝试把样式写成 inline style 只能缓解部分问题，无法稳定控制列表、引用、分割线和表格这类块级结构。

关键改动：

- `package-card/components/markdown-content/index.ts`：保留 markdown-it 作为 Markdown 解析器，但不再把整篇 Markdown 直接渲染成一个 HTML 字符串；改为读取 token 并拆成 `heading`、`paragraph`、`list`、`quote`、`divider`、`code`、`table` 等块级数据。
- `package-card/components/markdown-content/index.wxml`：改为按块级数据渲染原生小程序节点。标题、段落、列表、引用、分割线、代码块和表格都由 `view` / `text` / `scroll-view` 控制外层结构，`rich-text` 只保留在块内部处理加粗、斜体、行内代码、链接、图片等行内内容。
- `package-card/components/markdown-content/index.wxss`：新增小程序专用 Markdown 样式，统一标题上下间距和行高，手动绘制分割线，列表使用自定义 marker 缩小前导间隔，引用块使用原生背景、左边线和内边距。
- 表格不再依赖 `rich-text` 内部的 `<table>` 横向溢出能力，改成解析为行列数据后用 `scroll-view scroll-x` 包裹原生单元格，固定单元格宽度，内容较多时横向滚动，避免在手机窄屏里全部挤在一起。

5、已知问题：小程序真机中 Markdown 笔记 textarea 在长内容编辑时可能出现内部滚动条，与页面滚动存在一定手感冲突。当前保留原生 auto-height，以保证输入、光标、键盘聚焦和工具栏插入行为稳定。

- 当前不继续改动，不影响核心功能，继续改的收益小，只提升视觉和手感，疑似小程序原生组件边界问题，当前不打算为它重构编辑器。
- 继续改风险会明显变大：光标跳动、输入区空白、键盘聚焦异常、页面滚动错位、工具栏插入位置错乱、不同机型表现不一致。编辑器是核心入口，一旦光标、键盘、插入位置出问题，体验会比滚动条难受十倍。
- 后续如需优化，可评估拆分为预览/编辑模式：编辑时 textarea 固定高度，查看时 Markdown 预览完整展开，或改为固定高度编辑区：textarea 固定高度，内部滚动变成明确设计，页面不再跟着内容无限变长。
