# knowledge-card

一个基于微信小程序的知识卡片应用，支持卡片浏览、分类管理、卡片编辑、测验、导入导出和 Markdown 内容编辑。它是另一个同名 uniapp 项目的原生微信小程序版，在保留核心逻辑的基础上补齐了原生小程序需要的工程化和分包处理。

## 项目特点

- 源码与运行目录分离，微信开发者工具只读取 `dist/`
- TypeScript 作为主要开发语言，运行产物统一输出到 `dist/`
- 静态资源、分包依赖和运行时数据模块由脚本自动同步
- 开发态支持 `watch` 模式，修改源码后自动更新运行产物
- 已接入 ESLint、Prettier 和 TypeScript 类型检查

## 技术栈

- 微信小程序
- TypeScript
- Node.js 脚本工具链
- ESLint
- Prettier
- chokidar
- concurrently

## 目录说明

- `pages/`：主包页面
- `package-card/`：卡片相关分包
- `components/`：通用组件
- `services/`：业务服务层
- `utils/`：通用工具
- `constants/`：常量定义
- `types/`：类型定义
- `data/`：数据源 JSON 和自动生成的运行时 JS 模块
- `assets/`：静态资源
- `dist/`：小程序运行目录
- `docs/`：工程化说明和开发记录

## 功能概览

- 卡片列表与详情查看
- 卡片编辑与 Markdown 内容编辑
- 分类管理
- 测验与测验结果页
- 卡片批量操作
- 数据导入与导出
- 首页和“我的”页面

## 环境要求

- Node.js 18+
- npm
- 微信开发者工具

## 安装依赖

```bash
npm install
```

## 常用命令

```bash
npm run build        # 完整构建
npm run dev          # 开发模式，启动三个 watcher
npm run check        # ESLint + TypeScript 检查
npm run lint         # ESLint 检查
npm run typecheck    # TypeScript 类型检查
npm run format       # Prettier 格式化
npm run format:check # Prettier 格式检查
```

## 构建与开发流程

### 一次性构建

```bash
npm run build
```

执行顺序如下：

1. 清理 `dist/`
2. 同步静态资源和运行时依赖
3. 编译 TypeScript 到 `dist/`
4. 重写 `dist/` 中的路径别名

### 日常开发

```bash
npm run dev
```

会同时启动：

- `watch:ts`
- `watch:assets`
- `watch:paths`

这样可以在源码变化后自动更新 `dist/`。

## 工作方式

- 微信开发者工具的项目根目录配置为 `dist/`
- 平时只修改源码目录，不直接改 `dist/`
- `data/*.json` 是数据源，`data/*.js` 由脚本自动生成
- `package-card/` 下的运行时依赖会同步到对应子包目录

## 注意事项

- 不要手动修改自动生成的 `data/*.js`
- 如果开发者工具里还是旧内容，先确认 `npm run dev` 是否还在运行
- 如果 `dist/` 被占用导致清理失败，通常关闭开发者工具后再重试即可
- 工程化方案和踩坑记录见 [docs/ts-build-and-watch.md](docs/ts-build-and-watch.md)

## 参考

- [工程化说明](docs/ts-build-and-watch.md)
- [开发记录](docs/devlog-weapp.md)
