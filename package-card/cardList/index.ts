import type {
  QueryParams,
  PageOptions,
  CardStatus,
  CardView,
  CardSortConfig,
  InteractionMode,
  Move,
} from '@/types/card';
import type { quizQuery } from '@/types/quiz';
import { createCardViewList, loadCardPage, loadCategories } from '@/view-model/card-view';
import {
  batchDeleteCards,
  batchUpdateCards,
  updateCardOrderInCategory,
} from '@/services/cardService';
import { CARD_SORT_OPTIONS } from '@/constants/sortConfig';

const PAGE_SIZE = 10;

// 定义状态标签类型
type StatusTab = {
  label: string;
  value: CardStatus | '';
  active: boolean;
};

type CardListItem = CardView & {
  answerPreview: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

type Direction = 'up' | 'down';

const CUSTOM_SORT_INDEX = Math.max(
  0,
  CARD_SORT_OPTIONS.findIndex((option) => option.value.sortBy === 'customSort'),
);

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
function applySelectionState(
  cardViewList: CardListItem[],
  selectedCards: string[],
  interactionMode: InteractionMode,
): CardListItem[] {
  const isSelectMode = interactionMode === 'select';
  const isSortMode = interactionMode === 'sort';

  return cardViewList.map((item, index) => ({
    ...item,
    isSelected: isSelectMode && selectedCards.includes(item.id),
    canMoveUp: isSortMode && index > 0,
    canMoveDown: isSortMode && index < cardViewList.length - 1,
  }));
}

function formatAnswerPreview(answer: string | null | undefined) {
  if (!answer) {
    return '';
  }

  // 列表预览必须固定卡高：把显式换行压成空格，再交给两行省略处理。
  return answer
    .replace(/\s*\r?\n\s*/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .trim();
}

function buildCardListItems(cardViewList: CardView[]): CardListItem[] {
  return cardViewList.map((item) => ({
    ...item,
    answerPreview: formatAnswerPreview(item.answer),
    canMoveUp: false,
    canMoveDown: false,
  }));
}

function canUseSortMode(queryParams: QueryParams, isSearchResultMode: boolean): boolean {
  return Boolean(queryParams.categoryId) && !isSearchResultMode;
}

function getSortModeDisabledReason(queryParams: QueryParams, isSearchResultMode: boolean): string {
  if (!queryParams.categoryId) {
    return '仅分类列表支持上下排序';
  }

  if (isSearchResultMode) {
    return '搜索结果里暂不支持上下排序';
  }

  return '';
}

function normalizeInteractionMode(
  interactionMode: InteractionMode,
  sortModeAvailable: boolean,
): InteractionMode {
  if (interactionMode === 'sort' && !sortModeAvailable) {
    return 'browse';
  }

  return interactionMode;
}

function getInteractionCopy(interactionMode: InteractionMode) {
  if (interactionMode === 'sort') {
    return {
      currentModeTitle: '排序模式',
      currentModeTag: '排序中',
      currentModeDesc: '点击卡片左侧按钮上下移动，完成后可退出排序',
      sortModeActionLabel: '退出排序',
    };
  }

  if (interactionMode === 'select') {
    return {
      currentModeTitle: '多选模式',
      currentModeTag: '多选中',
      currentModeDesc: '长按继续选择，支持批量转移分类与删除',
      sortModeActionLabel: '上下排序',
    };
  }

  return {
    currentModeTitle: '浏览模式',
    currentModeTag: '浏览中',
    currentModeDesc: '长按卡片进入多选模式，或点击上下排序',
    sortModeActionLabel: '上下排序',
  };
}

function buildInteractionState(params: {
  interactionMode: InteractionMode;
  queryParams: QueryParams;
  isSearchResultMode: boolean;
  cardViewList: CardListItem[];
  selectedCards: string[];
}) {
  const sortModeAvailable = canUseSortMode(params.queryParams, params.isSearchResultMode);
  const normalizedInteractionMode = normalizeInteractionMode(
    params.interactionMode,
    sortModeAvailable,
  );
  const normalizedSelectedCards =
    normalizedInteractionMode === 'select' ? params.selectedCards : [];

  return {
    interactionMode: normalizedInteractionMode,
    isEditMode: normalizedInteractionMode === 'select',
    isSortMode: normalizedInteractionMode === 'sort',
    isSortModeDisabled: !sortModeAvailable,
    sortModeDisabledReason: getSortModeDisabledReason(
      params.queryParams,
      params.isSearchResultMode,
    ),
    selectedCards: normalizedSelectedCards,
    cardViewList: applySelectionState(
      params.cardViewList,
      normalizedSelectedCards,
      normalizedInteractionMode,
    ),
    ...getInteractionCopy(normalizedInteractionMode),
  };
}

function reorderCardListItems(cardViewList: CardListItem[], move: Move): CardListItem[] {
  const movedIndex = cardViewList.findIndex((item) => item.id === move.movedId);
  const anchorIndex = cardViewList.findIndex((item) => item.id === move.anchorId);

  if (movedIndex === -1 || anchorIndex === -1) {
    return cardViewList;
  }

  const nextList = [...cardViewList];
  const [movedCard] = nextList.splice(movedIndex, 1);
  const adjustedAnchorIndex = movedIndex < anchorIndex ? anchorIndex - 1 : anchorIndex;
  const insertIndex = move.position === 'before' ? adjustedAnchorIndex : adjustedAnchorIndex + 1;

  nextList.splice(insertIndex, 0, movedCard);
  return nextList;
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

function buildBrowseState(pageData: {
  queryParams: QueryParams;
  isSearchResultMode: boolean;
  cardViewList: CardListItem[];
}) {
  return buildInteractionState({
    interactionMode: 'browse',
    queryParams: pageData.queryParams,
    isSearchResultMode: pageData.isSearchResultMode,
    cardViewList: pageData.cardViewList,
    selectedCards: [],
  });
}

Page({
  data: {
    inputKeyword: '',
    queryParams: {} as QueryParams,
    cardViewList: [] as CardListItem[],
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
    enteredFromHomeSearch: false as boolean,
    interactionMode: 'browse' as InteractionMode,
    isEditMode: false as boolean,
    isSortMode: false as boolean,
    isSortModeDisabled: true as boolean,
    sortModeDisabledReason: '仅分类列表支持上下排序',
    sortModeActionLabel: '上下排序',
    currentModeTitle: '浏览模式',
    currentModeTag: '浏览中',
    currentModeDesc: '长按卡片进入多选模式，或点击上下排序',
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
    // 和 uniapp 对齐：只有“首页带 keyword 进入”的场景才切搜索结果页内模式；
    // 当前列表页自己输入关键词时，只是普通筛选，不应该把整块筛选区切掉。
    const isSearchResultMode = this.data.enteredFromHomeSearch && Boolean(keyword);

    this.setData({
      queryParams: query,
      isSearchResultMode,
      showQuizAction: Boolean(query.categoryId) && !isSearchResultMode,
      ...buildInteractionState({
        interactionMode: this.data.interactionMode,
        queryParams: query,
        isSearchResultMode,
        cardViewList: this.data.cardViewList,
        selectedCards: this.data.selectedCards,
      }),
    });
    this.loadData(true);
  },

  // 切换状态筛选条件
  toggleStatusFilter(event: WechatMiniprogram.BaseEvent) {
    const rawStatus = event.currentTarget.dataset.value as CardStatus | '' | undefined;
    const status = rawStatus ? rawStatus : undefined;
    const queryParams = {
      ...this.data.queryParams,
      status,
    };

    this.setData({
      queryParams,
      statusTabs: buildStatusTabs(status),
      ...buildBrowseState({
        queryParams,
        isSearchResultMode: this.data.isSearchResultMode,
        cardViewList: this.data.cardViewList,
      }),
    });
    this.loadData(true);
  },

  // 切换排序配置。这里不让页面自己排数据，而是把排序参数交给服务层统一处理。
  onSortChange(event: WechatMiniprogram.PickerChange) {
    if (this.data.isSortMode) {
      return;
    }

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
    const nextCardViewList = reset
      ? buildCardListItems(cardViewList)
      : this.data.cardViewList.concat(buildCardListItems(cardViewList));
    const nextInteractionMode =
      reset && this.data.interactionMode === 'select' ? 'browse' : this.data.interactionMode;
    const transferCategoryState = syncTransferCategoryState(
      categoryList.map((category) => ({
        id: category.id,
        name: category.name,
      })),
      this.data.selectedTransferCategoryId,
    );
    const interactionState = buildInteractionState({
      interactionMode: nextInteractionMode,
      queryParams: this.data.queryParams,
      isSearchResultMode: this.data.isSearchResultMode,
      cardViewList: nextCardViewList,
      selectedCards: this.data.selectedCards,
    });

    this.setData({
      ...interactionState,
      currentPage: page,
      total,
      pageSize,
      hasMore: page * pageSize < total,
      isLoading: false,
      categoryOptions: categoryList.map((category) => ({
        id: category.id,
        name: category.name,
      })),
      ...transferCategoryState,
    });
  },

  // 打开测验设置界面
  openQuizSetup() {
    this.setData({
      showQuizSetup: true,
      ...buildBrowseState(this.data),
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
      enteredFromHomeSearch: Boolean(normalizedQuery.keyword?.trim()),
      isSearchResultMode: Boolean(normalizedQuery.keyword?.trim()),
      showQuizAction:
        Boolean(normalizedQuery.categoryId) && !Boolean(normalizedQuery.keyword?.trim()),
      statusTabs: buildStatusTabs(normalizedQuery.status),
      ...buildInteractionState({
        interactionMode: 'browse',
        queryParams: normalizedQuery,
        isSearchResultMode: Boolean(normalizedQuery.keyword?.trim()),
        cardViewList: this.data.cardViewList,
        selectedCards: [],
      }),
    });
  },

  onShow() {
    this.loadData(true);
  },

  onHide() {
    if (!this.data.isSortMode) {
      return;
    }

    this.setData({
      ...buildBrowseState(this.data),
    });
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
    const { interactionMode, selectedCards } = this.data;

    if (interactionMode === 'sort') {
      return;
    }

    let arr = [...selectedCards];
    if (interactionMode === 'select') {
      if (arr.includes(id)) {
        arr = arr.filter((cardId) => cardId !== id);
      } else {
        arr.push(id);
      }
      this.setData({
        ...buildInteractionState({
          interactionMode: 'select',
          queryParams: this.data.queryParams,
          isSearchResultMode: this.data.isSearchResultMode,
          cardViewList: this.data.cardViewList,
          selectedCards: arr,
        }),
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
    this.setData({
      ...buildBrowseState(this.data),
    });
    wx.navigateTo({
      url: `/package-card/cardEdit/index${query}`,
    });
  },

  // 进入编辑模式（长按卡片）
  onEdit(event: WechatMiniprogram.BaseEvent) {
    if (this.data.interactionMode === 'sort') {
      return;
    }

    const id = event.currentTarget.dataset.id;
    const { selectedCards } = this.data;
    const nextSelectedCards = selectedCards.includes(id) ? selectedCards : [...selectedCards, id];

    this.setData({
      ...buildInteractionState({
        interactionMode: 'select',
        queryParams: this.data.queryParams,
        isSearchResultMode: this.data.isSearchResultMode,
        cardViewList: this.data.cardViewList,
        selectedCards: nextSelectedCards,
      }),
    });
  },

  exitEditMode() {
    this.setData({
      categoryDialogVisible: false,
      ...buildInteractionState({
        interactionMode: 'browse',
        queryParams: this.data.queryParams,
        isSearchResultMode: this.data.isSearchResultMode,
        cardViewList: this.data.cardViewList,
        selectedCards: [],
      }),
    });
  },

  toggleSortMode() {
    if (this.data.isSortMode) {
      this.setData({
        categoryDialogVisible: false,
        ...buildBrowseState(this.data),
      });
      return;
    }

    if (this.data.isSortModeDisabled) {
      wx.showToast({
        title: this.data.sortModeDisabledReason || '当前列表暂不支持上下排序',
        icon: 'none',
      });
      return;
    }

    const shouldReload = this.data.selectedSortIndex !== CUSTOM_SORT_INDEX;

    this.setData({
      selectedSortIndex: CUSTOM_SORT_INDEX,
      selectedSortLabel: getSortLabel(CUSTOM_SORT_INDEX),
      categoryDialogVisible: false,
      ...buildInteractionState({
        interactionMode: 'sort',
        queryParams: this.data.queryParams,
        isSearchResultMode: this.data.isSearchResultMode,
        cardViewList: this.data.cardViewList,
        selectedCards: [],
      }),
    });

    // 排序模式必须绑定到自定义顺序，否则用户眼前的顺序和最终落盘顺序会脱节。
    if (shouldReload) {
      this.loadData(true);
    }
  },

  moveCard(event: WechatMiniprogram.BaseEvent, direction: Direction) {
    if (!this.data.isSortMode || !this.data.queryParams.categoryId) {
      return;
    }

    const id = String(event.currentTarget.dataset.id || '');
    const index = Number(event.currentTarget.dataset.index);

    if (!id || Number.isNaN(index)) {
      return;
    }

    const anchorIndex = direction === 'up' ? index - 1 : index + 1;
    const anchorCard = this.data.cardViewList[anchorIndex];

    if (!anchorCard) {
      return;
    }

    const move: Move = {
      movedId: id,
      anchorId: anchorCard.id,
      position: direction === 'up' ? 'before' : 'after',
    };
    const result = updateCardOrderInCategory(this.data.queryParams.categoryId, move);

    if (!result.success) {
      wx.showToast({ title: result.message || '排序失败', icon: 'none' });
      return;
    }

    const reorderedList = reorderCardListItems(this.data.cardViewList, move);
    this.setData({
      ...buildInteractionState({
        interactionMode: 'sort',
        queryParams: this.data.queryParams,
        isSearchResultMode: this.data.isSearchResultMode,
        cardViewList: reorderedList,
        selectedCards: [],
      }),
    });
  },

  moveCardUp(event: WechatMiniprogram.BaseEvent) {
    this.moveCard(event, 'up');
  },

  moveCardDown(event: WechatMiniprogram.BaseEvent) {
    this.moveCard(event, 'down');
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
