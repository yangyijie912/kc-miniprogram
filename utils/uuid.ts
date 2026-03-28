export function generateUUID(): string {
  // 生成一个简单的UUID，4是固定的代表版本号，y必须是8、9、a或b
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16); // 0-15随机数
    const v = c === 'x' ? r : (r % 4) + 8; // 根据字符决定生成的值
    return v.toString(16); // 转换为16进制字符串
  });
}
