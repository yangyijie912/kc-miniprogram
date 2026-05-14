import { UNCATEGORIZED_ID } from '@/constants/category';
import { CATEGORY_THEMES } from '@/constants/themes';
import type { Category } from '@/types/card';

// 通过字符串生成稳定哈希，给旧数据回退主题时继续沿用之前的颜色规则。
function hashString(value: string) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }

  return Math.abs(hash);
}

type CategoryThemeSource = Pick<Category, 'id' | 'name' | 'themeIndex' | 'isSystem'>;

const UNCATEGORIZED_THEME = {
  background: 'linear-gradient(135deg, #6b7280, #9ca3af)',
  color: '#f9fafb',
};

export function isValidCategoryThemeIndex(themeIndex: unknown): themeIndex is number {
  return (
    Number.isInteger(themeIndex) &&
    Number(themeIndex) >= 0 &&
    Number(themeIndex) < CATEGORY_THEMES.length
  );
}

// 旧分类首次升级时使用旧哈希结果补齐 themeIndex，避免名称不变但颜色漂移。
export function getCategoryThemeIndexByName(name: string) {
  return hashString(name) % CATEGORY_THEMES.length;
}

function countThemeUsage(categories: CategoryThemeSource[]) {
  const usage = Array.from({ length: CATEGORY_THEMES.length }, () => 0);

  categories.forEach((category) => {
    if (category.id === UNCATEGORIZED_ID || category.isSystem) {
      return;
    }

    if (isValidCategoryThemeIndex(category.themeIndex)) {
      usage[category.themeIndex] += 1;
    }
  });

  return usage;
}

// 新分类优先复用首选主题；如果主题池已经用完，则按最少使用次数轮转复用。
export function pickAvailableCategoryThemeIndex(
  categories: CategoryThemeSource[],
  preferredThemeIndex?: number,
) {
  const usage = countThemeUsage(categories);

  if (isValidCategoryThemeIndex(preferredThemeIndex) && usage[preferredThemeIndex] === 0) {
    return preferredThemeIndex;
  }

  const minUsage = Math.min(...usage);
  if (isValidCategoryThemeIndex(preferredThemeIndex) && usage[preferredThemeIndex] === minUsage) {
    return preferredThemeIndex;
  }

  const startIndex =
    categories.filter((category) => category.id !== UNCATEGORIZED_ID && !category.isSystem).length %
    CATEGORY_THEMES.length;

  for (let offset = 0; offset < CATEGORY_THEMES.length; offset += 1) {
    const index = (startIndex + offset) % CATEGORY_THEMES.length;
    if (usage[index] === minUsage) {
      return index;
    }
  }

  return 0;
}

export function getCategoryTheme(category: CategoryThemeSource | string) {
  if (typeof category === 'string') {
    return CATEGORY_THEMES[getCategoryThemeIndexByName(category)];
  }

  if (category.id === UNCATEGORIZED_ID || category.isSystem) {
    return UNCATEGORIZED_THEME;
  }

  const index = isValidCategoryThemeIndex(category.themeIndex)
    ? category.themeIndex
    : getCategoryThemeIndexByName(category.name);

  return CATEGORY_THEMES[index];
}
