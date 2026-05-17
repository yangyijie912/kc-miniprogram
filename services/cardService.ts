import cards from '@/data/cards';
import categories from '@/data/category';
import { UNCATEGORIZED_ID } from '@/constants/category';
import {
  CATEGORY_STORAGE_KEY,
  CARD_STORAGE_KEY,
  DAILY_LEARNING_STATS_KEY,
} from '@/constants/storageKeys';
import { SORT_STEP } from '@/constants/sortConfig';
import { CARD_STATUS_TO_CODE } from '@/constants/cardStatus';
import type {
  Card,
  Category,
  RawCard,
  CardSortConfig,
  Move,
  DailyLearningStats,
  CardStatus,
  CardStatusCode,
} from '@/types/card';
import type { ServiceResult } from '@/types/service';
import type { PageResult, StatsResult } from '@/types/common';
import { success, fail } from '@/services/serviceHelper';
import { generateUUID } from '@/utils/uuid';
import { sortCards } from '@/utils/cardSort';
import { getStoredDailyQuizSession, readStorageJson } from '@/utils/storage';
import { getDateKey, getTimestampDaysAgo, dateKeyToTimestamp } from '@/utils/date';

const defaultCategories = categories as Category[];

// 默认种子数据里仍然允许 category 名称写法，这里只在初始化阶段把它转换成 categoryId。
const defaultCategoryIdByName = new Map(
  defaultCategories.map((category) => [category.name, category.id]),
);

type CategorySortCache = {
  snapshot: string;
  categories: Category[];
};

type CardQueryCache = {
  version: number;
  signature: string;
  result: Card[];
};

let cardDataVersion = 0;
let categorySortCache: CategorySortCache | null = null;
let cardQueryCache: CardQueryCache | null = null;
const MAX_DAILY_LEARNING_STATS_DAYS = 60;

function cloneCategory(category: Category): Category {
  return { ...category };
}

// 查询排序不能只盯着静态 category 数据，要跟当前 storage 里的分类顺序保持一致。
function loadCategoriesForSort(): CategorySortCache {
  const saved = wx.getStorageSync(CATEGORY_STORAGE_KEY);
  const snapshot = saved || '__empty__';

  if (categorySortCache && categorySortCache.snapshot === snapshot) {
    return {
      snapshot: categorySortCache.snapshot,
      categories: categorySortCache.categories.map(cloneCategory),
    };
  }

  if (!saved) {
    const nextCache = {
      snapshot,
      categories: [...defaultCategories],
    };
    categorySortCache = nextCache;
    return {
      snapshot: nextCache.snapshot,
      categories: nextCache.categories.map(cloneCategory),
    };
  }

  try {
    const savedList = JSON.parse(saved) as Category[];
    if (!Array.isArray(savedList) || savedList.length === 0) {
      const nextCache = {
        snapshot,
        categories: [...defaultCategories],
      };
      categorySortCache = nextCache;
      return {
        snapshot: nextCache.snapshot,
        categories: nextCache.categories.map(cloneCategory),
      };
    }

    const nextCache = {
      snapshot,
      categories: savedList.map(cloneCategory),
    };
    categorySortCache = nextCache;
    return {
      snapshot: nextCache.snapshot,
      categories: nextCache.categories.map(cloneCategory),
    };
  } catch {
    const nextCache = {
      snapshot,
      categories: [...defaultCategories],
    };
    categorySortCache = nextCache;
    return {
      snapshot: nextCache.snapshot,
      categories: nextCache.categories.map(cloneCategory),
    };
  }
}

function resolveDefaultCategoryId(rawCard: RawCard): string {
  const rawCategoryName = rawCard.category ? rawCard.category.trim() : undefined;

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

function normalizeTags(tags?: string[]): string[] | undefined {
  const tagSet = new Set<string>();
  if (Array.isArray(tags)) {
    tags.forEach((tag) => {
      const normalizedTag = tag.trim();
      if (normalizedTag) {
        tagSet.add(normalizedTag);
      }
    });
  }
  if (tagSet.size === 0) {
    return undefined;
  }
  return Array.from(tagSet);
}

// 统一把卡片对象压成稳定结构，后续无论页面、导入还是统计都基于这一层结果工作。
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
    statusUpdatedAt: card.statusUpdatedAt,
    masteredAt: card.masteredAt,
    contentUpdatedAt: card.contentUpdatedAt,
    sort: card.sort,
  };
}

