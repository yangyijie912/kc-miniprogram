import { exportToJson } from '../../services/exportService';

Page({
  importData() {
    wx.showToast({
      title: '导入功能开发中',
      icon: 'none',
    });
  },
  async exportData() {
    exportToJson();
  },
});
