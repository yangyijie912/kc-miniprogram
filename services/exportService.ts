import { getCategories } from './categoryService';
import { getCards } from './cardService';
import type { ExportData } from '../types/migration';

// 导出的数据结构
export const buildExportData = async (): Promise<ExportData> => {
  const categoriesRes = await getCategories();
  const cardsRes = await getCards();

  const categories = categoriesRes.data || [];
  const cards = cardsRes.data?.list || [];

  return {
    categories,
    cards,
    version: '1.0',
    exportedAt: Date.now(),
  };
};

// 转成 JSON 字符串
export const buildExportJson = async () => {
  const data = await buildExportData();
  return JSON.stringify(
    data,
    (key, value) => {
      if (value === undefined) {
        return undefined;
      }
      return value;
    },
    2,
  );
};

// 导出为 JSON 文件
export const exportToJson = async () => {
  const jsonStr = await buildExportJson();
  const fs = wx.getFileSystemManager();
  const filePath = `${wx.env.USER_DATA_PATH}/export_${Date.now()}.json`;

  fs.writeFile({
    filePath,
    data: jsonStr,
    encoding: 'utf8',
    success: () => {
      wx.showToast({ title: '导出成功' });

      wx.openDocument({
        filePath,
      });
    },
    fail: (err) => {
      console.error('导出失败', err);
      wx.showToast({ title: '导出失败', icon: 'none' });
    },
  });
};
