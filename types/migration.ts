import type { Card, Category } from './card';

export type ExportType = 'json';
export type ImportType = 'json';

export interface ExportData {
  categories: Category[];
  cards: Card[];
  version: string;
  exportedAt: number;
}

export interface ImportData {
  categories: Category[];
  cards: Card[];
  version: string;
  exportedAt: number;
}

export interface ImportResult {
  categoryCount: number; // 导入后的分类总数量
  categoryViewCount: number; // 视图中的分类数量（不包含系统分类比如“未分类”）
  cardCount: number; // 导入后的卡片总数量
  newCategoryCount: number; // 新增的分类数量
  newCardCount: number; // 新增的卡片数量
  skippedCategoryCount: number; // 跳过的分类数量（已存在的分类）
  skippedCardCount: number; // 跳过的卡片数量（不规范的卡片）
  overwrittenCardCount: number; // 覆盖的卡片数量（同 ID 覆盖）
}
