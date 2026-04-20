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
