import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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
    const tsSibling = source.replace(/\.js$/, '.ts');
    return !existsSync(tsSibling);
  }

  return true;
};

await mkdir(distDir, { recursive: true });

for (const entry of entriesToCopy) {
  await cp(path.join(rootDir, entry), path.join(distDir, entry), {
    recursive: true,
    force: true,
    filter,
  });
}
