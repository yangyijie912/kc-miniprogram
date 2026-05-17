import categories from '@/data/category';
import { UNCATEGORIZED_CATEGORY, UNCATEGORIZED_ID } from '@/constants/category';
import { CATEGORY_STORAGE_KEY } from '@/constants/storageKeys';
import type { Category } from '@/types/card';
import {
  getCategoryThemeIndexByName,
  isValidCategoryThemeIndex,
  pickAvailableCategoryThemeIndex,
} from '@/utils/categoryTheme';
import { readStorageJson } from '@/utils/storage';
import type { ServiceResult } from '@/types/service';
import { generateUUID } from '@/utils/uuid';
import { success, fail } from '@/services/serviceHelper';
import { getCards, updateCard } from '@/services/cardService';

// 固定的未分类ID，确保在任何情况下都存在一个未分类
export const uncategorizedId = UNCATEGORIZED_ID;
const uncategorizedCategory: Category = UNCATEGORIZED_CATEGORY;

// 默认分类列表，从静态数据文件加载
const defaultCategories: Category[] = (categories as Category[]).map((category) => ({
  ...category,
}));

// 当前的分类列表，后续会从本地存储加载或使用默认分类
let categoryList: Category[] = [];

// 克隆一个分类对象，确保外部修改不会影响内部数据
function cloneCategory(category: Category): Category {
  return { ...category };
}

// 按 id 去重，避免默认数据和兜底补齐逻辑把同一个系统分类放进列表两次
function dedupeCategories(list: Category[]): Category[] {
  const seenIds = new Set<string>();

  return list.filter((category) => {
    if (seenIds.has(category.id)) {
      return false;
    }

    seenIds.add(category.id);
    return true;
  });
}

// 统一在服务层补齐 themeIndex，这样页面读取分类时只消费稳定结果。
function normalizeCategory(category: Category, index: number): Category {
  const normalizedCategory: Category = {
    ...category,
    name: category.name.trim(),
    sort:
      typeof category.sort === 'number' && Number.isFinite(category.sort) ? category.sort : index,
  };

  if (normalizedCategory.id === UNCATEGORIZED_ID || normalizedCategory.isSystem) {
    return {
      ...normalizedCategory,
      isSystem: true,
      themeIndex: undefined,
    };
  }

  return {
    ...normalizedCategory,
    themeIndex: isValidCategoryThemeIndex(normalizedCategory.themeIndex)
      ? normalizedCategory.themeIndex
      : getCategoryThemeIndexByName(normalizedCategory.name),
  };
}

function createThemeIndex(currentCategories: Category[], preferredThemeIndex?: number) {
  return pickAvailableCategoryThemeIndex(currentCategories, preferredThemeIndex);
}

// 对分类列表进行排序，首先按照 sort 字段升序排序，如果 sort 相同则按照 name 字段的字母顺序排序
function normalizeCategories(list: Category[]): Category[] {
  return dedupeCategories(list)
    .map((category, index) => normalizeCategory(cloneCategory(category), index))
    .sort((left, right) => left.sort - right.sort || left.name.localeCompare(right.name));
}

// 确保列表里有且只有一个未分类；如果默认数据本身没有这条，再统一补一次
function ensureUncategorizedCategory(list: Category[]): Category[] {
  return list.some((category) => category.id === uncategorizedId)
    ? list
    : [...list, uncategorizedCategory];
}

// 从本地存储加载分类列表，如果没有则使用默认分类，并保存到本地存储
function loadCategoriesFromStorage(): Category[] {
  const { hasStoredValue, parsed, value } = readStorageJson<unknown>(CATEGORY_STORAGE_KEY, null);

  if (!hasStoredValue) {
    // 本地没有数据时，优先使用静态默认分类；如果默认数据缺失未分类，再统一补齐一次
    categoryList = normalizeCategories(ensureUncategorizedCategory(defaultCategories));
    saveCategoriesToStorage(categoryList);
    return categoryList;
  }

  if (!parsed || !Array.isArray(value)) {
    // storage 被污染时直接回退到可用默认值，避免分类服务在初始化阶段崩掉。
    categoryList = normalizeCategories(ensureUncategorizedCategory(defaultCategories));
    saveCategoriesToStorage(categoryList);
    return categoryList;
  }

  const savedList = value as Category[];
  // 如果有数据，判断是否包含未分类，如果没有则添加一个
  categoryList = normalizeCategories(ensureUncategorizedCategory(savedList));
  saveCategoriesToStorage(categoryList);
  return categoryList;
}

