import { loadAllViewData, type CategoryViewPageData } from '@/view-model/card-view';
import type { quizQuery } from '@/types/quiz';

Page({
  data: {
    cardList: [] as CategoryViewPageData['cardList'],
    categoryViewList: [] as CategoryViewPageData['categoryViewList'],
    unmasteredCount: 0,
    searchQuery: '',
    showQuizSetup: false as boolean,
  },

  // 打开测验设置界面
  openQuizSetup() {
    this.setData({
      showQuizSetup: true,
    });
  },

  // 关闭测验设置界面
  closeQuizSetup() {
    this.setData({
      showQuizSetup: false,
    });
  },

  // 开始测验，使用当前UI选择的条件
  startQuizWithCurrentUI(event: WechatMiniprogram.CustomEvent) {
    this.closeQuizSetup();
    const { mode, type, limit } = event.detail as quizQuery;
    wx.navigateTo({
      url: `/package-card/quiz/index?mode=${mode}&type=${type}&limit=${limit}`,
    });
  },

  // 打开所有卡片的列表页
  goToCardListByAll() {
    wx.navigateTo({
      url: '/package-card/cardList/index',
    });
  },

  // 处理搜索输入事件，更新 searchQuery 数据字段
  onSearchInput(event: WechatMiniprogram.Input) {
    this.setData({
      searchQuery: event.detail.value,
    });
  },

  // 搜索卡片
  searchCard() {
    if (!this.data.searchQuery.trim()) {
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none',
      });
      return;
    }
    wx.navigateTo({
      // 显式标记来源，避免列表页把普通带 keyword 的场景误判成“搜索结果模式”。
      url:
        '/package-card/cardList/index?enteredFromHomeSearch=1&keyword=' +
        encodeURIComponent(this.data.searchQuery),
    });
  },

  // 打开指定分类的卡片列表页
  goToCardListByCategory(event: WechatMiniprogram.BaseEvent) {
    const categoryId = event.currentTarget.dataset.categoryId;
    wx.navigateTo({
      url: `/package-card/cardList/index?categoryId=${categoryId}`,
    });
  },

  // 加载所有数据，包括分类列表、卡片列表和分类视图列表
  loadAllData() {
    const { cardList, categoryViewList } = loadAllViewData();
    this.setData({
      cardList,
      categoryViewList,
      unmasteredCount: cardList.filter((card) => card.status !== 'mastered').length,
    });
  },

  onShow() {
    this.loadAllData();
  },

  onHide() {
    // 页面隐藏时关闭测验设置界面，避免下次打开时状态异常
    this.setData({
      showQuizSetup: false,
    });
  },
});
