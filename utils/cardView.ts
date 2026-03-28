import { cardStatusTextMap } from '../constants/cardStatus';
import type { Card, CardView, Category } from '../types/card';

// 创建一个映射，将分类ID映射到分类名称，方便在转换卡片视图时使用
export function createCategoryNameMap(categoryList: Category[]): Map<string, string> {
  return new Map(categoryList.map((category) => [category.id, category.name]));
}

// 将单个卡片转换为卡片视图，添加分类名称和状态名称
export function toCardView(card: Card, categoryNameById: Map<string, string>): CardView {
  const tagText = Array.isArray(card.tags)
    ? card.tags
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean)
        .join('•')
    : '';

  return {
    ...card,
    categoryName: categoryNameById.get(card.categoryId),
    tagText,
    statusName: card.status ? cardStatusTextMap[card.status] : undefined,
  };
}

// 将卡片列表转换为卡片视图列表，批量处理分类名称映射
export function toCardViews(cardList: Card[], categoryList: Category[]): CardView[] {
  const categoryNameById = createCategoryNameMap(categoryList);
  return cardList.map((card) => toCardView(card, categoryNameById));
}
