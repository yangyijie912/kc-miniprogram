export type CardStatus = 'unknown' | 'fuzzy' | 'mastered';

export interface Category {
  id: string;
  name: string;
  sort: number;
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
};

export interface Card {
  id: string;
  categoryId: string;
  question: string;
  answer: string;
  content?: string;
  tags?: string[];
  status?: CardStatus;
  createdAt?: number;
  updatedAt?: number;
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
}

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
