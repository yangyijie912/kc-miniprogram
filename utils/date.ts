// 获取当天的日期键，用于存储和比较每日测验数据。
export function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 获取包含今天在内的最近 N 天窗口起点，默认只保留到日期粒度。
export function getTimestampDaysAgo(days: number, onlyDate: boolean = true): number {
  const date = new Date();
  date.setDate(date.getDate() - Math.max(days - 1, 0));
  if (onlyDate) {
    date.setHours(0, 0, 0, 0);
  }
  return date.getTime();
}

// 日期键转换为时间戳，默认转换为当天起点。
export function dateKeyToTimestamp(dateKey: string, onlyDate: boolean = true): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (onlyDate) {
    date.setHours(0, 0, 0, 0);
  }
  return date.getTime();
}