// 保存整个分类列表到本地存储
function saveCategoriesToStorage(list: Category[]) {
  const normalizedList = normalizeCategories(list);
  wx.setStorageSync(CATEGORY_STORAGE_KEY, JSON.stringify(normalizedList));
  categoryList = normalizedList;
}

loadCategoriesFromStorage();

// 获取分类列表，支持根据参数过滤分类
export function getCategories(params?: Partial<Category>): ServiceResult<Category[]> {
  const currentList = loadCategoriesFromStorage();

  if (!params) {
    return success(currentList.map(cloneCategory));
  }

  return success(
    currentList
      .filter((category) => {
        return (Object.keys(params) as Array<keyof Category>).every(
          (key) => category[key] === params[key],
        );
      })
      .map(cloneCategory),
  );
}

// 根据 id 获取单个分类
export function getCategoryById(id: string): ServiceResult<Category | undefined> {
  const category = loadCategoriesFromStorage().find((item) => item.id === id);
  return category ? success(cloneCategory(category)) : fail('分类未找到');
}

// 添加新分类
export function addCategory(category: Omit<Category, 'id'>): ServiceResult<Category> {
  const currentList = loadCategoriesFromStorage();
  const newCategory: Category = {
    id: generateUUID(),
    ...category,
    themeIndex: createThemeIndex(currentList, category.themeIndex),
  };

  saveCategoriesToStorage([...currentList, newCategory]);
  return success(cloneCategory(newCategory));
}

// 更新分类
export function updateCategory(updates: Partial<Category>): ServiceResult<Category | null> {
  const currentList = loadCategoriesFromStorage();
  const index = currentList.findIndex((category) => category.id === updates.id);

  if (index === -1) {
    return fail('分类未找到');
  }

  const updatedCategory: Category = {
    ...currentList[index],
    ...updates,
  };

  currentList[index] = updatedCategory;
  saveCategoriesToStorage(currentList);
  return success(cloneCategory(updatedCategory));
}

// 删除分类
export function deleteCategory(id: string): ServiceResult<null> {
  if (id === uncategorizedId) {
    return fail('未分类不能删除');
  }
  const currentList = loadCategoriesFromStorage();
  const nextList = currentList.filter((category) => category.id !== id);
  if (nextList.length === currentList.length) {
    return fail('分类未找到');
  }
  // 将被删除的分类下的卡片移动到未分类
  const res = getCards({ categoryId: id });
  if (res.success && res.data) {
    res.data.list.forEach((card) => {
      updateCard({
        id: card.id,
        categoryId: uncategorizedId,
      });
    });
  }

  saveCategoriesToStorage(nextList);
  return success(null);
}

// 保存所有分类（覆盖式），用于导入时批量保存
export function saveAllCategories(categories: Category[]): ServiceResult<null> {
  saveCategoriesToStorage(categories);
  return success(null);
}

// 向上移动分类：和上一个可移动分类交换顺序
export function moveCategoryUp(id: string): ServiceResult<null> {
  if (id === uncategorizedId) {
    return fail('该分类不可移动');
  }

  const currentList = loadCategoriesFromStorage();
  const index = currentList.findIndex((category) => category.id === id);
  if (index === -1) {
    return fail('分类未找到');
  }

  const targetIndex = index - 1;
  if (targetIndex < 0) {
    return fail('已经在顶部');
  }
  if (currentList[targetIndex].id === uncategorizedId) {
    return fail('目标位置不可用');
  }

  const currentSort = currentList[index].sort;
  currentList[index].sort = currentList[targetIndex].sort;
  currentList[targetIndex].sort = currentSort;

  saveCategoriesToStorage(currentList);
  return success(null);
}

// 向下移动分类：和下一个可移动分类交换顺序
export function moveCategoryDown(id: string): ServiceResult<null> {
  if (id === uncategorizedId) {
    return fail('该分类不可移动');
  }

  const currentList = loadCategoriesFromStorage();
  const index = currentList.findIndex((category) => category.id === id);
  if (index === -1) {
    return fail('分类未找到');
  }

  const targetIndex = index + 1;
  if (targetIndex >= currentList.length) {
    return fail('已经在底部');
  }
  if (currentList[targetIndex].id === uncategorizedId) {
    return fail('目标位置不可用');
  }

  const currentSort = currentList[index].sort;
  currentList[index].sort = currentList[targetIndex].sort;
  currentList[targetIndex].sort = currentSort;

  saveCategoriesToStorage(currentList);
  return success(null);
}
