import type { Card, Category, CategoryView } from '../types/card';
import type { ServiceResult } from '../types/service';
import { getCards } from '../services/cardService';
import { getCategories } from '../services/categoryService';
import { UNCATEGORIZED_ID } from '../constants/category';
import { getCategoryTheme } from './categoryTheme';

export type CategoryViewPageData = {
  cardList: Card[];
  categoryList: Category[];
  categoryViewList: CategoryView[];
};

// 创建一个映射，统计每个分类的卡片数量，格式为 { [categoryId]: count }
function createCardCountMap(cards: Card[]): Record<string, number> {
  const countMap: Record<string, number> = {};

  cards.forEach((card) => {
    const currentCount = countMap[card.categoryId] ?? 0;
    // 如果出现这个分类ID，表示有一条该分类的卡片，累加一次
    countMap[card.categoryId] = currentCount + 1;
  });

  return countMap;
}

// 计算分类视图列表，包含每个分类的卡片数量和是否可编辑/删除等属性
function createCategoryViewList(categoryList: Category[], cardList: Card[]): CategoryView[] {
  const cardCountMap = createCardCountMap(cardList);
  return categoryList
    .map((category) => {
      const cardCount = cardCountMap[category.id] ?? 0;
      const isUncategorized = category.id === UNCATEGORIZED_ID;

      return {
        ...category,
        cardCount,
        canEdit: !isUncategorized,
        canDelete: !isUncategorized,
        visible: !(isUncategorized && cardCount === 0),
        theme: getCategoryTheme(category.name),
      };
    })
    .filter((category) => category.visible);
}

// 加载卡片列表
export function loadCards(): Card[] {
  const res = getCards() as ServiceResult<Card[]>;
  if (res.success && res.data) {
    return res.data;
  }
  wx.showToast({
    title: res.message || '加载卡片失败',
    icon: 'none',
  });
  return [];
}

// 加载分类列表
export function loadCategories(): Category[] {
  const res = getCategories() as ServiceResult<Category[]>;
  if (res.success && res.data) {
    return res.data;
  }
  wx.showToast({
    title: res.message || '加载分类失败',
    icon: 'none',
  });
  return [];
}

// 返回所有数据
export function loadAllCategoryViewData(): CategoryViewPageData {
  const cardList = loadCards();
  const categoryList = loadCategories();
  const categoryViewList = createCategoryViewList(categoryList, cardList);

  return {
    cardList,
    categoryList,
    categoryViewList,
  };
}
