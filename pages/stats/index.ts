import { getCardStats } from '@/services/cardService';
import { getCategories } from '@/services/categoryService';
import type { Category } from '@/types/card';

type ActivityRange = '7d' | '30d';

type CategoryRow = {
  id: string;
  name: string;
  cards: number;
  rate: string;
  review: number;
};

// 百分比统一在页面层做轻量格式化，避免模板里塞重复表达式。
function formatRate(value: number, total: number) {
  if (total <= 0) {
    return '0%';
  }

  return `${Math.round((value / total) * 100)}%`;
}

Page({
  data: {
    activityRange: '7d' as ActivityRange,
    totalCards: 0,
    reviewCards: 0,
    masteredCards: 0,
    masteredRate: '0%',
    todayProgressText: '今日还没有开始每日测验',
    todayQuizRate: 0,
    todayPracticeCount: 0,
    todayCorrectCount: 0,
    todayCorrectRate: 0,
    statusDistribution: [] as Array<{
      key: string;
      label: string;
      count: number;
      percent: string;
      dotClass: string;
    }>,
    activityStatsMap: {
      '7d': {
        added: 0,
        updated: 0,
        practice: 0,
        mastered: 0,
      },
      '30d': {
        added: 0,
        updated: 0,
        practice: 0,
        mastered: 0,
      },
    },
    currentActivityStats: {
      added: 0,
      updated: 0,
      practice: 0,
      mastered: 0,
    },
    categoryRows: [] as CategoryRow[],
  },

  // 统计页展示完全依赖稳定服务接口，不在页面层重复推导底层业务口径。
  loadStatsPage() {
    const statsRes = getCardStats();
    const categoriesRes = getCategories();

    if (!statsRes.success || !statsRes.data) {
      wx.showToast({ title: statsRes.message || '加载统计失败', icon: 'none' });
      return;
    }

    const stats = statsRes.data;
    const categories = categoriesRes.success && categoriesRes.data ? categoriesRes.data : [];
    const undefinedCards = Math.max(stats.total - stats.mastered - stats.fuzzy - stats.unknown, 0);
    const quizDone = stats.dailyQuizCurrentIndex;
    const quizTarget = stats.dailyQuizLimit;
    const todayPracticeCount = typeof stats.dailyStudied === 'number' ? stats.dailyStudied : 0;
    const todayCorrectCount = typeof stats.dailyMastered === 'number' ? stats.dailyMastered : 0;
    const activityStats = stats.activityStats;
    const activityStats7day = activityStats && activityStats['7day'] ? activityStats['7day'] : null;
    const activityStats30day =
      activityStats && activityStats['30day'] ? activityStats['30day'] : null;

    // 活跃度区间字段和服务层约定保持一致，页面只做 7d / 30d 显示映射。
    const activityStatsMap = {
      '7d': {
        added:
          activityStats7day && activityStats7day.added !== undefined ? activityStats7day.added : 0,
        updated:
          activityStats7day && activityStats7day.updated !== undefined
            ? activityStats7day.updated
            : 0,
        practice:
          activityStats7day && activityStats7day.practice !== undefined
            ? activityStats7day.practice
            : 0,
        mastered:
          activityStats7day && activityStats7day.mastered !== undefined
            ? activityStats7day.mastered
            : 0,
      },
      '30d': {
        added:
          activityStats30day && activityStats30day.added !== undefined
            ? activityStats30day.added
            : 0,
        updated:
          activityStats30day && activityStats30day.updated !== undefined
            ? activityStats30day.updated
            : 0,
        practice:
          activityStats30day && activityStats30day.practice !== undefined
            ? activityStats30day.practice
            : 0,
        mastered:
          activityStats30day && activityStats30day.mastered !== undefined
            ? activityStats30day.mastered
            : 0,
      },
    };

    // 分类表现直接消费服务返回的 categoryStats，页面只做展示格式转换。
    const categoryRows = categories.map((category: Category) => {
      const categoryStats = stats.categoryStats[category.id];
      const total = categoryStats && categoryStats.total !== undefined ? categoryStats.total : 0;
      const mastered =
        categoryStats && categoryStats.mastered !== undefined ? categoryStats.mastered : 0;

      return {
        id: category.id,
        name: category.name,
        cards: total,
        rate: formatRate(mastered, total),
        review: Math.max(total - mastered, 0),
      };
    });

    this.setData({
      totalCards: stats.total,
      reviewCards: Math.max(stats.total - stats.mastered, 0),
      masteredCards: stats.mastered,
      masteredRate: formatRate(stats.mastered, stats.total),
      todayProgressText:
        quizTarget > 0 ? `${quizDone} / ${quizTarget} 已完成` : '今日还没有开始每日测验',
      todayQuizRate: quizTarget > 0 ? Math.round((quizDone / quizTarget) * 100) : 0,
      todayPracticeCount,
      todayCorrectCount,
      todayCorrectRate:
        todayPracticeCount > 0 ? Math.round((todayCorrectCount / todayPracticeCount) * 100) : 0,
      statusDistribution: [
        {
          key: 'mastered',
          label: '掌握',
          count: stats.mastered,
          percent: formatRate(stats.mastered, stats.total),
          dotClass: 'dist-dot-mastered',
        },
        {
          key: 'fuzzy',
          label: '模糊',
          count: stats.fuzzy,
          percent: formatRate(stats.fuzzy, stats.total),
          dotClass: 'dist-dot-fuzzy',
        },
        {
          key: 'unknown',
          label: '未知',
          count: stats.unknown,
          percent: formatRate(stats.unknown, stats.total),
          dotClass: 'dist-dot-unknown',
        },
        {
          key: 'undefined',
          label: '未设置',
          count: undefinedCards,
          percent: formatRate(undefinedCards, stats.total),
          dotClass: 'dist-dot-undefined',
        },
      ],
      activityStatsMap,
      currentActivityStats: activityStatsMap[this.data.activityRange],
      categoryRows,
    });
  },

  // 切换活跃度区间时只替换展示数据，不重新请求，避免页面闪动。
  switchActivityRange(event: WechatMiniprogram.BaseEvent) {
    const activityRange = event.currentTarget.dataset.range as ActivityRange;
    this.setData({
      activityRange,
      currentActivityStats: this.data.activityStatsMap[activityRange],
    });
  },

  handleTodayQuizTap() {
    const { todayQuizRate, todayProgressText } = this.data;

    // 进度卡片只负责已完成结果回看；未完成时统一拦截并提示继续去做题。
    if (todayQuizRate < 100 || todayProgressText === '今日还没有开始每日测验') {
      wx.showToast({
        title: '今日测验还没完成，快去开始吧',
        icon: 'none',
      });
      return;
    }

    // 结果页沿用测验页完成时的入参协议，避免入口不同导致页面状态分支不一致。
    wx.navigateTo({
      url: '/package-card/quizResult/index?type=today',
    });
  },

  onShow() {
    this.loadStatsPage();
  },
});
