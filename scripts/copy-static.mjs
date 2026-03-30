import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const entriesToCopy = [
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

function getRuntimeDependencies() {
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return [];
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return Object.keys(packageJson.dependencies || {});
}

async function syncVendorModulesToDist() {
  const dependencies = getRuntimeDependencies();
  for (const dependencyName of dependencies) {
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
}

function syncDataJsonToJsModules() {
  const dataDir = path.join(rootDir, 'data');
  const jsonFiles = ['cards.json', 'category.json'];

  for (const fileName of jsonFiles) {
    const jsonPath = path.join(dataDir, fileName);
    if (!existsSync(jsonPath)) {
      continue;
    }

    const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
    const jsModulePath = path.join(dataDir, fileName.replace(/\.json$/, '.js'));
    writeFileSync(jsModulePath, `module.exports = ${JSON.stringify(data, null, 2)};\n`, 'utf8');
  }
}

const filter = (source) => {
  const relativePath = path.relative(rootDir, source).replace(/\\/g, '/');

  if (!relativePath || relativePath.startsWith('dist/')) {
    return false;
  }

  const fileName = path.basename(source);
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
    const tsSibling = source.replace(/\.js$/, '.ts');
    return !existsSync(tsSibling);
  }

  return true;
};

await mkdir(distDir, { recursive: true });
syncDataJsonToJsModules();

for (const entry of entriesToCopy) {
  const sourcePath = path.join(rootDir, entry);
  if (!existsSync(sourcePath)) {
    continue;
  }

  await cp(sourcePath, path.join(distDir, entry), {
    recursive: true,
    force: true,
    filter,
  });
}

await syncVendorModulesToDist();
