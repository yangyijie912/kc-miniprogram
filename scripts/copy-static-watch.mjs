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
  'package-card',
  'package-card/package.json',
  'pages',
  'package.json',
];

function getRuntimeDependencies(packageJsonDir = rootDir) {
  const packageJsonPath = path.join(packageJsonDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return [];
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return Object.keys(packageJson.dependencies || {});
}

async function syncVendorModulesToDist() {
  // Get subpackage dependencies and their runtime dependency tree
  const subpackageDependencies = new Set(
    getRuntimeDependencies(path.join(rootDir, 'package-card')),
  );
  const copiedSubpackageDependencies = new Set();

  const copyDependencyTree = async (dependencyName) => {
    if (copiedSubpackageDependencies.has(dependencyName)) {
      return;
    }

    copiedSubpackageDependencies.add(dependencyName);
    const dependencySource = path.join(rootDir, 'node_modules', dependencyName);
    const dependencyTarget = path.join(distDir, 'package-card', 'miniprogram_npm', dependencyName);

    if (!existsSync(dependencySource)) {
      return;
    }

    await mkdir(path.dirname(dependencyTarget), { recursive: true });
    await cp(dependencySource, dependencyTarget, {
      recursive: true,
      force: true,
    });

    const dependencyPackageJson = path.join(dependencySource, 'package.json');
    if (!existsSync(dependencyPackageJson)) {
      return;
    }

    const dependencyManifest = JSON.parse(readFileSync(dependencyPackageJson, 'utf8'));
    const nestedDependencies = Object.keys(dependencyManifest.dependencies || {});
    for (const nestedDependency of nestedDependencies) {
      await copyDependencyTree(nestedDependency);
    }
  };

  // Copy main package dependencies to dist/miniprogram_npm
  for (const dependencyName of getRuntimeDependencies().filter(
    (dep) => !subpackageDependencies.has(dep),
  )) {
    const dependencySource = path.join(rootDir, 'node_modules', dependencyName);
    const dependencyTarget = path.join(distDir, 'miniprogram_npm', dependencyName);

    if (!existsSync(dependencySource)) {
      continue;
    }

    await mkdir(path.dirname(dependencyTarget), { recursive: true });
    await cp(dependencySource, dependencyTarget, {
      recursive: true,
      force: true,
    });
  }

  // For subpackage, only copy markdown-it (no transitive deps)
  const mdSrc = path.join(rootDir, 'node_modules', 'markdown-it');
  const mdDst = path.join(distDir, 'package-card', 'miniprogram_npm', 'markdown-it');
  if (existsSync(mdSrc)) {
    await mkdir(path.dirname(mdDst), { recursive: true });
    await cp(mdSrc, mdDst, { recursive: true, force: true });
  }
}

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
    if (relativePath === 'package-card/package.json') {
      return true;
    }
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
await syncVendorModulesToDist();

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

const initialTargets = watchedEntries
  .map((entry) => path.join(rootDir, entry))
  .filter((entryPath) => existsSync(entryPath));
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
      if (path.basename(filePath) === 'package.json') {
        await syncVendorModulesToDist();
      }
      const generatedJsPath = trySyncDataJsonToJs(filePath);
      await copyOne(filePath);
      if (generatedJsPath) {
        await copyOne(generatedJsPath);
      }
    }, filePath);
  })
  .on('change', async (filePath) => {
    await safeRun(async () => {
      if (path.basename(filePath) === 'package.json') {
        await syncVendorModulesToDist();
      }
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
