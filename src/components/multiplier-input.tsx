import { useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
import { formatMultiplier, parseMultiplier } from '@/lib/multiplier';

/**
 * 倍率输入框（0.01 精度，草稿模式）。
 *
 * 不能直接受控绑 `formatMultiplier(bp)`：清空或输入中间态时解析会被
 * 拒绝，值立刻弹回旧串，等于根本没法编辑。这里用本地草稿——输入期间
 * 随便打，失焦或回车时才解析提交（解析失败弹回当前值）。
 */
export function MultiplierInput({
  bp,
  id,
  className,
  onCommit,
}: {
  bp: number | undefined;
  id?: string;
  className?: string;
  onCommit: (bp: number) => void;
}) {
  const [draft, setDraft] = useState(() => formatMultiplier(bp));

  // 外部值变了（比如同一模型的其它入口改过）就同步显示。
  useEffect(() => {
    setDraft(formatMultiplier(bp));
  }, [bp]);

  const commit = () => {
    const parsed = parseMultiplier(draft);
    if (parsed === null) {
      setDraft(formatMultiplier(bp));
      return;
    }
    onCommit(parsed);
    setDraft(formatMultiplier(parsed));
  };

  return (
    <Input
      id={id}
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
      className={className}
    />
  );
}
