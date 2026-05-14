import { DAILY_QUIZ_SESSION_KEY } from '@/constants/storageKeys';
import type { DailyQuizSession } from '@/types/quiz';
import { getDateKey } from '@/utils/date';

// 读取每日测验进度数据，如果不存在或解析失败则返回 null。
export function readDailyQuizSession(): DailyQuizSession | null {
  const stored = wx.getStorageSync(DAILY_QUIZ_SESSION_KEY);
  if (!stored) {
    return null;
  }
  try {
    return JSON.parse(stored) as DailyQuizSession;
  } catch {
    return null;
  }
}

// 统计场景只读取当天已有 session，不能因为查看统计页而创建新 session。
export function getStoredDailyQuizSession(): DailyQuizSession | null {
  const session = readDailyQuizSession();
  if (!session) {
    return null;
  }

  return session.dateKey === getDateKey(new Date()) ? session : null;
}
