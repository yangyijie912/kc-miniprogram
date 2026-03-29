import type { Category } from '../../types/card';

Page({
  data: {
    cardId: '' as string,
    categoryOptions: [] as Category[],
    formData: {
      categoryId: '',
      question: '',
      answer: '',
      content: '',
      tagsText: '',
    },
  },

  // 保存
  save() {},
  // 取消
  cancel() {},
  // 删除卡片
  removeCard() {},
});
