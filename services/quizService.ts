import { DAILY_QUIZ_SESSION_KEY } from '@/constants/storageKeys';
import type { ServiceResult } from '@/types/service';
import { success, fail } from '@/services/serviceHelper';
import { shuffle } from '@/utils/arrayUtils';
import type { Card, CardView } from '@/types/card';
import type { DailyQuizSession, quizQuery, QuizResultSummary } from '@/types/quiz';
import { getCategories } from '@/services/categoryService';
import { getCards } from '@/services/cardService';
import { toCardViews } from '@/utils/cardView';
import { readDailyQuizSession } from '@/utils/storage';
import { getDateKey } from '@/utils/date';

// 每日测验的题目数量限制，默认值为10
export const dailyQuizLimit = 10;

// 测验题库也要复用卡片服务的安全读取和迁移逻辑，不能自己直接解析原始 storage。
function loadCardList(): Card[] {
  const cardRes = getCards();
  return cardRes.success && cardRes.data ? cardRes.data.list : [];
}

// 获取分类列表
function getCategoryList() {
  const categoryRes = getCategories();
  return categoryRes.success && categoryRes.data ? categoryRes.data : [];
}

// 将测验选项中的 limit 参数规范化为一个有效的正整数，如果无效则使用默认值
function normalizeLimit(limit?: number, fallback = 10): number {
  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
    return Math.floor(limit);
  }
  return fallback;
}

// 查询参数签名是根据测验选项生成的一个字符串，用于快速判断测验选项是否发生变化，如果发生变化则需要重新生成测验进度数据
function buildDailyQuizSignature(quizOptions: Partial<quizQuery>): string {
  return [
    `type:${quizOptions.type || 'today'}`,
    `categoryId:${quizOptions.categoryId || ''}`,
    `mode:${quizOptions.mode || ''}`,
    `limit:${normalizeLimit(dailyQuizLimit)}`,
  ].join('|');
}

// 每日测验只把会影响核心题面的字段（分类、问题、答案、内容）算进续答有效性
// 标签允许漂移，避免轻微整理标签就打断当天进度。
function isQueueCardStillValid(queuedCard: CardView, currentCard: Card) {
  return (
    queuedCard.categoryId === currentCard.categoryId &&
    queuedCard.question === currentCard.question &&
    queuedCard.answer === currentCard.answer &&
    (queuedCard.content || '') === (currentCard.content || '')
  );
}

// 判断测验队列是否仍然有效，条件是队列不为空，当前索引在有效范围内，并且每个题目在当前卡片列表中仍然有效
function isSessionQueueValid(session: DailyQuizSession, currentCardList: Card[]) {
  if (!session.queue.length) {
    return false;
  }

  if (session.currentIndex < 0 || session.currentIndex >= session.queue.length) {
    return session.finished && session.currentIndex === session.queue.length - 1;
  }

  const currentCardById = new Map(currentCardList.map((card) => [card.id, card]));
  return session.queue.every((queuedCard) => {
    const currentCard = currentCardById.get(queuedCard.id);
    return currentCard ? isQueueCardStillValid(queuedCard, currentCard) : false;
  });
}

// 根据测验选项过滤卡片列表
function filterQuizCards(
  cardList: Card[],
  quizOptions: Partial<quizQuery>,
  ignoreMode = false,
  statusOptions?: {
    unknown?: boolean;
    fuzzy?: boolean;
    mastered?: boolean;
    undefinedStatus?: boolean;
  },
): Card[] {
  let list = [...cardList];
  if (!ignoreMode && quizOptions.categoryId) {
    list = list.filter((card) => card.categoryId === quizOptions.categoryId);
  }
  if (quizOptions.mode === 'review') {
    return list.filter(
      (card) => card.status === 'unknown' || card.status === 'fuzzy' || !card.status,
    );
  }
  if (quizOptions.mode === 'unknown') {
    return list.filter((card) => card.status === 'unknown');
  }
  if (ignoreMode && statusOptions) {
    return list.filter((card) => {
      // 返回满足statusOptions条件的卡片，如果statusOptions中没有任何状态选项，则返回所有卡片
      if (statusOptions.unknown && card.status === 'unknown') {
        return true;
      }
      if (statusOptions.fuzzy && card.status === 'fuzzy') {
        return true;
      }
      if (statusOptions.mastered && card.status === 'mastered') {
        return true;
      }
      if (statusOptions.undefinedStatus && !card.status) {
        return true;
      }
      return false;
    });
  }
  return list;
}

