import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { IAccessKey } from '@/data/admin';
import { api, isUnauthorized } from '@/lib/api';

/** 一次拉全部访问密钥：后端单页上限 100，循环取完为止。 */
async function fetchAllKeys(): Promise<IAccessKey[]> {
  const all: IAccessKey[] = [];
  for (let page = 1; ; page += 1) {
    const res = await api.listKeys({ page, page_size: 100 });
    all.push(...res.keys);
    // total 是筛选后的总数；拿满或拿到空页就收工。
    if (res.keys.length === 0 || all.length >= res.total) break;
  }
  return all;
}

/** 白名单里已经有这条路由。 */
function hasEntry(key: IAccessKey, entry: string): boolean {
  return (key.allowed_models ?? []).includes(entry);
}

/** 白名单为空 = 不限制：本来就允许所有模型，不需要也不该再「应用」。 */
function isUnrestricted(key: IAccessKey): boolean {
  return !key.allowed_models || key.allowed_models.length === 0;
}

/**
 * 把一条「块/模型」路由**增量**写进多把访问密钥的白名单。
 *
 * 只做加法：勾选的密钥在原有白名单后面追加这一条，其余条目原样保留
 * （整体替换会把密钥已有的授权一次清掉）。已经包含这条的密钥默认勾选
 * 并置灰——它无需再应用；白名单为空（不限制）的密钥同理置灰。
 */
export function ModelApplyKeysDialog({
  target,
  open,
  onOpenChange,
  onAuthFail,
}: {
  target: { blockId: string; modelName: string } | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAuthFail: () => void;
}) {
  const entry = target ? `${target.blockId}/${target.modelName}` : '';
  const [keys, setKeys] = useState<IAccessKey[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setKeys(null);
    setPicked([]);
    setQuery('');
    fetchAllKeys()
      .then((list) => {
        if (!cancelled) setKeys(list);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (isUnauthorized(e)) {
          onAuthFail();
          return;
        }
        toast.error(e instanceof Error ? e.message : '加载密钥失败，请稍后重试');
      });
    return () => {
      cancelled = true;
    };
  }, [open, onAuthFail]);

  const filtered = useMemo(() => {
    if (!keys) return [];
    const kw = query.trim().toLowerCase();
    if (!kw) return keys;
    return keys.filter(
      (k) => k.name.toLowerCase().includes(kw) || k.id.toLowerCase().includes(kw),
    );
  }, [keys, query]);

  const toggle = (id: string, checked: boolean) => {
    setPicked((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const onApply = async () => {
    if (!keys || applying || picked.length === 0) return;
    setApplying(true);
    let ok = 0;
    let failed = 0;
    for (const id of picked) {
      const current = keys.find((k) => k.id === id);
      if (!current) continue;
      const next = Array.from(new Set([...(current.allowed_models ?? []), entry]));
      try {
        const updated = await api.updateKey(id, { allowed_models: next });
        setKeys((prev) => prev?.map((k) => (k.id === updated.id ? updated : k)) ?? prev);
        ok += 1;
      } catch (e) {
        if (isUnauthorized(e)) {
          onAuthFail();
          setApplying(false);
          return;
        }
        failed += 1;
      }
    }
    setApplying(false);
    if (ok > 0) toast.success(`已为 ${ok} 把密钥添加上 ${entry}`);
    if (failed > 0) toast.error(`${failed} 把密钥未更新，请稍后重试`);
    if (ok > 0) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 rounded-2xl sm:max-w-lg">
        <DialogHeader className="shrink-0 pb-2">
          <DialogTitle>快速应用</DialogTitle>
          <DialogDescription>
            把{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{entry}</code>{' '}
            追加到所选密钥的模型白名单；已包含或不限制的密钥无需重复添加。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-2 pr-1">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索密钥名称或 ID"
              className="rounded-lg pl-9"
            />
          </div>

          {keys === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
              {keys.length === 0 ? '还没有任何访问密钥' : '没有匹配的密钥'}
            </p>
          ) : (
            <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-lg border border-border/60 p-1.5 pr-2">
              {filtered.map((k) => {
                const included = hasEntry(k, entry);
                const free = isUnrestricted(k);
                const locked = included || free;
                return (
                  <label
                    key={k.id}
                    title={k.id}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                      locked ? 'opacity-60' : 'cursor-pointer hover:bg-muted'
                    }`}
                  >
                    <Checkbox
                      checked={included || picked.includes(k.id)}
                      disabled={locked}
                      onCheckedChange={(checked) => toggle(k.id, checked === true)}
                    />
                    <span className="min-w-0 flex-1 truncate">{k.name || '未命名'}</span>
                    {included ? (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        已包含
                      </Badge>
                    ) : free ? (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        不限制
                      </Badge>
                    ) : !k.enabled ? (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        已禁用
                      </Badge>
                    ) : null}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t pt-3">
          <Button
            variant="ghost"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={applying}
          >
            取消
          </Button>
          <Button
            className="rounded-full"
            disabled={applying || picked.length === 0}
            onClick={() => void onApply()}
          >
            {applying ? <Loader2 className="size-4 animate-spin" /> : null}
            {applying
              ? '应用中…'
              : picked.length > 0
                ? `应用到 ${picked.length} 把密钥`
                : '应用'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
