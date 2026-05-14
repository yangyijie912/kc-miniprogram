import type { Card, Category, CardSortBy, SortOrder } from '@/types/card';

const getSafeNumber = (value: unknown, fallback = Number.MAX_SAFE_INTEGER): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const compareNumber = (a: number, b: number, order: SortOrder = 'asc'): number => {
  return order === 'asc' ? a - b : b - a;
};

const getSortValue = (card: Card, sortBy: CardSortBy): number => {
  if (sortBy === 'contentUpdatedAt' || sortBy === 'updatedAt') {
    return getSafeNumber(card.contentUpdatedAt ?? card.updatedAt, 0);
  }

  if (sortBy === 'createdAt') {
    return getSafeNumber(card.createdAt, 0);
  }

  return 0;
};

export const sortCards = (
  cards: Card[],
  sortBy: CardSortBy,
  order: SortOrder = 'asc',
  categories: Category[] = [],
): Card[] => {
  if (sortBy === 'customSort') {
    return sortCardsByCategoryAndSort(cards, categories);
  }

  return [...cards].sort((a, b) => {
    const aValue = getSortValue(a, sortBy);
    const bValue = getSortValue(b, sortBy);
    const result = compareNumber(aValue, bValue, order);

    if (result !== 0) {
      return result;
    }

    return getSafeNumber(a.createdAt, 0) - getSafeNumber(b.createdAt, 0);
  });
};

// 自定义排序不做拖拽写回，但查询时仍然要保证分类顺序和卡片顺序稳定。
export const sortCardsByCategoryAndSort = (cards: Card[], categories: Category[]): Card[] => {
  const categorySortMap = new Map(
    categories.map((category) => [category.id, getSafeNumber(category.sort)]),
  );

  return [...cards].sort((a, b) => {
    const aCategorySort = categorySortMap.get(a.categoryId) ?? Number.MAX_SAFE_INTEGER;
    const bCategorySort = categorySortMap.get(b.categoryId) ?? Number.MAX_SAFE_INTEGER;

    if (aCategorySort !== bCategorySort) {
      return aCategorySort - bCategorySort;
    }

    const aCardSort = getSafeNumber(a.sort);
    const bCardSort = getSafeNumber(b.sort);

    if (aCardSort !== bCardSort) {
      return aCardSort - bCardSort;
    }

    return getSafeNumber(a.createdAt, 0) - getSafeNumber(b.createdAt, 0);
  });
};
