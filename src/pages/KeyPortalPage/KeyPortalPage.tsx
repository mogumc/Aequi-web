import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, KeyRound, LogOut, RefreshCw, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { IKeyModel, IKeySelf, IKeyUsage, IUsageRecord } from '@/data/admin';
import { api, clearAccessKey, getAccessKey, isUnauthorized } from '@/lib/api';
import { formatCompact, formatCredits, formatDateTime } from '@/lib/format';

/** 同名模型合并成一组（模型名是主键），展开看它在各块里的路由。 */
interface IModelRouteGroup {
  name: string;
  routes: IKeyModel[];
}

/**
 * 密钥自助视图。
 *
 * 用访问密钥登录后进入这里：只看得到这把密钥自己的余额与用量，
 * 没有任何管理能力（后端的 `/api/key/*` 只有三个只读接口）。
 */
export default function KeyPortalPage() {
  const navigate = useNavigate();
  const [self, setSelf] = useState<IKeySelf | null>(null);
  const [usage, setUsage] = useState<IKeyUsage | null>(null);
  const [models, setModels] = useState<IKeyModel[] | null>(null);
  const [modelQuery, setModelQuery] = useState('');
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const [expandedUsage, setExpandedUsage] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, records, keyModels] = await Promise.all([
        api.keyMe(),
        api.keyUsage(50),
        api.keyModels(),
      ]);
      setSelf(me);
      setUsage(records);
      setModels(keyModels.models);
      setError('');
    } catch (err) {
      if (isUnauthorized(err)) {
        clearAccessKey();
        toast.error('密钥已失效，请重新登录');
        navigate('/login', { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  /**
   * 按模型名合并路由，组内按块 id 排序。
   * 模型名是主键——一个模型可以出现在多个块里（各自带不同倍率）。
   */
  const modelGroups = useMemo<IModelRouteGroup[]>(() => {
    const map = new Map<string, IKeyModel[]>();
    for (const m of models ?? []) {
      const bucket = map.get(m.model);
      if (bucket) bucket.push(m);
      else map.set(m.model, [m]);
    }
    return [...map.entries()]
      .map(([name, routes]) => ({
        name,
        routes: [...routes].sort((a, b) => a.block_id.localeCompare(b.block_id)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [models]);

  /** 搜索命中模型名或组内任一所属块即保留该组。 */
  const filteredModelGroups = useMemo<IModelRouteGroup[]>(() => {
    const needle = modelQuery.trim().toLowerCase();
    if (!needle) return modelGroups;
    return modelGroups.filter(
      ({ name, routes }) =>
        name.toLowerCase().includes(needle) ||
        routes.some((r) => r.block_id.toLowerCase().includes(needle)),
    );
  }, [modelGroups, modelQuery]);

  const toggleModel = (name: string) => {
    setExpandedModels((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleUsage = (id: number) => {
    setExpandedUsage((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** 游标分页：把更早的一页追加到现有记录后面。 */
  const loadMore = useCallback(async () => {
    if (!usage || loadingMore || !usage.has_more) return;
    const lastId = usage.records.at(-1)?.id;
    if (!lastId) return;
    setLoadingMore(true);
    try {
      const next = await api.keyUsage(50, lastId);
      setUsage((prev) =>
        prev
          ? { ...next, records: [...prev.records, ...next.records] }
          : next,
      );
    } catch (err) {
      if (isUnauthorized(err)) {
        clearAccessKey();
        toast.error('密钥已失效，请重新登录');
        navigate('/login', { replace: true });
        return;
      }
      toast.error(err instanceof Error ? err.message : '加载失败，请稍后重试');
    } finally {
      setLoadingMore(false);
    }
  }, [usage, loadingMore, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const logout = () => {
    clearAccessKey();
    navigate('/login', { replace: true });
  };

  // 没带密钥就直接回登录页（凭证被清掉时也会走到这里）。
  if (!getAccessKey()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <KeyRound className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium">{self?.name || '访问密钥'}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {self ? `${self.key_prefix}…` : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
              刷新
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="size-4" />
              退出
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {error && (
          <Card className="border-destructive/40">
            <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 大数从 K 起缩写，防止撑爆卡片；title 里保留精确值 */}
          <StatCard
            title="剩余额度"
            value={self ? (self.unlimited ? '无限' : formatCompact(self.credits)) : null}
            hint={self?.unlimited ? '消耗仍然照记' : '积分'}
            exact={self && !self.unlimited ? formatCredits(self.credits) : undefined}
          />
          <StatCard
            title="请求次数"
            value={usage ? formatCompact(usage.summary.requests) : null}
            hint={usage && usage.summary.failed > 0 ? `失败 ${usage.summary.failed}` : undefined}
            exact={usage ? String(usage.summary.requests) : undefined}
          />
          <StatCard
            title="消耗 token"
            value={usage ? formatCompact(usage.summary.final_tokens) : null}
            // 「原始」按语义展示完整数值：超宽时省略号截断，悬停看全。
            hint={
              usage
                ? `原始 ${usage.summary.raw_tokens.toLocaleString('zh-CN')}`
                : undefined
            }
            exact={
              usage
                ? `${usage.summary.final_tokens}（原始 ${usage.summary.raw_tokens}）`
                : undefined
            }
          />
          <StatCard
            title="累计消耗"
            value={usage ? formatCompact(usage.summary.credits) : null}
            hint="积分"
            exact={usage ? formatCredits(usage.summary.credits) : undefined}
          />
        </div>

        {/* 密钥信息：可用模型有专门一栏，这里不再重复（否则又长又难分辨） */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">密钥信息</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
            <Field label="状态">
              {self ? (
                <Badge variant={self.enabled ? 'default' : 'secondary'}>
                  {self.enabled ? '启用' : '已停用'}
                </Badge>
              ) : (
                <Skeleton className="h-5 w-12" />
              )}
            </Field>
            <Field label="创建时间">
              {self ? formatDateTime(self.created_at) : '—'}
            </Field>
            <Field label="最后使用">
              {self?.last_used_at ? formatDateTime(self.last_used_at) : '从未使用'}
            </Field>
          </CardContent>
        </Card>

        {/* token 分项汇总：三条明细都记在每条用量里，这里给累计视角。
            「累计」实际是保留期窗口内的累计（过期记录被回收会回退），
            窗口长度从后端 settings 带下来。 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">累计 token</CardTitle>
            <CardDescription>
              {usage?.retention_days
                ? `最近 ${usage.retention_days} 天的用量聚合；缓存为命中缓存的输入部分，已包含在输入内`
                : '全部用量记录的聚合；缓存为命中缓存的输入部分，已包含在输入内'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-4">
            <Field label="输入">
              {usage ? (
                <span
                  className="tabular-nums"
                  title={usage.summary.prompt_tokens.toLocaleString('zh-CN')}
                >
                  {formatCompact(usage.summary.prompt_tokens)}
                </span>
              ) : (
                <Skeleton className="h-5 w-16" />
              )}
            </Field>
            <Field label="输出">
              {usage ? (
                <span
                  className="tabular-nums"
                  title={usage.summary.completion_tokens.toLocaleString('zh-CN')}
                >
                  {formatCompact(usage.summary.completion_tokens)}
                </span>
              ) : (
                <Skeleton className="h-5 w-16" />
              )}
            </Field>
            <Field label="缓存命中">
              {usage ? (
                <span
                  className="tabular-nums"
                  title={usage.summary.cache_tokens.toLocaleString('zh-CN')}
                >
                  {formatCompact(usage.summary.cache_tokens)}
                </span>
              ) : (
                <Skeleton className="h-5 w-16" />
              )}
            </Field>
            <Field label="缓存率">
              {usage ? (
                // 缓存命中占输入 token 的比例，前端直接算。
                <span className="tabular-nums" title="缓存命中 / 输入">
                  {usage.summary.prompt_tokens > 0
                    ? `${((usage.summary.cache_tokens / usage.summary.prompt_tokens) * 100).toFixed(1)}%`
                    : '—'}
                </span>
              ) : (
                <Skeleton className="h-5 w-16" />
              )}
            </Field>
          </CardContent>
        </Card>

        {/* 可用模型：按模型名（主键）合并，展开看各块的路由与倍率（脱敏视图） */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">可用模型</CardTitle>
            <CardDescription>
              只写模型名在提供它的块之间轮询；用「块/模型」写法可锁定某个块。
              倍率决定该模型按多少倍计费。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {models !== null && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span>
                  共 <strong className="tabular-nums">{modelGroups.length}</strong> 个模型
                </span>
                <span className="text-muted-foreground">
                  <strong className="tabular-nums">{models.length}</strong> 条路由，分布在{' '}
                  <strong className="tabular-nums">
                    {new Set(models.map((m) => m.block_id)).size}
                  </strong>{' '}
                  个块里
                </span>
              </div>
            )}

            <div className="relative max-w-xs">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
                placeholder="搜索模型名或块"
                className="rounded-lg pl-9"
              />
            </div>

            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">模型</TableHead>
                    <TableHead
                      className="whitespace-nowrap"
                      title="提供该模型的块数量"
                    >
                      上游数
                    </TableHead>
                    <TableHead className="w-10" aria-label="展开" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models === null ? (
                    [0, 1, 2].map((row) => (
                      <TableRow key={row}>
                        <TableCell colSpan={3}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredModelGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        {models.length === 0
                          ? '没有可用模型——白名单与启用的块不匹配，或块里还没有配置模型'
                          : '没有匹配的模型'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredModelGroups.map(({ name, routes }) => {
                      const isOpen = expandedModels.has(name);
                      return (
                        <Fragment key={name}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleModel(name)}
                            aria-expanded={isOpen}
                          >
                            <TableCell className="font-medium">{name}</TableCell>
                            <TableCell className="tabular-nums">{routes.length}</TableCell>
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
                                        <TableHead className="whitespace-nowrap text-xs">
                                          调用写法
                                        </TableHead>
                                        <TableHead className="whitespace-nowrap text-xs text-right">
                                          倍率
                                        </TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {routes.map((route) => (
                                        <TableRow key={`${route.block_id}/${name}`}>
                                          <TableCell>
                                            {/* 块 id 已包含在调用写法里（无块名可用），不再单列 */}
                                            <code
                                              className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs"
                                              title="请求里用这个写法可以锁定该块"
                                            >
                                              {route.block_id}/{name}
                                            </code>
                                          </TableCell>
                                          <TableCell className="text-right font-mono text-xs tabular-nums">
                                            {route.multiplier}×
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">用量记录</CardTitle>
            <CardDescription>
              最近 50 次请求一页；点击任意一行展开完整明细。失败请求同样在列，
              token 与积分为 0。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && !usage ? (
              <div className="space-y-2">
                {[0, 1, 2].map((row) => (
                  <Skeleton key={row} className="h-10 w-full" />
                ))}
              </div>
            ) : usage && usage.records.length > 0 ? (
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">时间</TableHead>
                      <TableHead className="whitespace-nowrap">模型</TableHead>
                      <TableHead className="whitespace-nowrap">输入 / 输出</TableHead>
                      <TableHead className="whitespace-nowrap">积分</TableHead>
                      <TableHead className="whitespace-nowrap">状态</TableHead>
                      <TableHead className="w-10" aria-label="展开" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.records.map((record) => {
                      const isOpen = expandedUsage.has(record.id);
                      return (
                        <Fragment key={record.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleUsage(record.id)}
                            aria-expanded={isOpen}
                          >
                            <TableCell className="whitespace-nowrap">
                              {formatDateTime(record.created_at)}
                            </TableCell>
                            <TableCell className="font-medium">{record.model}</TableCell>
                            <TableCell
                              className="whitespace-nowrap tabular-nums"
                              title={record.estimated ? 'token 为本地估算' : undefined}
                            >
                              {formatCompact(record.prompt_tokens)}
                              {record.estimated && '*'}
                              <span className="mx-1 text-muted-foreground">/</span>
                              {formatCompact(record.completion_tokens)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap tabular-nums">
                              {formatCredits(record.credits)}
                            </TableCell>
                            <TableCell>
                              {record.status === 'success' ? (
                                <Badge variant="secondary">成功</Badge>
                              ) : (
                                <Badge variant="destructive" className="shrink-0">
                                  失败
                                </Badge>
                              )}
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
                              <TableCell colSpan={6} className="bg-muted/30">
                                <UsageDetail record={record} />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">还没有用量记录</p>
            )}

            {usage?.has_more && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? <RefreshCw className="size-4 animate-spin" /> : null}
                  {loadingMore ? '加载中…' : '显示更早记录'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Toaster position="top-center" richColors />
    </div>
  );
}

/** 单条用量记录的展开明细：主行只放概览，细节都在这里。 */
function UsageDetail({ record }: { record: IUsageRecord }) {
  const n = (v: number) => v.toLocaleString('zh-CN');
  return (
    <div className="space-y-3 px-1 py-1 text-sm">
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="输入 token">
          <span className="tabular-nums">{n(record.prompt_tokens)}</span>
        </Field>
        <Field label="输出 token">
          <span className="tabular-nums">{n(record.completion_tokens)}</span>
        </Field>
        <Field label="缓存命中">
          <span className="tabular-nums">
            {n(record.cache_tokens)}
            {record.prompt_tokens > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">
                ({((record.cache_tokens / record.prompt_tokens) * 100).toFixed(1)}%)
              </span>
            )}
          </span>
        </Field>
        <Field label="倍率">
          <span className="font-mono tabular-nums">{record.multiplier}×</span>
        </Field>
        <Field label="原始 token">
          <span className="tabular-nums">{n(record.raw_tokens)}</span>
        </Field>
        <Field label="最终 token">
          <span className="tabular-nums">{n(record.final_tokens)}</span>
        </Field>
        <Field label="计费积分">
          <span className="tabular-nums">{formatCredits(record.credits)}</span>
        </Field>
        <Field label="类型">
          {record.stream ? '流式' : '普通'}
        </Field>
        <Field label="token 来源">
          {record.estimated ? '本地估算（标 *）' : '上游返回'}
        </Field>
        <Field label="时间">
          <span className="tabular-nums">{formatDateTime(record.created_at)}</span>
        </Field>
        <Field label="记录 ID">
          <span className="font-mono tabular-nums">{record.id}</span>
        </Field>
      </div>
      {record.error && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">失败原因</p>
          <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            {record.error}
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  exact,
}: {
  title: string;
  value: string | null;
  hint?: string;
  /** 悬停时展示的精确值（缩写只影响显示，不丢精度） */
  exact?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        {value === null ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-2xl font-medium tracking-tight" title={exact}>
            {value}
          </p>
        )}
        {hint && (
          // 数值超宽时省略号截断，悬停看完整值
          <p className="mt-1 truncate text-xs text-muted-foreground" title={hint}>
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div>{children}</div>
    </div>
  );
}
