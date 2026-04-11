import type { CardView } from '@/types/card';

// 测验页面查询参数类型定义
export type quizQuery = {
  categoryId: string;
  mode: 'review' | 'unknown' | 'all';
  type: 'today' | 'freedom';
  limit: number;
};

// 测验结果统计类型定义
export type QuizResultSummary = {
  total: number;
  unknown: number;
  fuzzy: number;
  mastered: number;
};

// 每日测验进度类型定义
export type DailyQuizSession = {
  dateKey: string;
  limit: number;
  queue: CardView[];
  currentIndex: number;
  result: QuizResultSummary;
  finished: boolean;
  lastAnsweredAt: number;
};
