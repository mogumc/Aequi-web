import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import {
  Copy,
  Eye,
  EyeOff,
  FlaskConical,
  Loader2,
  Network,
  Pause,
  Play,
  Plus,
  Trash2,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { VirtualList } from '@/components/virtual-list';
import {
  type IBlockInput,
  type IBlockModel,
  type IUpstreamBlock,
  type IUpstreamKey,
} from '@/data/admin';
import { ApiError, api, clearToken, isUnauthorized } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { cleanHeaders, findHeaderProblem, type IHeaderRow } from '@/lib/headers';
import { ModelEditor } from '@/components/model-editor';
import { HeaderEditor } from '@/components/header-editor';

const API_FORMATS = ['openai', 'google', 'anthropic'] as const;

/** 块内密钥管理对话框 */
function BlockKeysDialog({
  block,
  open,
  onOpenChange,
  onAuthFail,
}: {
  block: IUpstreamBlock | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAuthFail: () => void;
}) {
  const [keys, setKeys] = useState<IUpstreamKey[] | null>(null);
  const [secretsText, setSecretsText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // 密钥展示：默认只露前缀，点击眼睛展开完整明文（管理员本就可取回）。
  const [revealedId, setRevealedId] = useState<string | null>(null);
  // 一键测试全部：前端按顺序逐把发送，进度 {done, total} 驱动按钮文案。
  const [testAll, setTestAll] = useState<{ done: number; total: number } | null>(null);

  const blockId = block?.id ?? '';

  const loadKeys = useCallback(async () => {
    if (!blockId) return;
    setKeys(null);
    try {
      const list = await api.listBlockKeys(blockId);
      setKeys(list);
    } catch (e) {
      if (isUnauthorized(e)) {
        onAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '加载失败，请稍后重试');
    }
  }, [blockId, onAuthFail]);

  useEffect(() => {
    if (open) void loadKeys();
  }, [open, loadKeys]);

  const batchAction = async (
    action: 'pause' | 'resume' | 'remove',
    keyId: string,
    label: string,
  ) => {
    if (!blockId || busyId !== null) return;
    setBusyId(keyId);
    try {
      if (action === 'pause') await api.pauseBlockKeys(blockId, [keyId]);
      else if (action === 'resume') await api.resumeBlockKeys(blockId, [keyId]);
      else await api.removeBlockKeys(blockId, [keyId]);
      toast.success(label);

      // 成功之后再更新本地列表，省一次往返；失败时列表保持原样。
      if (action === 'pause') {
        setKeys((prev) => prev?.map((k) => (k.id === keyId ? { ...k, status: 'paused' } : k)) ?? prev);
      } else if (action === 'resume') {
        setKeys(
          (prev) =>
            prev?.map((k) =>
              k.id === keyId
                ? { ...k, status: 'active', failure_count: 0, cooldown_until: null }
                : k,
            ) ?? prev,
        );
      } else {
        setKeys((prev) => prev?.filter((k) => k.id !== keyId) ?? prev);
      }
    } catch (e) {
      if (isUnauthorized(e)) {
        onAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '操作失败，请稍后重试');
    } finally {
      setBusyId(null);
    }
  };

  const onTest = async (keyId: string) => {
    if (!blockId || busyId !== null) return;
    setBusyId(keyId);
    toast.info('正在测试密钥（走列表模型接口，不消耗 token）…');
    try {
      await api.testBlockKey(blockId, keyId);
      toast.success('测试完成，最新状态已落库');
    } catch (e) {
      if (isUnauthorized(e)) {
        onAuthFail();
        return;
      }
      toast.warning(`测试请求未完成：${e instanceof ApiError ? e.message : '未知错误'}`);
    } finally {
      setBusyId(null);
      void loadKeys();
    }
  };

  /**
   * 一键测试全部：前端按顺序逐把发送单把测试请求，不需要后端批量接口。
   * 单把失败（网络抖动等）不中断整轮，最终状态以刷新后的落库结果为准。
   */
  const onTestAll = async () => {
    if (!blockId || testAll !== null || keys === null || keys.length === 0) return;
    setTestAll({ done: 0, total: keys.length });
    for (const k of keys) {
      try {
        await api.testBlockKey(blockId, k.id);
      } catch {
        // 单把失败不算整轮失败，坏密钥会被测试接口自动停用。
      }
      setTestAll((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
    }
    toast.success('整块测试完成，最新状态已落库');
    setTestAll(null);
    void loadKeys();
  };

  const onAdd = async () => {
    if (!blockId || adding) return;
    const secrets = secretsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (secrets.length === 0) {
      toast.error('请输入至少一条上游密钥');
      return;
    }
    setAdding(true);
    try {
      const { keys, skipped } = await api.addBlockKeys(blockId, secrets);
      if (keys.length === 0) {
        toast.warning(`没有新增密钥：${skipped} 条与已有密钥重复`);
      } else if (skipped > 0) {
        toast.success(`新增 ${keys.length} 条密钥，跳过 ${skipped} 条重复`);
      } else {
        toast.success(`已添加 ${keys.length} 条密钥`);
      }
    } catch (e) {
      if (isUnauthorized(e)) {
        onAuthFail();
        return;
      }
      toast.warning(`后端未连接，示例未变更（${e instanceof ApiError ? e.message : '未知错误'}）`);
    } finally {
      setAdding(false);
      setSecretsText('');
      void loadKeys();
    }
  };

  const statusBadge = (status: IUpstreamKey['status']) => {
    if (status === 'active') {
      return (
        <Badge variant="outline" className="rounded-full bg-success/15 text-success">
          正常
        </Badge>
      );
    }
    if (status === 'paused') {
      return <Badge variant="secondary" className="rounded-full">已暂停</Badge>;
    }
    return <Badge variant="destructive" className="rounded-full">已停用</Badge>;
  };

  /**
   * 密钥展示：默认显示密钥 ID（定长 16 位，完整展示也不会撑破布局），
   * 点眼睛才切到完整明文——明文只在需要时露面。
   */
  const secretView = (k: IUpstreamKey) => {
    const revealed = revealedId === k.id;
    const shown = revealed ? k.secret : k.id;
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <code
          className="min-w-0 flex-1 truncate rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs"
          title={k.last_error ?? shown}
        >
          {shown}
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 rounded-full text-muted-foreground"
          onClick={() => setRevealedId((prev) => (prev === k.id ? null : k.id))}
          aria-label={revealed ? '隐藏完整密钥' : '查看完整密钥'}
          title={revealed ? '点击隐藏，回到密钥 ID' : '点击查看完整密钥明文'}
        >
          {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </Button>
        {/* 复制恒指向完整明文，与眼睛是否展开无关 */}
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 rounded-full text-muted-foreground"
          onClick={() => {
            void copyToClipboard(k.secret);
            toast.success('已复制完整密钥');
          }}
          aria-label="复制完整密钥"
          title="复制完整密钥"
        >
          <Copy className="size-3.5" />
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col rounded-2xl sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>块内密钥 · {block?.name}</DialogTitle>
          <DialogDescription>
            密钥生命周期自治：成功清零失败计数、429 退避 30 秒、连续失败 3 次自动停用
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {keys !== null && keys.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">共 {keys.length} 条密钥</span>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-8 rounded-full text-xs"
                disabled={testAll !== null || busyId !== null}
                onClick={() => void onTestAll()}
              >
                {testAll ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FlaskConical className="size-3.5" />
                )}
                {testAll ? `测试中 ${testAll.done}/${testAll.total}` : '一键测试全部'}
              </Button>
            </div>
          )}

          {keys === null ? (
            <div className="space-y-2">
              {[0, 1].map((row) => (
                <Skeleton key={row} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {keys.length > 0 && (
                <div className="flex items-center gap-2 border-b border-border/60 px-2.5 pb-1.5 text-xs text-muted-foreground">
                  <span className="min-w-0 flex-1">密钥</span>
                  <span className="w-16 shrink-0">状态</span>
                  <span className="w-12 shrink-0 text-center">失败</span>
                  <span className="w-28 shrink-0">最近使用</span>
                  <span className="w-[100px] shrink-0 text-right">操作</span>
                </div>
              )}
              <VirtualList
                items={keys}
                itemHeight={56}
                maxHeight={360}
                getItemKey={(k) => k.id}
                empty={
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    该块暂无上游密钥，请在下方添加
                  </p>
                }
                renderItem={(k) => (
                  <div className="flex h-12 w-full items-center gap-2 rounded-lg border border-border/60 px-2.5">
                    {secretView(k)}
                    <div className="w-16 shrink-0">{statusBadge(k.status)}</div>
                    <span
                      className="w-12 shrink-0 text-center text-xs tabular-nums text-muted-foreground"
                      title={k.failure_count > 0 ? '连续失败次数' : undefined}
                    >
                      {k.failure_count}
                    </span>
                    <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                      {k.last_used_at ? formatDateTime(k.last_used_at) : '从未'}
                    </span>
                    <div className="flex w-[100px] shrink-0 justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 rounded-full"
                        disabled={busyId === k.id || testAll !== null}
                        onClick={() => void onTest(k.id)}
                        aria-label="测试密钥"
                      >
                        {busyId === k.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <FlaskConical className="size-4" />
                        )}
                      </Button>
                      {k.status === 'paused' ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 rounded-full"
                          disabled={busyId === k.id || testAll !== null}
                          onClick={() => void batchAction('resume', k.id, '已恢复该密钥')}
                          aria-label="恢复"
                        >
                          <Play className="size-4" />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 rounded-full"
                          disabled={busyId === k.id || testAll !== null}
                          onClick={() => void batchAction('pause', k.id, '已暂停该密钥')}
                          aria-label="暂停"
                        >
                          <Pause className="size-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 rounded-full text-destructive"
                        disabled={busyId === k.id || testAll !== null}
                        onClick={() => void batchAction('remove', k.id, '已移除该密钥')}
                        aria-label="移除"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              />
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="add-secrets">批量添加密钥（每行一条）</Label>
            <Textarea
              id="add-secrets"
              value={secretsText}
              onChange={(e) => setSecretsText(e.target.value)}
              className="min-h-20 rounded-lg font-mono text-xs"
              placeholder={'sk-proj-xxxx\nsk-proj-yyyy'}
            />
            <Button
              variant="secondary"
              className="rounded-full"
              disabled={adding}
              onClick={() => void onAdd()}
            >
              <Plus className="size-4" /> {adding ? '添加中…' : '批量添加'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function UpstreamBlocksPage() {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<IUpstreamBlock[] | null>(null);

  // 新建 / 编辑
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IUpstreamBlock | null>(null);
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formFormat, setFormFormat] = useState<string>('openai');
  const [formWeight, setFormWeight] = useState('1');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formProxy, setFormProxy] = useState('');
  // 编辑期允许半成品行（只有名字、或整行空白），提交前统一 clean。
  const [formHeaders, setFormHeaders] = useState<IHeaderRow[]>([]);
  const [formModelList, setFormModelList] = useState<IBlockModel[]>([]);
  // 从上游拉回来的可用模型（拉取结果与错误分开存，便于分别展示）。
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [keysBlock, setKeysBlock] = useState<IUpstreamBlock | null>(null);
  const [deleteBlock, setDeleteBlock] = useState<IUpstreamBlock | null>(null);

  const handleAuthFail = useCallback(() => {
    clearToken();
    toast.error('登录已过期，请重新登录');
    navigate('/login', { replace: true });
  }, [navigate]);

  const load = useCallback(async () => {
    try {
      const list = await api.listBlocks();
      setBlocks(list);
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

  const openCreate = () => {
    setEditing(null);
    setFormId('');
    setFormName('');
    setFormFormat('openai');
    setFormWeight('1');
    setFormBaseUrl('');
    setFormProxy('');
    setFormHeaders([]);
    setFormModelList([]);
    setFetchedModels([]);
    setFetchError(null);
    setDialogOpen(true);
  };

  const openEdit = (b: IUpstreamBlock) => {
    setEditing(b);
    setFormId(b.id);
    setFormName(b.name);
    setFormFormat(b.api_format);
    setFormWeight(String(b.weight));
    setFormBaseUrl(b.base_url);
    setFormProxy(b.proxy ?? '');
    setFormHeaders(b.headers ?? []);
    setFormModelList(b.models);
    setFetchedModels([]);
    setFetchError(null);
    setDialogOpen(true);
  };

  /**
   * 拉取上游模型列表。
   *
   * 用的是块已保存的出口与密钥，所以只在编辑已存在的块时可用——
   * 新建时先把块存下来，再回来拉。
   */
  const onFetchModels = async () => {
    if (!editing || fetchingModels) return;
    setFetchingModels(true);
    setFetchError(null);
    try {
      const models = await api.fetchBlockModels(editing.id);
      setFetchedModels(models);
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      setFetchError(e instanceof Error ? e.message : '拉取失败，请稍后重试');
    } finally {
      setFetchingModels(false);
    }
  };

  const onSave = async () => {
    if (saving) return;
    if (!formId.trim() || !formName.trim() || !formBaseUrl.trim()) {
      toast.error('请填写 Block ID、名称与 Base URL');
      return;
    }
    const weight = Number(formWeight);
    if (Number.isNaN(weight) || weight <= 0) {
      toast.error('权重必须是正数');
      return;
    }
    // 自定义头先在本地挡一道（与后端同一套规则），省一趟注定 400 的往返。
    // 空白行在这里丢掉——「加了一行还没填」不该阻止保存。
    const headerProblem = findHeaderProblem(formHeaders);
    if (headerProblem) {
      toast.error(headerProblem);
      return;
    }
    const body: IBlockInput = {
      name: formName.trim(),
      api_format: formFormat as IBlockInput['api_format'],
      weight,
      base_url: formBaseUrl.trim(),
      proxy: formProxy.trim() || null,
      models: formModelList,
      headers: cleanHeaders(formHeaders),
    };
    setSaving(true);
    try {
      if (editing) {
        const updated = await api.updateBlock(editing.id, body);
        setBlocks((prev) => prev?.map((b) => (b.id === updated.id ? updated : b)) ?? prev);
        toast.success('上游块已更新');
      } else {
        const created = await api.createBlock({ ...body, id: formId.trim() });
        setBlocks((prev) => [...(prev ?? []), created]);
        toast.success('上游块已创建');
      }
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
      setDialogOpen(false);
    }
  };

  const onDelete = async () => {
    if (!deleteBlock || saving) return;
    setSaving(true);
    try {
      await api.deleteBlock(deleteBlock.id);
      setBlocks((prev) => prev?.filter((b) => b.id !== deleteBlock.id) ?? prev);
      toast.success('上游块已删除');
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '删除失败，请稍后重试');
    } finally {
      setSaving(false);
      setDeleteBlock(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-none shadow-xs">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Network className="size-5 text-primary" /> 上游配置
            </CardTitle>
            <CardDescription>
              每个块只允许一种 API 格式，内含一组上游密钥；代理按权重平滑轮询
            </CardDescription>
          </div>
          <Button className="rounded-full" onClick={openCreate}>
            <Plus className="size-4" /> 新建上游
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Block</TableHead>
                  <TableHead className="whitespace-nowrap">API 格式</TableHead>
                  <TableHead className="whitespace-nowrap">Base URL</TableHead>
                  <TableHead className="whitespace-nowrap">权重</TableHead>
                  <TableHead className="whitespace-nowrap">可用密钥</TableHead>
                  <TableHead className="whitespace-nowrap">模型</TableHead>
                  <TableHead className="whitespace-nowrap text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocks === null ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-8 w-full rounded-lg" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : blocks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                      暂无上游块，点击右上角「新建上游」创建
                    </TableCell>
                  </TableRow>
                ) : (
                  blocks.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.id}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full bg-primary/10 text-primary">
                          {b.api_format}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-[220px] truncate text-muted-foreground">
                          {b.base_url}
                        </span>
                        {b.proxy && (
                          <span className="block max-w-[220px] truncate text-xs text-muted-foreground">
                            代理：{b.proxy}
                          </span>
                        )}
                        {/* 只列头名不列值：值可能是凭证（比如整条 Authorization），
                            摊在列表里就是明晃晃地摆在屏幕上。 */}
                        {(b.headers ?? []).length > 0 && (
                          <span
                            className="block max-w-[220px] truncate text-xs text-muted-foreground"
                            title={b.headers.map((h) => h.name).join('、')}
                          >
                            请求头：{b.headers.map((h) => h.name).join('、')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{b.weight}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {b.available_keys ?? '-'} / {b.key_count ?? '-'}
                      </TableCell>
                      <TableCell>
                        {b.models.length === 0 ? (
                          <span className="text-muted-foreground">无</span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-sm">{b.models.length} 个模型</span>
                            <p className="max-w-[200px] truncate text-xs text-muted-foreground">
                              {b.models
                                .slice(0, 3)
                                .map((m) => m.name)
                                .join('、')}
                              {b.models.length > 3 && ' 等'}
                            </p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="rounded-full">
                              操作
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setKeysBlock(b)}>
                              块内密钥
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(b)}>编辑</DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteBlock(b)}
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

      {/* 新建 / 编辑上游。
          模型多时内容区滚动、底部按钮常驻；点击外部不关闭——
          在长列表里拖滚动条时误触遮罩会直接丢掉未保存的编辑。 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="flex max-h-[88vh] flex-col gap-0 rounded-2xl sm:max-w-3xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="shrink-0 pb-2">
            <DialogTitle>{editing ? '编辑上游块' : '新建上游块'}</DialogTitle>
            <DialogDescription>
              {editing ? `Block ID ${editing.id} 不可修改` : 'Block ID 创建后不可修改'}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="block-id">Block ID</Label>
                <Input
                  id="block-id"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  disabled={editing !== null}
                  placeholder="如 openai-main"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  小写字母、数字、点、下划线、连字符；它会作为「块ID/模型名」的前缀，
                  用来在请求里指定走这个块
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="block-name">名称</Label>
                <Input
                  id="block-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="如 OpenAI 官方"
                  className="rounded-lg"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>API 格式</Label>
                <Select value={formFormat} onValueChange={setFormFormat}>
                  <SelectTrigger className="w-full rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {API_FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="block-weight">权重</Label>
                <Input
                  id="block-weight"
                  inputMode="decimal"
                  value={formWeight}
                  onChange={(e) => setFormWeight(e.target.value)}
                  className="rounded-lg"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-url">Base URL</Label>
              <Input
                id="block-url"
                value={formBaseUrl}
                onChange={(e) => setFormBaseUrl(e.target.value)}
                placeholder="https://api.openai.com"
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-proxy">代理（可选，留空直连）</Label>
              <Input
                id="block-proxy"
                value={formProxy}
                onChange={(e) => setFormProxy(e.target.value)}
                placeholder="http://127.0.0.1:7890"
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>自定义请求头</Label>
              <HeaderEditor headers={formHeaders} onChange={setFormHeaders} />
            </div>
            <div className="space-y-2">
              <Label>模型</Label>
              <ModelEditor
                models={formModelList}
                onChange={setFormModelList}
                onFetch={() => void onFetchModels()}
                fetched={fetchedModels}
                fetching={fetchingModels}
                fetchError={fetchError}
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t pt-3">
            <Button variant="ghost" className="rounded-full" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button className="rounded-full" disabled={saving} onClick={() => void onSave()}>
              {saving ? '保存中…' : editing ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 块内密钥管理 */}
      <BlockKeysDialog
        block={keysBlock}
        open={keysBlock !== null}
        onOpenChange={(v) => !v && setKeysBlock(null)}
        onAuthFail={handleAuthFail}
      />

      {/* 删除上游（描述含块名与密钥数，md 保证不折行溢出） */}
      <Dialog open={deleteBlock !== null} onOpenChange={(v) => !v && setDeleteBlock(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除上游块</DialogTitle>
            <DialogDescription>
              块「{deleteBlock?.name}」内的 {deleteBlock?.key_count ?? 0} 条上游密钥将被级联清理，且不可恢复。
              {deleteBlock && (deleteBlock.key_count ?? 0) > 0
                ? ' 该块仍有关联密钥，请确认！'
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setDeleteBlock(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={saving}
              onClick={() => void onDelete()}
            >
              {saving ? '删除中…' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
