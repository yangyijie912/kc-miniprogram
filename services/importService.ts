import { getCategories, saveAllCategories } from '@/services/categoryService';
import { getCards, saveAllCards } from '@/services/cardService';
import { fail, success } from '@/services/serviceHelper';
import { generateUUID } from '@/utils/uuid';
import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME } from '@/constants/category';
import type { ImportData, ImportResult } from '@/types/migration';
import type { RawCard, Card, Category } from '@/types/card';
import type { ServiceResult } from '@/types/service';

/**
 * ==============================================================
 * 以下是和平台相关的文件操作接口，主要是小程序
 * ==============================================================
 */

// 选文件读文本
export function pickImportData(): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extensions: ['json'],
      success: (res) => {
        const file = res.tempFiles[0];
        if (file) {
          wx.getFileSystemManager().readFile({
            filePath: file.path,
            encoding: 'utf-8',
            success: (fileRes) => {
              try {
                resolve(fileRes.data as string);
              } catch (_error) {
                reject(new Error('读取文件失败'));
              }
            },
            fail: (err) => {
              reject(err);
            },
          });
        } else {
          reject(new Error('未选择文件'));
        }
      },
      fail: (err) => {
        reject(err);
      },
    });
  });
}

/**
 * ==============================================================
 * 以下是和平台无关的导入数据处理逻辑，包括数据格式验证、分类合并、卡片合并等核心功能。
 * ==============================================================
 */

// 判断导入的数据是否符合 ImportData 的结构，确保数据的有效性和安全性
function isImportData(data: unknown): data is ImportData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    Array.isArray(obj.categories) &&
    Array.isArray(obj.cards) &&
    typeof obj.version === 'string' &&
    typeof obj.exportedAt === 'number'
  );
}

// 解析JSON
function parseImportData(jsonStr: string): ImportData {
  let data: unknown;
  try {
    data = JSON.parse(jsonStr);
  } catch (error) {
    throw new Error('解析JSON失败', { cause: error });
  }

  if (!isImportData(data)) {
    throw new Error('数据格式不正确');
  }

  return data;
}

/**
 * example:
 * 系统数据分类：[{id: '1', name: 'React'}, {id: '2', name: 'Vue'}]
 * 导入数据分类：[
 * {id: '1', name: 'React'},
 * {id: '2', name: 'JS'},
 * {id: '3', name: 'Vue'},
 * {id: '4', name: 'CSS'}
 * ]
 * 合并后系统分类：[
 * {id: '1', name: 'React'}, // ID和名称都匹配，认为是同一个分类，不重复添加
 * {id: '2', name: 'Vue'},  // 名称匹配但ID不匹配的分类, 认为是同一个分类，保留系统中已有的分类信息
 * {id: '1002', name: 'JS'},  // ID匹配但名称不匹配的分类，原分类不动，重新创建新分类JS
 * {id: '4', name: 'CSS'} // ID和名称都不匹配的分类，认为是新分类，添加到列表中
 * ]
 * 总结：
 * 分类名优先，ID 只拿来辅助判断；同名视为同类，不同名再看是不是 ID 冲突，冲突就新建分类
 */

// 导入结果统计对象，记录整个导入过程中各种情况的数量，最终返回给用户
const countTotal = {
  newCategoryCount: 0,
  newCardCount: 0,
  skippedCategoryCount: 0,
  skippedCardCount: 0,
  overwrittenCardCount: 0,
};

type MergeCategoriesResult = {
  mergedCategories: Category[];
  importedCategoryMap: Map<string, string>; // key: 导入分类ID，value: 系统分类ID，用于后续关联卡片时转换导入的 categoryId
};

// 处理导入的分类数据，返回合并后的分类列表和导入分类ID到系统分类ID的映射关系
function mergeCategories(
  importedCategories: ImportData['categories'],
  currentCategories: Category[],
): MergeCategoriesResult {
  const mergedCategories: Category[] = [...currentCategories];
  const importedCategoryMap: Map<string, string> = new Map();

  // 构建当前分类的名称和ID映射，方便后续匹配
  const nameMap = new Map(currentCategories.map((cat) => [cat.name, cat]));
  const idMap = new Map(currentCategories.map((cat) => [cat.id, cat]));

  for (const importedCategory of importedCategories) {
    const importedName = importedCategory.name.trim();
    const importedId = importedCategory.id;
    if (!importedName) {
      countTotal.skippedCategoryCount += 1;
      continue; // 跳过名称为空的分类
    }

    // 未分类是系统保留分类，直接跳过
    if (importedId === UNCATEGORIZED_ID || importedName === UNCATEGORIZED_NAME) {
      importedCategoryMap.set(importedId, UNCATEGORIZED_ID); // 无论ID还是名称匹配，都映射到系统的未分类ID
      countTotal.skippedCategoryCount += 1;
      continue;
    }

    const nameMatch = nameMap.get(importedName);
    const idMatch = idMap.get(importedId);

    // 1、按名称匹配，认为是同一个分类，不重复添加
    if (nameMatch) {
      importedCategoryMap.set(importedId, nameMatch.id);
      countTotal.skippedCategoryCount += 1;
      continue;
    }

    // 2、按ID匹配但名称不匹配，保留旧分类，重新创建一个新分类
    if (idMatch) {
      const newCategory: Category = {
        id: generateUUID(),
        name: importedName,
        sort: mergedCategories.length, // 新分类排序值放到最后
      };
      mergedCategories.push(newCategory);
      importedCategoryMap.set(importedId, newCategory.id);
      nameMap.set(importedName, newCategory); // 更新名称映射，避免后续同名分类重复添加
      idMap.set(importedId, newCategory); // 更新ID映射，避免后续ID冲突重复添加
      countTotal.newCategoryCount += 1;
      continue;
    }

    // 3、名称和ID都不匹配，认为是新分类，添加到列表中
    const newCategory: Category = {
      ...importedCategory,
      sort: importedCategory.sort ?? mergedCategories.length, // 保留原排序值，或者放到最后
    };
    mergedCategories.push(newCategory);
    importedCategoryMap.set(importedId, newCategory.id);
    nameMap.set(importedName, newCategory);
    idMap.set(importedId, newCategory);
    countTotal.newCategoryCount += 1;
  }

  return {
    mergedCategories,
    importedCategoryMap,
  };
}

