import { exportToJson } from '@/services/exportService';
import { pickImportData, importFromJsonFile } from '@/services/importService';

Page({
  async importData() {
    try {
      const fileData = await pickImportData();
      const res = await importFromJsonFile(fileData);
      if (res.success && res.data) {
        const {
          newCategoryCount,
          newCardCount,
          skippedCategoryCount,
          skippedCardCount,
          overwrittenCardCount,
        } = res.data;
        const content = [
          `新增 ${newCategoryCount} 个分类，${newCardCount} 张卡片。`,
          `跳过 ${skippedCategoryCount} 个分类，${skippedCardCount} 张卡片。`,
          `覆盖 ${overwrittenCardCount} 张卡片。`,
        ].join('\n');
        wx.showModal({
          title: '导入成功',
          content,
          showCancel: false,
        });
      } else {
        wx.showToast({ title: res.message || '导入失败', icon: 'none' });
      }
    } catch (_err) {
      wx.showToast({ title: '导入失败', icon: 'none' });
    }
  },
  async exportData() {
    exportToJson();
  },
});
