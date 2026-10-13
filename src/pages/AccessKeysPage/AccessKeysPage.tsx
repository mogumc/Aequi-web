import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  ReceiptText,
  Search,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { IAccessKey, IKeyUsage } from '@/data/admin';
import { api, clearToken, isUnauthorized } from '@/lib/api';
import { formatCompact, formatCredits, formatDateTime } from '@/lib/format';

/**
 * 密钥白名单的选择器——**双层筛选**。
 *
 * 第一层是「总表」：所有块配置的可用模型（每个块每个模型一条，形如 `block-a/gpt-4o`）；
 * 第二层是在这份总表上勾选。
 *
 * 条目带块前缀是必须的：同一个模型名出现在两个块里时，那是两条彼此独立的授权——
 * 只勾了 a 的 gpt-4o，就不该被轮询到 b 去。列表只呈现两处都在的条目：白名单里若
 * 残留着已经从块里删掉的名字，那个模型本来就调不到，留着只会让人以为它还能用。
 */
function ModelPicker({
  names,
  selected,
  onChange,
}: {
  names: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (name: string, checked: boolean) => {
    onChange(checked ? [...selected, name] : selected.filter((item) => item !== name));
  };

  const row = (name: string, hint?: string) => (
    <label
      key={name}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
    >
      <Checkbox
        checked={selected.includes(name)}
        onCheckedChange={(checked) => toggle(name, checked === true)}
      />
      <span className="truncate">{name}</span>
      {hint && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{hint}</span>}
    </label>
  );

  if (names.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 px-3 py-2.5 text-xs text-muted-foreground">
        还没有可选的模型——先到「上游配置」里给块添加模型；此处不选表示不限制。
      </p>
    );
  }

  return (
    <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-border/60 p-1.5 pr-2">
      {names.map((name) => row(name))}
    </div>
  );
}

/**
 * 一次取多少把密钥。
 *
 * `/api/keys` 是 page/page_size 分页（不是游标），单页上限 100。下游密钥一般
 * 不多，所以「翻页」就在前端按页追加，不动后端接口。
 */
const KEY_PAGE_SIZE = 100;

