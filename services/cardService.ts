import cards from '../data/cards';
import categories from '../data/category';
import { UNCATEGORIZED_CATEGORY, UNCATEGORIZED_ID } from '../constants/category';
import { CARD_STORAGE_KEY, CATEGORY_STORAGE_KEY } from '../constants/storageKeys';
import type { Card, Category } from '../types/card';
import type { ServiceResult } from '../types/service';
import { success, fail } from './serviceHelper';
import { generateUUID } from '../utils/uuid';

const uncategorizedId = UNCATEGORIZED_ID;

// 定义一个类型来表示原始的卡片数据结构
type RawCard = {
  id: string;
  categoryId?: string;
  category?: string;
  question: string;
  answer: string;
  content?: string;
  tags?: string[];
  status?: Card['status'];
  createdAt?: string;
  updatedAt?: string;
};

// 先拿到分类列表，如果本地存储没有数据，则使用默认分类列表，并确保包含未分类
function getCurrentCategories(): Category[] {
  const saved = wx.getStorageSync(CATEGORY_STORAGE_KEY);
  const fallbackList = (categories as Category[]).map((category) => ({ ...category }));
  const categoryList = saved ? (JSON.parse(saved) as Category[]) : fallbackList;
  if (categoryList.findIndex((category) => category.id === uncategorizedId) === -1) {
    categoryList.push(UNCATEGORIZED_CATEGORY);
  }
  return categoryList.map((category) => ({ ...category }));
}

// 保存分类列表到本地存储
function saveCurrentCategories(list: Category[]) {
  wx.setStorageSync(CATEGORY_STORAGE_KEY, JSON.stringify(list));
}

// 新建分类，用于导入时创建不存在的分类
function createImportedCategory(name: string): Category {
  const currentCategories = getCurrentCategories();
  // 计算当前分类列表中最大的 sort 值，给新建的分类排序值加1，确保新分类排在最后面
  const maxSort = currentCategories.reduce((maxValue, category) => {
    return category.sort > maxValue && Number.isFinite(category.sort) ? category.sort : maxValue;
  }, 0);

  const newCategory: Category = {
    id: generateUUID(),
    name,
    sort: maxSort + 1,
  };

  saveCurrentCategories([...currentCategories, newCategory]);
  return newCategory;
}

// 解析并处理原始卡片数据中的分类信息，返回最终的 categoryId，确保导入的卡片能够正确关联到分类
function resolveCategoryId(rawCard: RawCard): string {
  const currentCategories = getCurrentCategories();
  // 从原始数据中获取分类名称和ID
  const rawCategoryName = rawCard.category?.trim();
  // 按原始卡片名称获取匹配的分类，优先按名称匹配
  const categoryByName = rawCategoryName
    ? currentCategories.find((category) => category.name === rawCategoryName)
    : undefined;
  // 按原始卡片ID获取匹配的分类，次要按ID匹配
  const categoryById = rawCard.categoryId
    ? currentCategories.find((category) => category.id === rawCard.categoryId)
    : undefined;

  // 1. categoryId 和 categoryName 都与系统一致，正常导入
  if (rawCategoryName && categoryByName && categoryById && categoryByName.id === categoryById.id) {
    // 卡片有分类名字，系统有这个分类名，并且卡片的 categoryId 在系统中对应
    return categoryById.id;
  }

  // 2. categoryId 不一致或没有，但 categoryName 一致，按 categoryName 导入
  if (rawCategoryName && categoryByName) {
    if (rawCard.categoryId && categoryById && categoryById.id !== categoryByName.id) {
      console.warn(
        `[cardService] 导入分类冲突：card=${rawCard.id}, categoryId=${rawCard.categoryId}, category=${rawCategoryName}，已按分类名导入。`,
      );
    }
    return categoryByName.id;
  }

  // 3. 有 categoryName 但是和系统不一致，新建分类
  if (rawCategoryName) {
    return createImportedCategory(rawCategoryName).id;
  }

  // 4. 没有 categoryName，但是有 categoryId，能找到就按 ID，找不到进未分类
  if (categoryById) {
    return categoryById.id;
  }

  // 5. 其余情况，移入未分类
  return uncategorizedId;
}

// 清洗标签数据，去除空字符串和重复项
function normalizeTags(tags?: string[]): string[] | undefined {
  // 使用 Set 来去重，同时保持原有的顺序
  const tagSet = new Set<string>();
  (tags ?? []).forEach((tag) => {
    const normalizedTag = tag.trim();
    if (normalizedTag) {
      tagSet.add(normalizedTag);
    }
  });
  if (tagSet.size === 0) {
    return undefined;
  }
  // 将 Set 转换回数组，并返回
  return Array.from(tagSet);
}

