// EXPORTS: formatCredits, formatCompact, formatTime, formatDateTime, formatDuration
import { format, fromUnixTime } from 'date-fns';

/** 积分为四位小数字符串，展示时去掉多余的尾零 */
export function formatCredits(credits: string | null | undefined): string {
  const n = Number(credits ?? 0);
  if (Number.isNaN(n)) return String(credits ?? '0');
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 4 });
}

/**
 * 大数缩写：≥1000 起缩写为 K / M / B，避免长数字撑爆统计卡。
 * 千以内原样展示（保留 ≤4 位小数）；缩写保留 1 位小数，.0 去掉。
 * 需要精确值时由调用方在 tooltip 里补 formatCredits / 原始数字。
 */
export function formatCompact(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return String(value);
  if (Math.abs(n) < 1000) {
    return n.toLocaleString('zh-CN', { maximumFractionDigits: 4 });
  }
  const tiers: [number, string][] = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [size, suffix] of tiers) {
    if (Math.abs(n) >= size) {
      const scaled = n / size;
      const text = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, '');
      return `${text}${suffix}`;
    }
  }
  return String(n);
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
