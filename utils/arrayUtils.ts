export function shuffle<T>(list: T[]): T[] {
  const result = [...list];
  // 从后往前遍历数组，每次随机选一个前面的元素交换位置
  for (let index = result.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    // 交换元素位置（ES6 解构赋值，左边是当前元素，右边是随机选中的元素）
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }

  return result;
}
