import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import {
  syncVendorModulesToDist,
  shouldCopy,
  toPosixPath,
  rootDir,
  distDir,
} from './copy-static.shared.mjs';

const watchedEntries = [
  'app.json',
  'app.wxss',
  'sitemap.json',
  'assets',
  'components',
  'constants',
  'data',
  'package-card',
  'package-card/package.json',
  'pages',
  'package.json',
];

// 将 data 目录下的 JSON 文件转换为 JS 模块，方便在小程序中直接 require 使用
function trySyncDataJsonToJs(sourcePath) {
  const jsPath = getDistPathFromJson(sourcePath);
  if (!jsPath) {
    return null;
  }

  const data = JSON.parse(readFileSync(sourcePath, 'utf8'));
  mkdirSync(path.dirname(jsPath), { recursive: true });
  writeFileSync(jsPath, `module.exports = ${JSON.stringify(data, null, 2)};\n`, 'utf8');
  return jsPath;
}

// 获取Json文件对应的JS模块路径
function getDistPathFromJson(sourcePath) {
  const relativePath = toPosixPath(path.relative(rootDir, sourcePath));
  if (!relativePath.startsWith('data/') || !relativePath.endsWith('.json')) {
    return null;
  }
  // 去掉 data/ 前缀和 .json 后缀，拼接成 dist/data/*.js 的路径
  const jsRelativePath = relativePath.replace(/^data\//, '').replace(/\.json$/, '.js');
  return path.join(distDir, 'data', jsRelativePath);
}

async function copyOne(sourcePath) {
  if (!shouldCopy(sourcePath)) {
    return;
  }

  const relativePath = path.relative(rootDir, sourcePath);
  const targetPath = path.join(distDir, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { force: true });
}

// 移除 dist 目录中对应的文件或目录
async function removeOne(sourcePath) {
  const relativePath = path.relative(rootDir, sourcePath);
  const targetPath = path.join(distDir, relativePath);
  await rm(targetPath, { force: true, recursive: true });
}

await mkdir(distDir, { recursive: true });
await syncVendorModulesToDist();

async function safeRun(action, payloadPath) {
  try {
    await action();
  } catch (error) {
    const e = /** @type {{ code?: string }} */ (error);
    // 当文件被非常快速地创建/删除时，忽略瞬态竞争条件。
    if (e && (e.code === 'ENOENT' || e.code === 'EBUSY')) {
      return;
    }
    console.error(`[copy-static-watch] failed for ${payloadPath}:`, error);
  }
}

// 把监听项转成绝对路径，过滤掉不存在的项，交给 chokidar 监听
const initialTargets = watchedEntries
  .map((entry) => path.join(rootDir, entry))
  .filter((entryPath) => existsSync(entryPath));
// 监听这些文件和目录的变化，动态同步到 dist 目录
const watcher = chokidar.watch(initialTargets, {
  ignoreInitial: false, // 不忽略初始，启动时把所有文件都当成新增事件来处理一遍，确保 dist 目录初始状态正确
  awaitWriteFinish: {
    stabilityThreshold: 120, // 120ms 内文件没有变化才认为写入完成
    pollInterval: 50, // 50ms 内检查一次文件是否还在变化
  },
});

watcher
  .on('add', async (filePath) => {
    await safeRun(async () => {
      if (path.basename(filePath) === 'package.json') {
        await syncVendorModulesToDist();
      }
      trySyncDataJsonToJs(filePath);
      await copyOne(filePath);
    }, filePath);
  })
  .on('change', async (filePath) => {
    await safeRun(async () => {
      if (path.basename(filePath) === 'package.json') {
        await syncVendorModulesToDist();
      }
      trySyncDataJsonToJs(filePath);
      await copyOne(filePath);
    }, filePath);
  })
  .on('unlink', async (filePath) => {
    await safeRun(async () => {
      await removeOne(filePath);

      const distJsPath = getDistPathFromJson(filePath);
      if (distJsPath) {
        await rm(distJsPath, { force: true });
      }
    }, filePath);
  })
  .on('addDir', async (dirPath) => {
    await safeRun(async () => {
      if (!shouldCopy(dirPath)) {
        return;
      }
      const relativePath = path.relative(rootDir, dirPath);
      await mkdir(path.join(distDir, relativePath), { recursive: true });
    }, dirPath);
  })
  .on('unlinkDir', async (dirPath) => {
    await safeRun(async () => {
      await removeOne(dirPath);
    }, dirPath);
  })
  .on('error', (error) => {
    console.error('[copy-static-watch] error:', error);
  })
  .on('ready', () => {
    console.log('[copy-static-watch] watching static assets...');
  });
