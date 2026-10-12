import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Cpu, Pencil, RefreshCw, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { IBlockModel, IUpstreamBlock } from '@/data/admin';
import { api, clearToken, isUnauthorized } from '@/lib/api';
import { formatMultiplier, parseMultiplier } from '@/lib/multiplier';

/** 一行 = 某个块里的某条模型配置（路由）。 */
interface IModelRow {
  model: IBlockModel;
  blockId: string;
  blockName: string;
  apiFormat: string;
  /** 块被停用时，它的模型不参与调度——路由表里要能一眼看出来。 */
  blockEnabled: boolean;
}

/** 模型页主行：同名模型合并成一组，展开看各块的路由。 */
interface IModelGroup {
  name: string;
  rows: IModelRow[];
}

/** 编辑弹窗的目标：某块里的某个模型。 */
interface IEditTarget {
  blockId: string;
  modelName: string;
}

/**
 * 模型管理页。
 *
 * 模型是块内配置的——同一个模型名可以出现在多个块里，各自带不同的
 * 转发名与倍率。页面按模型名合并展示，展开查看各块的路由明细；
 * 每条路由（块/模型）可以直接编辑转发名与倍率，让这里成为真正的
 * 管理面板而不是只读展板。
 */
export default function ModelsPage() {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<IUpstreamBlock[] | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<IEditTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleAuthFail = useCallback(() => {
    clearToken();
    toast.error('登录已过期，请重新登录');
    navigate('/login', { replace: true });
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    setBlocks(null);

    api
      .listBlocks()
      .then((list) => {
        if (!cancelled) setBlocks(list);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (isUnauthorized(e)) {
          handleAuthFail();
          return;
        }
        toast.error(e instanceof Error ? e.message : '加载失败，请稍后重试');
      });

    return () => {
      cancelled = true;
    };
  }, [handleAuthFail, reloadKey]);

  /** 摊平成「模型 × 块」的路由行，组内按块名排序。 */
  const rows = useMemo<IModelRow[]>(() => {
    if (!blocks) return [];
    const list: IModelRow[] = [];
    for (const block of blocks) {
      for (const model of block.models) {
        list.push({
          model,
          blockId: block.id,
          blockName: block.name || block.id,
          apiFormat: block.api_format,
          blockEnabled: block.enabled,
        });
      }
    }
    return list.sort((a, b) => a.blockName.localeCompare(b.blockName));
  }, [blocks]);

  /** 按模型名合并成组，组按名字排序。 */
  const groups = useMemo<IModelGroup[]>(() => {
    const map = new Map<string, IModelRow[]>();
    for (const row of rows) {
      const bucket = map.get(row.model.name);
      if (bucket) bucket.push(row);
      else map.set(row.model.name, [row]);
    }
    return [...map.entries()]
      .map(([name, list]) => ({ name, rows: list }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  /** 搜索命中组内任意一项（模型名、块名、转发名）即保留该组。 */
  const filtered = useMemo<IModelGroup[]>(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return groups;
    return groups.filter(({ name, rows: list }) =>
      name.toLowerCase().includes(needle) ||
      list.some(
        (row) =>
          row.blockName.toLowerCase().includes(needle) ||
          (row.model.forward ?? '').toLowerCase().includes(needle),
      ),
    );
  }, [groups, search]);

  const modelCount = groups.length;
  const routeCount = rows.length;

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  /** 保存单条路由：替换块 models 里的对应条目，PATCH 回去。 */
  const onSaveRoute = async (
    target: IEditTarget,
    forward: string,
    multiplierText: string,
    onDone: () => void,
  ) => {
    if (saving) return;
    const bp = parseMultiplier(multiplierText);
    if (bp === null) {
      toast.error('倍率必须是 ≥ 0 的数字');
      return;
    }
    const block = blocks?.find((b) => b.id === target.blockId);
    if (!block) {
      toast.error('找不到所属块，请刷新后重试');
      return;
    }
    const models: IBlockModel[] = block.models.map((m) =>
      m.name === target.modelName
        ? { ...m, forward: forward.trim() || undefined, multiplier_bp: bp }
        : m,
    );
    setSaving(true);
    try {
      const updated = await api.updateBlock(target.blockId, { models });
      setBlocks((prev) => prev?.map((b) => (b.id === updated.id ? updated : b)) ?? prev);
      toast.success(`已更新 ${target.modelName} 的路由配置`);
      onDone();
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-none shadow-xs">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Cpu className="size-5 text-primary" /> 模型
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              同名模型合并展示，展开查看它在各块里的路由（调用写法、转发名、倍率），
              点击「修改」可直接调整某条路由——请求时用「块/模型」写法锁定某个块，
              只写模型名则在提供它的块之间轮询。
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setReloadKey((n) => n + 1)}
            aria-label="刷新"
          >
            <RefreshCw className="size-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {blocks !== null && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span>
                共 <strong className="tabular-nums">{modelCount}</strong> 个模型
              </span>
              <span className="text-muted-foreground">
                <strong className="tabular-nums">{routeCount}</strong> 条路由，分布在{' '}
                <strong className="tabular-nums">{new Set(rows.map((r) => r.blockId)).size}</strong>{' '}
                个块里
              </span>
            </div>
          )}

          <div className="relative max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索模型名、块名或转发名"
              className="rounded-lg pl-9"
            />
          </div>

          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">模型</TableHead>
                  <TableHead className="whitespace-nowrap">数量</TableHead>
                  <TableHead className="w-10" aria-label="展开" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocks === null ? (
                  [0, 1, 2].map((row) => (
                    <TableRow key={row}>
                      <TableCell colSpan={3}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      {rows.length === 0
                        ? '还没有任何模型——到「上游配置」里给块添加模型'
                        : '没有匹配的模型'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(({ name, rows: list }) => {
                    const isOpen = expanded.has(name);
                    return (
                      <Fragment key={name}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggle(name)}
                        >
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-2">
                              <span>{name}</span>
                              {list.length > 1 && (
                                <Badge variant="outline" title={`有 ${list.length} 个块提供该模型`}>
                                  {list.length} 个块
                                </Badge>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {list.length === 1
                              ? list[0].blockName
                              : `${list.length} 个块提供，点击展开`}
                          </TableCell>
                          <TableCell className="text-right">
                            {isOpen ? (
                              <ChevronDown className="ml-auto size-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                            )}
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={3} className="bg-muted/30 p-0">
                              <div className="px-4 py-3">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="whitespace-nowrap text-xs">调用写法</TableHead>
                                      <TableHead className="whitespace-nowrap text-xs">所属块</TableHead>
                                      <TableHead className="whitespace-nowrap text-xs">格式</TableHead>
                                      <TableHead className="whitespace-nowrap text-xs">转发为</TableHead>
                                      <TableHead className="whitespace-nowrap text-xs text-right">倍率</TableHead>
                                      <TableHead className="whitespace-nowrap text-xs text-right">操作</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {list.map((row) => (
                                      <TableRow key={`${row.blockId}/${name}`}>
                                        <TableCell>
                                          <code
                                            className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs"
                                            title="请求里用这个写法可以锁定该块"
                                          >
                                            {row.blockId}/{name}
                                          </code>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                          <span className="flex items-center gap-1.5 text-xs">
                                            {row.blockName}
                                            {!row.blockEnabled && <Badge variant="outline">已停用</Badge>}
                                          </span>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                          {row.apiFormat}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                          {row.model.forward || '同名'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs tabular-nums">
                                          {formatMultiplier(row.model.multiplier_bp)}×
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 rounded-full text-xs"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditTarget({
                                                blockId: row.blockId,
                                                modelName: name,
                                              });
                                            }}
                                          >
                                            <Pencil className="size-3.5" /> 修改
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 编辑单条路由（块/模型）的转发名与倍率 */}
      {editTarget && (
        <ModelRouteDialog
          key={`${editTarget.blockId}/${editTarget.modelName}`}
          target={editTarget}
          block={blocks?.find((b) => b.id === editTarget.blockId) ?? null}
          open={editTarget !== null}
          saving={saving}
          onOpenChange={(v) => !v && setEditTarget(null)}
          onSave={(forward, multiplierText, onDone) =>
            void onSaveRoute(editTarget, forward, multiplierText, onDone)
          }
        />
      )}
    </div>
  );
}

/** 单条路由的编辑弹窗：只改转发名与倍率，其余模型条目原样保留。 */
function ModelRouteDialog({
  target,
  block,
  open,
  saving,
  onOpenChange,
  onSave,
}: {
  target: IEditTarget;
  block: IUpstreamBlock | null;
  open: boolean;
  saving: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (forward: string, multiplierText: string, onDone: () => void) => void;
}) {
  const entry = block?.models.find((m) => m.name === target.modelName);
  const [forward, setForward] = useState(entry?.forward ?? '');
  const [multiplierText, setMultiplierText] = useState(formatMultiplier(entry?.multiplier_bp));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>修改模型路由</DialogTitle>
          <DialogDescription>
            {target.blockId}/{target.modelName}——只影响这个块里的这个模型
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="route-forward">转发为</Label>
            <Input
              id="route-forward"
              value={forward}
              onChange={(e) => setForward(e.target.value)}
              placeholder="留空表示同名转发"
              className="rounded-lg font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              发给上游时替换成这个名字；对外仍然用 {target.modelName} 调用
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="route-multiplier">计费倍率</Label>
            <Input
              id="route-multiplier"
              inputMode="decimal"
              value={multiplierText}
              onChange={(e) => setMultiplierText(e.target.value)}
              className="rounded-lg text-sm tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              1.00 = 原价，精度 0.01，按 token 消耗乘以该倍率计费
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            className="rounded-full"
            disabled={saving}
            onClick={() => onSave(forward, multiplierText, () => onOpenChange(false))}
          >
            {saving ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
