import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format, fromUnixTime } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  CreditCard,
  KeyRound,
  ServerCrash,
  ShieldAlert,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type IDashboardStats,
  type IHealth,
} from '@/data/admin';
import { api, clearToken, isUnauthorized } from '@/lib/api';
import { formatCredits } from '@/lib/format';

function formatUptime(seconds?: number): string {
  if (!seconds) return '-';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return d > 0 ? `${d} 天 ${h} 小时` : `${h} 小时`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<IHealth | null>(null);
  const [healthDown, setHealthDown] = useState(false);
  // 看板的数字全在服务端算好（当日口径、24 个整点桶），这里只负责显示。
  const [stats, setStats] = useState<IDashboardStats | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then((h) => {
        if (alive) setHealth(h);
      })
      .catch(() => {
        if (alive) setHealthDown(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      setStats(await api.dashboard());
    } catch (e) {
      if (isUnauthorized(e)) {
        clearToken();
        toast.error('登录已过期，请重新登录');
        navigate('/login', { replace: true });
        return;
      }
      toast.error(e instanceof Error ? e.message : '加载失败，请稍后重试');
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    if (!stats) return null;
    const { today, keys, low_credits } = stats;
    return {
      activeKeys: keys.enabled,
      totalKeys: keys.total,
      todayRequests: today.requests,
      todaySuccess: today.success,
      todayFailed: today.failed,
      todayErrorRate: today.requests
        ? ((today.failed / today.requests) * 100).toFixed(1)
        : '0.0',
      lowCredit: low_credits.count,
      // 阈值由服务端给，界面直接显示——两边各写一个「5 积分」迟早对不上。
      lowCreditThreshold: formatCredits(low_credits.threshold),
    };
  }, [stats]);

  const trend = useMemo(() => {
    if (!stats) return [];
    return stats.hourly.map((point) => ({
      label: format(fromUnixTime(point.hour), 'HH:00'),
      requests: point.requests,
      errors: point.failed,
    }));
  }, [stats]);

  const alerts = useMemo(() => {
    if (!stats) return [];
    const items: {
      id: string;
      kind: 'error' | 'credit';
      title: string;
      desc: string;
      to: string;
    }[] = [];
    for (const error of stats.recent_errors) {
      items.push({
        id: `e${error.id}`,
        kind: 'error',
        title: `${error.model} 请求失败`,
        desc: error.error_detail ?? '上游错误',
        to: '/logs',
      });
    }
    // 服务端已经把无限额度与停用的密钥排除在预警之外。
    for (const key of stats.low_credits.keys) {
      items.push({
        id: `c${key.id}`,
        kind: 'credit',
        title: `密钥「${key.name}」额度预警`,
        desc: `剩余 ${formatCredits(key.credits)} 积分，请及时调整额度`,
        to: '/keys',
      });
    }
    return items.slice(0, 5);
  }, [stats]);

  return (
    <div className="space-y-6">
      {healthDown ? (
        <Alert variant="destructive" className="rounded-xl">
          <ServerCrash className="size-4" />
          <AlertTitle>服务异常</AlertTitle>
          <AlertDescription>健康检查（GET /health）失败，网关可能已下线。</AlertDescription>
        </Alert>
      ) : (
        health && (
          <Card className="rounded-2xl border-none shadow-xs">
            <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
              {/* 服务状态与版本在顶栏已有，这里只放仪表盘特有的运行信息 */}
              <span className="text-sm text-muted-foreground">
                运行时长 {formatUptime(health.uptime_seconds)}
              </span>
              <span className="text-sm text-muted-foreground">
                账号{health.account_configured ? '已初始化' : '未初始化'}
              </span>
            </CardContent>
          </Card>
        )
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis ? (
          <>
            <Card className="rounded-2xl border-none shadow-xs">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-sm">
                  <KeyRound className="size-4" /> 活跃密钥
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-medium tabular-nums">{kpis.activeKeys}</p>
                <p className="mt-1 text-xs text-muted-foreground">共 {kpis.totalKeys} 把密钥</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-none shadow-xs">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-sm">
                  <Activity className="size-4" /> 今日请求量
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-medium tabular-nums">{kpis.todayRequests}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  成功 {kpis.todaySuccess} · 失败 {kpis.todayFailed}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-none shadow-xs">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-sm">
                  <ShieldAlert className="size-4" /> 今日错误率
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-medium tabular-nums">{kpis.todayErrorRate}%</p>
                <p className="mt-1 text-xs text-muted-foreground">失败请求 / 总请求</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-none shadow-xs">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-sm">
                  <CreditCard className="size-4" /> 额度预警
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-medium tabular-nums">{kpis.lowCredit}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  剩余额度不足 {kpis.lowCreditThreshold} 积分
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="rounded-2xl border-none shadow-xs">
              <CardContent className="space-y-3 py-6">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="rounded-2xl border-none shadow-xs">
        <CardHeader>
          <CardTitle className="text-xl">最近 24 小时请求趋势</CardTitle>
          <CardDescription>按整点聚合，没有流量的整点记 0</CardDescription>
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E0EC" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    name="请求量"
                    stroke="#6750A4"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="errors"
                    name="错误量"
                    stroke="#B3261E"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Skeleton className="h-64 w-full rounded-xl" />
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-none shadow-xs">
        <CardHeader>
          <CardTitle className="text-xl">高危告警</CardTitle>
          <CardDescription>最近失败请求与额度预警，点击跳转对应页面处理</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {alerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">暂无告警，一切正常</p>
          ) : (
            alerts.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.to)}
                className="flex w-full items-center gap-3 rounded-xl bg-secondary/50 px-4 py-3 text-left transition-colors hover:bg-secondary"
              >
                <AlertTriangle
                  className={`size-4 shrink-0 ${item.kind === 'error' ? 'text-destructive' : 'text-warning'}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Badge variant="outline" className="shrink-0 rounded-full text-xs">
                  {item.kind === 'error' ? '请求失败' : '额度预警'}
                </Badge>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
