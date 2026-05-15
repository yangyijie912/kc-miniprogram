import { addCategory, updateCategory, getCategoryById } from '@/services/categoryService';

Page({
  data: {
    categoryId: '' as string,
    formData: {
      name: '' as string,
      // 排序输入需要保留原始字符串，避免用户清空或编辑中间态时被立即转回 0。
      sort: '' as string,
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
        sort: event.detail.value,
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
    // 只在提交时解析排序，允许输入框保留空串等编辑态，避免被受控值强制回写成 0。
    const rawSort = formData.sort.trim();
    const sort = rawSort === '' ? 0 : Number(rawSort);
    if (!Number.isFinite(sort)) {
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
    const categoryId = options && options.id ? options.id : null;
    if (categoryId) {
      // 编辑模式，加载分类数据
      const res = getCategoryById(categoryId);
      if (res.success && res.data) {
        this.setData({
          formData: {
            name: res.data.name,
            sort: String(res.data.sort),
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
