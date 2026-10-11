import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Cpu, RefreshCw, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { formatMultiplier } from '@/lib/multiplier';

/** 一行 = 某个块里的某条模型配置。 */
interface IModelRow {
  model: IBlockModel;
  blockId: string;
  blockName: string;
  apiFormat: string;
  /** 块被停用时，它的模型不参与调度——总览里要能一眼看出来。 */
  blockEnabled: boolean;
}

/**
 * 全部模型总览（只读）。
 *
 * 模型是块内配置的，这里只是把各块摊平到一起看——同一个模型名可能出现在
 * 多个块里，各自带着不同的转发名与倍率，所以按行展示而不是并成一条。
 */
export default function ModelsPage() {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<IUpstreamBlock[] | null>(null);
  const [search, setSearch] = useState('');
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

  /** 摊平成「模型 × 块」的行，按模型名、再按块名排序。 */
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
    return list.sort(
      (a, b) => a.model.name.localeCompare(b.model.name) || a.blockName.localeCompare(b.blockName),
    );
  }, [blocks]);

  /** 同一个模型被几个块提供——多块提供时值得一眼看出来。 */
  const providerCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.model.name, (counts.get(row.model.name) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (row) =>
        row.model.name.toLowerCase().includes(needle) ||
        row.blockName.toLowerCase().includes(needle) ||
        (row.model.forward ?? '').toLowerCase().includes(needle),
    );
  }, [rows, search]);

  const modelCount = providerCount.size;
  const blockWithModels = new Set(rows.map((row) => row.blockId)).size;

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-none shadow-xs">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Cpu className="size-5 text-primary" /> 模型
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              模型在各上游块里配置；同一个模型可以出现在多个块里，各自带不同的转发名与倍率。
              请求时用「块/模型」这种写法可以锁定某个块，只写模型名则在提供它的块之间轮询。
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
                分布在 <strong className="tabular-nums">{blockWithModels}</strong> 个块里
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
                  <TableHead className="whitespace-nowrap">调用写法</TableHead>
                  <TableHead className="whitespace-nowrap">所属块</TableHead>
                  <TableHead className="whitespace-nowrap">格式</TableHead>
                  <TableHead className="whitespace-nowrap">转发为</TableHead>
                  <TableHead className="whitespace-nowrap text-right">倍率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocks === null ? (
                  [0, 1, 2].map((row) => (
                    <TableRow key={row}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {rows.length === 0
                        ? '还没有任何模型——到「上游配置」里给块添加模型'
                        : '没有匹配的模型'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => {
                    const providers = providerCount.get(row.model.name) ?? 1;
                    return (
                      <TableRow key={`${row.blockId}/${row.model.name}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{row.model.name}</span>
                            {providers > 1 && (
                              <Badge variant="outline" title={`有 ${providers} 个块提供该模型`}>
                                {providers} 个块
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code
                            className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs"
                            title="请求里用这个写法可以锁定该块"
                          >
                            {row.blockId}/{row.model.name}
                          </code>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            {row.blockName}
                            {!row.blockEnabled && <Badge variant="outline">已停用</Badge>}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.apiFormat}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {row.model.forward || '同名'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMultiplier(row.model.multiplier_bp)}×
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
