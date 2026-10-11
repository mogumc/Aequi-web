import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  KeyRound,
  LogOut,
  MonitorSmartphone,
  Settings as SettingsIcon,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { IDeviceInfo, IOtpStatus, ISystemSettings } from '@/data/admin';
import {
  ApiError,
  api,
  clearToken,
  getProfile,
  isUnauthorized,
  setProfile,
} from '@/lib/api';
import { formatDateTime } from '@/lib/format';

const DEFAULT_SETTINGS: ISystemSettings = {
  listen: '0.0.0.0:8080',
  cors_origins: ['*'],
  trust_proxy: false,
  token_ttl_hours: 168,
  log_retention_days: 7,
};

interface SettingsDraft {
  listen: string;
  corsText: string;
  trust_proxy: boolean;
  token_ttl_hours: string;
  log_retention_days: string;
}

function draftFrom(s: ISystemSettings): SettingsDraft {
  return {
    listen: s.listen,
    corsText: s.cors_origins.join(', '),
    trust_proxy: s.trust_proxy,
    token_ttl_hours: String(s.token_ttl_hours),
    log_retention_days: String(s.log_retention_days),
  };
}

export default function SettingsPage() {
  const navigate = useNavigate();

  // 服务器配置
  const [saved, setSaved] = useState<ISystemSettings | null>(null);
  const [form, setForm] = useState<SettingsDraft | null>(null);
  const [settingsMock, setSettingsMock] = useState(false);
  const [restartNeeded, setRestartNeeded] = useState<string[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  // 账号 / 安全
  const [profile, setProfileState] = useState(getProfile());
  const [otp, setOtp] = useState<IOtpStatus | null>(null);
  const [otpSetup, setOtpSetup] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [usernameOpen, setUsernameOpen] = useState(false);
  const [unCurrent, setUnCurrent] = useState('');
  const [unNew, setUnNew] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  // 设备
  const [devices, setDevices] = useState<IDeviceInfo[] | null>(null);
  const [kickBusy, setKickBusy] = useState(false);

  // 退出登录
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleAuthFail = useCallback(() => {
    clearToken();
    toast.error('登录已过期，请重新登录');
    navigate('/login', { replace: true });
  }, [navigate]);

  const applySettings = (s: ISystemSettings, mock: boolean) => {
    setSaved(s);
    setForm(draftFrom(s));
    setSettingsMock(mock);
  };

  const loadAll = useCallback(async () => {
    api
      .getSettings()
      .then((s) => applySettings(s, false))
      .catch((e) => {
        if (isUnauthorized(e)) {
          handleAuthFail();
          return;
        }
        applySettings(DEFAULT_SETTINGS, true);
      });

    api
      .me()
      .then((acc) => setProfileState(acc))
      .catch(() => undefined); // 失败时沿用本地缓存 profile

    api
      .getOtp()
      .then(setOtp)
      .catch((e) => {
        if (isUnauthorized(e)) handleAuthFail();
        else setOtp(null);
      });

    api
      .listDevices()
      .then(setDevices)
      .catch((e) => {
        if (isUnauthorized(e)) handleAuthFail();
        else setDevices(null);
      });
  }, [handleAuthFail]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const onSaveSettings = async () => {
    if (!form || !saved || savingSettings) return;
    const ttl = Number(form.token_ttl_hours);
    const retention = Number(form.log_retention_days);
    if (!Number.isFinite(ttl) || ttl <= 0) {
      toast.error('令牌有效期必须是正数（小时）');
      return;
    }
    if (!Number.isInteger(retention) || retention < 1 || retention > 365) {
      toast.error('日志保留天数范围 1-365');
      return;
    }
    const cors = form.corsText
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const patch: Partial<ISystemSettings> = {};
    const restartFields: string[] = [];
    if (form.listen !== saved.listen) {
      patch.listen = form.listen;
      restartFields.push('listen');
    }
    if (JSON.stringify(cors) !== JSON.stringify(saved.cors_origins)) {
      patch.cors_origins = cors;
      restartFields.push('cors_origins');
    }
    if (form.trust_proxy !== saved.trust_proxy) patch.trust_proxy = form.trust_proxy;
    if (ttl !== saved.token_ttl_hours) patch.token_ttl_hours = ttl;
    if (retention !== saved.log_retention_days) patch.log_retention_days = retention;
    if (Object.keys(patch).length === 0) {
      toast.info('配置没有变更');
      return;
    }

    setSavingSettings(true);
    try {
      const updated = await api.updateSettings(patch);
      applySettings(updated, false);
      setRestartNeeded(restartFields);
      toast.success('配置已保存');
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      const updated: ISystemSettings = {
        ...saved,
        ...(Object.keys(patch).length > 0 ? patch : {}),
        cors_origins: cors,
        token_ttl_hours: ttl,
        log_retention_days: retention,
        trust_proxy: form.trust_proxy,
        listen: form.listen,
      };
      applySettings(updated, true);
      toast.error(e instanceof Error ? e.message : '保存失败，请稍后重试');
    } finally {
      setSavingSettings(false);
    }
  };

  const onChangePassword = async () => {
    if (savingPw) return;
    if (!pwCurrent || !pwNew || !pwConfirm) {
      toast.error('请填写完整密码字段');
      return;
    }
    if (pwNew !== pwConfirm) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    setSavingPw(true);
    try {
      const res = await api.changePassword({
        current_password: pwCurrent,
        new_password: pwNew,
        confirm_password: pwConfirm,
      });
      toast.success(`密码已修改${res.revoked ? `，已撤销其它 ${res.revoked} 台设备` : ''}`);
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof ApiError ? e.message : '修改密码失败');
    } finally {
      setSavingPw(false);
    }
  };

  const onChangeUsername = async () => {
    if (savingUsername) return;
    const username = unNew.trim();
    if (!unCurrent || !username) {
      toast.error('请输入当前密码与新用户名');
      return;
    }
    if (username.length > 64) {
      toast.error('用户名最长 64 字符');
      return;
    }
    setSavingUsername(true);
    try {
      const acc = await api.updateUsername({
        current_password: unCurrent,
        username,
      });
      setProfileState(acc);
      setProfile(acc);
      toast.success('用户名已更新');
      setUsernameOpen(false);
      setUnCurrent('');
      setUnNew('');
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof ApiError ? e.message : '修改用户名失败');
    } finally {
      setSavingUsername(false);
    }
  };

  const refreshOtp = () => {
    api
      .getOtp()
      .then(setOtp)
      .catch(() => undefined);
  };

  const onStartOtpSetup = async () => {
    if (otpBusy) return;
    setOtpBusy(true);
    try {
      const setup = await api.setupOtp();
      setOtpSetup(setup);
      setOtpCode('');
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof ApiError ? e.message : '获取 OTP 密钥失败');
    } finally {
      setOtpBusy(false);
    }
  };

  const onEnableOtp = async () => {
    if (otpBusy) return;
    if (!otpCode.trim()) {
      toast.error('请输入验证器 App 中的 6 位验证码');
      return;
    }
    setOtpBusy(true);
    try {
      await api.enableOtp(otpCode.trim());
      toast.success('两步验证已启用');
      setOtpSetup(null);
      setOtpCode('');
      refreshOtp();
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof ApiError ? e.message : '验证码校验失败');
    } finally {
      setOtpBusy(false);
    }
  };

  const onDisableOtp = async () => {
    if (otpBusy) return;
    setOtpBusy(true);
    try {
      await api.disableOtp(disableCode.trim() || undefined);
      toast.success('两步验证已关闭');
      setDisableOpen(false);
      setDisableCode('');
      refreshOtp();
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof ApiError ? e.message : '关闭两步验证失败');
    } finally {
      setOtpBusy(false);
    }
  };

  const onKick = async (id: string) => {
    if (kickBusy) return;
    setKickBusy(true);
    try {
      await api.removeDevice(id);
      setDevices((prev) => prev?.filter((d) => d.id !== id) ?? prev);
      toast.success('该设备已移出');
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof ApiError ? e.message : '移出设备失败');
    } finally {
      setKickBusy(false);
    }
  };

  const onKickAll = async () => {
    if (kickBusy) return;
    setKickBusy(true);
    try {
      const res = await api.removeAllDevices();
      setDevices((prev) => prev?.filter((d) => d.current) ?? prev);
      toast.success(`已移出其它 ${res.revoked ?? 0} 台设备`);
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof ApiError ? e.message : '批量移出失败');
    } finally {
      setKickBusy(false);
    }
  };

  const onLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api.logout();
    } catch {
      // 无论服务端是否成功，本地一律登出
    } finally {
      clearToken();
      toast.success('已退出登录');
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="space-y-6">
      {settingsMock && (
        <Alert className="rounded-xl border-warning/40 bg-warning/10">
          <AlertTitle>示例配置模式</AlertTitle>
          <AlertDescription>
            无法连接 Aequi 后端（GET /api/settings 失败），展示默认配置；保存仅在本页生效。
          </AlertDescription>
        </Alert>
      )}

      {/* 服务器配置 */}
      <Card className="rounded-2xl border-none shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <SettingsIcon className="size-5 text-primary" /> 服务器配置
          </CardTitle>
          <CardDescription>PATCH /api/settings 部分更新，只提交有变更的字段</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {restartNeeded.length > 0 && (
            <Alert className="rounded-xl border-warning/40 bg-warning/10">
              <TriangleAlert className="size-4 text-warning" />
              <AlertTitle>部分配置需重启生效</AlertTitle>
              <AlertDescription>
                以下字段已变更但需重启后端进程才能生效：{restartNeeded.join('、')}
              </AlertDescription>
            </Alert>
          )}
          {form ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cfg-listen">监听地址（重启生效）</Label>
                  <Input
                    id="cfg-listen"
                    value={form.listen}
                    onChange={(e) => setForm({ ...form, listen: e.target.value })}
                    className="rounded-lg font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cfg-cors">CORS 允许来源（逗号分隔，重启生效）</Label>
                  <Input
                    id="cfg-cors"
                    value={form.corsText}
                    onChange={(e) => setForm({ ...form, corsText: e.target.value })}
                    className="rounded-lg font-mono text-sm"
                    placeholder="* 或 https://example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cfg-ttl">登录令牌有效期（小时）</Label>
                  <Input
                    id="cfg-ttl"
                    inputMode="numeric"
                    value={form.token_ttl_hours}
                    onChange={(e) => setForm({ ...form, token_ttl_hours: e.target.value })}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cfg-retention">日志保留天数（1-365）</Label>
                  <Input
                    id="cfg-retention"
                    inputMode="numeric"
                    value={form.log_retention_days}
                    onChange={(e) => setForm({ ...form, log_retention_days: e.target.value })}
                    className="rounded-lg"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3">
                <div>
                  <Label htmlFor="cfg-proxy">信任反向代理头</Label>
                  <p className="text-xs text-muted-foreground">
                    直连部署时保持关闭，否则来源 IP 可被伪造
                  </p>
                </div>
                <Switch
                  id="cfg-proxy"
                  checked={form.trust_proxy}
                  onCheckedChange={(v) => setForm({ ...form, trust_proxy: v })}
                />
              </div>
              <div>
                <Button className="rounded-full" disabled={savingSettings} onClick={() => void onSaveSettings()}>
                  {savingSettings ? '保存中…' : '保存配置'}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-1/2 rounded-lg" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 个人安全 */}
      <Card className="rounded-2xl border-none shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="size-5 text-primary" /> 个人安全
          </CardTitle>
          {profile && (
            <CardDescription>
              {profile.username} · 两步验证{profile.totp_enabled ? '已启用' : '未启用'}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 账号 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">账号信息</p>
              <p className="text-xs text-muted-foreground">
                修改用户名需要验证当前密码，改名不会踢出其它设备
              </p>
            </div>
            <Button
              variant="secondary"
              className="rounded-full"
              onClick={() => {
                setUnCurrent('');
                setUnNew(profile?.username ?? '');
                setUsernameOpen(true);
              }}
            >
              修改用户名
            </Button>
          </div>
          <Separator />
          {/* 改密码 */}
          <div className="space-y-3">
            <p className="text-sm font-medium">修改密码</p>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pw-current">当前密码</Label>
                <Input
                  id="pw-current"
                  type="password"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-new">新密码</Label>
                <Input
                  id="pw-new"
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-confirm">确认新密码</Label>
                <Input
                  id="pw-confirm"
                  type="password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  className="rounded-lg"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">修改成功后将自动撤销其它全部已登录设备</p>
            <Button
              variant="secondary"
              className="rounded-full"
              disabled={savingPw}
              onClick={() => void onChangePassword()}
            >
              <KeyRound className="size-4" /> {savingPw ? '提交中…' : '修改密码'}
            </Button>
          </div>
          <Separator />
          {/* OTP */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">两步验证（TOTP）</p>
                <p className="text-xs text-muted-foreground">
                  启用后登录需要输入验证器 App 的动态验证码
                </p>
              </div>
              {otp === null ? (
                <Skeleton className="h-9 w-24 rounded-full" />
              ) : otp.enabled ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full bg-success/15 text-success">
                    已启用
                  </Badge>
                  <Button
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => {
                      setDisableCode('');
                      setDisableOpen(true);
                    }}
                  >
                    关闭两步验证
                  </Button>
                </div>
              ) : (
                <Button className="rounded-full" disabled={otpBusy} onClick={() => void onStartOtpSetup()}>
                  {otpBusy ? '生成中…' : '启用两步验证'}
                </Button>
              )}
            </div>

            {otpSetup && (
              <div className="flex flex-col items-start gap-4 rounded-xl bg-secondary/50 p-4 md:flex-row md:items-center">
                <div className="rounded-xl bg-background p-2">
                  <QRCodeSVG value={otpSetup.otpauth_url} size={128} />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-medium">1. 用验证器 App 扫描二维码</p>
                  <p className="break-all font-mono text-xs text-muted-foreground">
                    密钥：{otpSetup.secret}
                  </p>
                  <div className="flex max-w-xs items-center gap-2">
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="2. 输入 6 位验证码"
                      className="rounded-lg font-mono tracking-[0.3em]"
                    />
                    <Button className="shrink-0 rounded-full" disabled={otpBusy} onClick={() => void onEnableOtp()}>
                      确认启用
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Separator />
          {/* 设备 */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <MonitorSmartphone className="size-4" /> 已登录设备
              </p>
              <Button
                variant="secondary"
                className="rounded-full"
                disabled={kickBusy || !devices?.some((d) => !d.current)}
                onClick={() => void onKickAll()}
              >
                移出其它全部设备
              </Button>
            </div>
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">设备（令牌前缀）</TableHead>
                    <TableHead className="whitespace-nowrap">IP</TableHead>
                    <TableHead className="whitespace-nowrap">最近在线</TableHead>
                    <TableHead className="whitespace-nowrap">状态</TableHead>
                    <TableHead className="whitespace-nowrap text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices === null ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        设备列表不可用（后端未连接）
                      </TableCell>
                    </TableRow>
                  ) : devices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        暂无在线设备记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    devices.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
                            {d.token_prefix}
                          </code>
                          <p className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground">
                            {d.user_agent}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs">{d.ip}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(d.last_seen_at)}
                        </TableCell>
                        <TableCell>
                          {d.current ? (
                            <Badge variant="outline" className="rounded-full bg-primary/10 text-primary">
                              当前设备
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="rounded-full">
                              在线
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full text-destructive hover:text-destructive"
                            disabled={kickBusy || d.current}
                            onClick={() => void onKick(d.id)}
                          >
                            移出
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 危险操作 */}
      <Card className="rounded-2xl border-none shadow-xs">
        <CardHeader>
          <CardTitle className="text-xl">退出登录</CardTitle>
          <CardDescription>退出当前会话并返回登录页</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" className="rounded-full" onClick={() => setLogoutOpen(true)}>
            <LogOut className="size-4" /> 退出登录
          </Button>
        </CardContent>
      </Card>

      {/* 关闭 OTP */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>关闭两步验证</DialogTitle>
            <DialogDescription>如验证器仍可用，建议输入当前验证码确认操作</DialogDescription>
          </DialogHeader>
          <Input
            inputMode="numeric"
            maxLength={6}
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value)}
            placeholder="验证码（可选）"
            className="rounded-lg font-mono tracking-[0.3em]"
          />
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setDisableOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" className="rounded-full" disabled={otpBusy} onClick={() => void onDisableOtp()}>
              {otpBusy ? '处理中…' : '确认关闭'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 修改用户名 */}
      <Dialog open={usernameOpen} onOpenChange={setUsernameOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>修改用户名</DialogTitle>
            <DialogDescription>需验证当前密码</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="un-current">当前密码</Label>
              <Input
                id="un-current"
                type="password"
                value={unCurrent}
                onChange={(e) => setUnCurrent(e.target.value)}
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="un-new">新用户名</Label>
              <Input
                id="un-new"
                value={unNew}
                onChange={(e) => setUnNew(e.target.value)}
                maxLength={64}
                className="rounded-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setUsernameOpen(false)}>
              取消
            </Button>
            <Button className="rounded-full" disabled={savingUsername} onClick={() => void onChangeUsername()}>
              {savingUsername ? '提交中…' : '确认修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 退出登录确认 */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>退出登录</DialogTitle>
            <DialogDescription>将清除本机的管理员登录令牌</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setLogoutOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" className="rounded-full" disabled={loggingOut} onClick={() => void onLogout()}>
              {loggingOut ? '退出中…' : '确认退出'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