function toCard(rawCard: RawCard): Card {
  const categoryId = resolveDefaultCategoryId(rawCard);
  const createdAt = Date.now();

  return {
    id: rawCard.id,
    categoryId,
    question: rawCard.question,
    answer: rawCard.answer,
    content: rawCard.content,
    tags: normalizeTags(rawCard.tags),
    status: rawCard.status,
    createdAt: rawCard.createdAt !== undefined ? rawCard.createdAt : createdAt,
    updatedAt: rawCard.updatedAt !== undefined ? rawCard.updatedAt : createdAt,
    statusUpdatedAt: rawCard.statusUpdatedAt,
    masteredAt: rawCard.masteredAt,
    contentUpdatedAt: rawCard.contentUpdatedAt,
    sort: rawCard.sort !== undefined ? rawCard.sort : Number.MAX_SAFE_INTEGER,
  };
}

const defaultCards: Card[] = (cards as RawCard[]).map((rawCard) => toCard(rawCard));
const defaultCardById = new Map(defaultCards.map((card) => [card.id, cloneCard(card)]));

let cardList: Card[] = [];

function cloneCard(card: Card): Card {
  return {
    ...card,
    tags: card.tags ? [...card.tags] : undefined,
  };
}

// 这一层先只做缺字段补齐，不主动改动用户已有业务数据内容。
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

function loadCardsFromStorage(): Card[] {
  if (cardList.length > 0) {
    return cardList.map(cloneCard);
  }

  const { hasStoredValue, parsed, value } = readStorageJson<unknown>(CARD_STORAGE_KEY, null);

  if (hasStoredValue && parsed && Array.isArray(value)) {
    const savedCards = value as Card[];
    const normalizedCards = savedCards.map(mergeMissingCardFields);
    saveCardsToStorage(normalizedCards);
    return normalizedCards.map(cloneCard);
  }

  // 坏数据不能继续让卡片服务在模块初始化时抛异常，这里直接回写一份可用题库自愈。
  saveCardsToStorage(defaultCards);
  return defaultCards.map(cloneCard);
}

function saveCardsToStorage(list: Card[]) {
  const normalizedList = list.map(normalizeCard);
  wx.setStorageSync(CARD_STORAGE_KEY, JSON.stringify(normalizedList));
  cardList = normalizedList.map(cloneCard);
  cardDataVersion += 1;
  cardQueryCache = null;
}

// 学习统计单独存，避免统计口径完全依赖卡片时间字段，后续调整空间也更大。
export function loadDailyLearningStats(): DailyLearningStats[] {
  const saved = wx.getStorageSync(DAILY_LEARNING_STATS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved) as DailyLearningStats[];
    } catch {
      return [];
    }
  }
  return [];
}

export function saveDailyLearningStats(stats: DailyLearningStats[]) {
  const trimmedStats = [...stats]
    .sort((left, right) => dateKeyToTimestamp(left.date) - dateKeyToTimestamp(right.date))
    .slice(-MAX_DAILY_LEARNING_STATS_DAYS);
  wx.setStorageSync(DAILY_LEARNING_STATS_KEY, JSON.stringify(trimmedStats));
}

