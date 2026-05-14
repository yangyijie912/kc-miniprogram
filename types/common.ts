export type PageResult<T> = {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type StatsResult = {
  total: number;
  mastered: number;
  fuzzy: number;
  unknown: number;
  dailyQuizLimit: number;
  dailyQuizCurrentIndex: number;
  dailyStudied: number;
  dailyMastered: number;
  categoryStats: {
    [categoryId: string]: {
      total: number;
      mastered: number;
      fuzzy: number;
      unknown: number;
    };
  };
  activityStats: {
    '7day': {
      added: number;
      updated: number;
      practice: number;
      mastered: number;
    };
    '30day': {
      added: number;
      updated: number;
      practice: number;
      mastered: number;
    };
  };
};
