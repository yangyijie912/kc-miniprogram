import type { Card, Category } from './card';

export type ExportType = 'json';

export interface ExportData {
  categories: Category[];
  cards: Card[];
  version: string;
  exportedAt: number;
}
