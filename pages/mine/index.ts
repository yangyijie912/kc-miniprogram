import { exportToJson } from '@/services/exportService';
import { pickImportData, importFromJsonFile } from '@/services/importService';
import type { ImportMode, MergeConfig } from '@/types/migration';

const MAX_EXPORT_FILE_NAME_LENGTH = 20;

type ModeOption = 'merge' | 'overwrite';
type StatusStrategyOption = 'imported' | 'clear';
type ConflictStrategyOption = 'skip' | 'overwrite';

Page({
  data: {
    exportDialogVisible: false,
    importDialogVisible: false,
    pendingExport: false,
    pendingImport: false,
    exportFileName: '',
    maxExportFileNameLength: MAX_EXPORT_FILE_NAME_LENGTH,
    importMode: 'merge' as ImportMode,
    importStatusStrategy: 'imported' as MergeConfig['statusStrategy'],
    importConflictStrategy: 'skip' as MergeConfig['conflictStrategy'],
  },

  goToStats() {
    wx.navigateTo({
      url: '/pages/stats/index',
    });
  },

  // 仅用于弹层内容区拦截冒泡，避免点击卡片本体时把遮罩关闭掉。
  noop() {},

  openExportDialog() {
    this.setData({
      exportDialogVisible: true,
      exportFileName: '',
    });
  },

  closeExportDialog() {
    if (this.data.pendingExport) {
      return;
    }

    this.setData({
      exportDialogVisible: false,
      exportFileName: '',
    });
  },

  onExportFileNameInput(event: WechatMiniprogram.Input) {
    this.setData({
      exportFileName: event.detail.value,
    });
  },

  openImportDialog() {
    this.setData({
      importDialogVisible: true,
      importMode: 'merge',
      importStatusStrategy: 'imported',
      importConflictStrategy: 'skip',
    });
  },

  closeImportDialog() {
    if (this.data.pendingImport) {
      return;
    }

    this.setData({
      importDialogVisible: false,
    });
  },

  onImportModeChange(event: WechatMiniprogram.BaseEvent) {
    const importMode = event.currentTarget.dataset.mode as ModeOption;
    this.setData({
      importMode,
    });
  },

  onImportStatusStrategyChange(event: WechatMiniprogram.BaseEvent) {
    const importStatusStrategy = event.currentTarget.dataset.strategy as StatusStrategyOption;
    this.setData({
      importStatusStrategy,
    });
  },

  onImportConflictStrategyChange(event: WechatMiniprogram.BaseEvent) {
    const importConflictStrategy = event.currentTarget.dataset.strategy as ConflictStrategyOption;
    this.setData({
      importConflictStrategy,
    });
  },

  // 导入结果文案按模式拆开，避免覆盖导入和合并导入混成一套提示。
  showImportResult(result: Awaited<ReturnType<typeof importFromJsonFile>>, mode: ImportMode) {
    if (result.success && result.data) {
      const content =
        mode === 'overwrite'
          ? [
              `覆盖后当前分类 ${result.data.categoryViewCount} 个，卡片 ${result.data.cardCount} 张`,
              `跳过 ${result.data.skippedCategoryCount} 个分类，${result.data.skippedCardCount} 张卡片`,
            ].join('\n')
          : [
              `新增 ${result.data.newCategoryCount} 个分类，${result.data.newCardCount} 张卡片`,
              `跳过 ${result.data.skippedCategoryCount} 个分类，${result.data.skippedCardCount} 张卡片`,
              `覆盖 ${result.data.overwrittenCardCount} 张卡片`,
            ].join('\n');

      wx.showModal({
        title: '导入成功',
        content,
        showCancel: false,
      });
      return;
    }

    wx.showToast({ title: result.message || '导入失败', icon: 'none' });
  },

  async importData() {
    this.openImportDialog();
  },

  async confirmImport() {
    const mergeConfig: MergeConfig | undefined =
      this.data.importMode === 'merge'
        ? {
            statusStrategy: this.data.importStatusStrategy,
            conflictStrategy: this.data.importConflictStrategy,
          }
        : undefined;

    try {
      this.setData({
        pendingImport: true,
        importDialogVisible: false,
      });

      const fileData = await pickImportData();
      const res = await importFromJsonFile(fileData, this.data.importMode, mergeConfig);
      this.showImportResult(res, this.data.importMode);
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败';
      console.error('[mine] 导入失败', error);
      wx.showModal({
        title: '导入失败',
        content: message,
        showCancel: false,
      });
    } finally {
      this.setData({
        pendingImport: false,
      });
    }
  },

  async exportData() {
    this.openExportDialog();
  },

  async confirmExport() {
    const fileName = this.data.exportFileName.trim();

    if (fileName.length > MAX_EXPORT_FILE_NAME_LENGTH) {
      wx.showToast({
        title: `文件名不能超过${MAX_EXPORT_FILE_NAME_LENGTH}个字`,
        icon: 'none',
      });
      return;
    }

    try {
      this.setData({
        pendingExport: true,
      });
      wx.showLoading({ title: '导出中' });

      const filePath = await exportToJson(fileName || undefined);

      this.setData({
        exportDialogVisible: false,
        exportFileName: '',
      });

      wx.showModal({
        title: '导出成功',
        content: `已保存到：\n${filePath}`,
        confirmText: '打开文件',
        cancelText: '关闭',
        success: (res) => {
          if (res.confirm) {
            wx.openDocument({ filePath });
          }
        },
      });
    } catch (error) {
      wx.showModal({
        title: '导出失败',
        content: error instanceof Error ? error.message : '导出失败',
        showCancel: false,
      });
    } finally {
      this.setData({
        pendingExport: false,
      });
      wx.hideLoading();
    }
  },
});
