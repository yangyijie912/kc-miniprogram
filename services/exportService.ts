import { getCategories } from '@/services/categoryService';
import { getCards, loadDailyLearningStats } from '@/services/cardService';
import type { ExportData } from '@/types/migration';

// 导出的数据结构
export const buildExportData = async (): Promise<ExportData> => {
  const categoriesRes = await getCategories();
  const cardsRes = await getCards();

  const categories = categoriesRes.data || [];
  const cards = cardsRes.data?.list || [];
  const dailyLearningStats = loadDailyLearningStats();

  return {
    categories,
    cards,
    dailyLearningStats,
    version: '1.1',
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

const EXPORT_BACKUP_SLOT_COUNT = 5;
const EXPORT_BACKUP_RECORDS_KEY = 'knowledge-card.export-backup-records';
const MAX_EXPORT_FILE_NAME_LENGTH = 20;

type ExportRecord = {
  fileName: string;
  exportedAt: number;
};

function formatExportedAt() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function normalizeExportFileName(inputFileName?: string) {
  const trimmed = (inputFileName || '').trim();
  if (!trimmed) {
    return `${formatExportedAt()}.json`;
  }

  const baseName = trimmed.replace(/\.json$/i, '').slice(0, MAX_EXPORT_FILE_NAME_LENGTH);
  const safeName = baseName.replace(/[\\/:*?"<>|]/g, '_');
  return `${safeName}.json`;
}

function readExportRecords(): ExportRecord[] {
  const storedValue = wx.getStorageSync(EXPORT_BACKUP_RECORDS_KEY);
  if (!Array.isArray(storedValue)) {
    return [];
  }

  return storedValue.filter(
    (record): record is ExportRecord =>
      !!record &&
      typeof record === 'object' &&
      typeof record.fileName === 'string' &&
      typeof record.exportedAt === 'number',
  );
}

function saveExportRecords(records: ExportRecord[]) {
  wx.setStorageSync(EXPORT_BACKUP_RECORDS_KEY, records.slice(-EXPORT_BACKUP_SLOT_COUNT));
}

function getNextExportTarget(
  fileName: string,
  records: ExportRecord[],
): { fileName: string; previousFileName?: string } {
  const orderedRecords = [...records].sort((left, right) => left.exportedAt - right.exportedAt);
  const existingRecord = orderedRecords.find((record) => record.fileName === fileName);

  if (existingRecord) {
    return { fileName: existingRecord.fileName };
  }

  if (orderedRecords.length < EXPORT_BACKUP_SLOT_COUNT) {
    return { fileName };
  }

  const oldestRecord = orderedRecords.reduce((oldest, current) =>
    current.exportedAt < oldest.exportedAt ? current : oldest,
  );

  return { fileName, previousFileName: oldestRecord.fileName };
}

// 导出为 JSON 文件
export const exportToJson = async (inputFileName?: string): Promise<string> => {
  const jsonStr = await buildExportJson();
  const fs = wx.getFileSystemManager();
  const records = readExportRecords();
  const target = getNextExportTarget(normalizeExportFileName(inputFileName), records);
  const filePath = `${wx.env.USER_DATA_PATH}/${target.fileName}`;

  if (target.previousFileName && target.previousFileName !== target.fileName) {
    try {
      fs.unlinkSync(`${wx.env.USER_DATA_PATH}/${target.previousFileName}`);
    } catch {
      // 旧文件可能已经被用户删掉，轮转时忽略即可。
    }
  }

  return new Promise((resolve, reject) => {
    fs.writeFile({
      filePath,
      data: jsonStr,
      encoding: 'utf8',
      success: () => {
        const nextRecords = records.filter((record) => record.fileName !== target.fileName);
        nextRecords.push({
          fileName: target.fileName,
          exportedAt: Date.now(),
        });
        nextRecords.sort((left, right) => left.exportedAt - right.exportedAt);
        saveExportRecords(nextRecords);

        resolve(filePath);
      },
      fail: (err) => {
        reject(err);
      },
    });
  });
};
