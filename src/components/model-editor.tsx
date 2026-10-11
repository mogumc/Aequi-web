import { useState } from 'react';
import { toast } from 'sonner';
import { CloudDownload, Loader2, Plus, Search, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { IBlockModel } from '@/data/admin';
import { formatMultiplier, parseMultiplier } from '@/lib/multiplier';

/**
 * 块的模型编辑器。
 *
 * 主路径是从上游拉一份列表勾选加入——手输模型名既容易写错，也没人记得住
 * 上游到底有哪些模型。但确实有上游不提供列模型接口，也有些模型不在返回的
 * 列表里，所以保留手动添加这条路。
 */
export function ModelEditor({
  models,
  onChange,
  onFetch,
  fetched,
  fetching,
  fetchError,
}: {
  models: IBlockModel[];
  onChange: (next: IBlockModel[]) => void;
  onFetch: () => void;
  fetched: string[];
  fetching: boolean;
  fetchError: string | null;
}) {
  const [manual, setManual] = useState('');
  const [filter, setFilter] = useState('');

  const selected = new Set(models.map((model) => model.name));
  const available = fetched.filter((name) => !selected.has(name));
  const needle = filter.trim().toLowerCase();
  const shown = needle ? available.filter((name) => name.toLowerCase().includes(needle)) : available;

  const add = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || selected.has(trimmed)) return;
    onChange([...models, { name: trimmed }]);
  };

  const remove = (name: string) => onChange(models.filter((model) => model.name !== name));

  const patch = (name: string, next: Partial<IBlockModel>) =>
    onChange(models.map((model) => (model.name === name ? { ...model, ...next } : model)));

  const submitManual = () => {
    const trimmed = manual.trim();
    if (!trimmed) return;
    if (selected.has(trimmed)) {
      toast.error('该模型已经在列表里了');
      return;
    }
    add(trimmed);
    setManual('');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={fetching}
          onClick={onFetch}
        >
          {fetching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CloudDownload className="size-4" />
          )}
          从上游拉取模型
        </Button>
        <div className="flex flex-1 items-center gap-2">
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitManual();
              }
            }}
            placeholder="上游没有该模型？手动输入名称后回车"
            className="h-9 rounded-lg"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={submitManual}
          >
            <Plus className="size-4" /> 添加
          </Button>
        </div>
      </div>

      {fetchError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {fetchError}——可以直接手动添加模型名。
        </p>
      )}

      {!fetchError && fetched.length === 0 && (
        <p className="text-xs text-muted-foreground">
          点「从上游拉取模型」拿到上游支持的模型列表；上游没有列模型接口时，直接手动添加。
        </p>
      )}

      {available.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border/60 p-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              上游有 {available.length} 个模型还没加入
            </span>
            <div className="relative ml-auto w-40">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="筛选"
                className="h-8 rounded-lg pl-8 text-xs"
              />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {shown.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">没有匹配的模型</p>
            ) : (
              shown.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => add(name)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {models.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 px-3 py-2.5 text-center text-xs text-muted-foreground">
          还没有加入任何模型——这个块对外不接受任何模型
        </p>
      ) : (
        <div className="space-y-1.5">
          {models.map((model) => (
            <div
              key={model.name}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{model.name}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">转发为</span>
                <Input
                  value={model.forward ?? ''}
                  onChange={(e) => patch(model.name, { forward: e.target.value || undefined })}
                  placeholder="同名"
                  className="h-8 w-36 rounded-lg text-xs"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">倍率</span>
                <Input
                  value={formatMultiplier(model.multiplier_bp)}
                  onChange={(e) => {
                    const bp = parseMultiplier(e.target.value);
                    if (bp !== null) patch(model.name, { multiplier_bp: bp });
                  }}
                  className="h-8 w-20 rounded-lg text-xs tabular-nums"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-full text-destructive hover:text-destructive"
                onClick={() => remove(model.name)}
                aria-label="移除"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
