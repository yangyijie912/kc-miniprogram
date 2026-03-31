import type { Card } from '../../types/card';
import { getCardById } from '../../services/cardService';
import { getCategoryById } from '../../services/categoryService';
import { UNCATEGORIZED_NAME } from '../../constants/category';
import { cardStatusTextMap } from '../../constants/cardStatus';

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
          tagsText:
            (Array.isArray(card?.tags) && card?.tags?.length > 0 ? '/ ' : '') +
            card?.tags?.join('•'),
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
