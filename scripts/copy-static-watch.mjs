import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import {
  syncVendorModulesToDist,
  syncDataJsonArtifacts,
  removeDataJsonArtifacts,
  shouldCopy,
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
  await rm(targetPath, {
    force: true,
    recursive: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}

await mkdir(distDir, { recursive: true });
await syncVendorModulesToDist();
await syncDataJsonArtifacts();

// 设为 false，启动时不再因为 package.json 的初始 add 事件反复清理 vendor 目录
// 等监听准备好后再响应 package.json 的变化事件，避免重复构建。
let watcherReady = false;

// 当 package.json 变化时，重新同步 vendor 模块到 dist 目录
async function syncVendorModulesWhenReady(filePath) {
  if (!watcherReady || path.basename(filePath) !== 'package.json') {
    return;
  }

  await syncVendorModulesToDist();
}

function isDataJsonFile(filePath) {
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  return relativePath.startsWith('data/') && relativePath.endsWith('.json');
}

async function safeRun(action, payloadPath) {
  try {
    await action();
  } catch (error) {
    const e = /** @type {{ code?: string }} */ (error);
    // 当文件被非常快速地创建/删除时，忽略瞬态竞争条件。
    if (e && (e.code === 'ENOENT' || e.code === 'EBUSY' || e.code === 'EPERM')) {
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
      await syncVendorModulesWhenReady(filePath);
      if (isDataJsonFile(filePath)) {
        await syncDataJsonArtifacts();
      }
      await copyOne(filePath);
    }, filePath);
  })
  .on('change', async (filePath) => {
    await safeRun(async () => {
      await syncVendorModulesWhenReady(filePath);
      if (isDataJsonFile(filePath)) {
        await syncDataJsonArtifacts();
      }
      await copyOne(filePath);
    }, filePath);
  })
  .on('unlink', async (filePath) => {
    await safeRun(async () => {
      const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
      if (relativePath.startsWith('data/') && relativePath.endsWith('.json')) {
        await removeDataJsonArtifacts(filePath);
      } else {
        await removeOne(filePath);
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
    watcherReady = true;
    console.log('[copy-static-watch] watching static assets...');
  });
