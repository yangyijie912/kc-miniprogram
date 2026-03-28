import { loadAllCategoryViewData } from '../../utils/useCategoryView';

Page({
  data: {
    categoryList: [],
    cardList: [],
    categoryViewList: [],
  },

  openQuizSetup() {},

  goToCardListByAll() {
    wx.navigateTo({
      url: '/pages/cardList/index',
    });
  },

  searchCard() {},

  goToCardList(categoryId: string) {
    wx.navigateTo({
      url: `/pages/cardList/index?categoryId=${categoryId}`,
    });
  },

  loadAllData() {
    const { categoryList, cardList, categoryViewList } = loadAllCategoryViewData();
    this.setData({
      categoryList,
      cardList,
      categoryViewList,
    });
  },

  onLoad() {},

  onReady() {},

  onShow() {
    this.loadAllData();
  },

  onHide() {},

  onUnload() {},

  onPullDownRefresh() {},

  onReachBottom() {},

  onShareAppMessage() {},
});
