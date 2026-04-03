import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  syncVendorModulesToDist,
  syncDataJsonArtifacts,
  shouldCopy,
  rootDir,
  distDir,
} from './copy-static.shared.mjs';

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

const filter = (source) => {
  return shouldCopy(source);
};

await mkdir(distDir, { recursive: true });
await syncDataJsonArtifacts();

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
