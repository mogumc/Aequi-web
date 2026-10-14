import { AlertTriangle, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { findHeaderProblem, type IHeaderRow } from '@/lib/headers';

/**
 * 块的自定义请求头编辑器。
 *
 * 行少、字段也少，所以直接摊开两列输入，不套虚拟列表。上面只**提示**问题、
 * 不拦编辑——刚加了一行还没填是正常状态；真正把关在保存那一步
 * （父组件调 `findHeaderProblem`，后端还有一道）。
 */
export function HeaderEditor({
  headers,
  onChange,
}: {
  headers: IHeaderRow[];
  onChange: (next: IHeaderRow[]) => void;
}) {
  const problem = findHeaderProblem(headers);

  const patch = (index: number, next: Partial<IHeaderRow>) =>
    onChange(headers.map((row, i) => (i === index ? { ...row, ...next } : row)));

  const remove = (index: number) => onChange(headers.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => onChange([...headers, { name: '', value: '' }])}
        >
          <Plus className="size-4" /> 添加请求头
        </Button>
        {headers.length > 0 && (
          <span className="text-xs text-muted-foreground">共 {headers.length} 条</span>
        )}
      </div>

      {headers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 px-3 py-2.5 text-center text-xs text-muted-foreground">
          没有自定义请求头——上游不要额外的头就留空
        </p>
      ) : (
        <div className="space-y-2 rounded-lg border border-border/60 p-2">
          {headers.map((row, index) => (
            // 列表按位置编辑，没有天然主键（头名本身也在改）——按下标复用即可。
            <div key={index} className="flex items-center gap-2">
              <Input
                value={row.name}
                onChange={(e) => patch(index, { name: e.target.value })}
                placeholder="头名，如 anthropic-version"
                aria-label="请求头名"
                className="h-9 flex-[4] rounded-lg font-mono text-xs"
              />
              <Input
                value={row.value}
                onChange={(e) => patch(index, { value: e.target.value })}
                placeholder="值"
                aria-label="请求头的值"
                className="h-9 flex-[6] rounded-lg font-mono text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 rounded-full text-destructive hover:text-destructive"
                onClick={() => remove(index)}
                aria-label="移除这条请求头"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {problem && (
        <p className="flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          <span>{problem}</span>
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        发往该上游的每个请求（含测试密钥与拉取模型）都会带上这些头；
        <strong>同名会盖掉内置的认证头与各家固定头</strong>，包括<code>Authorization</code>。由 HTTP 栈自己管的头（Content-Length、Connection 之类）不允许配置。
      </p>
    </div>
  );
}