function hasOwnField<T extends object>(target: T, key: keyof T) {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function shouldUpdateContentTimestamp(updates: Partial<Card>) {
  return (
    hasOwnField(updates, 'content') ||
    hasOwnField(updates, 'question') ||
    hasOwnField(updates, 'answer') ||
    hasOwnField(updates, 'tags')
  );
}

loadCardsFromStorage();

type CardQueryParams = Partial<Card> & {
  keyword?: string;
  page?: number;
  pageSize?: number;
  cardSortConfig?: CardSortConfig;
};

function buildCardQuerySignature(params: {
  keyword?: string;
  filters: Partial<Card>;
  sortBy: CardSortConfig['sortBy'];
  order: CardSortConfig['order'];
  categorySnapshot: string;
}): string {
  const filterEntries = Object.entries(params.filters)
    .filter(([, value]) => value !== undefined)
    .sort(([key1], [key2]) => key1.localeCompare(key2));

  return [
    `keyword:${params.keyword || ''}`,
    `sortBy:${params.sortBy}`,
    `order:${params.order || 'asc'}`,
    `categorySnapshot:${params.categorySnapshot}`,
    ...filterEntries.map(([key, value]) => `${key}:${String(value)}`),
  ].join('|');
}

// 先做过滤再做排序，并把结果缓存下来，给同一组查询条件的翻页请求直接复用。
function getMatchedCards(params: CardQueryParams): Card[] {
  // page / pageSize 只用于分页，不能混进卡片字段过滤，否则每张卡都会因为没有这两个字段而被筛掉。
  const { keyword, page: _page, pageSize: _pageSize, cardSortConfig, ...filters } = params;
  const normalizedKeyword = keyword ? keyword.trim().toLowerCase() : undefined;
  const defaultSortConfig: CardSortConfig = {
    sortBy: 'customSort',
    order: 'asc',
  };
  const { sortBy, order } = cardSortConfig || defaultSortConfig;
  const categorySortState = loadCategoriesForSort();
  const querySignature = buildCardQuerySignature({
    keyword: normalizedKeyword,
    filters,
    sortBy,
    order,
    categorySnapshot: categorySortState.snapshot,
  });

  if (
    cardQueryCache &&
    cardQueryCache.version === cardDataVersion &&
    cardQueryCache.signature === querySignature
  ) {
    return cardQueryCache.result;
  }

  const currentList = loadCardsFromStorage();
  const filteredList = currentList.filter((card) => {
    if (normalizedKeyword) {
      const matchKeyword =
        card.question.toLowerCase().includes(normalizedKeyword) ||
        card.answer.toLowerCase().includes(normalizedKeyword) ||
        (card.content ? card.content.toLowerCase().includes(normalizedKeyword) : false) ||
        (Array.isArray(card.tags)
          ? card.tags.some((tag) => tag.toLowerCase().includes(normalizedKeyword))
          : false);

      if (!matchKeyword) {
        return false;
      }
    }

    for (const key of Object.keys(filters) as Array<keyof Card>) {
      const value = filters[key];
      if (value !== undefined && card[key] !== value) {
        return false;
      }
    }

    return true;
  });

  const sortedList = sortCards(filteredList, sortBy, order, categorySortState.categories);
  cardQueryCache = {
    version: cardDataVersion,
    signature: querySignature,
    result: sortedList,
  };

  return sortedList;
}

export function getCards(params?: CardQueryParams): ServiceResult<PageResult<Card>> {
  const currentList = loadCardsFromStorage();
  if (!params) {
    return success({
      list: currentList.map(cloneCard),
      total: currentList.length,
      page: 1,
      pageSize: currentList.length,
    });
  }

  const { page = 1, pageSize } = params;
  const result = getMatchedCards(params);
  let paginatedResult = result;
  if (page && pageSize) {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    paginatedResult = result.slice(start, end);
  }

  return success({
    list: paginatedResult.map(cloneCard),
    total: result.length,
    page,
    pageSize: pageSize !== undefined ? pageSize : result.length,
  });
}

export function getCardById(id: string): ServiceResult<Card | undefined> {
  const currentList = loadCardsFromStorage();
  const card = currentList.find((item) => item.id === id);
  return card ? success(cloneCard(card)) : fail('题目未找到');
}

export function addCard(
  card: Omit<
    Card,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'statusUpdatedAt'
    | 'masteredAt'
    | 'contentUpdatedAt'
    | 'sort'
  >,
): ServiceResult<Card> {
  const currentList = loadCardsFromStorage();
  const createdAt = Date.now();
  const newCard: Card = {
    id: generateUUID(),
    ...card,
    createdAt,
    updatedAt: createdAt,
    sort: currentList.length > 0 ? (currentList.length + 1) * SORT_STEP : SORT_STEP,
  };
  const updatedList = [...currentList, newCard];
  saveCardsToStorage(updatedList);
  return success(cloneCard(newCard));
}

// 页面侧普通编辑继续走 updateCard，由服务层统一补状态时间和内容时间。
export function updateCard(updates: Partial<Card>): ServiceResult<Card> {
  const currentList = loadCardsFromStorage();
  const index = currentList.findIndex((item) => item.id === updates.id);
  if (index === -1) {
    return fail('题目未找到');
  }

  const now = Date.now();
  if (hasOwnField(updates, 'status') && updates.status) {
    updates.statusUpdatedAt = now;
    if (updates.status === 'mastered') {
      updates.masteredAt = now;
    }
  }
  if (shouldUpdateContentTimestamp(updates)) {
    updates.contentUpdatedAt = now;
  }

  const updatedCard: Card = {
    ...currentList[index],
    ...updates,
    updatedAt: now,
  };
  const updatedList = [...currentList];
  updatedList[index] = updatedCard;
  saveCardsToStorage(updatedList);
  return success(cloneCard(updatedCard));
}

// 测验场景单独走这个入口，把状态写入和学习统计收口到同一个服务里。
export function updateDailyLearningStats(cardId: string, status: CardStatus): ServiceResult<Card> {
  const currentList = loadCardsFromStorage();
  const index = currentList.findIndex((item) => item.id === cardId);
  if (index === -1) {
    return fail('题目未找到');
  }

  const now = Date.now();
  const updatedCard: Card = {
    ...currentList[index],
    status,
    statusUpdatedAt: now,
    masteredAt: status === 'mastered' ? now : currentList[index].masteredAt,
    updatedAt: now,
  };
  const updatedList = [...currentList];
  updatedList[index] = updatedCard;

  const dailyStats = loadDailyLearningStats();
  const todayKey = getDateKey(new Date(now));
  const todayStatsIndex = dailyStats.findIndex((stats) => stats.date === todayKey);
  if (todayStatsIndex !== -1) {
    const todayStats = dailyStats[todayStatsIndex];
    todayStats.practicedCardIds.push(cardId);
    todayStats.practiceStatuses.push(CARD_STATUS_TO_CODE[status]);
    dailyStats[todayStatsIndex] = todayStats;
  } else {
    dailyStats.push({
      date: todayKey,
      practicedCardIds: [cardId],
      practiceStatuses: [CARD_STATUS_TO_CODE[status]],
    });
  }

  saveDailyLearningStats(dailyStats);
  saveCardsToStorage(updatedList);
  return success(cloneCard(updatedCard));
}

export function batchUpdateCards(ids: string[], patch: Partial<Card>): ServiceResult<null> {
  const currentList = loadCardsFromStorage();
  for (const id of ids) {
    if (!currentList.some((item) => item.id === id)) {
      return fail(`题目 ID ${id} 未找到，无法批量更新`);
    }
  }
  ids.forEach((id) => {
    const index = currentList.findIndex((item) => item.id === id);
    const updatedCard: Card = {
      ...currentList[index],
      ...patch,
      updatedAt: Date.now(),
    };
    currentList[index] = updatedCard;
  });
  saveCardsToStorage(currentList);
  return success(null);
}

export function deleteCard(id: string): ServiceResult<null> {
  const currentList = loadCardsFromStorage();
  const nextList = currentList.filter((card) => card.id !== id);
  if (nextList.length === currentList.length) {
    return fail('题目未找到');
  }
  saveCardsToStorage(nextList);
  return success(null);
}

export function batchDeleteCards(ids: string[]): ServiceResult<null> {
  const currentList = loadCardsFromStorage();
  const nextList = currentList.filter((card) => !ids.includes(card.id));
  if (nextList.length === currentList.length) {
    return fail('没有找到要删除的题目');
  }
  if (currentList.length - nextList.length !== ids.length) {
    return fail('部分题目未找到，无法批量删除');
  }
  saveCardsToStorage(nextList);
  return success(null);
}

export function saveAllCards(cards: Card[]): ServiceResult<null> {
  saveCardsToStorage(cards);
  return success(null);
}

const compareCardSort = (a: Card, b: Card) => {
  if (a.sort !== b.sort) {
    return a.sort - b.sort;
  }

  return a.createdAt - b.createdAt;
};

export function updateCardOrderInCategory(categoryId: string, move: Move): ServiceResult<null> {
  if (!categoryId) {
    return fail('分类 ID 不能为空');
  }

  const currentList = loadCardsFromStorage();
  // 上下移动必须基于分类全量顺序计算，不能只看当前页面已经渲染出来的片段。
  const categoryCards = currentList
    .filter((card) => card.categoryId === categoryId)
    .sort(compareCardSort);
  const movedIndex = categoryCards.findIndex((card) => card.id === move.movedId);
  const anchorIndex = categoryCards.findIndex((card) => card.id === move.anchorId);

  if (movedIndex === -1 || anchorIndex === -1) {
    return fail('排序目标不存在');
  }

  if (move.position === 'before' && movedIndex < anchorIndex && movedIndex + 1 === anchorIndex) {
    return success(null);
  }

  if (move.position === 'after' && movedIndex > anchorIndex && movedIndex === anchorIndex + 1) {
    return success(null);
  }

  const nextCategoryCards = [...categoryCards];
  const [movedCard] = nextCategoryCards.splice(movedIndex, 1);
  const adjustedAnchorIndex = movedIndex < anchorIndex ? anchorIndex - 1 : anchorIndex;
  const insertIndex = move.position === 'before' ? adjustedAnchorIndex : adjustedAnchorIndex + 1;

  nextCategoryCards.splice(insertIndex, 0, movedCard);
  nextCategoryCards.forEach((card, index) => {
    card.sort = (index + 1) * SORT_STEP;
  });

  const nextList = currentList.map((card) => {
    if (card.categoryId !== categoryId) {
      return card;
    }

    const updatedCard = nextCategoryCards.find((item) => item.id === card.id);
    return updatedCard ? { ...card, sort: updatedCard.sort } : card;
  });

  saveCardsToStorage(nextList);
  return success(null);
}

export function getCardStats(): ServiceResult<StatsResult> {
  const currentList = loadCardsFromStorage();
  const currentCategories = loadCategoriesForSort().categories;
  const dailyStats = loadDailyLearningStats();
  const todayKey = getDateKey(new Date());
  const todayStart = dateKeyToTimestamp(todayKey);
  const now = Date.now();

  const total = currentList.length;
  const mastered = currentList.filter((card) => card.status === 'mastered').length;
  const fuzzy = currentList.filter((card) => card.status === 'fuzzy').length;
  const unknown = currentList.filter((card) => card.status === 'unknown').length;

  const { dailyQuizLimit, dailyQuizCurrentIndex } = getAnsweredCount();
  const hasTodayDailyStats = hasDailyStatsInRange(dailyStats, todayStart);
  const todayPracticeIds = hasTodayDailyStats
    ? getCardIdsFromDailyStats(dailyStats, todayStart)
    : getCardIdsByTime(currentList, 'statusUpdatedAt', todayStart, now);
  const todayMasteredIds = hasTodayDailyStats
    ? getCardIdsFromDailyStats(dailyStats, todayStart, CARD_STATUS_TO_CODE.mastered)
    : getCardIdsByTime(currentList, 'masteredAt', todayStart, now);
  const dailyStudied = getUniqueCount(todayPracticeIds);
  const dailyMastered = getUniqueCount(todayMasteredIds);

  const categoryStats: StatsResult['categoryStats'] = {};
  currentCategories.forEach((category) => {
    const categoryCards = currentList.filter((card) => card.categoryId === category.id);
    categoryStats[category.id] = {
      total: categoryCards.length,
      mastered: categoryCards.filter((card) => card.status === 'mastered').length,
      fuzzy: categoryCards.filter((card) => card.status === 'fuzzy').length,
      unknown: categoryCards.filter((card) => card.status === 'unknown').length,
    };
  });

  const activityStats = getActivityStats(currentList, dailyStats);

  return success({
    total,
    mastered,
    fuzzy,
    unknown,
    dailyQuizLimit,
    dailyQuizCurrentIndex,
    dailyStudied,
    dailyMastered,
    categoryStats,
    activityStats,
  });
}

function countCardsByTime(
  cards: Card[],
  field: 'createdAt' | 'contentUpdatedAt' | 'statusUpdatedAt' | 'masteredAt',
  start: number,
  end: number,
) {
  return cards.filter((card) => {
    const value = card[field];
    return typeof value === 'number' && value >= start && value <= end;
  }).length;
}

function getAnsweredCount() {
  const quizSession = getStoredDailyQuizSession();
  if (!quizSession) {
    return {
      dailyQuizLimit: 0,
      dailyQuizCurrentIndex: 0,
    };
  }

  return {
    dailyQuizLimit: quizSession.limit,
    dailyQuizCurrentIndex: quizSession.finished
      ? quizSession.queue.length
      : quizSession.currentIndex,
  };
}

function getCardIdsByTime(
  cards: Card[],
  field: 'createdAt' | 'contentUpdatedAt' | 'statusUpdatedAt' | 'masteredAt',
  start: number,
  end: number,
) {
  return cards
    .filter((card) => {
      const value = card[field];
      return typeof value === 'number' && value >= start && value <= end;
    })
    .map((card) => card.id);
}

function getCardIdsFromDailyStats(
  dailyStats: DailyLearningStats[],
  start: number,
  statusCode?: CardStatusCode,
) {
  const ids: string[] = [];

  dailyStats.forEach((stats) => {
    if (dateKeyToTimestamp(stats.date) < start) {
      return;
    }

    const pairCount = Math.min(stats.practicedCardIds.length, stats.practiceStatuses.length);
    for (let index = 0; index < pairCount; index += 1) {
      if (statusCode === undefined || stats.practiceStatuses[index] === statusCode) {
        ids.push(stats.practicedCardIds[index]);
      }
    }
  });

  return ids;
}

function getUniqueCount(ids: string[]) {
  return new Set(ids).size;
}

function hasDailyStatsInRange(dailyStats: DailyLearningStats[], start: number) {
  return dailyStats.some((stats) => dateKeyToTimestamp(stats.date) >= start);
}

// 新增和内容更新继续读卡片时间字段；练习和掌握优先读 dailyStats，避免状态修改把统计口径搅乱。
function getActivityStats(
  currentList: Card[],
  dailyStats: DailyLearningStats[],
): StatsResult['activityStats'] {
  const now = Date.now();
  const day7Start = getTimestampDaysAgo(7);
  const day30Start = getTimestampDaysAgo(30);

  const hasDay7DailyStats = hasDailyStatsInRange(dailyStats, day7Start);
  const hasDay30DailyStats = hasDailyStatsInRange(dailyStats, day30Start);

  const day7PracticeIds = hasDay7DailyStats
    ? getCardIdsFromDailyStats(dailyStats, day7Start)
    : getCardIdsByTime(currentList, 'statusUpdatedAt', day7Start, now);
  const day30PracticeIds = hasDay30DailyStats
    ? getCardIdsFromDailyStats(dailyStats, day30Start)
    : getCardIdsByTime(currentList, 'statusUpdatedAt', day30Start, now);
  const day7MasteredIds = hasDay7DailyStats
    ? getCardIdsFromDailyStats(dailyStats, day7Start, CARD_STATUS_TO_CODE.mastered)
    : getCardIdsByTime(currentList, 'masteredAt', day7Start, now);
  const day30MasteredIds = hasDay30DailyStats
    ? getCardIdsFromDailyStats(dailyStats, day30Start, CARD_STATUS_TO_CODE.mastered)
    : getCardIdsByTime(currentList, 'masteredAt', day30Start, now);

  return {
    '7day': {
      added: countCardsByTime(currentList, 'createdAt', day7Start, now),
      updated: countCardsByTime(currentList, 'contentUpdatedAt', day7Start, now),
      practice: getUniqueCount(day7PracticeIds),
      mastered: getUniqueCount(day7MasteredIds),
    },
    '30day': {
      added: countCardsByTime(currentList, 'createdAt', day30Start, now),
      updated: countCardsByTime(currentList, 'contentUpdatedAt', day30Start, now),
      practice: getUniqueCount(day30PracticeIds),
      mastered: getUniqueCount(day30MasteredIds),
    },
  };
}