// 构建测验题目队列，先根据测验选项过滤卡片列表，然后随机打乱并限制数量，最后转换为卡片视图
function buildQueue(quizOptions: Partial<quizQuery>, ignoreMode = false): CardView[] {
  const cardList = loadCardList();

  // 如果是每日测验，抽取题目时按照unknown（包含状态为undefined） : fuzzy : mastered = 6 : 3 : 1的比例进行抽取
  if (quizOptions.type === 'today') {
    const unknownCards = filterQuizCards(cardList, quizOptions, true, {
      unknown: true,
      undefinedStatus: true,
    });
    const fuzzyCards = filterQuizCards(cardList, quizOptions, true, { fuzzy: true });
    const masteredCards = filterQuizCards(cardList, quizOptions, true, { mastered: true });

    // 计算每个状态的题目数量，按照6:3:1的比例分配，如果总数不足则按比例缩放
    const limit = normalizeLimit(dailyQuizLimit);
    const unknownLimit = Math.round((limit * 6) / 10);
    const fuzzyLimit = Math.round((limit * 3) / 10);
    const masteredLimit = limit - unknownLimit - fuzzyLimit;

    // 随机打乱每个状态的卡片列表，并按照计算的数量限制抽取题目，最后合并并再次打乱
    const selectedUnknown = shuffle(unknownCards).slice(
      0,
      Math.min(unknownLimit, unknownCards.length),
    );
    const selectedFuzzy = shuffle(fuzzyCards).slice(0, Math.min(fuzzyLimit, fuzzyCards.length));
    const selectedMastered = shuffle(masteredCards).slice(
      0,
      Math.min(masteredLimit, masteredCards.length),
    );
    const combined = [...selectedUnknown, ...selectedFuzzy, ...selectedMastered];

    // 如果抽取的题目总数不足每日测验的限制数量，则从剩余的卡片中随机抽取补足，且题目不能重复
    if (combined.length < limit) {
      const remainingCards = filterQuizCards(cardList, quizOptions, true).filter(
        (card) => !combined.some((c) => c.id === card.id),
      );
      const additional = shuffle(remainingCards).slice(0, limit - combined.length);
      return toCardViews(shuffle([...combined, ...additional]), getCategoryList());
    }
    return toCardViews(shuffle(combined), getCategoryList());
  } else {
    const filteredList = filterQuizCards(cardList, quizOptions, ignoreMode);
    const limit = normalizeLimit(quizOptions.limit);
    return toCardViews(shuffle(filteredList).slice(0, limit), getCategoryList());
  }
}

// 创建一个空的测验结果统计对象，初始值为0
function createEmptyQuizResult(total = 0): QuizResultSummary {
  return {
    total,
    unknown: 0,
    fuzzy: 0,
    mastered: 0,
  };
}

// 保存每日测验进度数据到本地存储
function saveDailyQuizSession(session: DailyQuizSession) {
  wx.setStorageSync(DAILY_QUIZ_SESSION_KEY, JSON.stringify(session));
}

// 判断是否可以重用现有的每日测验进度数据
// 条件是日期键、题目数量和查询参数签名都匹配，并且题目队列中的每个题目在当前卡片列表中仍然有效（没有被修改或删除）
function shouldReuseDailySession(
  session: DailyQuizSession,
  quizOptions: Partial<quizQuery>,
  currentCardList: Card[],
  dateKey: string,
): boolean {
  return (
    session.dateKey === dateKey &&
    session.querySignature === buildDailyQuizSignature(quizOptions) &&
    session.limit ===
      normalizeLimit(quizOptions.type === 'today' ? dailyQuizLimit : quizOptions.limit) &&
    isSessionQueueValid(session, currentCardList)
  );
}

// 获取每日测验进度数据
export function getDailyQuizSession(
  quizOptions: Partial<quizQuery>,
): ServiceResult<DailyQuizSession> {
  const todayKey = getDateKey(new Date());
  const storedSession = readDailyQuizSession();
  const currentCardList = loadCardList();
  const hasResetStoredSession =
    !!storedSession &&
    !shouldReuseDailySession(storedSession, quizOptions, currentCardList, todayKey);
  // 如果现有数据符合条件则重用，否则创建新的测验进度数据并保存到本地存储
  if (
    storedSession &&
    shouldReuseDailySession(storedSession, quizOptions, currentCardList, todayKey)
  ) {
    return success(storedSession);
  }
  const queue = buildQueue(quizOptions, true);
  if (queue.length === 0) {
    return fail('没有符合条件的题目');
  }
  const session: DailyQuizSession = {
    dateKey: todayKey,
    limit: normalizeLimit(dailyQuizLimit),
    querySignature: buildDailyQuizSignature(quizOptions),
    queue,
    currentIndex: 0,
    result: createEmptyQuizResult(queue.length),
    finished: false,
    lastAnsweredAt: Date.now(),
  };
  saveDailyQuizSession(session);
  return success(session, hasResetStoredSession ? '当日题集已按最新卡片内容重新生成' : undefined);
}

// 更新每日测验进度数据
export function updateDailyQuizSessionProgress(
  progress: Pick<DailyQuizSession, 'currentIndex' | 'result' | 'finished'>,
) {
  const session = readDailyQuizSession();
  if (!session) {
    return fail('每日测验进度不存在');
  }
  // 只更新进度相关的字段，保持其他字段不变
  const nextSession: DailyQuizSession = {
    ...session,
    currentIndex: progress.currentIndex,
    result: {
      ...progress.result,
      total: session.queue.length,
    },
    finished: progress.finished,
    lastAnsweredAt: Date.now(),
  };
  saveDailyQuizSession(nextSession);
  return success(nextSession);
}

// 获取每日测验题目列表
export function getDailyQuizQuestions(quizOptions: Partial<quizQuery>): ServiceResult<CardView[]> {
  const res = getDailyQuizSession(quizOptions);
  if (!res.success || !res.data) {
    return fail(res.message || '没有符合条件的题目');
  }
  return success(res.data.queue);
}

// 获取自由测验题目列表
export function getFreedomQuizQuestions(
  quizOptions: Partial<quizQuery>,
): ServiceResult<CardView[]> {
  const quiz = buildQueue(quizOptions);
  if (quiz.length === 0) {
    return fail('没有符合条件的题目');
  }
  return success(quiz);
}
