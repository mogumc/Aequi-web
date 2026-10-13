import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

/** 单页上限（后端 `MAX_PAGE_SIZE`）。 */
const KEY_PAGE_SIZE = 100;
/**
 * 最多翻多少页——**有界**是硬要求。
 *
 * 退出条件依赖后端 `total` 与返回条数自洽；一旦 `total` 报大或分页异常重复
 * 返回同一页，没有这个上限就是前端死循环 + 请求风暴。下游密钥量远小于 2000，
 * 正常永远翻不到这里。
 */
const KEY_PAGE_MAX = 20;

/** 一次拉全部访问密钥：按页取到 `total` 为止，最多 `KEY_PAGE_MAX` 页。 */
async function fetchAllKeys(): Promise<IAccessKey[]> {
  const all: IAccessKey[] = [];
  for (let page = 1; page <= KEY_PAGE_MAX; page += 1) {
    const res = await api.listKeys({ page, page_size: KEY_PAGE_SIZE });
    all.push(...res.keys);
    // 拿满或拿到空页就收工。
    if (res.keys.length === 0 || all.length >= res.total) break;
  }
  return all;
}

/** 白名单里已经有这条路由。 */
function hasEntry(key: IAccessKey, entry: string): boolean {
  return (key.allowed_models ?? []).includes(entry);
}

/** 白名单为空 = 不限制：本来就允许所有模型，白名单对它没有意义。 */
function isUnrestricted(key: IAccessKey): boolean {
  return !key.allowed_models || key.allowed_models.length === 0;
}

/** 待提交的一处改动：给某把密钥的白名单加上或去掉这条路由。 */
interface IPendingChange {
  key: IAccessKey;
  action: 'add' | 'remove';
}

