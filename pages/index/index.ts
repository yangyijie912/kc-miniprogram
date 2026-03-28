import { loadAllViewData, type CategoryViewPageData } from '../../utils/useCategoryView';

Page({
  data: {
    categoryList: [] as CategoryViewPageData['categoryList'],
    cardList: [] as CategoryViewPageData['cardList'],
    categoryViewList: [] as CategoryViewPageData['categoryViewList'],
    unmasteredCount: 0,
    searchQuery: '',
  },

  openQuizSetup() {},

  // 打开所有卡片的列表页
  goToCardListByAll() {
    wx.navigateTo({
      url: '/pages/cardList/index',
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
      url: '/pages/cardList/index?keyword=' + encodeURIComponent(this.data.searchQuery),
    });
  },

  // 打开指定分类的卡片列表页
  goToCardListByCategory(event: WechatMiniprogram.BaseEvent) {
    const categoryId = event.currentTarget.dataset.categoryId;
    wx.navigateTo({
      url: `/pages/cardList/index?categoryId=${categoryId}`,
    });
  },

  // 加载所有数据，包括分类列表、卡片列表和分类视图列表
  loadAllData() {
    const { categoryList, cardList, categoryViewList } = loadAllViewData();
    this.setData({
      categoryList,
      cardList,
      categoryViewList,
      unmasteredCount: cardList.filter((card) => card.status !== 'mastered').length,
    });
  },

  onShow() {
    this.loadAllData();
  },
});
