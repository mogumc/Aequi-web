import { useState } from 'react';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * 网关掌管的请求体键——与后端 `PROTECTED_BODY_KEYS` 同步。
 *
 * 前端挡一道只是为了让用户早点看到问题；真正的关口在后端（那里会 400）。
 * 名单不同步时以后端为准。
 */
const PROTECTED_EXTRA_BODY_KEYS = [
  'model',
  'messages',
  'contents',
  'input',
  'system',
  'system_instruction',
  'stream',
  'stream_options',
  'tools',
  'tool_choice',
];

/**
 * 模型级额外请求体输入（JSON 对象，草稿模式）。
 *
 * 上游块编辑器与模型页的路由弹窗共用一份——两处都要能配这个字段，
 * 规则也只能有一份。
 *
 * 编辑期间**不回写**受控值再回灌显示——中途的 `{"top_k": 4` 不是合法
 * JSON，强行回写会把用户正在打的字吃掉。合法即提交，非法只提示。
 */
export function ExtraBodyInput({
  id,
  value,
  onCommit,
}: {
  /** 输入框 id（同一页可能有多个实例，必须唯一）。 */
  id: string;
  value?: Record<string, unknown>;
  onCommit: (next: Record<string, unknown> | undefined) => void;
}) {
  const [draft, setDraft] = useState(() => (value ? JSON.stringify(value) : ''));
  const [error, setError] = useState<string | null>(null);

  const handle = (raw: string) => {
    setDraft(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      setError(null);
      onCommit(undefined);
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      setError('不是合法的 JSON');
      return;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setError('必须是 JSON 对象，例如 {"top_k": 40}');
      return;
    }

    const blocked = Object.keys(parsed).filter((key) => PROTECTED_EXTRA_BODY_KEYS.includes(key));
    if (blocked.length > 0) {
      setError(`这些字段由网关掌管，不能覆盖：${blocked.join('、')}`);
      return;
    }

    setError(null);
    const object = parsed as Record<string, unknown>;
    // 空对象视同没配——和后端的口径一致。
    onCommit(Object.keys(object).length > 0 ? object : undefined);
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>额外请求体（高级）</Label>
      <Textarea
        id={id}
        value={draft}
        onChange={(e) => handle(e.target.value)}
        rows={3}
        spellCheck={false}
        placeholder='{"top_k": 40}'
        className="rounded-lg font-mono text-xs"
      />
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">该模型向上游额外发送的请求体</p>
      )}
    </div>
  );
}