// 清洗卡片数据，确保每个字段都符合预期的格式
function normalizeCard(card: Card): Card {
  return {
    id: card.id,
    categoryId: card.categoryId,
    question: card.question,
    answer: card.answer,
    content: card.content,
    tags: normalizeTags(card.tags),
    status: card.status,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}

// 将原始卡片数据转换为Card类型
function toCard(rawCard: RawCard): Card {
  const categoryId = resolveCategoryId(rawCard);

  return {
    id: rawCard.id,
    categoryId,
    question: rawCard.question,
    answer: rawCard.answer,
    content: rawCard.content,
    tags: normalizeTags(rawCard.tags),
    status: rawCard.status,
    createdAt: rawCard.createdAt,
    updatedAt: rawCard.updatedAt,
  };
}

// 默认的卡片列表，从静态数据文件加载
const defaultCards: Card[] = (cards as RawCard[]).map((rawCard) => toCard(rawCard));

// 当前的卡片列表，后续会从本地存储加载或使用默认卡片
let cardList: Card[] = [];

// 克隆一个卡片对象，确保外部修改不会影响内部数据
function cloneCard(card: Card): Card {
  return {
    ...card,
    tags: card.tags ? [...card.tags] : undefined,
  };
}

// 从本地存储加载卡片列表，如果没有则使用默认卡片，并保存到本地存储
function loadCardsFromStorage(): Card[] {
  const saved = wx.getStorageSync(CARD_STORAGE_KEY);
  if (saved) {
    const savedCards = JSON.parse(saved) as Card[];
    const normalizedCards = savedCards.map(normalizeCard);
    saveCardsToStorage(normalizedCards);
    return normalizedCards.map(cloneCard);
  } else {
    saveCardsToStorage(defaultCards); // 保存默认卡片到本地存储
    return defaultCards.map(cloneCard);
  }
}

// 保存整个卡片列表到本地存储
function saveCardsToStorage(list: Card[]) {
  const normalizedList = list.map(normalizeCard);
  wx.setStorageSync(CARD_STORAGE_KEY, JSON.stringify(normalizedList));
  cardList = normalizedList.map(cloneCard);
}

loadCardsFromStorage();

type CardQueryParams = Partial<Card> & {
  keyword?: string;
};

// 根据参数获取卡片
export function getCards(params?: CardQueryParams): ServiceResult<Card[]> {
  const currentList = loadCardsFromStorage();
  if (!params) {
    return success(currentList.map(cloneCard));
  }
  const { keyword, ...filters } = params;
  const k = keyword?.trim().toLowerCase();
  const result = currentList.filter((card) => {
    // keyword 模糊搜索
    if (k) {
      const matchKeyword =
        card.question.toLowerCase().includes(k) ||
        card.answer.toLowerCase().includes(k) ||
        card.content?.toLowerCase().includes(k) ||
        card.tags?.some((tag) => tag.toLowerCase().includes(k));

      if (!matchKeyword) return false;
    }

    // 精确过滤
    for (const key of Object.keys(filters) as Array<keyof Card>) {
      const value = filters[key];
      // 如果参数中有这个字段，并且卡片的对应字段不等于这个值，则过滤掉这个卡片
      if (value !== undefined && card[key] !== value) {
        return false;
      }
    }

    return true;
  });

  return success(result.map(cloneCard));
}

// 根据 id 获取单个卡片
export function getCardById(id: string): ServiceResult<Card | undefined> {
  const currentList = loadCardsFromStorage();
  const card = currentList.find((item) => item.id === id);
  return card ? success(cloneCard(card)) : fail('题目未找到');
}

// 添加新卡片
export function addCard(card: Omit<Card, 'id'>): ServiceResult<Card> {
  const currentList = loadCardsFromStorage();
  const newCard: Card = {
    id: generateUUID(),
    ...card,
  };
  const updatedList = [...currentList, newCard];
  saveCardsToStorage(updatedList);
  return success(cloneCard(newCard));
}

// 更新卡片
export function updateCard(updates: Partial<Card>): ServiceResult<Card> {
  const currentList = loadCardsFromStorage();
  const index = currentList.findIndex((item) => item.id === updates.id);
  if (index === -1) {
    return fail('题目未找到');
  }
  const updatedCard: Card = {
    ...currentList[index],
    ...updates,
  };
  const updatedList = [...currentList];
  updatedList[index] = updatedCard;
  saveCardsToStorage(updatedList);
  return success(cloneCard(updatedCard));
}

// 删除卡片
export function deleteCard(id: string): ServiceResult<null> {
  const currentList = loadCardsFromStorage();
  const nextList = currentList.filter((card) => card.id !== id);
  if (nextList.length === currentList.length) {
    return fail('题目未找到');
  }
  saveCardsToStorage(nextList);
  return success(null);
}
