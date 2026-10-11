import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Filter, Loader2, ReceiptText, RefreshCw, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { IRequestLog } from '@/data/admin';
import { api, clearToken, isUnauthorized } from '@/lib/api';
import { formatCredits, formatDateTime, formatDuration } from '@/lib/format';

const RANGES = [
  { value: 'all', label: '全部时间' },
  { value: '1h', label: '最近 1 小时' },
  { value: '24h', label: '最近 24 小时' },
  { value: '7d', label: '最近 7 天' },
] as const;

type StatusFilter = 'all' | 'success' | 'error';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-all">{value}</span>
    </div>
  );
}

export default function RequestLogsPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<IRequestLog[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [range, setRange] = useState('all');
  const [keyQuery, setKeyQuery] = useState('');
  const [detail, setDetail] = useState<IRequestLog | null>(null);
  // 时间范围筛选的基准：固定于挂载时刻，免得 useMemo 里取当前时间导致结果不稳定。
  const [nowSec] = useState(() => Math.floor(Date.now() / 1000));

  const handleAuthFail = useCallback(() => {
    clearToken();
    toast.error('登录已过期，请重新登录');
    navigate('/login', { replace: true });
  }, [navigate]);

  const load = useCallback(async () => {
    try {
      const list = await api.listLogs(500);
      setLogs(list);
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '加载失败，请稍后重试');
    }
  }, [handleAuthFail]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!logs) return [];
    const rangeStart =
      range === '1h' ? nowSec - 3600 : range === '24h' ? nowSec - 86400 : range === '7d' ? nowSec - 7 * 86400 : 0;
    const kw = keyQuery.trim().toLowerCase();
    return [...logs]
      .filter((l) => {
        if (statusFilter !== 'all' && l.status !== statusFilter) return false;
        if (rangeStart && l.created_at < rangeStart) return false;
        if (!kw) return true;
        return (
          String(l.access_key_id ?? '').includes(kw) ||
          (l.block_id ?? '').toLowerCase().includes(kw) ||
          l.model.toLowerCase().includes(kw)
        );
      })
      .sort((a, b) => b.created_at - a.created_at);
  }, [logs, statusFilter, range, keyQuery, nowSec]);

  const [refreshing, setRefreshing] = useState(false);

  /** 真正的刷新：重新从后端拉取日志流水。 */
  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /** 筛选条件是否偏离默认值。 */
  const hasFilter = statusFilter !== 'all' || range !== 'all' || keyQuery.trim() !== '';
  const onClearFilter = () => {
    setStatusFilter('all');
    setRange('all');
    setKeyQuery('');
  };

  return (
    <div className="space-y-6">

      <Card className="rounded-2xl border-none shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ReceiptText className="size-5 text-primary" /> 请求日志
          </CardTitle>
          <CardDescription>最近 500 条代理请求流水，按时间倒序；点击行查看完整详情</CardDescription>
          <div className="flex flex-col gap-3 pt-2 lg:flex-row lg:items-center">
            <div className="flex items-center gap-1 rounded-full bg-secondary/60 p-1">
              {(
                [
                  ['all', '全部'],
                  ['success', '成功'],
                  ['error', '失败'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`h-9 rounded-full px-4 text-sm font-medium transition-colors ${
                    statusFilter === value
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-full rounded-full lg:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={keyQuery}
                onChange={(e) => setKeyQuery(e.target.value)}
                placeholder="搜索密钥 ID / 上游块 / 模型"
                className="rounded-full bg-background pl-9"
              />
            </div>
            {hasFilter && (
              <Button variant="ghost" className="rounded-full" onClick={onClearFilter}>
                清除筛选
              </Button>
            )}
            <Button
              variant="secondary"
              className="rounded-full"
              onClick={() => void onRefresh()}
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">时间</TableHead>
                  <TableHead className="whitespace-nowrap">密钥</TableHead>
                  <TableHead className="whitespace-nowrap">上游块</TableHead>
                  <TableHead className="whitespace-nowrap">模型</TableHead>
                  <TableHead className="whitespace-nowrap">状态</TableHead>
                  <TableHead className="whitespace-nowrap">耗时</TableHead>
                  <TableHead className="whitespace-nowrap">Tokens</TableHead>
                  <TableHead className="whitespace-nowrap">积分</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs === null ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-8 w-full rounded-lg" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      <Filter className="mx-auto mb-2 size-6 text-muted-foreground/50" />
                      暂无近期请求
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((l) => (
                    <TableRow
                      key={l.id}
                      className="cursor-pointer"
                      onClick={() => setDetail(l)}
                    >
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(l.created_at)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {l.access_key_id != null ? `#${l.access_key_id}` : '-'}
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-[140px] truncate">{l.block_id ?? '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-[160px] truncate font-mono text-xs">
                          {l.model}
                        </span>
                      </TableCell>
                      <TableCell>
                        {l.status === 'success' ? (
                          <Badge variant="outline" className="rounded-full bg-success/15 text-success">
                            成功
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="rounded-full">
                            失败
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatDuration(l.duration_ms)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {l.prompt_tokens + l.completion_tokens}
                        {l.estimated && (
                          <span className="ml-1 text-xs text-muted-foreground/70">(估)</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatCredits(l.credits)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 请求详情抽屉 */}
      <Drawer open={detail !== null} onOpenChange={(v) => !v && setDetail(null)}>
        <DrawerContent className="rounded-t-2xl">
          <div className="mx-auto w-full max-w-2xl overflow-y-auto px-6 pb-8">
            <DrawerHeader className="px-0">
              <DrawerTitle className="flex items-center gap-2 text-lg">
                请求详情
                {detail?.status === 'success' ? (
                  <Badge variant="outline" className="rounded-full bg-success/15 text-success">
                    成功
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="rounded-full">
                    失败
                  </Badge>
                )}
              </DrawerTitle>
              <DrawerDescription>日志 #{detail?.id}</DrawerDescription>
            </DrawerHeader>
            {detail && (
              <div className="space-y-4">
                <Separator />
                <div>
                  <DetailRow label="时间" value={formatDateTime(detail.created_at)} />
                  <DetailRow label="模型" value={detail.model} />
                  <DetailRow label="密钥 ID" value={detail.access_key_id != null ? `#${detail.access_key_id}` : '-'} />
                  <DetailRow label="上游块" value={detail.block_id ?? '-'} />
                  <DetailRow label="上游密钥" value={detail.upstream_key_id != null ? `#${detail.upstream_key_id}` : '-'} />
                  <DetailRow label="来源 IP" value={detail.ip || '-'} />
                  <DetailRow label="User-Agent" value={detail.user_agent || '-'} />
                  <DetailRow label="耗时" value={formatDuration(detail.duration_ms)} />
                  <DetailRow label="Prompt Tokens" value={String(detail.prompt_tokens)} />
                  <DetailRow label="Completion Tokens" value={String(detail.completion_tokens)} />
                  <DetailRow label="Cache Tokens" value={String(detail.cache_tokens)} />
                  <DetailRow
                    label="Token 估算"
                    value={detail.estimated ? '是（上游未报 usage，本地估算计费）' : '否（上游实际用量）'}
                  />
                  <DetailRow label="积分消耗" value={formatCredits(detail.credits)} />
                </div>
                {detail.error_detail && (
                  <div className="rounded-xl bg-destructive/10 p-4">
                    <p className="mb-1 text-sm font-medium text-destructive">错误详情</p>
                    <p className="break-all text-sm text-destructive/90">{detail.error_detail}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
