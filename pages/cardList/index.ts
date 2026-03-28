import type { QueryParams, PageOptions, CardStatus, CardView } from '../../types/card';
import { loadAllViewData } from '../../view-model/card-view';

Page({
  data: {
    inputKeyword: '',
    queryParams: {
      categoryId: '',
      status: '',
      keyword: '',
    } as PageOptions,
    cardViewList: [] as CardView[],
    showQuizAction: false as boolean,
    isSearchResultMode: false as boolean,
    statusTabs: [
      { label: '全部', value: undefined },
      { label: '掌握', value: 'mastered' },
      { label: '模糊', value: 'fuzzy' },
      { label: '未知', value: 'unknown' },
    ] as const,
  },

  // 解析状态参数，确保它是合法的 CardStatus 值
  parseStatus(status?: string): CardStatus | undefined {
    if (status === 'mastered' || status === 'fuzzy' || status === 'unknown') {
      return status;
    }
    return undefined;
  },

  // 解析页面参数，设置查询参数
  parseParams(options?: PageOptions): QueryParams {
    return {
      categoryId: options?.categoryId || undefined,
      keyword: options?.keyword || undefined,
      status: this.parseStatus(options?.status),
    };
  },

  // 处理搜索输入事件，更新 inputKeyword 数据字段
  onSearchInput(event: WechatMiniprogram.Input) {
    this.setData({
      inputKeyword: event.detail.value,
    });
  },

  // 查询卡片列表，更新页面数据
  searchCard() {
    if (!this.data.inputKeyword?.trim()) {
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none',
      });
      return;
    }

    this.setData({
      queryParams: {
        ...this.data.queryParams,
        keyword: this.data.inputKeyword.trim(),
      },
    });
    this.loadData();
  },

  // 切换状态筛选条件
  toggleStatusFilter(event: WechatMiniprogram.BaseEvent) {
    const status = event.currentTarget.dataset.value as CardStatus | undefined;

    this.setData({
      queryParams: {
        ...this.data.queryParams,
        status,
      },
    });
    this.loadData();
  },

  // 加载数据，根据当前查询参数获取卡片视图列表
  loadData() {
    const { cardViewList } = loadAllViewData(this.data.queryParams);
    this.setData({
      cardViewList,
    });
  },

  onLoad(options: PageOptions) {
    const q = this.parseParams(options as PageOptions);
    const { categoryId, status, keyword } = q;

    this.data.queryParams = {
      categoryId: categoryId || '',
      status: status || '',
      keyword: keyword ? decodeURIComponent(keyword) : '',
    };
    this.setData({
      isSearchResultMode: Boolean(this.data.queryParams.keyword?.trim()),
      showQuizAction: Boolean(this.data.queryParams.categoryId) && !this.data.isSearchResultMode,
    });
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData();
    wx.stopPullDownRefresh();
  },

  // 进入卡片详情
  goToDetail(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/cardDetail/index?id=${id}`,
    });
  },

  // 打开添加卡片页面，传递当前分类 ID 作为参数
  goToAddCard() {
    const query = this.data.queryParams.categoryId
      ? `?categoryId=${this.data.queryParams.categoryId}`
      : '';
    wx.navigateTo({
      url: `/pages/cardEdit/index${query}`,
    });
  },

  // 打开测验启动页面
  openQuizSetup() {},
});
