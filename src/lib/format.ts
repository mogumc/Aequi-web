// EXPORTS: formatCredits, formatTime, formatDateTime, formatDuration
import { format, fromUnixTime } from 'date-fns';

/** 积分为四位小数字符串，展示时去掉多余的尾零 */
export function formatCredits(credits: string | null | undefined): string {
  const n = Number(credits ?? 0);
  if (Number.isNaN(n)) return String(credits ?? '0');
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 4 });
}

/** 秒级 Unix 时间戳 → HH:mm:ss */
export function formatTime(ts: number | null | undefined): string {
  if (!ts) return '-';
  return format(fromUnixTime(ts), 'HH:mm:ss');
}

/** 秒级 Unix 时间戳 → yyyy-MM-dd HH:mm */
export function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return '-';
  return format(fromUnixTime(ts), 'yyyy-MM-dd HH:mm');
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
