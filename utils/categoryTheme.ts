import { CATEGORY_THEMES } from '@/constants/themes';

// 通过字符串生成一个稳定的哈希值，确保同一个字符串总是得到同一个哈希值
function hashString(value: string) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    // 这里使用一个简单的哈希算法，将字符的Unicode值与之前的哈希值进行组合
    // hash << 5 是将之前的哈希值左移5位，相当于乘以32，这样可以增加哈希值的分布范围
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }

  return Math.abs(hash);
}

// 根据类别名称获取对应的主题颜色，使用哈希函数确保同一类别总是得到同一主题
export function getCategoryTheme(name: string) {
  // 取余以后将其映射到主题数组的索引范围内
  const index = hashString(name) % CATEGORY_THEMES.length;
  return CATEGORY_THEMES[index];
}
