import { type FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toaster } from '@/components/ui/sonner';
import { ApiError, api, getToken, setProfile, setToken } from '@/lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [needOtp, setNeedOtp] = useState(false);
  const [otpInvalid, setOtpInvalid] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (getToken()) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setOtpInvalid(false);
    try {
      const res = await api.login({
        username,
        password,
        otp: needOtp && otp ? otp : undefined,
      });
      setToken(res.token);
      setProfile({
        id: res.account.id,
        username: res.account.username,
        totp_enabled: res.account.totp_enabled,
        created_at: res.account.created_at,
      });
      toast.success('登录成功');
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.type === 'totp_required') {
          setNeedOtp(true);
          setError('该账号已启用两步验证，请输入验证码');
        } else if (err.type === 'invalid_totp') {
          setNeedOtp(true);
          setOtpInvalid(true);
          setError(err.message);
        } else {
          setError(err.message);
        }
      } else {
        setError('登录失败，请稍后重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onDemo = () => {
    setToken('demo-token');
    toast.info('已进入演示模式，页面数据为本地示例');
    navigate('/', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-medium tracking-tight">Aequi 控制台</h1>
            <p className="mt-1 text-sm text-muted-foreground">API 网关管理面板</p>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-6 shadow-xs md:p-8">
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 rounded-lg"
                placeholder="管理员用户名"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-lg"
                placeholder="管理员密码"
                required
              />
            </div>
            {needOtp && (
              <div className="space-y-2">
                <Label htmlFor="otp">两步验证码</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className={`h-12 rounded-lg font-mono tracking-[0.3em] ${
                    otpInvalid ? 'ring-2 ring-destructive' : ''
                  }`}
                  placeholder="6 位验证码"
                  maxLength={6}
                />
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={submitting || !username || !password || (needOtp && !otp)}
              className="h-12 w-full rounded-full text-base"
            >
              {submitting ? '登录中…' : '登录'}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-xs text-muted-foreground">或</span>
            <div className="h-px flex-1 bg-border/40" />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={onDemo}
            className="h-11 w-full rounded-full"
          >
            演示模式进入（无需后端）
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          生产环境请在构建时通过 VITE_API_BASE_URL 指定 Aequi 后端地址
        </p>
      </div>
      <Toaster position="top-center" richColors />
    </div>
  );
}
