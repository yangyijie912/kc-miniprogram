import { loadAllViewData, type CategoryViewPageData } from '@/view-model/card-view';
import { deleteCategory } from '@/services/categoryService';

Page({
  data: {
    categoryViewList: [] as CategoryViewPageData['categoryViewList'],
  },

  // 跳转到添加分类页面
  addCategory() {
    wx.navigateTo({
      url: '/pages/categoryEdit/index',
    });
  },
  // 跳转到编辑分类页面
  goToEdit(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/categoryEdit/index?id=' + id,
    });
  },
  // 删除分类
  removeCategory(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id;
    // 删除分类逻辑
    wx.showModal({
      title: '确认删除',
      content: '删除分类会将该分类的卡片全部移入未分类，请谨慎操作。',
      confirmText: '删除',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.performDelete(id);
        }
      },
    });
  },
  // 确认删除
  performDelete(id: string) {
    const res = deleteCategory(id);
    if (res.success) {
      this.loadAllData(); // 刷新分类视图，确保未分类被正确更新
    }
    wx.showToast({
      title: res.success ? '分类删除成功' : res.message || '分类删除失败',
      icon: res.success ? 'success' : 'none',
    });
  },

  // 加载数据并更新页面显示
  loadAllData() {
    const { categoryViewList } = loadAllViewData();
    this.setData({
      categoryViewList,
    });
  },

  onShow() {
    this.loadAllData();
  },
});
