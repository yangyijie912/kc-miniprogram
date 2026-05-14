import { CARD_STORAGE_KEY, DAILY_QUIZ_SESSION_KEY } from '@/constants/storageKeys';
import type { ServiceResult } from '@/types/service';
import { success, fail } from '@/services/serviceHelper';
import { shuffle } from '@/utils/arrayUtils';
import type { Card, CardView } from '@/types/card';
import type { DailyQuizSession, quizQuery, QuizResultSummary } from '@/types/quiz';
import { getCategories } from '@/services/categoryService';
import { toCardViews } from '@/utils/cardView';
import { readDailyQuizSession } from '@/utils/storage';
import { getDateKey } from '@/utils/date';

// 每日测验的题目数量限制，默认值为10
export const dailyQuizLimit = 10;

// 从本地存储加载卡片列表
function loadCardList(): Card[] {
  return JSON.parse(wx.getStorageSync(CARD_STORAGE_KEY) || '[]') as Card[];
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
  // 如果是每日测验，抽取题目时按照unknown（包含状态为undefined） : fuzzy : mastered = 6 : 3 : 1的比例进行抽取
  if (quizOptions.type === 'today') {
    const unknownCards = filterQuizCards(loadCardList(), quizOptions, true, {
      unknown: true,
      undefinedStatus: true,
    });
    const fuzzyCards = filterQuizCards(loadCardList(), quizOptions, true, { fuzzy: true });
    const masteredCards = filterQuizCards(loadCardList(), quizOptions, true, { mastered: true });

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
      const remainingCards = filterQuizCards(loadCardList(), quizOptions, true).filter(
        (card) => !combined.some((c) => c.id === card.id),
      );
      const additional = shuffle(remainingCards).slice(0, limit - combined.length);
      return toCardViews(shuffle([...combined, ...additional]), getCategoryList());
    }
    return toCardViews(shuffle(combined), getCategoryList());
  } else {
    const filteredList = filterQuizCards(loadCardList(), quizOptions, ignoreMode);
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

// 判断是否可以重用现有的每日测验进度数据，条件是日期键和题目数量都匹配
function shouldReuseDailySession(
  session: DailyQuizSession,
  quizOptions: Partial<quizQuery>,
  dateKey: string,
): boolean {
  return (
    session.dateKey === dateKey &&
    session.limit ===
      normalizeLimit(quizOptions.type === 'today' ? dailyQuizLimit : quizOptions.limit)
  );
}

// 获取每日测验进度数据
export function getDailyQuizSession(
  quizOptions: Partial<quizQuery>,
): ServiceResult<DailyQuizSession> {
  const todayKey = getDateKey(new Date());
  const storedSession = readDailyQuizSession();
  // 如果现有数据符合条件则重用，否则创建新的测验进度数据并保存到本地存储
  if (storedSession && shouldReuseDailySession(storedSession, quizOptions, todayKey)) {
    return success(storedSession);
  }
  const queue = buildQueue(quizOptions, true);
  if (queue.length === 0) {
    return fail('没有符合条件的题目');
  }
  const session: DailyQuizSession = {
    dateKey: todayKey,
    limit: normalizeLimit(dailyQuizLimit),
    queue,
    currentIndex: 0,
    result: createEmptyQuizResult(queue.length),
    finished: false,
    lastAnsweredAt: Date.now(),
  };
  saveDailyQuizSession(session);
  return success(session);
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
