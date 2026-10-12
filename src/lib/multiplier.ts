/** 倍率的刻度：10000 = 1.0 倍（万分比整数）。 */
export const MULTIPLIER_SCALE = 10_000;

/** 倍率精度：0.01，即万分比必须是 100 的倍数（两位小数）。 */
const MULTIPLIER_STEP = 100;

/** 把万分比格式化成两位小数（0.01 精度），例如 `15000` → `"1.50"`。 */
export function formatMultiplier(bp: number | undefined): string {
  const value = bp ?? MULTIPLIER_SCALE;
  const whole = Math.trunc(value / MULTIPLIER_SCALE);
  const fraction = Math.round(Math.abs(value % MULTIPLIER_SCALE) / MULTIPLIER_STEP);
  return `${whole}.${String(fraction).padStart(2, '0')}`;
}

/** 把倍率字符串解析成万分比；非法输入返回 null（调用方应保持原值）。
 *
 * 倍率精度为 0.01：输入被四舍五入到两位小数（万分比 100 的倍数），
 * 例如 `1.055` 会落到 `1.06`——与后端「拒绝超过两位小数」的口径一致，
 * 只是前端代为取整，省得用户在中间态被卡住。
 */
export function parseMultiplier(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round((value * MULTIPLIER_SCALE) / MULTIPLIER_STEP) * MULTIPLIER_STEP;
}
