export type CardStatus = 'unknown' | 'fuzzy' | 'mastered';

export interface Category {
  id: string;
  name: string;
  sort: number;
}

export interface Card {
  id: string;
  categoryId: string;
  question: string;
  answer: string;
  content?: string;
  tags?: string[];
  status?: CardStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryView extends Category {
  cardCount: number;
  canEdit: boolean;
  canDelete: boolean;
  visible: boolean;
}

export interface CardView extends Card {
  categoryName?: string;
  statusName?: string;
}
