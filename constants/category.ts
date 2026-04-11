import type { Category } from '@/types/card';

export const UNCATEGORIZED_ID = 'uncategorized';
export const UNCATEGORIZED_NAME = '未分类';

export const UNCATEGORIZED_CATEGORY: Category = {
  id: UNCATEGORIZED_ID,
  name: UNCATEGORIZED_NAME,
  sort: Number.MAX_SAFE_INTEGER,
  isSystem: true,
};
