import type { QueryParams, PageOptions, CardStatus, CardView, CardSortConfig } from '@/types/card';
import type { quizQuery } from '@/types/quiz';
import { createCardViewList, loadCardPage, loadCategories } from '@/view-model/card-view';
import { batchDeleteCards, batchUpdateCards } from '@/services/cardService';
import { CARD_SORT_OPTIONS } from '@/constants/sortConfig';

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

// 根据 selectedCards 列表更新 cardViewList 中的 isSelected 字段
function applySelectionState(cardViewList: CardView[], selectedCards: string[]): CardView[] {
  return cardViewList.map((item) => ({
    ...item,
    isSelected: selectedCards.includes(item.id),
  }));
}

// 同步转移分类的选择状态，确保在分类列表变化时 selectedTransferCategoryId 始终有效
function syncTransferCategoryState(
  categoryOptions: Array<{ id: string; name: string }>,
  selectedTransferCategoryId: string,
) {
  if (categoryOptions.length === 0) {
    return {
      selectedTransferCategoryId: '',
      selectedTransferCategoryName: '',
      selectedTransferCategoryIndex: 0,
    };
  }

  const matchedIndex = categoryOptions.findIndex(
    (category) => category.id === selectedTransferCategoryId,
  );
  const fallbackIndex = matchedIndex >= 0 ? matchedIndex : 0;
  const fallbackCategory = categoryOptions[fallbackIndex];

  return {
    selectedTransferCategoryId: fallbackCategory.id,
    selectedTransferCategoryName: fallbackCategory.name,
    selectedTransferCategoryIndex: fallbackIndex,
  };
}

function getSortConfig(sortIndex: number): CardSortConfig {
  return CARD_SORT_OPTIONS[sortIndex]?.value ?? CARD_SORT_OPTIONS[0].value;
}

function getSortLabel(sortIndex: number): string {
  return CARD_SORT_OPTIONS[sortIndex]?.label ?? CARD_SORT_OPTIONS[0].label;
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
    selectedSortIndex: 0 as number,
    selectedSortLabel: getSortLabel(0),
    sortOptionLabels: CARD_SORT_OPTIONS.map((option) => option.label),
    isEditMode: false as boolean,
    selectedCards: [] as string[],
    categoryDialogVisible: false as boolean,
    categoryOptions: [] as Array<{ id: string; name: string }>,
    selectedTransferCategoryIndex: 0 as number,
    selectedTransferCategoryId: '' as string,
    selectedTransferCategoryName: '' as string,
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

  // 切换排序配置。这里不让页面自己排数据，而是把排序参数交给服务层统一处理。
  onSortChange(event: WechatMiniprogram.PickerChange) {
    const selectedSortIndex = Number(event.detail.value);
    this.setData({
      selectedSortIndex,
      selectedSortLabel: getSortLabel(selectedSortIndex),
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
      // 排序参数和筛选参数一起走服务层，避免页面和服务层各自维护一套排序规则。
      cardSortConfig: getSortConfig(this.data.selectedSortIndex),
      page: nextPage,
      pageSize: this.data.pageSize,
    });
    const categoryList = loadCategories();
    const cardViewList = createCardViewList(list, categoryList);
    const nextCardViewList = reset ? cardViewList : this.data.cardViewList.concat(cardViewList);
    const nextSelectedCards = reset ? [] : this.data.selectedCards;
    const transferCategoryState = syncTransferCategoryState(
      categoryList.map((category) => ({
        id: category.id,
        name: category.name,
      })),
      this.data.selectedTransferCategoryId,
    );

    this.setData({
      cardViewList: applySelectionState(nextCardViewList, nextSelectedCards),
      currentPage: page,
      total,
      pageSize,
      hasMore: page * pageSize < total,
      isLoading: false,
      categoryOptions: categoryList.map((category) => ({
        id: category.id,
        name: category.name,
      })),
      isEditMode: reset ? false : this.data.isEditMode,
      selectedCards: reset ? [] : this.data.selectedCards,
      ...transferCategoryState,
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

  // 点击卡片多选或进入详情
  onCardClick(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id;
    const { isEditMode, selectedCards } = this.data;
    let arr = [...selectedCards];
    if (isEditMode) {
      if (arr.includes(id)) {
        arr = arr.filter((cardId) => cardId !== id);
      } else {
        arr.push(id);
      }
      this.setData({
        selectedCards: arr,
        cardViewList: applySelectionState(this.data.cardViewList, arr),
      });
      return;
    }
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

  // 进入编辑模式（长按卡片）
  onEdit(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id;
    const { selectedCards } = this.data;
    this.setData({
      isEditMode: true,
    });
    if (!selectedCards.includes(id)) {
      const nextSelectedCards = [...selectedCards, id];
      this.setData({
        selectedCards: nextSelectedCards,
        cardViewList: applySelectionState(this.data.cardViewList, nextSelectedCards),
      });
      return;
    }
    this.setData({
      cardViewList: applySelectionState(this.data.cardViewList, selectedCards),
    });
  },

  exitEditMode() {
    this.setData({
      isEditMode: false,
      selectedCards: [],
      cardViewList: applySelectionState(this.data.cardViewList, []),
    });
    this.closeCategoryDialog();
  },

  // 选择转移的分类
  onTransferCategoryChange(e: WechatMiniprogram.PickerChange) {
    const { categoryOptions } = this.data;
    const index = Number(e.detail.value);
    const category = categoryOptions[index];

    if (category) {
      this.setData({
        selectedTransferCategoryId: category.id,
        selectedTransferCategoryName: category.name,
        selectedTransferCategoryIndex: index,
      });
    }
  },
  openCategoryDialog() {
    const { categoryOptions, selectedCards, selectedTransferCategoryId } = this.data;
    if (selectedCards.length === 0) {
      wx.showToast({ title: '请先选择卡片', icon: 'none' });
      return;
    }

    const transferCategoryState = syncTransferCategoryState(
      categoryOptions,
      selectedTransferCategoryId,
    );

    this.setData({
      ...transferCategoryState,
      categoryDialogVisible: true,
    });
  },

  closeCategoryDialog() {
    this.setData({
      categoryDialogVisible: false,
    });
  },

  // 选择分类并转移
  selectCategory() {
    this.openCategoryDialog();
  },

  confirmTransferCategory() {
    const { selectedCards, selectedTransferCategoryId } = this.data;
    if (selectedCards.length === 0) {
      wx.showToast({ title: '请先选择卡片', icon: 'none' });
      return;
    }

    if (!selectedTransferCategoryId) {
      wx.showToast({ title: '请选择分类', icon: 'none' });
      return;
    }

    const res = batchUpdateCards(selectedCards, {
      categoryId: selectedTransferCategoryId,
    });

    if (res.success) {
      wx.showToast({ title: '转移成功', icon: 'success' });
      this.closeCategoryDialog();
      this.exitEditMode();
      this.loadData(true);
      return;
    }

    wx.showToast({ title: res.message || '转移失败', icon: 'none' });
  },

  // 批量删除
  batchDelete() {
    const { selectedCards } = this.data;
    if (selectedCards.length === 0) {
      wx.showToast({ title: '请至少选择一张卡片', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedCards.length} 张卡片吗？不可恢复`,
      confirmText: '删除',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          const { success, message } = batchDeleteCards(selectedCards);
          if (success) {
            wx.showToast({ title: message || '删除成功', icon: 'success' });
            this.exitEditMode();
            this.loadData(true);
          } else {
            wx.showToast({ title: message || '删除失败，请重试', icon: 'none' });
          }
        }
      },
    });
  },
});
