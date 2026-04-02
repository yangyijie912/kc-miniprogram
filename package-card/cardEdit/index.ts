import type { Category } from '../../types/card';
import { getCategories } from '../../services/categoryService';
import { getCardById, updateCard, addCard, deleteCard } from '../../services/cardService';
import category from '@/data/category';

Page({
  data: {
    cardId: '' as string,
    categoryOptions: [] as Category[],
    formData: {
      categoryId: '',
      categoryName: '',
      categoryIndex: 0,
      question: '',
      answer: '',
      content: '',
      tagsText: '',
    },
  },

  // 加载分类列表
  loadCategories(categoryId?: string) {
    const res = getCategories();
    if (res.success && res.data) {
      if (categoryId) {
        const categoryInfo = res.data.find((cat) => cat.id === categoryId);
        if (categoryInfo) {
          this.setData({
            'formData.categoryName': categoryInfo.name,
            'formData.categoryIndex': res.data.indexOf(categoryInfo),
          });
        }
      }
      this.setData({
        categoryOptions: res.data,
      });
      return;
    }
    this.setData({
      categoryOptions: [],
    });
    wx.showToast({
      title: res.message || '分类加载失败',
      icon: 'none',
    });
  },

  // 加载卡片数据
  loadCard(id: string) {
    const res = getCardById(id);

    if (res.success && res.data) {
      const categoryInfo = this.data.categoryOptions.find((cat) => cat.id === res.data.categoryId);
      this.setData({
        'formData.categoryId': res.data.categoryId,
        'formData.categoryName': categoryInfo ? categoryInfo.name : '',
        'formData.categoryIndex': categoryInfo
          ? this.data.categoryOptions.indexOf(categoryInfo)
          : -1,
        'formData.question': res.data.question,
        'formData.answer': res.data.answer,
        'formData.content': res.data.content || '',
        'formData.tagsText': res.data.tags?.join('、') || '',
      });
      return;
    }

    wx.showToast({
      title: res.message || '卡片加载失败',
      icon: 'none',
    });
  },

  // 输入事件处理函数
  onContentInput(e: WechatMiniprogram.CustomEvent) {
    this.setData({
      'formData.content': e.detail?.value || '',
    });
  },

  onQuestionInput(e: WechatMiniprogram.Input) {
    this.setData({
      'formData.question': e.detail.value,
    });
  },

  onAnswerInput(e: WechatMiniprogram.Input) {
    this.setData({
      'formData.answer': e.detail.value,
    });
  },

  onTagsInput(e: WechatMiniprogram.Input) {
    this.setData({
      'formData.tagsText': e.detail.value,
    });
  },

  // 分类选择处理函数
  onCategoryChange(e: WechatMiniprogram.PickerChange) {
    const index = e.detail.value as unknown;
    const selectedCategory = this.data.categoryOptions[Number(index)];
    if (selectedCategory) {
      this.setData({
        'formData.categoryId': selectedCategory.id,
        'formData.categoryName': selectedCategory.name,
        'formData.categoryIndex': Number(index),
      });
    }
  },

  // 表单验证
  validateForm(formData: typeof this.data.formData) {
    const validateRules = [
      {
        field: 'categoryId',
        message: '请选择分类',
        validate: () => !!formData.categoryId,
      },
      {
        field: 'question',
        message: '问题不能为空',
        validate: () => !!formData.question.trim(),
      },
      {
        field: 'answer',
        message: '答案不能为空',
        validate: () => !!formData.answer.trim(),
      },
    ];
    for (const rule of validateRules) {
      if (!rule.validate()) {
        wx.showToast({
          title: rule.message,
          icon: 'none',
        });
        return false;
      }
    }
    return true;
  },

  // 保存
  save() {
    console.log('保存卡片，数据：', this.data.formData);
    const isValid = this.validateForm(this.data.formData);
    if (!isValid) {
      return;
    }
    const { formData: form, cardId } = this.data;
    // 传递的参数
    const params = {
      categoryId: form.categoryId,
      question: form.question.trim(),
      answer: form.answer.trim(),
      content: form.content ? form.content.trim() : '',
      tags: form.tagsText
        .split(/[,、，]/)
        .map((tag) => tag.trim())
        .filter((tag) => tag),
    };

    let res = undefined;

    if (cardId) {
      res = updateCard({ id: cardId, ...params });
    } else {
      res = addCard(params);
    }

    if (res.success) {
      wx.showToast({
        title: res.message || '保存成功',
        icon: 'success',
      });
      wx.navigateBack();
    } else {
      wx.showToast({
        title: res.message || '保存失败',
        icon: 'none',
      });
    }
  },

  // 取消
  cancel() {
    wx.navigateBack();
  },

  // 删除卡片
  removeCard() {
    wx.showModal({
      title: '确认删除',
      content: '删除后将无法恢复，请确认已经导出备份。',
      confirmText: '删除',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.performDelete();
        }
      },
    });
  },

  performDelete() {
    if (!this.data.cardId) {
      wx.showToast({
        title: '卡片数据异常，无法删除',
        icon: 'none',
      });
      return;
    }

    const res = deleteCard(this.data.cardId);

    if (res.success) {
      wx.showToast({
        title: res.message || '删除成功',
        icon: 'success',
      });
      wx.navigateBack({
        delta: 2,
      });
    } else {
      wx.showToast({
        title: res.message || '删除失败',
        icon: 'none',
      });
    }
  },

  onLoad(options) {
    // 新增卡片时，如果传入了 categoryId 参数，优先使用这个参数
    if (options?.categoryId && !options?.id) {
      this.loadCategories(options.categoryId);
      this.setData({
        'formData.categoryId': options.categoryId,
      });
    } else {
      this.loadCategories();
    }
    this.setData({
      cardId: options?.id || null,
    });
    if (options?.id) {
      this.loadCard(options?.id);
      return;
    }
  },
});
