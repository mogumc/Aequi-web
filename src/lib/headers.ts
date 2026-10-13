/**
 * 自定义请求头的编辑期工具。
 *
 * **权威校验在后端**（`service::upstream::normalize_headers`）。这里只是用同一套
 * 口径做即时提示：改一个头名不值得先发一趟请求再等 400 回来。所以两边要一起改，
 * 后端加一条约束，这里跟着加。
 *
 * 另外，这两个函数的形状刻意与后端一致——「空白行 = 还没填」不算错误，
 * 「名字重复」「HTTP 栈管的头」才算。
 */

import type { IBlockHeader } from '@/data/admin';

/** 编辑期的一行：允许半成品（只填了名字、或整行还空着）。 */
export type IHeaderRow = IBlockHeader;

/**
 * 由 HTTP 栈自己管理的头，不允许配置。
 *
 * 与后端 `FORBIDDEN_HEADERS` 同一份：请求体长度、连接语义、升级协商这些
 * 配了只会让请求畸形，浏览器的 fetch 也禁同一批。
 */
const FORBIDDEN_HEADERS = new Set([
  'content-length',
  'transfer-encoding',
  'connection',
  'upgrade',
  'expect',
  'te',
  'trailer',
  'keep-alive',
]);

/** 条数上限，与后端一致。 */
export const MAX_HEADERS = 32;
/** 单个头值的字符数上限，与后端一致。 */
export const MAX_HEADER_VALUE_LEN = 4096;

/** HTTP 头名的合法字符集（RFC 9110 的 token）。 */
const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/** 整行都是空白——刚加的一行还没填，不该当成错误。 */
function isBlankRow(row: IHeaderRow): boolean {
  return row.name.trim() === '' && row.value.trim() === '';
}

/** 去掉空白行、去掉首尾空白，得到可以提交的列表。 */
export function cleanHeaders(rows: IHeaderRow[]): IHeaderRow[] {
  return rows
    .filter((row) => !isBlankRow(row))
    .map((row) => ({ name: row.name.trim(), value: row.value.trim() }));
}

/**
 * 第一个问题；没问题返回 `null`。
 *
 * 在**清理之后**的列表上判——半成品行留给「还没填完」，不算错。
 * 提示里带上具体是哪个头，不然一堆条目里让人自己找。
 */
export function findHeaderProblem(rows: IHeaderRow[]): string | null {
  const cleaned = cleanHeaders(rows);

  if (cleaned.length > MAX_HEADERS) {
    return `自定义请求头最多 ${MAX_HEADERS} 条`;
  }

  const seen = new Set<string>();
  for (const row of cleaned) {
    if (!row.name) {
      return '有一行只填了值、没填头名';
    }
    if (!TOKEN.test(row.name)) {
      return `头名「${row.name}」不合法——不能含空格、冒号这类字符`;
    }
    if (/[\r\n]/.test(row.value)) {
      return `头 ${row.name} 的值不能换行`;
    }
    // 按**码点**数而不是 UTF-16 长度：后端用 Rust 的 `chars().count()`，
    // 两边要量同一件事（对代理对字符才有差别，但没必要留这个口子）。
    if ([...row.value].length > MAX_HEADER_VALUE_LEN) {
      return `头 ${row.name} 的值不能超过 ${MAX_HEADER_VALUE_LEN} 个字符`;
    }

    // 头名大小写不敏感，去重与禁用名单都按小写比对。
    const lower = row.name.toLowerCase();
    if (FORBIDDEN_HEADERS.has(lower)) {
      return `头 ${row.name} 由 HTTP 栈自己管理，不能配在块上`;
    }
    if (seen.has(lower)) {
      return `头 ${row.name} 配了两次——同名会覆盖，留一条就行`;
    }
    seen.add(lower);
  }

  return null;
}
