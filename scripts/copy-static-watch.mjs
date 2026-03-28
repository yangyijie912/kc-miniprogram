import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chokidar from 'chokidar';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const watchedEntries = [
  'app.json',
  'app.wxss',
  'sitemap.json',
  'assets',
  'components',
  'config',
  'constants',
  'data',
  'pages',
];

function toPosixPath(value) {
  return value.replace(/\\/g, '/');
}

function trySyncDataJsonToJs(sourcePath) {
  const relativePath = toPosixPath(path.relative(rootDir, sourcePath));
  if (!relativePath.startsWith('data/') || !relativePath.endsWith('.json')) {
    return null;
  }

  const data = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const jsPath = sourcePath.replace(/\.json$/, '.js');
  writeFileSync(jsPath, `module.exports = ${JSON.stringify(data, null, 2)};\n`, 'utf8');
  return jsPath;
}

function shouldCopy(sourcePath) {
  const relativePath = toPosixPath(path.relative(rootDir, sourcePath));
  if (!relativePath || relativePath.startsWith('dist/')) {
    return false;
  }

  const fileName = path.basename(sourcePath);
  if (
    fileName === 'project.config.json' ||
    fileName === 'project.private.config.json' ||
    fileName === 'package.json' ||
    fileName === 'package-lock.json'
  ) {
    return false;
  }

  if (fileName.endsWith('.ts')) {
    return false;
  }

  if (fileName.endsWith('.js')) {
    if (relativePath.startsWith('data/')) {
      return false;
    }
    const tsSibling = sourcePath.replace(/\.js$/, '.ts');
    return !existsSync(tsSibling);
  }

  return true;
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

async function removeOne(sourcePath) {
  const relativePath = path.relative(rootDir, sourcePath);
  const targetPath = path.join(distDir, relativePath);
  await rm(targetPath, { force: true, recursive: true });
}

await mkdir(distDir, { recursive: true });

async function safeRun(action, payloadPath) {
  try {
    await action();
  } catch (error) {
    const e = /** @type {{ code?: string }} */ (error);
    // Ignore transient races when files are created/removed very quickly.
    if (e && (e.code === 'ENOENT' || e.code === 'EBUSY')) {
      return;
    }
    console.error(`[copy-static-watch] failed for ${payloadPath}:`, error);
  }
}

const initialTargets = watchedEntries.map((entry) => path.join(rootDir, entry));
const watcher = chokidar.watch(initialTargets, {
  ignoreInitial: false,
  awaitWriteFinish: {
    stabilityThreshold: 120,
    pollInterval: 50,
  },
});

watcher
  .on('add', async (filePath) => {
    await safeRun(async () => {
      const generatedJsPath = trySyncDataJsonToJs(filePath);
      await copyOne(filePath);
      if (generatedJsPath) {
        await copyOne(generatedJsPath);
      }
    }, filePath);
  })
  .on('change', async (filePath) => {
    await safeRun(async () => {
      const generatedJsPath = trySyncDataJsonToJs(filePath);
      await copyOne(filePath);
      if (generatedJsPath) {
        await copyOne(generatedJsPath);
      }
    }, filePath);
  })
  .on('unlink', async (filePath) => {
    await safeRun(async () => {
      await removeOne(filePath);
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