// 分类合并后，处理分类ID的映射关系，确保导入的卡片数据能够正确关联到合并后的分类
function transformImportedCategoryId(rawCard: RawCard, mergeResult: MergeCategoriesResult): string {
  const mergedCategories = mergeResult.mergedCategories;
  const importedCategoryMap = mergeResult.importedCategoryMap;
  // 从原始数据中获取分类名称和ID
  const rawCategoryName = rawCard.category?.trim();
  const rawCategoryId = rawCard.categoryId;

  // 1、如果卡片的 categoryId 在导入分类ID映射中，说明这个分类在合并后被保留或新建了，直接使用映射后的系统分类ID
  if (rawCategoryId && importedCategoryMap.has(rawCategoryId)) {
    return importedCategoryMap.get(rawCategoryId)!;
  }

  // 2、按原始卡片名称获取匹配的分类，优先按名称匹配
  if (rawCategoryName) {
    const matched = mergedCategories.find((category) => category.name === rawCategoryName);
    if (matched) {
      return matched.id;
    }
  }

  // 3、其余情况，返回未分类
  return UNCATEGORIZED_ID;
}

// 把导入的原始卡片数据转换成系统的卡片数据结构
function normalizeImportedCard(rawCard: RawCard, mergeResult: MergeCategoriesResult): Card | null {
  if (!rawCard.question || !rawCard.answer) {
    console.warn(
      `[importService] 导入卡片数据不完整，缺少 question 或 answer 字段，已跳过。rawCard=${JSON.stringify(rawCard)}`,
    );
    countTotal.skippedCardCount += 1;
    return null; // 跳过数据不完整的卡片
  }
  return {
    id: rawCard.id || generateUUID(),
    categoryId: transformImportedCategoryId(rawCard, mergeResult),
    question: rawCard?.question,
    answer: rawCard?.answer,
    content: rawCard?.content,
    tags: rawCard?.tags,
    status: rawCard?.status,
    createdAt: rawCard?.createdAt || Date.now(), // 时间戳
    updatedAt: rawCard?.updatedAt,
  };
}

// 合并卡片
function mergeCards(
  importedCards: ImportData['cards'],
  currentCards: Card[],
  mergeResult: MergeCategoriesResult,
): Card[] {
  const cardsMap = new Map(currentCards.map((card) => [card.id, card]));
  for (const rawCard of importedCards) {
    const normalizedCard = normalizeImportedCard(rawCard, mergeResult);
    if (normalizedCard) {
      cardsMap.set(normalizedCard.id, normalizedCard); // ID 冲突时覆盖原有卡片
      const existed = cardsMap.has(normalizedCard.id);
      if (existed) {
        countTotal.overwrittenCardCount += 1;
      } else {
        countTotal.newCardCount += 1;
      }
    }
  }

  return Array.from(cardsMap.values());
}

// 最终导入流程
export async function importFromJsonFile(jsonStr: string): Promise<ServiceResult<ImportResult>> {
  // 重置计数器，确保每次导入都是独立统计
  countTotal.newCategoryCount = 0;
  countTotal.newCardCount = 0;
  countTotal.skippedCategoryCount = 0;
  countTotal.skippedCardCount = 0;
  countTotal.overwrittenCardCount = 0;
  try {
    // 1、解析数据
    const importData = parseImportData(jsonStr);
    // 2、获取当前系统数据
    const currentCategories = getCategories().data || [];
    const currentCards = getCards().data?.list || [];
    // 3、合并分类和卡片数据，并处理分类ID映射关系
    const mergeResult = mergeCategories(importData.categories, currentCategories);
    const mergedCategories = mergeResult.mergedCategories;
    const mergedCards = mergeCards(importData.cards, currentCards, mergeResult);
    // 4、批量保存合并后的分类和卡片
    const cardRes = saveAllCards(mergedCards);
    if (!cardRes.success) {
      return fail(cardRes.message || '导入卡片失败');
    }
    const categoryRes = saveAllCategories(mergedCategories);
    if (!categoryRes.success) {
      return fail(categoryRes.message || '导入分类失败');
    }
    // 5、返回导入结果
    return success({
      categoryCount: mergedCategories.length,
      categoryViewCount: getVisibleCategoryCount(mergedCategories, mergedCards),
      cardCount: mergedCards.length,
      newCategoryCount: countTotal.newCategoryCount,
      newCardCount: countTotal.newCardCount,
      skippedCategoryCount: countTotal.skippedCategoryCount,
      skippedCardCount: countTotal.skippedCardCount,
      overwrittenCardCount: countTotal.overwrittenCardCount,
    });
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : '导入失败');
  }
}

// 未分类处理：如果导入的卡片数据没有未分类，categoryCount不计算未分类，有则计算
function getVisibleCategoryCount(categories: Category[], cards: Card[]): number {
  // 判断是否有未分类的卡片
  const hasUncategorizedCards = cards.some((card) => card.categoryId === UNCATEGORIZED_ID);
  return categories.filter((cat) => {
    if (cat.id === UNCATEGORIZED_ID) {
      return hasUncategorizedCards; // 只有当有未分类卡片时，才显示未分类
    }
    return true; // 其他分类正常显示
  }).length;
}
