import type { CardStatus, CardStatusCode, CardStatusLabel } from '@/types/card';

export const CARD_STATUS_LABELS = {
  unknown: '未知',
  fuzzy: '模糊',
  mastered: '掌握',
} as const satisfies Record<CardStatus, CardStatusLabel>;

export const CARD_STATUS_TO_CODE = {
  unknown: 0,
  fuzzy: 1,
  mastered: 2,
} as const satisfies Record<CardStatus, CardStatusCode>;

export const CARD_STATUS_FROM_CODE = {
  0: 'unknown',
  1: 'fuzzy',
  2: 'mastered',
} as const satisfies Record<CardStatusCode, CardStatus>;

// 保留旧导出，避免现有页面和工具函数在这轮收口时被一起打断。
export const cardStatusTextMap = CARD_STATUS_LABELS;
