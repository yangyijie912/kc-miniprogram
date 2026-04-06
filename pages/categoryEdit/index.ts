import { addCategory, updateCategory, getCategoryById } from '../../services/categoryService';

Page({
  data: {
    categoryId: '' as string,
    formData: {
      name: '' as string,
      sort: 0 as number,
    },
  },

  // 输入分类名称
  onNameInput(event: WechatMiniprogram.Input) {
    this.setData({
      formData: {
        ...this.data.formData,
        name: event.detail.value,
      },
    });
  },

  // 输入分类排序
  onSortInput(event: WechatMiniprogram.Input) {
    this.setData({
      formData: {
        ...this.data.formData,
        sort: Number(event.detail.value),
      },
    });
  },

  // 保存
  save() {
    const { formData, categoryId } = this.data;
    if (formData.name.trim() === '') {
      wx.showToast({
        title: '名称不能为空',
        icon: 'none',
      });
      return;
    }
    // 将排序转换为数字，如果输入为空则默认为 0
    const sort = formData.sort ? Number(formData.sort) : 0;
    if (Number.isNaN(sort)) {
      wx.showToast({
        title: '排序必须是数字',
        icon: 'none',
      });
      return;
    }
    // 调用添加或更新分类的服务
    let res;

    if (categoryId) {
      res = updateCategory({ id: categoryId, name: formData.name.trim(), sort });
    } else {
      res = addCategory({ name: formData.name.trim(), sort });
    }

    if (!res.success) {
      wx.showToast({
        title: res.message || '保存失败',
        icon: 'none',
      });
      return;
    }

    wx.navigateBack();
  },
  // 取消
  cancel() {
    wx.navigateBack();
  },

  onLoad(options) {
    const categoryId = options?.id || null;
    if (categoryId) {
      // 编辑模式，加载分类数据
      const res = getCategoryById(categoryId);
      if (res.success && res.data) {
        this.setData({
          formData: {
            name: res.data.name,
            sort: Number(res.data.sort),
          },
          categoryId,
        });
      } else {
        wx.showToast({
          title: res.message || '分类加载失败',
          icon: 'none',
        });
      }
    }
  },
});