export default function AccessKeysPage() {
  const navigate = useNavigate();
  const [keys, setKeys] = useState<IAccessKey[] | null>(null);
  /** 后端报的总数——用来决定还要不要「加载更多」。 */
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // 新建密钥
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCredits, setNewCredits] = useState('');
  const [newUnlimited, setNewUnlimited] = useState(false);
  const [newModels, setNewModels] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  // 编辑 / 额度 / 删除
  const [editKey, setEditKey] = useState<IAccessKey | null>(null);
  const [editName, setEditName] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editModels, setEditModels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [creditKey, setCreditKey] = useState<IAccessKey | null>(null);
  const [creditValue, setCreditValue] = useState('');
  const [creditUnlimited, setCreditUnlimited] = useState(false);
  // 当前展开了完整密钥的那一行（同一时刻只展开一个）。
  const [revealedId, setRevealedId] = useState<string | null>(null);
  // 已配置的模型名（来自各块），供白名单多选。
  const [modelNames, setModelNames] = useState<string[]>([]);

  const [deleteKey, setDeleteKey] = useState<IAccessKey | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  // 用量视图
  const [usageKey, setUsageKey] = useState<IAccessKey | null>(null);

  const handleAuthFail = useCallback(() => {
    clearToken();
    toast.error('登录已过期，请重新登录');
    navigate('/login', { replace: true });
  }, [navigate]);

  const load = useCallback(async () => {
    try {
      // 白名单的候选模型来自各块的配置，和密钥一起取。
      const [list, blocks] = await Promise.all([
        api.listKeys({ page: 1, page_size: KEY_PAGE_SIZE }),
        api.listBlocks(),
      ]);
      setKeys(list.keys);
      setTotal(list.total);
      setPage(1);

      // 白名单的候选是「块 + 模型」的全名：同一个模型名在不同块是两条独立授权，
      // 出口与价格都可能不同，所以必须能分别勾选。
      const names = new Set<string>();
      for (const block of blocks) {
        for (const model of block.models) names.add(`${block.id}/${model.name}`);
      }
      setModelNames([...names].sort());
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '加载失败，请稍后重试');
    }
  }, [handleAuthFail]);

  /** 增量加载下一页：追加到现有列表后面（搜索仍在前端对已加载的部分生效）。 */
  const loadMore = useCallback(async () => {
    if (loadingMore || keys === null || keys.length >= total) return;
    setLoadingMore(true);
    try {
      const next = await api.listKeys({ page: page + 1, page_size: KEY_PAGE_SIZE });
      setKeys((prev) => [...(prev ?? []), ...next.keys]);
      setPage(page + 1);
      setTotal(next.total);
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '加载失败，请稍后重试');
    } finally {
      setLoadingMore(false);
    }
  }, [keys, total, page, loadingMore, handleAuthFail]);

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
      // 列表里露的是密钥 ID，所以它也要能搜——否则从日志抄来的 ID 对不上。
      return (
        k.name.toLowerCase().includes(kw) ||
        k.id.toLowerCase().includes(kw) ||
        k.key_prefix.toLowerCase().includes(kw)
      );
    });
  }, [keys, search, statusFilter]);

  const resetCreateForm = () => {
    setNewName('');
    setNewCredits('');
    setNewUnlimited(false);
    setNewModels([]);
  };

  const onCreate = async () => {
    if (creating) return;
    setCreating(true);
    const credits = newCredits.trim();
    const body = {
      name: newName.trim() || undefined,
      credits: credits || undefined,
      // 只在开启时提交，缺省即有限额度。
      unlimited: newUnlimited || undefined,
      allowed_models: newModels.length > 0 ? newModels : undefined,
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
      // 保存时再取一次交集，确保白名单里不会留下总表里已经没有的名字。
      allowed_models:
        modelNames.length > 0
          ? editModels.filter((name) => modelNames.includes(name))
          : editModels,
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
    // 无限额度不看余额，只有切到有限额度时才校验数值。
    if (!creditUnlimited && (!credits || Number.isNaN(Number(credits)) || Number(credits) < 0)) {
      toast.error('请输入有效的额度数值');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.resetKeyCredits(creditKey.id, {
        credits: credits || undefined,
        unlimited: creditUnlimited,
      });
      setKeys((prev) => prev?.map((k) => (k.id === updated.id ? updated : k)) ?? prev);
      toast.success(
        creditUnlimited ? '已设为无限额度' : `额度已重置为 ${formatCredits(credits)}`,
      );
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

  const copyText = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    if (ok) toast.success(label);
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
              「密钥」列默认显示密钥 ID（与请求日志里的「密钥」是同一个值，便于对照），
              点右侧眼睛查看完整明文
            </CardDescription>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索名称、密钥 ID 或前缀"
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
        <CardContent className="space-y-4">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">名称</TableHead>
                  <TableHead className="whitespace-nowrap">密钥</TableHead>
                  <TableHead className="whitespace-nowrap">剩余额度</TableHead>
                  <TableHead className="whitespace-nowrap">状态</TableHead>
                  <TableHead className="whitespace-nowrap">最近使用</TableHead>
                  <TableHead className="whitespace-nowrap text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys === null ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8 w-full rounded-lg" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                      {keys.length === 0
                        ? '暂无密钥，点击右下角按钮创建第一把'
                        : '没有匹配筛选条件的密钥'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((k) => {
                    // 默认展示密钥 ID（与日志里的「密钥」同值，方便互相对照），
                    // 点眼睛才切到完整明文。
                    const revealed = revealedId === k.id;
                    const shown = revealed ? (k.secret ?? '') : k.id;
                    return (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">
                        <span className="block max-w-[180px] truncate">{k.name || '未命名'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {/* ID 定长 16 位，直接完整展示；明文只有展开时才出现 */}
                          <button
                            type="button"
                            onClick={() => setRevealedId((prev) => (prev === k.id ? null : k.id))}
                            className="flex items-center gap-1.5 rounded-md px-1.5 py-1 font-mono text-xs whitespace-nowrap transition-colors hover:bg-muted"
                            title={revealed ? '点击隐藏，回到密钥 ID' : '点击查看完整密钥明文'}
                          >
                            <span>{shown}</span>
                            {revealed ? (
                              <EyeOff className="size-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <Eye className="size-3.5 shrink-0 text-muted-foreground" />
                            )}
                          </button>
                          {/* 复制恒指向完整明文：与眼睛是否展开无关（这样也能
                              不看明文就复制），按钮语义固定，不会随显示状态漂移 */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 rounded-full"
                            onClick={() => {
                              if (k.secret) void copyText(k.secret, '已复制完整密钥');
                            }}
                            aria-label="复制完整密钥"
                            title="复制完整密钥"
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {k.unlimited ? (
                          <Badge variant="secondary">无限</Badge>
                        ) : (
                          formatCredits(k.credits)
                        )}
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
                            <DropdownMenuItem onClick={() => setUsageKey(k)}>
                              用量
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditKey(k);
                                setEditName(k.name);
                                setEditEnabled(k.enabled);
                                // 只载入总表里仍存在的：已经从块里删掉的模型
                                // 调不到，留在白名单里只会误导。（总表还没加载
                                // 出来时不要清洗，免得把配置误清空。）
                                setEditModels(
                                  modelNames.length > 0
                                    ? (k.allowed_models ?? []).filter((name) =>
                                        modelNames.includes(name),
                                      )
                                    : (k.allowed_models ?? []),
                                );
                              }}
                            >
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setCreditKey(k);
                                setCreditValue(String(Number(k.credits)));
                                setCreditUnlimited(k.unlimited);
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
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* 增量加载：后端每页 100，取完为止（密钥数量通常远小于此） */}
          {keys !== null && keys.length < total && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore && <Loader2 className="size-4 animate-spin" />}
                {loadingMore ? '加载中…' : `加载更多（已显示 ${keys.length}/${total}）`}
              </Button>
            </div>
          )}
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

      {/* 密钥用量（管理员视角，数据与门户同源） */}
      {usageKey && (
        <KeyUsageDialog
          key={usageKey.id}
          accessKey={usageKey}
          open={usageKey !== null}
          onOpenChange={(v) => !v && setUsageKey(null)}
          onAuthFail={handleAuthFail}
        />
      )}

      {/* 新建密钥（含模型白名单多选，与编辑弹窗同宽） */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
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
                placeholder={newUnlimited ? '无限额度下只是个起点' : '如：100'}
                className="rounded-lg"
                disabled={newUnlimited}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
              <div className="space-y-0.5">
                <Label htmlFor="key-unlimited">无限额度</Label>
                <p className="text-xs text-muted-foreground">
                  不设上限，消耗与用量照常记录
                </p>
              </div>
              <Switch id="key-unlimited" checked={newUnlimited} onCheckedChange={setNewUnlimited} />
            </div>
            <div className="space-y-2">
              <Label>允许模型（勾选「块/模型」，不选表示不限制）</Label>
              <ModelPicker names={modelNames} selected={newModels} onChange={setNewModels} />
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

      {/* 密钥明文仅显示一次（44 字符 mono，lg 才放得下一行） */}
      <Dialog open={createdSecret !== null} onOpenChange={(v) => !v && setCreatedSecret(null)}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
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
              onClick={() => createdSecret && void copyText(createdSecret, '已复制到剪贴板')}
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

      {/* 编辑密钥（含模型白名单多选，条目是「块/模型」全名，窄了会挤） */}
      <Dialog open={editKey !== null} onOpenChange={(v) => !v && setEditKey(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
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
              <Label>允许模型（勾选「块/模型」，不选表示不限制）</Label>
              <ModelPicker names={modelNames} selected={editModels} onChange={setEditModels} />
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
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重置余额</DialogTitle>
            <DialogDescription>
              将「{creditKey?.name}」的剩余额度直接重置为新值
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
              placeholder={creditUnlimited ? '无限额度下只是个起点' : '如：50'}
              disabled={creditUnlimited}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="credit-unlimited">无限额度</Label>
              <p className="text-xs text-muted-foreground">
                不设上限，消耗与用量照常记录
              </p>
            </div>
            <Switch
              id="credit-unlimited"
              checked={creditUnlimited}
              onCheckedChange={setCreditUnlimited}
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
        <DialogContent className="rounded-2xl sm:max-w-md">
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

/** 汇总统计的一小格。 */
function UsageStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-lg font-medium tabular-nums" title={value}>
        {value}
      </p>
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * 管理端查看某把访问密钥的用量。
 *
 * 数据与密钥门户同源（`/api/keys/{id}/usage`，结构一致），只是走管理员
 * 认证、可以看任意一把——省得管理员为了核对用量还要拿密钥登一次门户。
 * 大数从 K 起缩写，精确值看悬停；明细游标分页，「查询更多」往后翻。
 */
function KeyUsageDialog({
  accessKey,
  open,
  onOpenChange,
  onAuthFail,
}: {
  accessKey: IAccessKey;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAuthFail: () => void;
}) {
  const [usage, setUsage] = useState<IKeyUsage | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setUsage(null);
    try {
      setUsage(await api.keyUsageOf(accessKey.id, 50));
    } catch (e) {
      if (isUnauthorized(e)) {
        onAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '加载失败，请稍后重试');
    }
  }, [accessKey.id, onAuthFail]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const loadMore = useCallback(async () => {
    if (!usage || loadingMore || !usage.has_more) return;
    const lastId = usage.records.at(-1)?.id;
    if (!lastId) return;
    setLoadingMore(true);
    try {
      const next = await api.keyUsageOf(accessKey.id, 50, lastId);
      setUsage((prev) => (prev ? { ...next, records: [...prev.records, ...next.records] } : next));
    } catch (e) {
      if (isUnauthorized(e)) {
        onAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '加载失败，请稍后重试');
    } finally {
      setLoadingMore(false);
    }
  }, [usage, loadingMore, accessKey.id, onAuthFail]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 rounded-2xl sm:max-w-3xl">
        <DialogHeader className="shrink-0 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="size-5 text-primary" /> 密钥用量 ·{' '}
            {accessKey.name || '未命名'}
          </DialogTitle>
          <DialogDescription>
            {/* 省略号本身就说明没写全，「前缀」两字是噪音，去掉后给内容腾地方 */}
            {accessKey.key_prefix}…{' '}
            {usage?.retention_days ? `最近 ${usage.retention_days} 天内的` : ''}用量记录，更早的已按保留期回收
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {usage ? (
              <>
                <UsageStat
                  label="请求次数"
                  value={formatCompact(usage.summary.requests)}
                  hint={usage.summary.failed > 0 ? `失败 ${usage.summary.failed}` : '全部成功'}
                />
                <UsageStat
                  label="消耗 token"
                  value={formatCompact(usage.summary.final_tokens)}
                  hint={`原始 ${usage.summary.raw_tokens.toLocaleString('zh-CN')}`}
                />
                <UsageStat label="累计消耗" value={formatCompact(usage.summary.credits)} hint="积分" />
                <UsageStat
                  label="剩余额度"
                  value={accessKey.unlimited ? '无限' : formatCompact(accessKey.credits)}
                  hint={accessKey.unlimited ? '消耗仍然照记' : '积分'}
                />
              </>
            ) : (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))
            )}
          </div>

          {usage && usage.records.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">时间</TableHead>
                    <TableHead className="whitespace-nowrap">模型</TableHead>
                    <TableHead className="whitespace-nowrap">输入</TableHead>
                    <TableHead className="whitespace-nowrap">输出</TableHead>
                    <TableHead className="whitespace-nowrap">缓存</TableHead>
                    <TableHead className="whitespace-nowrap">积分</TableHead>
                    <TableHead className="whitespace-nowrap">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(record.created_at)}
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-[180px] truncate font-mono text-xs">
                          {record.model}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {record.prompt_tokens}
                        {record.estimated && (
                          <span className="ml-1 text-xs text-muted-foreground/70">*</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{record.completion_tokens}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {record.cache_tokens}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatCredits(record.credits)}
                      </TableCell>
                      <TableCell>
                        {record.status === 'success' ? (
                          <Badge
                            variant="outline"
                            className="rounded-full bg-success/15 text-success"
                          >
                            成功
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="destructive" className="shrink-0 rounded-full">
                              失败
                            </Badge>
                            {record.error && (
                              <span
                                className="max-w-40 truncate text-xs text-muted-foreground"
                                title={record.error}
                              >
                                {record.error}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : usage ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              这把密钥还没有任何用量记录
            </p>
          ) : (
            <div className="space-y-2">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-9 w-full" />
              ))}
            </div>
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
                {loadingMore && <Loader2 className="size-4 animate-spin" />}
                {loadingMore ? '加载中…' : '查询更早日志'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
