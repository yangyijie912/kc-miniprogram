import cards from '../data/cards';
import categories from '../data/category';
import { UNCATEGORIZED_ID } from '../constants/category';
import { CARD_STORAGE_KEY } from '../constants/storageKeys';
import type { Card, Category, RawCard } from '../types/card';
import type { ServiceResult } from '../types/service';
import { success, fail } from './serviceHelper';
import { generateUUID } from '../utils/uuid';

const defaultCategories = categories as Category[];
const defaultCategoryIdByName = new Map(
  defaultCategories.map((category) => [category.name, category.id]),
);

// 只把静态默认卡片映射成可存储的 categoryId，不处理导入时的分类冲突。
function resolveDefaultCategoryId(rawCard: RawCard): string {
  const rawCategoryName = rawCard.category?.trim();

  if (rawCategoryName) {
    const categoryId = defaultCategoryIdByName.get(rawCategoryName);
    if (categoryId) {
      return categoryId;
    }
  }

  if (rawCard.categoryId) {
    return rawCard.categoryId;
  }

  return UNCATEGORIZED_ID;
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
    categoryId: card.categoryId || UNCATEGORIZED_ID,
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
  const categoryId = resolveDefaultCategoryId(rawCard);

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
const defaultCardById = new Map(defaultCards.map((card) => [card.id, cloneCard(card)]));

// 克隆一个卡片对象，确保外部修改不会影响内部数据
function cloneCard(card: Card): Card {
  return {
    ...card,
    tags: card.tags ? [...card.tags] : undefined,
  };
}

// 对已经存在于本地 storage 的旧卡片做轻量迁移：只补齐缺失的 tags，避免覆盖用户自行编辑过的数据。
function mergeMissingCardFields(card: Card): Card {
  const defaultCard = defaultCardById.get(card.id);

  if (!defaultCard) {
    return normalizeCard(card);
  }

  return normalizeCard({
    ...card,
    categoryId: card.categoryId || defaultCard.categoryId,
    tags: card.tags && card.tags.length > 0 ? card.tags : defaultCard.tags,
  });
}

// 从本地存储加载卡片列表，如果没有则使用默认卡片，并保存到本地存储
function loadCardsFromStorage(): Card[] {
  const saved = wx.getStorageSync(CARD_STORAGE_KEY);
  if (saved) {
    const savedCards = JSON.parse(saved) as Card[];
    const normalizedCards = savedCards.map(mergeMissingCardFields);
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

// 保存所有卡片（覆盖式），用于导入时批量保存
export function saveAllCards(cards: Card[]): ServiceResult<null> {
  saveCardsToStorage(cards);
  return success(null);
}
