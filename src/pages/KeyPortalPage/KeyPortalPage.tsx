import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { KeyRound, LogOut, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import type { IKeySelf, IKeyUsage } from '@/data/admin';
import { api, clearAccessKey, getAccessKey, isUnauthorized } from '@/lib/api';
import { formatCompact, formatCredits, formatDateTime } from '@/lib/format';

/**
 * 密钥自助视图。
 *
 * 用访问密钥登录后进入这里：只看得到这把密钥自己的余额与用量，
 * 没有任何管理能力（后端的 `/api/key/*` 只有两个只读接口）。
 */
export default function KeyPortalPage() {
  const navigate = useNavigate();
  const [self, setSelf] = useState<IKeySelf | null>(null);
  const [usage, setUsage] = useState<IKeyUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, records] = await Promise.all([api.keyMe(), api.keyUsage(50)]);
      setSelf(me);
      setUsage(records);
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">密钥信息</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Field label="状态">
              {self ? (
                <Badge variant={self.enabled ? 'default' : 'secondary'}>
                  {self.enabled ? '启用' : '已停用'}
                </Badge>
              ) : (
                <Skeleton className="h-5 w-12" />
              )}
            </Field>
            <Field label="可用模型">
              {self
                ? self.allowed_models && self.allowed_models.length > 0
                  ? self.allowed_models.join('、')
                  : '不限制'
                : '—'}
            </Field>
            <Field label="创建时间">
              {self ? formatDateTime(self.created_at) : '—'}
            </Field>
            <Field label="最后使用">
              {self?.last_used_at ? formatDateTime(self.last_used_at) : '从未使用'}
            </Field>
          </CardContent>
        </Card>

        {/* token 分项汇总：三条明细都记在每条用量里，这里给累计视角 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">累计 token</CardTitle>
            <CardDescription>
              全部用量记录的聚合；缓存为命中缓存的输入部分，已包含在输入内
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">用量记录</CardTitle>
            <CardDescription>最近 50 次请求；失败请求同样在列，token 与积分为 0。</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !usage ? (
              <div className="space-y-2">
                {[0, 1, 2].map((row) => (
                  <Skeleton key={row} className="h-10 w-full" />
                ))}
              </div>
            ) : usage && usage.records.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">时间</TableHead>
                      <TableHead className="whitespace-nowrap">模型</TableHead>
                      <TableHead className="whitespace-nowrap">输入</TableHead>
                      <TableHead className="whitespace-nowrap">输出</TableHead>
                      <TableHead className="whitespace-nowrap">类型</TableHead>
                      <TableHead className="whitespace-nowrap">倍率</TableHead>
                      <TableHead className="whitespace-nowrap">积分</TableHead>
                      <TableHead className="whitespace-nowrap">状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(record.created_at)}
                        </TableCell>
                        <TableCell>{record.model}</TableCell>
                        <TableCell title={record.estimated ? '本地估算' : undefined}>
                          {record.prompt_tokens}
                          {record.estimated && '*'}
                        </TableCell>
                        <TableCell>{record.completion_tokens}</TableCell>
                        <TableCell>{record.stream ? '流式' : '普通'}</TableCell>
                        <TableCell>{record.multiplier}</TableCell>
                        <TableCell>{formatCredits(record.credits)}</TableCell>
                        <TableCell>
                          {record.status === 'success' ? (
                            <Badge variant="secondary">成功</Badge>
                          ) : (
                            <Badge variant="destructive" title={record.error || '请求失败'}>
                              失败
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">还没有用量记录</p>
            )}
          </CardContent>
        </Card>
      </main>

      <Toaster position="top-center" richColors />
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
