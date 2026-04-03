import { cp, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { syncVendorModulesToDist, shouldCopy, rootDir, distDir } from './copy-static.shared.mjs';

const entriesToCopy = [
  'app.json',
  'app.wxss',
  'sitemap.json',
  'assets',
  'components',
  'constants',
  'data',
  'package-card',
  'pages',
];

// 将 data 目录下的 JSON 文件转换为 JS 模块，方便在小程序中直接 require 使用
function syncDataJsonToJsModules() {
  const dataDir = path.join(rootDir, 'data');
  const distDataDir = path.join(distDir, 'data');
  const allFiles = existsSync(dataDir) ? readdirSync(dataDir) : [];
  const jsonFiles = allFiles.filter((file) => file.endsWith('.json'));

  if (!existsSync(distDataDir)) {
    mkdirSync(distDataDir, { recursive: true });
  }

  for (const fileName of jsonFiles) {
    const jsonPath = path.join(dataDir, fileName);
    if (!existsSync(jsonPath)) {
      continue;
    }

    const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
    const jsModulePath = path.join(distDataDir, fileName.replace(/\.json$/, '.js'));
    writeFileSync(jsModulePath, `module.exports = ${JSON.stringify(data, null, 2)};\n`, 'utf8');
  }
}

const filter = (source) => {
  return shouldCopy(source);
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
