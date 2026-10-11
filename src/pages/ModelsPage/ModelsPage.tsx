import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Cpu, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { IModel } from '@/data/admin';
import { api, clearToken, isUnauthorized } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

/**
 * 模型计费配置。
 *
 * 这里管的是「对外模型名 → 倍率」：模型能不能调用由上游块决定，
 * 没配倍率的模型照常可用，只是按默认 1.0 计费。
 */
export default function ModelsPage() {
  const navigate = useNavigate();
  const [models, setModels] = useState<IModel[] | null>(null);
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMultiplier, setNewMultiplier] = useState('1.0');

  const [editModel, setEditModel] = useState<IModel | null>(null);
  const [editMultiplier, setEditMultiplier] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);

  const [deleteModel, setDeleteModel] = useState<IModel | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAuthFail = useCallback(() => {
    clearToken();
    toast.error('登录已过期，请重新登录');
    navigate('/login', { replace: true });
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    setModels(null);

    api
      .listModels()
      .then((list) => {
        if (!cancelled) setModels(list);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (isUnauthorized(e)) {
          handleAuthFail();
          return;
        }
        toast.error(e instanceof Error ? e.message : '加载失败，请稍后重试');
      });

    return () => {
      cancelled = true;
    };
  }, [handleAuthFail, reloadKey]);

  const filtered = useMemo(() => {
    if (!models) return [];
    const keyword = search.trim().toLowerCase();
    if (!keyword) return models;
    return models.filter((model) => model.name.toLowerCase().includes(keyword));
  }, [models, search]);

  const resetCreateForm = () => {
    setNewName('');
    setNewMultiplier('1.0');
  };

  const onCreate = async () => {
    if (saving) return;
    const name = newName.trim();
    if (!name) {
      toast.error('请填写模型名');
      return;
    }

    setSaving(true);
    try {
      const created = await api.createModel({ name, multiplier: newMultiplier.trim() || undefined });
      setModels((prev) => [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('模型配置已创建');
      setCreateOpen(false);
      resetCreateForm();
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '创建失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    if (!editModel || saving) return;
    setSaving(true);
    try {
      const updated = await api.updateModel(editModel.name, {
        multiplier: editMultiplier.trim() || undefined,
        enabled: editEnabled,
      });
      setModels((prev) => prev?.map((m) => (m.name === updated.name ? updated : m)) ?? prev);
      toast.success('已保存');
      setEditModel(null);
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteModel || saving) return;
    setSaving(true);
    try {
      await api.deleteModel(deleteModel.name);
      setModels((prev) => prev?.filter((m) => m.name !== deleteModel.name) ?? prev);
      toast.success('已删除，该模型回落到默认倍率');
    } catch (e) {
      if (isUnauthorized(e)) {
        handleAuthFail();
        return;
      }
      toast.error(e instanceof Error ? e.message : '删除失败，请稍后重试');
    } finally {
      setSaving(false);
      setDeleteModel(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-none shadow-xs">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Cpu className="size-5 text-primary" /> 模型
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              按对外模型名配置计费倍率；没配置的模型按 1.0 计费，删除即回落默认。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setReloadKey((n) => n + 1)}
              aria-label="刷新"
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button className="rounded-full" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> 新建模型
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="relative max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索模型名"
              className="rounded-lg pl-9"
            />
          </div>

          <div className="w-full overflow-x-auto rounded-xl border border-border/40">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">模型</TableHead>
                  <TableHead className="whitespace-nowrap">倍率</TableHead>
                  <TableHead className="whitespace-nowrap">状态</TableHead>
                  <TableHead className="whitespace-nowrap">更新时间</TableHead>
                  <TableHead className="whitespace-nowrap text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models === null ? (
                  [0, 1, 2].map((row) => (
                    <TableRow key={row}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      {models.length === 0
                        ? '还没有模型配置，未配置的模型按 1.0 倍率计费'
                        : '没有匹配的模型'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((model) => (
                    <TableRow key={model.name}>
                      <TableCell className="font-medium">{model.name}</TableCell>
                      <TableCell className="tabular-nums">{model.multiplier}×</TableCell>
                      <TableCell>
                        {model.enabled ? (
                          <Badge variant="secondary">生效</Badge>
                        ) : (
                          <Badge variant="outline">已停用</Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(model.updated_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-full"
                            onClick={() => {
                              setEditModel(model);
                              setEditMultiplier(model.multiplier);
                              setEditEnabled(model.enabled);
                            }}
                            aria-label="编辑"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-full text-destructive hover:text-destructive"
                            onClick={() => setDeleteModel(model)}
                            aria-label="删除"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 新建 */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            resetCreateForm();
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>新建模型</DialogTitle>
            <DialogDescription>与上游块里配置的对外模型名保持一致。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model-name">模型名</Label>
              <Input
                id="model-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="如：gpt-4o"
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model-multiplier">倍率（四位小数，1.0 为不加价）</Label>
              <Input
                id="model-multiplier"
                inputMode="decimal"
                value={newMultiplier}
                onChange={(e) => setNewMultiplier(e.target.value)}
                placeholder="如：1.5"
                className="rounded-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button className="rounded-full" disabled={saving} onClick={() => void onCreate()}>
              {saving ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑 */}
      <Dialog open={editModel !== null} onOpenChange={(open) => !open && setEditModel(null)}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>编辑「{editModel?.name}」</DialogTitle>
            <DialogDescription>停用后该模型按默认 1.0 倍率计费。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-multiplier">倍率（四位小数）</Label>
              <Input
                id="edit-multiplier"
                inputMode="decimal"
                value={editMultiplier}
                onChange={(e) => setEditMultiplier(e.target.value)}
                className="rounded-lg"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
              <div className="space-y-0.5">
                <Label htmlFor="edit-enabled">启用该倍率</Label>
                <p className="text-xs text-muted-foreground">停用即回落默认倍率</p>
              </div>
              <Switch id="edit-enabled" checked={editEnabled} onCheckedChange={setEditEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setEditModel(null)}>
              取消
            </Button>
            <Button className="rounded-full" disabled={saving} onClick={() => void onSave()}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除 */}
      <Dialog open={deleteModel !== null} onOpenChange={(open) => !open && setDeleteModel(null)}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>删除模型配置</DialogTitle>
            <DialogDescription>
              删除「{deleteModel?.name}」的倍率配置。模型本身仍可调用，计费回落 1.0 倍。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setDeleteModel(null)}>
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
