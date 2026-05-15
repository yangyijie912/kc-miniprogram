import type { Card } from '@/types/card';
import { getCardById } from '@/services/cardService';
import { getCategoryById } from '@/services/categoryService';
import { UNCATEGORIZED_NAME } from '@/constants/category';
import { cardStatusTextMap } from '@/constants/cardStatus';

function formatTagsText(tags: Card['tags']) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return '';
  }

  // 详情页标签是完整展示态；为空时必须返回空串，不能把 undefined 拼进 UI。
  return '/ ' + tags.join('•');
}

Page({
  data: {
    cardId: '' as string,
    cardData: null as Card | null,
    categoryName: '' as string,
  },

  // 加载详情
  loadCardData(id: string) {
    const res = getCardById(id);
    if (res.success && res.data) {
      const card = res.data;
      this.setData({
        cardData: {
          ...card,
          statusText: card?.status ? cardStatusTextMap[card.status] : '新',
          tagsText: formatTagsText(card.tags),
        } as Card,
      });

      const categoryRes = getCategoryById(res.data.categoryId);
      if (categoryRes.success && categoryRes.data) {
        this.setData({ categoryName: categoryRes.data.name });
      } else {
        this.setData({ categoryName: UNCATEGORIZED_NAME });
      }
    } else {
      this.setData({ cardData: null, categoryName: '' });
      wx.showToast({
        title: res.message || '数据加载失败',
        icon: 'none',
      });
    }
  },

  // 进入编辑
  goToEdit() {
    if (!this.data.cardId) {
      return;
    }
    wx.navigateTo({
      url: `/package-card/cardEdit/index?id=${this.data.cardId}`,
    });
  },

  // 页面加载
  onLoad(options) {
    const id = options?.id || null;
    if (id) {
      this.setData({ cardId: id });
    } else {
      wx.showToast({
        title: '未指定卡片ID',
        icon: 'none',
      });
    }
  },

  // 页面显示时刷新数据
  onShow() {
    if (this.data.cardId) {
      this.loadCardData(this.data.cardId);
    }
  },
});
