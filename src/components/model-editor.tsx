import { useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCheck,
  CloudDownload,
  ListX,
  Loader2,
  Plus,
  Search,
  Settings2,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { MultiplierInput } from '@/components/multiplier-input';
import { VirtualList } from '@/components/virtual-list';
import type { IBlockModel } from '@/data/admin';
import { MULTIPLIER_SCALE, formatMultiplier } from '@/lib/multiplier';

/** 列表单行高度。 */
const AVAILABLE_ROW_HEIGHT = 36;
const MODEL_ROW_HEIGHT = 48;

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
 * 额外请求体输入（JSON 对象，草稿模式）。
 *
 * 编辑期间**不回写**受控值再回灌显示——中途的 `{"top_k": 4` 不是合法
 * JSON，强行回写会把用户正在打的字吃掉。合法即提交，非法只提示。
 */
function ExtraBodyInput({
  modelName,
  value,
  onCommit,
}: {
  modelName: string;
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
      <Label htmlFor={`extra-body-${modelName}`}>额外请求体（高级）</Label>
      <Textarea
        id={`extra-body-${modelName}`}
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
        <p className="text-xs text-muted-foreground">
          按上游格式书写，顶层合并；网关掌管的字段（model / messages / stream 等）会被拒。
          只有管理端能配，下游请求体里带同名键无效。
        </p>
      )}
    </div>
  );
}

/**
 * 块的模型编辑器。
 *
 * 主路径是从上游拉一份列表勾选加入——手输模型名既容易写错，也没人记得住
 * 上游到底有哪些模型。但确实有上游不提供列模型接口，也有些模型不在返回的
 * 列表里，所以保留手动添加这条路。
 *
 * 模型多时支持一键全选 / 一键清空；转发名与倍率属于低频设置，收进每行的
 * 「转发与倍率」弹层，不再常驻占宽度。两个列表都做了虚拟滚动。
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

  const addAllShown = () => {
    if (shown.length === 0) return;
    onChange([...models, ...shown.map((name) => ({ name }))]);
    toast.success(`已加入 ${shown.length} 个模型`);
  };

  const clearAll = () => {
    if (models.length === 0) return;
    onChange([]);
    toast.success(`已移除全部 ${models.length} 个模型`);
  };

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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-full text-xs"
              disabled={shown.length === 0}
              onClick={addAllShown}
            >
              <CheckCheck className="size-3.5" />
              全部加入
            </Button>
          </div>
          <VirtualList
            items={shown}
            itemHeight={AVAILABLE_ROW_HEIGHT}
            resetKey={filter}
            getItemKey={(name) => name}
            empty={<p className="px-2 py-3 text-center text-xs text-muted-foreground">没有匹配的模型</p>}
            renderItem={(name) => (
              <button
                type="button"
                onClick={() => add(name)}
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted"
              >
                <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{name}</span>
              </button>
            )}
          />
        </div>
      )}

      {models.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 px-3 py-2.5 text-center text-xs text-muted-foreground">
          还没有加入任何模型——这个块对外不接受任何模型
        </p>
      ) : (
        <div className="space-y-2 rounded-lg border border-border/60 p-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">已加入 {models.length} 个模型</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-8 rounded-full text-xs text-destructive hover:text-destructive"
              onClick={clearAll}
            >
              <ListX className="size-3.5" />
              全部移除
            </Button>
          </div>
          <VirtualList
            items={models}
            itemHeight={MODEL_ROW_HEIGHT}
            getItemKey={(model) => model.name}
            renderItem={(model) => {
              const hasForward = Boolean(model.forward);
              const hasCustomMultiplier =
                model.multiplier_bp !== undefined && model.multiplier_bp !== MULTIPLIER_SCALE;
              return (
                <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-border/60 px-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{model.name}</span>
                  {hasForward && (
                    <Badge variant="outline" className="max-w-40 shrink-0 font-mono text-[11px]">
                      <span className="truncate">→ {model.forward}</span>
                    </Badge>
                  )}
                  {hasCustomMultiplier && (
                    <Badge
                      variant="outline"
                      className="shrink-0 font-mono text-[11px] tabular-nums"
                    >
                      {formatMultiplier(model.multiplier_bp)}×
                    </Badge>
                  )}
                  {model.extra_body && Object.keys(model.extra_body).length > 0 && (
                    <Badge
                      variant="outline"
                      className="shrink-0 font-mono text-[11px]"
                      title="配了额外请求体"
                    >
                      +{Object.keys(model.extra_body).length}
                    </Badge>
                  )}
                  {/* 转发名与倍率是低频设置，收进二级弹层 */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 rounded-full text-muted-foreground"
                        aria-label={`设置 ${model.name} 的转发与倍率`}
                      >
                        <Settings2 className="size-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72 space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`forward-${model.name}`}>转发为</Label>
                        <Input
                          id={`forward-${model.name}`}
                          value={model.forward ?? ''}
                          onChange={(e) =>
                            patch(model.name, { forward: e.target.value || undefined })
                          }
                          placeholder="留空表示同名转发"
                          className="h-8 rounded-lg font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`multiplier-${model.name}`}>计费倍率</Label>
                        <MultiplierInput
                          id={`multiplier-${model.name}`}
                          bp={model.multiplier_bp}
                          className="h-8 rounded-lg text-xs tabular-nums"
                          onCommit={(bp) => patch(model.name, { multiplier_bp: bp })}
                        />
                        <p className="text-xs text-muted-foreground">
                          1.00 = 原价，精度 0.01；只影响这个块里的这个模型
                        </p>
                      </div>
                      <ExtraBodyInput
                        modelName={model.name}
                        value={model.extra_body}
                        onCommit={(next) => patch(model.name, { extra_body: next })}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-full text-destructive hover:text-destructive"
                    onClick={() => remove(model.name)}
                    aria-label="移除"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
