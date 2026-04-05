import { exportToJson } from '../../services/exportService';
import { pickImportData, importFromJsonFile } from '../../services/importService';

Page({
  async importData() {
    try {
      const fileData = await pickImportData();
      const res = await importFromJsonFile(fileData);
      if (res.success && res.data) {
        wx.showModal({
          title: '导入成功',
          content: `成功导入 ${res.data.categoryViewCount || 0} 个分类和 ${res.data.cardCount || 0} 张卡片`,
          showCancel: false,
        });
      } else {
        wx.showToast({ title: res.message || '导入失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '导入失败', icon: 'none' });
    }
  },
  async exportData() {
    exportToJson();
  },
});
