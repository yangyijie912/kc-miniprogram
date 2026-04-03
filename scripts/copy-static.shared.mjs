import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);
export const rootDir = path.resolve(__dirname, '..');
export const distDir = path.join(rootDir, 'dist');

// 把 Windows 路径转换为 POSIX 路径，\ 转换为 /
export function toPosixPath(value) {
  return value.replace(/\\/g, '/');
}

// 读取 package.json 的 dependencies 字段，获取运行时依赖列表
export function getRuntimeDependencies(packageJsonDir = rootDir) {
  const packageJsonPath = path.join(packageJsonDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return [];
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return Object.keys(packageJson.dependencies || {});
}

// 获取 data 目录下的 JSON 文件列表
function getDataJsonFiles(dataDir = path.join(rootDir, 'data')) {
  if (!existsSync(dataDir)) {
    return [];
  }

  return readdirSync(dataDir).filter((fileName) => fileName.endsWith('.json'));
}

// 将 JSON 数据写入 JS 模块，导出一个对象
function writeDataModule(targetPath, data) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, `module.exports = ${JSON.stringify(data, null, 2)};\n`, 'utf8');
}

// 同步 data 目录下的 JSON 文件到 dist 目录，并生成对应的 JS 模块
export async function syncDataJsonArtifacts() {
  const dataDir = path.join(rootDir, 'data');
  const distDataDir = path.join(distDir, 'data');

  await mkdir(distDataDir, { recursive: true });

  for (const fileName of getDataJsonFiles(dataDir)) {
    const jsonPath = path.join(dataDir, fileName);
    if (!existsSync(jsonPath)) {
      continue;
    }

    const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
    const jsFileName = fileName.replace(/\.json$/, '.js');
    const sourceJsPath = path.join(dataDir, jsFileName);
    const distJsonPath = path.join(distDataDir, fileName);
    const distJsPath = path.join(distDataDir, jsFileName);

    writeDataModule(sourceJsPath, data);
    await cp(jsonPath, distJsonPath, { force: true });
    writeDataModule(distJsPath, data);
  }
}

// 移除 dist 目录中对应的 data JSON 文件和 JS 模块
export async function removeDataJsonArtifacts(sourceJsonPath) {
  const relativePath = path.relative(rootDir, sourceJsonPath).replace(/\\/g, '/');
  if (!relativePath.startsWith('data/') || !relativePath.endsWith('.json')) {
    return;
  }

  const jsRelativePath = relativePath.replace(/\.json$/, '.js');
  await rm(path.join(rootDir, jsRelativePath), {
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
  await rm(path.join(distDir, relativePath), {
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
  await rm(path.join(distDir, jsRelativePath), {
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}

// 同步依赖到 dist 目录
export async function syncVendorModulesToDist() {
  const mainVendorDir = path.join(distDir, 'miniprogram_npm');
  const subVendorDir = path.join(distDir, 'package-card', 'miniprogram_npm');

  // 先清空，避免旧依赖残留
  await rm(mainVendorDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
  await rm(subVendorDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });

  await mkdir(mainVendorDir, { recursive: true });
  await mkdir(subVendorDir, { recursive: true });

  const subpackageDependencies = new Set(
    getRuntimeDependencies(path.join(rootDir, 'package-card')),
  );

  // 主包：复制所有不属于 package-card 的顶层依赖
  for (const dependencyName of getRuntimeDependencies().filter(
    (dep) => !subpackageDependencies.has(dep),
  )) {
    const dependencySource = path.join(rootDir, 'node_modules', dependencyName);
    const dependencyTarget = path.join(mainVendorDir, dependencyName);

    if (!existsSync(dependencySource)) {
      continue;
    }

    await mkdir(path.dirname(dependencyTarget), { recursive: true });
    await cp(dependencySource, dependencyTarget, {
      recursive: true,
      force: true,
    });
  }

  // 子包：递归复制 package-card 的依赖树
  const copiedSubpackageDependencies = new Set();

  const copyDependencyTree = async (dependencyName) => {
    if (copiedSubpackageDependencies.has(dependencyName)) {
      return;
    }

    copiedSubpackageDependencies.add(dependencyName);

    const dependencySource = path.join(rootDir, 'node_modules', dependencyName);
    const dependencyTarget = path.join(subVendorDir, dependencyName);

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

  for (const dependencyName of subpackageDependencies) {
    await copyDependencyTree(dependencyName);
  }
}

// 判断某个文件是否应该被复制到 dist 目录
export function shouldCopy(source) {
  const relativePath = path.relative(rootDir, source).replace(/\\/g, '/');

  if (!relativePath || relativePath.startsWith('dist/')) {
    return false;
  }

  // 这些配置文件不直接复制，而是通过代码生成的方式注入到最终产物中
  const fileName = path.basename(source);
  if (
    fileName === 'project.config.json' ||
    fileName === 'project.private.config.json' ||
    fileName === 'package.json' ||
    fileName === 'package-lock.json'
  ) {
    // 但 package-card 作为独立子包需要保留 package.json 来声明它的运行时依赖
    if (relativePath === 'package-card/package.json') {
      return true;
    }
    return false;
  }

  // TypeScript 源文件不直接复制，而是通过编译产物（同名的 JS 文件）间接使用
  if (fileName.endsWith('.ts')) {
    return false;
  }

  // data 目录下的 JSON 文件不直接复制，而是通过 syncDataJsonToJsModules 转换为 JS 模块
  if (relativePath.startsWith('data/') && fileName.endsWith('.json')) {
    return false;
  }

  if (relativePath.startsWith('data/') && fileName.endsWith('.js')) {
    return false;
  }

  // 其他 JS 文件如果有同名的 TS 文件存在，则不复制（说明它是编译产物）
  if (fileName.endsWith('.js')) {
    const tsSibling = source.replace(/\.js$/, '.ts');
    return !existsSync(tsSibling);
  }

  return true;
}
