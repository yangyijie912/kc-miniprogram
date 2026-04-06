import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// 全局变量列表，适用于微信小程序环境和 Node.js 环境
const sharedGlobals = {
  App: 'readonly',
  Behavior: 'readonly',
  Buffer: 'readonly',
  Component: 'readonly',
  Page: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  exports: 'readonly',
  getApp: 'readonly',
  getCurrentPages: 'readonly',
  global: 'readonly',
  globalThis: 'readonly',
  module: 'readonly',
  process: 'readonly',
  require: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  wx: 'readonly',
  WechatMiniprogram: 'readonly',
};

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'miniprogram_npm/**'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: sharedGlobals,
    },
  },
  js.configs.recommended, // JavaScript推荐规则
  ...tseslint.configs.recommended, // TypeScript推荐规则
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      // 允许使用 require 导入模块，因为该项目依赖包绕过了小程序自己的依赖分发逻辑直接引入
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-extra-boolean-cast': 'off', // 允许双重布尔转换
    },
  },
];
