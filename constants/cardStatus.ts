import type { CardStatus } from '@/types/card';

export const cardStatusTextMap: Record<CardStatus, string> = {
  unknown: '未知',
  fuzzy: '模糊',
  mastered: '掌握',
};
