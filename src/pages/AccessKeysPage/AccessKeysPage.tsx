import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import { Copy, KeyRound, Plus, Search } from 'lucide-react';

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import type { IAccessKey } from '@/data/admin';
import { api, clearToken, isUnauthorized } from '@/lib/api';
import { formatCredits, formatDateTime } from '@/lib/format';
function parseModels(text: string): string[] | null {
  const list = text
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

export default function AccessKeysPage() {
  const navigate = useNavigate();
  const [keys, setKeys] = useState<IAccessKey[] | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // 新建密钥
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCredits, setNewCredits] = useState('');
  const [newModels, setNewModels] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  // 编辑 / 额度 / 删除
  const [editKey, setEditKey] = useState<IAccessKey | null>(null);
  const [editName, setEditName] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editModels, setEditModels] = useState('');
  const [saving, setSaving] = useState(false);

  const [creditKey, setCreditKey] = useState<IAccessKey | null>(null);
  const [creditValue, setCreditValue] = useState('');

  const [deleteKey, setDeleteKey] = useState<IAccessKey | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const handleAuthFail = useCallback(() => {
    clearToken();
    toast.error('登录已过期，请重新登录');
    navigate('/login', { replace: true });
  }, [navigate]);

  const load = useCallback(async () => {
    try {
      const list = await api.listKeys();
      setKeys(list.keys);
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
    if (!keys) return [];
    const kw = search.trim().toLowerCase();
    return keys.filter((k) => {
      if (statusFilter === 'active' && !k.enabled) return false;
      if (statusFilter === 'disabled' && k.enabled) return false;
      if (!kw) return true;
      return (
        k.name.toLowerCase().includes(kw) || k.key_prefix.toLowerCase().includes(kw)
      );
    });
  }, [keys, search, statusFilter]);

  const resetCreateForm = () => {
    setNewName('');
    setNewCredits('');
    setNewModels('');
  };

  const onCreate = async () => {
    if (creating) return;
    setCreating(true);
    const credits = newCredits.trim();
    const body = {
      name: newName.trim() || undefined,
      credits: credits || undefined,
      allowed_models: parseModels(newModels) ?? undefined,
    };
    try {
      const created = await api.createKey(body);
      setKeys((prev) => [created, ...(prev ?? [])]);
      setCreatedSecret(created.secret ?? '');
      toast.success('密钥创建成功');
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '创建失败，请稍后重试');
    } finally {
      setCreating(false);
      setCreateOpen(false);
      resetCreateForm();
    }
  };

  const onEdit = async () => {
    if (!editKey || saving) return;
    setSaving(true);
    const patch = {
      name: editName.trim(),
      enabled: editEnabled,
      allowed_models: parseModels(editModels),
    };
    try {
      const updated = await api.updateKey(editKey.id, patch);
      setKeys((prev) => prev?.map((k) => (k.id === updated.id ? updated : k)) ?? prev);
      toast.success('密钥已更新');
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '更新失败，请稍后重试');
    } finally {
      setSaving(false);
      setEditKey(null);
    }
  };

  const onResetCredits = async () => {
    if (!creditKey || saving) return;
    const credits = creditValue.trim();
    if (!credits || Number.isNaN(Number(credits)) || Number(credits) < 0) {
      toast.error('请输入有效的额度数值');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.resetKeyCredits(creditKey.id, credits);
      setKeys((prev) => prev?.map((k) => (k.id === updated.id ? updated : k)) ?? prev);
      toast.success(`额度已重置为 ${formatCredits(credits)}`);
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '重置失败，请稍后重试');
    } finally {
      setSaving(false);
      setCreditKey(null);
    }
  };

  const onDelete = async () => {
    if (!deleteKey || saving) return;
    setSaving(true);
    try {
      await api.deleteKey(deleteKey.id);
      setKeys((prev) => prev?.filter((k) => k.id !== deleteKey.id) ?? prev);
      toast.success('密钥已删除');
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '删除失败，请稍后重试');
    } finally {
      setSaving(false);
      setDeleteKey(null);
      setDeleteConfirm('');
    }
  };

  const copySecret = async (secret: string) => {
    const ok = await copyToClipboard(secret);
    if (ok) toast.success('已复制到剪贴板');
    else toast.error('复制失败，请手动选择复制');
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-none shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <KeyRound className="size-5 text-primary" /> 访问密钥
          </CardTitle>
          <CardDescription>
            密钥明文（ak_ 开头）仅在创建时展示一次，列表中仅显示前缀
          </CardDescription>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索名称或密钥前缀"
                className="rounded-full bg-background pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full rounded-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">启用中</SelectItem>
                <SelectItem value="disabled">已禁用</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">名称</TableHead>
                  <TableHead className="whitespace-nowrap">密钥前缀</TableHead>
                  <TableHead className="whitespace-nowrap">剩余额度</TableHead>
                  <TableHead className="whitespace-nowrap">允许模型</TableHead>
                  <TableHead className="whitespace-nowrap">状态</TableHead>
                  <TableHead className="whitespace-nowrap">最近使用</TableHead>
                  <TableHead className="whitespace-nowrap text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys === null ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-8 w-full rounded-lg" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                      {keys.length === 0
                        ? '暂无密钥，点击右下角按钮创建第一把'
                        : '没有匹配筛选条件的密钥'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">
                        <span className="block max-w-[180px] truncate">{k.name || '未命名'}</span>
                      </TableCell>
                      <TableCell>
                        <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {k.key_prefix}…
                        </code>
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatCredits(k.credits)}
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-[200px] truncate text-muted-foreground">
                          {k.allowed_models ? k.allowed_models.join(', ') : '不限制'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {k.enabled ? (
                          <Badge variant="outline" className="rounded-full bg-success/15 text-success">
                            启用中
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="rounded-full">
                            已禁用
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {k.last_used_at ? formatDateTime(k.last_used_at) : '从未使用'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="rounded-full">
                              操作
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditKey(k);
                                setEditName(k.name);
                                setEditEnabled(k.enabled);
                                setEditModels(k.allowed_models?.join(', ') ?? '');
                              }}
                            >
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setCreditKey(k);
                                setCreditValue(String(Number(k.credits)));
                              }}
                            >
                              调整额度
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                setDeleteKey(k);
                                setDeleteConfirm('');
                              }}
                            >
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* M3 FAB：页面唯一主动作 = 新建密钥 */}
      <Button
        size="icon"
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-8 right-8 z-30 size-14 rounded-2xl shadow-lg"
        aria-label="新建密钥"
      >
        <Plus className="size-6" />
      </Button>

      {/* 新建密钥 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建访问密钥</DialogTitle>
            <DialogDescription>创建后仅本次展示完整密钥明文，请立即保存</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">名称</Label>
              <Input
                id="key-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="如：数据组-日常调用"
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-credits">初始额度（积分，四位小数）</Label>
              <Input
                id="key-credits"
                inputMode="decimal"
                value={newCredits}
                onChange={(e) => setNewCredits(e.target.value)}
                placeholder="如：100"
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-models">允许模型（逗号分隔，留空不限制）</Label>
              <Input
                id="key-models"
                value={newModels}
                onChange={(e) => setNewModels(e.target.value)}
                placeholder="如：gpt-4o, gpt-4o-mini"
                className="rounded-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button className="rounded-full" disabled={creating} onClick={() => void onCreate()}>
              {creating ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 密钥明文仅显示一次 */}
      <Dialog open={createdSecret !== null} onOpenChange={(v) => !v && setCreatedSecret(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>请保存密钥明文</DialogTitle>
            <DialogDescription>关闭后将无法再次查看完整密钥</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
            <code className="min-w-0 flex-1 break-all font-mono text-sm">{createdSecret}</code>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0 rounded-full"
              onClick={() => createdSecret && void copySecret(createdSecret)}
              aria-label="复制密钥"
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button className="rounded-full" onClick={() => setCreatedSecret(null)}>
              我已保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑密钥 */}
      <Dialog open={editKey !== null} onOpenChange={(v) => !v && setEditKey(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑密钥</DialogTitle>
            <DialogDescription>{editKey?.key_prefix}…</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">名称</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-lg"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3">
              <Label htmlFor="edit-enabled">启用状态</Label>
              <Switch id="edit-enabled" checked={editEnabled} onCheckedChange={setEditEnabled} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-models">允许模型（逗号分隔，留空不限制）</Label>
              <Input
                id="edit-models"
                value={editModels}
                onChange={(e) => setEditModels(e.target.value)}
                className="rounded-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setEditKey(null)}>
              取消
            </Button>
            <Button className="rounded-full" disabled={saving} onClick={() => void onEdit()}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 调整额度 */}
      <Dialog open={creditKey !== null} onOpenChange={(v) => !v && setCreditKey(null)}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>重置余额</DialogTitle>
            <DialogDescription>
              将「{creditKey?.name}」的剩余额度直接重置为新值（POST /api/keys/{creditKey?.id}/credits）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="credit-value">新额度（积分）</Label>
            <Input
              id="credit-value"
              inputMode="decimal"
              value={creditValue}
              onChange={(e) => setCreditValue(e.target.value)}
              className="rounded-lg"
              placeholder="如：50"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setCreditKey(null)}>
              取消
            </Button>
            <Button className="rounded-full" disabled={saving} onClick={() => void onResetCredits()}>
              {saving ? '提交中…' : '确认重置'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除密钥（输入名称二次确认） */}
      <Dialog open={deleteKey !== null} onOpenChange={(v) => !v && setDeleteKey(null)}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>删除密钥</DialogTitle>
            <DialogDescription>
              该密钥的用量记录将随级联清理，且不可恢复。请输入密钥名称「{deleteKey?.name}」确认。
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            className="rounded-lg"
            placeholder={deleteKey?.name}
          />
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setDeleteKey(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={saving || deleteConfirm !== deleteKey?.name}
              onClick={() => void onDelete()}
            >
              {saving ? '删除中…' : '永久删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
