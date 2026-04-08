import type { QueryParams, PageOptions, CardStatus, CardView } from '../../types/card';
import type { quizQuery } from '../../types/quiz';
import { createCardViewList, loadCardPage, loadCategories } from '../../view-model/card-view';

const PAGE_SIZE = 10;

// 定义状态标签类型
type StatusTab = {
  label: string;
  value: CardStatus | '';
  active: boolean;
};

// 基本状态标签列表
const baseStatusTabs: Array<Omit<StatusTab, 'active'>> = [
  { label: '全部', value: '' },
  { label: '掌握', value: 'mastered' },
  { label: '模糊', value: 'fuzzy' },
  { label: '未知', value: 'unknown' },
];

// 根据当前选中的状态构建状态标签列表，设置 active 字段
function buildStatusTabs(status?: CardStatus): StatusTab[] {
  const normalized = status || '';
  return baseStatusTabs.map((item) => ({
    ...item,
    active: item.value === normalized,
  }));
}

Page({
  data: {
    inputKeyword: '',
    queryParams: {} as QueryParams,
    cardViewList: [] as CardView[],
    currentPage: 0 as number,
    pageSize: PAGE_SIZE,
    total: 0 as number,
    hasMore: true as boolean,
    isLoading: false as boolean,
    showQuizAction: false as boolean,
    isSearchResultMode: false as boolean,
    statusTabs: buildStatusTabs(),
    showQuizSetup: false as boolean,
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
    const keyword = this.data.inputKeyword?.trim();
    const query = {
      ...this.data.queryParams,
      keyword: keyword ? keyword : undefined,
    };
    this.setData({ queryParams: query });
    this.loadData(true);
  },

  // 切换状态筛选条件
  toggleStatusFilter(event: WechatMiniprogram.BaseEvent) {
    const rawStatus = event.currentTarget.dataset.value as CardStatus | '' | undefined;
    const status = rawStatus ? rawStatus : undefined;

    this.setData({
      queryParams: {
        ...this.data.queryParams,
        status,
      },
      statusTabs: buildStatusTabs(status),
    });
    this.loadData(true);
  },

  // 加载数据，根据当前查询参数获取分页卡片视图列表
  loadData(reset = false) {
    if (this.data.isLoading) {
      return;
    }

    if (!reset && !this.data.hasMore) {
      return;
    }

    const nextPage = reset ? 1 : this.data.currentPage + 1;
    this.setData({
      isLoading: true,
    });

    const { list, total, page, pageSize } = loadCardPage({
      ...this.data.queryParams,
      page: nextPage,
      pageSize: this.data.pageSize,
    });
    const categoryList = loadCategories();
    const cardViewList = createCardViewList(list, categoryList);
    const nextCardViewList = reset ? cardViewList : this.data.cardViewList.concat(cardViewList);

    this.setData({
      cardViewList: nextCardViewList,
      currentPage: page,
      total,
      pageSize,
      hasMore: page * pageSize < total,
      isLoading: false,
    });
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
    if (!this.data.queryParams.categoryId) {
      return;
    }
    this.closeQuizSetup();
    const { mode, type, limit } = event.detail as quizQuery;
    wx.navigateTo({
      url: `/package-card/quiz/index?mode=${mode}&type=${type}&limit=${limit}&categoryId=${this.data.queryParams.categoryId}`,
    });
  },

  onLoad(options: PageOptions) {
    const q = this.parseParams(options as PageOptions);
    const { categoryId, status, keyword } = q;

    const normalizedQuery: QueryParams = {
      categoryId,
      status,
      keyword: keyword ? decodeURIComponent(keyword) : undefined,
    };

    this.setData({
      queryParams: normalizedQuery,
      inputKeyword: normalizedQuery.keyword || '',
      isSearchResultMode: Boolean(normalizedQuery.keyword?.trim()),
      showQuizAction:
        Boolean(normalizedQuery.categoryId) && !Boolean(normalizedQuery.keyword?.trim()),
      statusTabs: buildStatusTabs(normalizedQuery.status),
    });
  },

  onShow() {
    this.loadData(true);
  },

  onPullDownRefresh() {
    this.loadData(true);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    this.loadData(false);
  },

  // 进入卡片详情
  goToDetail(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/package-card/cardDetail/index?id=${id}`,
    });
  },

  // 打开添加卡片页面，传递当前分类 ID 作为参数
  goToAddCard() {
    const query = this.data.queryParams.categoryId
      ? `?categoryId=${this.data.queryParams.categoryId}`
      : '';
    wx.navigateTo({
      url: `/package-card/cardEdit/index${query}`,
    });
  },
});