/**
 * 把一条「块/模型」路由**增删**进多把访问密钥的白名单。
 *
 * 勾选状态表达的是「这把密钥**应该**拥有这条路由」，打开时按真实白名单初始化，
 * 所以勾上 = 添加、取消勾选 = 移除，提交时只写真正变化的那几把（差量写回）。
 * 只影响这一个条目：其余白名单条目原样保留，绝不整体替换。
 *
 * 不限制（白名单为空）的密钥一律置灰不可勾选——它不是「已经包含」，而是根本
 * 不受白名单约束；允许它勾选就等于把「全放开」静默降成「只允许这一个」，反过来
 * 取消勾选又无从谈起。
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
  /** 期望态：包含的密钥 id 表示「应有这条路由」，与真实白名单求差量。 */
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [applying, setApplying] = useState(false);
  /** 移除会把白名单清空时，先弹一次确认（空 = 不限制，是口径变了不只是少一条）。 */
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setKeys(null);
    setChecked(new Set());
    setQuery('');
    setClearConfirmOpen(false);
    fetchAllKeys()
      .then((list) => {
        if (cancelled) return;
        setKeys(list);
        // 期望态从现状出发，于是「没动过的」自然不会进差量。
        setChecked(new Set(list.filter((k) => hasEntry(k, entry)).map((k) => k.id)));
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
  }, [open, entry, onAuthFail]);

  const filtered = useMemo(() => {
    if (!keys) return [];
    const kw = query.trim().toLowerCase();
    if (!kw) return keys;
    return keys.filter(
      (k) => k.name.toLowerCase().includes(kw) || k.id.toLowerCase().includes(kw),
    );
  }, [keys, query]);

  /** 与现状的差量：只有真正需要写回后端的密钥才在里面。 */
  const pending = useMemo<IPendingChange[]>(() => {
    if (!keys) return [];
    const list: IPendingChange[] = [];
    for (const key of keys) {
      if (isUnrestricted(key)) continue;
      const included = hasEntry(key, entry);
      const wanted = checked.has(key.id);
      if (included === wanted) continue;
      list.push({ key, action: wanted ? 'add' : 'remove' });
    }
    return list;
  }, [keys, checked, entry]);

  const adds = pending.filter((p) => p.action === 'add');
  const removes = pending.filter((p) => p.action === 'remove');
  /** 移除后白名单就空了——后端口径里「空 = 不限制」，得单独确认。 */
  const clearings = removes.filter((p) => (p.key.allowed_models ?? []).length === 1);

  const toggle = (id: string, next: boolean) => {
    setChecked((prev) => {
      const set = new Set(prev);
      if (next) set.add(id);
      else set.delete(id);
      return set;
    });
  };

  const runApply = async () => {
    if (!keys || applying || pending.length === 0) return;
    setApplying(true);
    let added = 0;
    let removed = 0;
    let failed = 0;
    for (const { key, action } of pending) {
      const list = key.allowed_models ?? [];
      // 加法只是追加；减法只摘掉这一条，其余授权原样保留。
      const next =
        action === 'add'
          ? Array.from(new Set([...list, entry]))
          : list.filter((item) => item !== entry);
      try {
        const updated = await api.updateKey(key.id, { allowed_models: next });
        setKeys((prev) => prev?.map((k) => (k.id === updated.id ? updated : k)) ?? prev);
        // 落地的改动同步回期望态，失败的那些继续留在差量里等着重试。
        setChecked((prev) => {
          const set = new Set(prev);
          if (hasEntry(updated, entry)) set.add(updated.id);
          else set.delete(updated.id);
          return set;
        });
        if (action === 'add') added += 1;
        else removed += 1;
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
    if (added > 0 || removed > 0) {
      const parts: string[] = [];
      if (added > 0) parts.push(`添加 ${added} 把`);
      if (removed > 0) parts.push(`移除 ${removed} 把`);
      toast.success(`${entry}：已${parts.join('、')}密钥`);
    }
    if (failed > 0) toast.error(`${failed} 把密钥未更新，请稍后重试`);
    if (failed === 0) onOpenChange(false);
  };

  /** 有「移除即清空」的改动时先确认，其余直接落。 */
  const onApply = () => {
    if (clearings.length > 0) {
      setClearConfirmOpen(true);
      return;
    }
    void runApply();
  };

  const applyLabel =
    pending.length === 0
      ? '应用更改'
      : adds.length === 0
        ? `移除 ${removes.length} 项`
        : removes.length === 0
          ? `添加 ${adds.length} 项`
          : `应用 ${pending.length} 项更改`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 rounded-2xl sm:max-w-lg">
        <DialogHeader className="shrink-0 pb-2">
          <DialogTitle>快速应用</DialogTitle>
          <DialogDescription>
            勾选 = 把{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{entry}</code>{' '}
            写进该密钥的模型白名单，取消勾选 = 从白名单里移除。白名单为空的密钥表示
            <strong>不限制</strong>（可调用全部模型），不在此处调整。
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
                const free = isUnrestricted(k);
                const included = hasEntry(k, entry);
                const wanted = !free && checked.has(k.id);
                const changed = !free && included !== wanted;
                const willClear = changed && !wanted && (k.allowed_models ?? []).length === 1;
                return (
                  <label
                    key={k.id}
                    title={k.id}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                      free ? 'opacity-60' : 'cursor-pointer hover:bg-muted'
                    }`}
                  >
                    <Checkbox
                      checked={wanted}
                      disabled={free}
                      onCheckedChange={(next) => toggle(k.id, next === true)}
                    />
                    <span className="min-w-0 flex-1 truncate">{k.name || '未命名'}</span>
                    {free ? (
                      <Badge
                        variant="outline"
                        className="shrink-0 text-xs"
                        title="白名单为空 = 不限制，本来就能调用全部模型"
                      >
                        不限制
                      </Badge>
                    ) : changed ? (
                      <Badge
                        variant={wanted ? 'secondary' : 'outline'}
                        className={`shrink-0 text-xs ${wanted ? '' : 'text-destructive'}`}
                      >
                        {wanted ? '将添加' : willClear ? '移除后不限制' : '将移除'}
                      </Badge>
                    ) : included ? (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        已包含
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
            disabled={applying || pending.length === 0}
            onClick={onApply}
          >
            {applying ? <Loader2 className="size-4 animate-spin" /> : null}
            {applying ? '应用中…' : applyLabel}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* 移除后白名单变空 = 不再限制模型，是口径变了，不是「少了一条」 */}
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>移除后这几把密钥将不再限制模型</AlertDialogTitle>
            <AlertDialogDescription>
              它们当前的白名单里只有 {entry} 这一条。白名单为空在后端表示
              <strong>不限制</strong>，移除后它们可以调用全部模型。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-lg border border-border/60 p-1.5 text-sm">
            {clearings.map((p) => (
              <div key={p.key.id} className="truncate rounded-md px-2 py-1" title={p.key.id}>
                {p.key.name || '未命名'}
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">再想想</AlertDialogCancel>
            <AlertDialogAction className="rounded-full" onClick={() => void runApply()}>
              仍然移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
