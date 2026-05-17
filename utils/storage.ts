import { DAILY_QUIZ_SESSION_KEY, QUIZ_RESULT_STORAGE_KEY } from '@/constants/storageKeys';
import type { CardView } from '@/types/card';
import type { DailyQuizSession, QuizResultSummary } from '@/types/quiz';
import { getDateKey } from '@/utils/date';

type StorageJsonReadResult<T> = {
  hasStoredValue: boolean; // 表示本地存储中是否存在该键对应的值
  parsed: boolean; // 表示是否成功解析了存储的 JSON 字符串
  value: T;
};

// 从本地存储读取 JSON 数据，并进行安全解析，如果没有存储值或解析失败则返回提供的 fallback 值
export function readStorageJson<T>(key: string, fallback: T): StorageJsonReadResult<T> {
  const stored = wx.getStorageSync(key);

  if (!stored) {
    return {
      hasStoredValue: false,
      parsed: true,
      value: fallback,
    };
  }

  try {
    return {
      hasStoredValue: true,
      parsed: true,
      value: JSON.parse(stored) as T,
    };
  } catch {
    return {
      hasStoredValue: true,
      parsed: false,
      value: fallback,
    };
  }
}

/**
 * 以下是针对测验服务的存储读取函数，包含类型保护和数据验证逻辑，以确保读取到的数据结构正确且安全使用。
 */

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isQuizResultSummary(value: unknown): value is QuizResultSummary {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const result = value as Record<string, unknown>;
  return (
    typeof result.total === 'number' &&
    typeof result.unknown === 'number' &&
    typeof result.fuzzy === 'number' &&
    typeof result.mastered === 'number'
  );
}

function isCardView(value: unknown): value is CardView {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const card = value as Record<string, unknown>;
  return (
    typeof card.id === 'string' &&
    typeof card.categoryId === 'string' &&
    typeof card.question === 'string' &&
    typeof card.answer === 'string' &&
    typeof card.createdAt === 'number' &&
    typeof card.updatedAt === 'number' &&
    typeof card.sort === 'number' &&
    (card.content === undefined || typeof card.content === 'string') &&
    (card.tags === undefined || isStringArray(card.tags))
  );
}

// 判断是否为每日测验进度对象
function isDailyQuizSession(value: unknown): value is DailyQuizSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Record<string, unknown>;
  return (
    typeof session.dateKey === 'string' &&
    typeof session.limit === 'number' &&
    (session.querySignature === undefined || typeof session.querySignature === 'string') &&
    Array.isArray(session.queue) &&
    session.queue.every((item) => isCardView(item)) &&
    typeof session.currentIndex === 'number' &&
    isQuizResultSummary(session.result) &&
    typeof session.finished === 'boolean' &&
    typeof session.lastAnsweredAt === 'number'
  );
}

/**
 * 以下是存储读取函数
 */

// 读取每日测验进度数据，如果不存在或解析失败则返回 null。
export function readDailyQuizSession(): DailyQuizSession | null {
  const { value } = readStorageJson<unknown>(DAILY_QUIZ_SESSION_KEY, null);

  if (!isDailyQuizSession(value)) {
    return null;
  }

  return value;
}

// 读取测验结果统计数据，如果不存在或解析失败则返回 null。
export function readStoredQuizResult(): QuizResultSummary | null {
  const { value } = readStorageJson<unknown>(QUIZ_RESULT_STORAGE_KEY, null);

  return isQuizResultSummary(value) ? value : null;
}

// 统计场景只读取当天已有 session，不能因为查看统计页而创建新 session。
export function getStoredDailyQuizSession(): DailyQuizSession | null {
  const session = readDailyQuizSession();
  if (!session) {
    return null;
  }

  return session.dateKey === getDateKey(new Date()) ? session : null;
}
