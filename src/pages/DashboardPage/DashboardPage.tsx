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
  MOCK_KEYS,
  MOCK_LOGS,
  type IAccessKey,
  type IHealth,
  type IRequestLog,
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
  const [keys, setKeys] = useState<IAccessKey[] | null>(null);
  const [logs, setLogs] = useState<IRequestLog[] | null>(null);
  const [isMock, setIsMock] = useState(false);

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
      const [k, l] = await Promise.all([api.listKeys(), api.listLogs(500)]);
      setKeys(k);
      setLogs(l);
      setIsMock(false);
    } catch (e) {
      if (isUnauthorized(e)) {
        clearToken();
        toast.error('登录已过期，请重新登录');
        navigate('/login', { replace: true });
        return;
      }
      setKeys(MOCK_KEYS);
      setLogs(MOCK_LOGS);
      setIsMock(true);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    if (!keys || !logs) return null;
    const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    const todayLogs = logs.filter((l) => l.created_at >= todayStart);
    const todayErrors = todayLogs.filter((l) => l.status === 'error').length;
    return {
      activeKeys: keys.filter((k) => k.enabled).length,
      totalKeys: keys.length,
      todayRequests: todayLogs.length,
      todayErrorRate: todayLogs.length
        ? ((todayErrors / todayLogs.length) * 100).toFixed(1)
        : '0.0',
      lowCredit: keys.filter((k) => k.enabled && Number(k.credits) < 5).length,
    };
  }, [keys, logs]);

  const trend = useMemo(() => {
    if (!logs) return [];
    const nowSec = Math.floor(Date.now() / 1000);
    const start = nowSec - 11 * 3600;
    const buckets = Array.from({ length: 12 }, (_, i) => ({
      label: format(fromUnixTime(start + i * 3600), 'HH:00'),
      requests: 0,
      errors: 0,
    }));
    for (const log of logs) {
      const idx = Math.floor((log.created_at - start) / 3600);
      if (idx >= 0 && idx < 12) {
        buckets[idx].requests += 1;
        if (log.status === 'error') buckets[idx].errors += 1;
      }
    }
    return buckets;
  }, [logs]);

  const alerts = useMemo(() => {
    if (!keys || !logs) return [];
    const items: {
      id: string;
      kind: 'error' | 'credit';
      title: string;
      desc: string;
      to: string;
    }[] = [];
    for (const log of logs.filter((l) => l.status === 'error').slice(0, 3)) {
      items.push({
        id: `e${log.id}`,
        kind: 'error',
        title: `${log.model} 请求失败`,
        desc: log.error_detail ?? '上游错误',
        to: '/logs',
      });
    }
    for (const key of keys.filter((k) => k.enabled && Number(k.credits) < 5)) {
      items.push({
        id: `c${key.id}`,
        kind: 'credit',
        title: `密钥「${key.name}」额度预警`,
        desc: `剩余 ${formatCredits(key.credits)} 积分，请及时调整额度`,
        to: '/keys',
      });
    }
    return items.slice(0, 5);
  }, [keys, logs]);

  return (
    <div className="space-y-6">
      {isMock && (
        <Alert className="rounded-xl border-warning/40 bg-warning/10">
          <AlertTriangle className="size-4 text-warning" />
          <AlertTitle>示例数据模式</AlertTitle>
          <AlertDescription>
            无法连接 Aequi 后端（请检查 VITE_API_BASE_URL），以下为本地示例数据，所有操作仅在本页生效。
          </AlertDescription>
        </Alert>
      )}

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
              <Badge className="rounded-full bg-success/15 text-success" variant="outline">
                <span className="size-1.5 rounded-full bg-success" />
                {health.status || 'ok'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                版本 {health.version ? `v${health.version}` : '未知'}
              </span>
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
                <p className="mt-1 text-xs text-muted-foreground">来自最近请求流水</p>
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
                <p className="mt-1 text-xs text-muted-foreground">剩余额度不足 5 积分</p>
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
          <CardTitle className="text-xl">最近 12 小时请求趋势</CardTitle>
          <CardDescription>请求量与错误量（按小时聚合，数据来自 /api/logs）</CardDescription>
        </CardHeader>
        <CardContent>
          {logs ? (
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
