import categories from '../data/category';
import { UNCATEGORIZED_CATEGORY, UNCATEGORIZED_ID } from '../constants/category';
import { CATEGORY_STORAGE_KEY } from '../constants/storageKeys';
import type { Category } from '../types/card';
import type { ServiceResult } from '../types/service';
import { generateUUID } from '../utils/uuid';
import { success, fail } from './serviceHelper';
import { getCards, updateCard } from './cardService';

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

// 对分类列表进行排序，首先按照 sort 字段升序排序，如果 sort 相同则按照 name 字段的字母顺序排序
function normalizeCategories(list: Category[]): Category[] {
  return list
    .map(cloneCategory)
    .sort((left, right) => left.sort - right.sort || left.name.localeCompare(right.name));
}

// 从本地存储加载分类列表，如果没有则使用默认分类，并保存到本地存储
function loadCategoriesFromStorage(): Category[] {
  const saved = wx.getStorageSync(CATEGORY_STORAGE_KEY);

  if (!saved) {
    // 本地没有数据，使用默认分类并添加未分类
    categoryList = normalizeCategories([...defaultCategories, uncategorizedCategory]);
    saveCategoriesToStorage(categoryList);
    return categoryList;
  }

  const savedList = JSON.parse(saved) as Category[];
  // 如果有数据，判断是否包含未分类，如果没有则添加一个
  if (savedList.findIndex((category) => category.id === uncategorizedId) === -1) {
    savedList.push(uncategorizedCategory);
  }
  categoryList = normalizeCategories(savedList);
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
