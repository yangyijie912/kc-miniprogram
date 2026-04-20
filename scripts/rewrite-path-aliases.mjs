import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import chokidar from 'chokidar';
import { distDir, toPosixPath } from './copy-static.shared.mjs';

// 定义路径别名和需要忽略的目录
const aliasPrefix = '@/';
const ignoredDirectories = new Set([
  path.join(distDir, 'miniprogram_npm'),
  path.join(distDir, 'package-card', 'miniprogram_npm'),
]);

// 检查路径是否在需要忽略的目录中
function isIgnoredPath(filePath) {
  const normalizedPath = path.resolve(filePath);

  return Array.from(ignoredDirectories).some((ignoredDirectory) => {
    const normalizedDirectory = path.resolve(ignoredDirectory);
    // path.sep 是当前操作系统的分隔符，确保目录路径以正确的分隔符结尾，避免误匹配类似前缀的路径
    return (
      normalizedPath === normalizedDirectory ||
      normalizedPath.startsWith(`${normalizedDirectory}${path.sep}`)
    );
  });
}

// 递归收集所有 JavaScript 文件
async function collectJavaScriptFiles(directoryPath, filePaths = []) {
  if (!existsSync(directoryPath) || isIgnoredPath(directoryPath)) {
    return filePaths;
  }

  // 拿到目录下的所有条目（文件和子目录）
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    // 如果是目录，递归收集其中的 JavaScript 文件
    if (entry.isDirectory()) {
      await collectJavaScriptFiles(entryPath, filePaths);
      continue;
    }

    // 如果是文件且以 .js 结尾，收集该文件的路径
    if (entry.isFile() && entry.name.endsWith('.js')) {
      filePaths.push(entryPath);
    }
  }

  return filePaths;
}

// 把 "@/some/path" 这样的模块路径解析成 dist 目录下的实际文件路径
function resolveAliasTarget(specifier) {
  if (!specifier.startsWith(aliasPrefix)) {
    return null;
  }

  const aliasedPath = specifier.slice(aliasPrefix.length);
  const basePath = path.join(distDir, aliasedPath);
  // 可能的目标文件路径包括：basePath、basePath.js、basePath/index.js 等
  const candidates = [
    basePath,
    `${basePath}.js`,
    `${basePath}.cjs`,
    `${basePath}.mjs`,
    `${basePath}.json`,
    path.join(basePath, 'index.js'),
    path.join(basePath, 'index.cjs'),
    path.join(basePath, 'index.mjs'),
    path.join(basePath, 'index.json'),
  ];

  // 返回第一个存在的路径，或者 null 如果没有找到
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

// 解析 TypeScript 可能压成裸名字的本地模块引用，例如同目录的 serviceHelper
function resolveBareLocalTarget(specifier, filePath) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    return null;
  }

  const directory = path.dirname(filePath);
  const candidates = [
    path.join(directory, `${specifier}.js`),
    path.join(directory, `${specifier}.cjs`),
    path.join(directory, `${specifier}.mjs`),
    path.join(directory, `${specifier}.json`),
    path.join(directory, specifier, 'index.js'),
    path.join(directory, specifier, 'index.cjs'),
    path.join(directory, specifier, 'index.mjs'),
    path.join(directory, specifier, 'index.json'),
  ];

  return candidates.find((candidate) => existsSync(candidate)) || null;
}

// 计算从 fromFilePath 到 targetPath 的相对模块路径，并去掉 .js、.cjs、.mjs 后缀
function toRelativeModuleSpecifier(fromFilePath, targetPath) {
  // 利用 path.relative 计算相对路径
  const relativePath = toPosixPath(path.relative(path.dirname(fromFilePath), targetPath));
  const normalizedPath =
    relativePath.startsWith('.') || relativePath.startsWith('/')
      ? relativePath
      : `./${relativePath}`;
  return normalizedPath;
}

// 对单个JS文件重写源代码中的路径别名
function rewriteSourceText(sourceText, filePath) {
  // 这个正则匹配 require('...')、import('...')、import ... from '...' 这三种形式的模块引入，并捕获模块路径
  const pattern = /(require\(\s*|from\s+|import\(\s*|import\s+)(['"])([^'"]+)\2/g;

  // 对文件源码每个匹配项，解析模块路径并替换成相对路径
  // match 是整个匹配的字符串，prefix 是 require(、from 或 import( 这些引入前缀，quote 是引号，specifier 是模块路径
  return sourceText.replace(pattern, (match, prefix, quote, specifier) => {
    const resolvedTarget =
      resolveAliasTarget(specifier) || resolveBareLocalTarget(specifier, filePath);

    if (!resolvedTarget) {
      return match;
    }
    // 计算相对模块路径，并保持引号和前缀不变
    const relativeSpecifier = toRelativeModuleSpecifier(filePath, resolvedTarget);

    return `${prefix}${quote}${relativeSpecifier}${quote}`;
  });
}

/**
 * 主流程：
 * 1. 确保 dist 目录存在
 * 2. 收集 dist 目录下的所有 JavaScript 文件
 * 3. 对每个文件，读取其内容，重写路径别名，并在有修改时写回文件
 * 4. 如果启用了 --watch 模式，使用 chokidar 监视 dist 目录的变化，并在文件添加、修改或删除时重新执行重写操作
 */
async function rewritePathAliases() {
  await mkdir(distDir, { recursive: true });

  const files = await collectJavaScriptFiles(distDir);

  for (const filePath of files) {
    const sourceText = await readFile(filePath, 'utf8');
    const updatedText = rewriteSourceText(sourceText, filePath);

    if (updatedText !== sourceText) {
      await writeFile(filePath, updatedText, 'utf8');
    }
  }
}

// 主函数，支持 --watch 模式，在文件变更时自动重写路径别名
async function main() {
  if (process.argv.includes('--watch')) {
    let isRewriting = false;
    let pendingRewrite = false;

    // 定义一个函数来执行重写操作，并在完成后检查是否有新的重写请求
    const runRewrite = async () => {
      if (isRewriting) {
        pendingRewrite = true;
        return;
      }

      isRewriting = true;

      try {
        await rewritePathAliases();
      } finally {
        isRewriting = false;
      }

      // 如果在重写过程中有新的请求，立即再次执行重写
      if (pendingRewrite) {
        pendingRewrite = false;
        await runRewrite();
      }
    };

    await runRewrite();

    const watcher = chokidar.watch(distDir, {
      ignored: (watchedPath) => isIgnoredPath(watchedPath),
      ignoreInitial: true, // 启动时不把已有文件当作新增事件
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 25,
      },
    });

    // 定义一个定时器变量，用于防抖处理文件变更事件，一段时间内多次变更只集中执行一次重写操作
    let timer = null;
    const scheduleRewrite = () => {
      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        timer = null;
        void runRewrite();
      }, 50);
    };

    watcher.on('add', scheduleRewrite);
    watcher.on('change', scheduleRewrite);
    watcher.on('unlink', scheduleRewrite);

    // 监听 SIGINT 信号，在用户按 Ctrl+C 时优雅地关闭文件监视器并退出进程
    process.on('SIGINT', async () => {
      await watcher.close();
      process.exit(0);
    });

    return;
  }

  // 非 watch 模式直接执行一次重写操作
  await rewritePathAliases();
}

await main();
