import { type FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { KeyRound, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toaster } from '@/components/ui/sonner';
import type { IProvider } from '@/data/admin';
import {
  ApiError,
  api,
  clearAccessKey,
  getToken,
  setAccessKey,
  setProfile,
  setToken,
} from '@/lib/api';

/**
 * 登录页分两页：
 *
 * - 第 1 页：管理员账号（面板的完整能力）
 * - 第 2 页：访问密钥（只进入密钥自助视图，看自己的余额与用量）
 *
 * 两种身份互斥，登录任一侧都会清掉另一侧的凭证。
 */
type Page = 'admin' | 'key';

const PAGES = [
  { id: 'admin', label: '管理面板' },
  { id: 'key', label: '访问密钥' },
] as const;

export default function LoginPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState<Page>('admin');
  const [providers, setProviders] = useState<IProvider[]>([]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [needOtp, setNeedOtp] = useState(false);
  const [otpInvalid, setOtpInvalid] = useState(false);

  const [accessKey, setAccessKeyInput] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // 第三方登录方式由后端给出；当前后端返回空列表，这一块自然不显示。
    api
      .providers()
      .then(setProviders)
      .catch(() => setProviders([]));
  }, []);

  if (getToken()) {
    return <Navigate to="/" replace />;
  }

  const switchPage = (next: Page) => {
    setPage(next);
    setError('');
    setOtpInvalid(false);
  };

  const onAdminLogin = async (e: FormEvent) => {
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
      // 两种身份独立存放：管理端登录不再清门户的访问密钥，
      // 同一浏览器里两边可以共存（请求按作用域各带各的凭证）。
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

  const onKeyLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');

    const secret = accessKey.trim();
    try {
      // 先存再验：校验请求本身就要带上这把密钥。
      setAccessKey(secret);
      await api.keyMe();
      toast.success('已进入密钥视图');
      navigate('/portal', { replace: true });
    } catch (err) {
      clearAccessKey();
      setError(err instanceof ApiError ? err.message : '密钥校验失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen justify-center bg-background p-4 pt-16 sm:pt-24">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            {page === 'admin' ? (
              <ShieldCheck className="size-7" />
            ) : (
              <KeyRound className="size-7" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-medium tracking-tight">Aequi 控制台</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {page === 'admin' ? '网关管理面板' : '密钥查询用量'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-card shadow-xs">
          {/* 身份切换固定在卡片顶部：它不该跟着下面的表单内容上下移动 */}
          <div className="grid grid-cols-2 gap-1 border-b border-border/40 p-2">
            {PAGES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => switchPage(item.id)}
                className={`rounded-xl px-4 py-2.5 text-sm transition-colors ${
                  page === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* 内容区高度固定：两页内容量不同，定高之后切换时卡片外框不动 */}
          <div className="flex h-[272px] flex-col justify-center p-6 md:p-8">
            {page === 'admin' ? (
              <form onSubmit={onAdminLogin} className="space-y-5" noValidate>
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
                      className={`h-12 rounded-lg tracking-[0.3em] ${
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
            ) : (
              <form onSubmit={onKeyLogin} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="access-key">访问密钥</Label>
                  <Input
                    id="access-key"
                    type="password"
                    autoComplete="off"
                    value={accessKey}
                    onChange={(e) => setAccessKeyInput(e.target.value)}
                    className="h-12 rounded-lg"
                    placeholder="粘贴你的 API 密钥"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    密钥由管理员发放；登录后只能看到这把密钥自己的余额与用量。
                  </p>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button
                  type="submit"
                  disabled={submitting || !accessKey.trim()}
                  className="h-12 w-full rounded-full text-base"
                >
                  {submitting ? '校验中…' : '进入'}
                </Button>
              </form>
            )}

            {providers.length > 0 && (
              <div className="mt-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border/40" />
                  <span className="text-xs text-muted-foreground">或</span>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                <div className="space-y-2">
                  {providers.map((provider) => (
                    <Button
                      key={provider.id}
                      type="button"
                      variant="secondary"
                      className="h-11 w-full rounded-full"
                      onClick={() => toast.info(`${provider.label} 登录尚未开放`)}
                    >
                      {provider.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Toaster position="top-center" richColors />
      </div>
    </div>
  );
}
