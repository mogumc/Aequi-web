/** 倍率的刻度：10000 = 1.0 倍（万分比整数）。 */
export const MULTIPLIER_SCALE = 10_000;

/** 把万分比格式化成四位小数字符串。 */
export function formatMultiplier(bp: number | undefined): string {
  const value = bp ?? MULTIPLIER_SCALE;
  const whole = Math.trunc(value / MULTIPLIER_SCALE);
  const fraction = Math.abs(value % MULTIPLIER_SCALE);
  return `${whole}.${String(fraction).padStart(4, '0')}`;
}

/** 把四位小数字符串解析成万分比；非法输入返回 null（调用方应保持原值）。 */
export function parseMultiplier(text: string): number | null {
  const value = Number(text.trim());
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * MULTIPLIER_SCALE);
}
