export type CardStatusMap = {
  unknown: {
    code: 0;
    label: '未知';
  };
  fuzzy: {
    code: 1;
    label: '模糊';
  };
  mastered: {
    code: 2;
    label: '掌握';
  };
};

export type CardStatus = keyof CardStatusMap;
export type CardStatusCode = CardStatusMap[CardStatus]['code'];
export type CardStatusLabel = CardStatusMap[CardStatus]['label'];

export interface Category {
  id: string;
  name: string;
  sort: number;
  themeIndex?: number;
  isSystem?: boolean;
}

// 定义一个类型来表示原始的卡片数据结构
export type RawCard = {
  id: string;
  categoryId?: string;
  category?: string;
  question: string;
  answer: string;
  content?: string;
  tags?: string[];
  status?: Card['status'];
  createdAt?: number;
  updatedAt?: number;
  statusUpdatedAt?: number;
  masteredAt?: number;
  contentUpdatedAt?: number;
  sort?: number;
};

export interface Card {
  id: string;
  categoryId: string;
  question: string;
  answer: string;
  content?: string;
  tags?: string[];
  status?: CardStatus;
  createdAt: number;
  updatedAt: number;
  statusUpdatedAt?: number;
  masteredAt?: number;
  contentUpdatedAt?: number;
  sort: number;
}

export interface CategoryView extends Category {
  cardCount: number;
  canEdit: boolean;
  canDelete: boolean;
  visible: boolean;
  theme: {
    background: string;
    color: string;
  };
}

export interface CardView extends Card {
  categoryName?: string;
  tagText?: string;
  statusName?: string;
  isSelected?: boolean;
}

export type CardSortBy = 'createdAt' | 'updatedAt' | 'contentUpdatedAt' | 'customSort';

export type SortOrder = 'asc' | 'desc';

export interface CardSortConfig {
  sortBy: CardSortBy;
  order?: SortOrder;
}

export type DailyLearningStats = {
  date: string;
  practicedCardIds: string[];
  practiceStatuses: CardStatusCode[];
};

// 定义查询参数类型
export type QueryParams = {
  categoryId?: string;
  keyword?: string;
  status?: CardStatus;
};

// 定义页面接收的查询参数类型
export type PageOptions = {
  categoryId?: string;
  keyword?: string;
  status?: string;
};
