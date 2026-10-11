// EXPORTS: NAV_ITEMS, PAGE_TITLES
import type { LucideIcon } from 'lucide-react';
import { Cpu, KeyRound, LayoutDashboard, Network, ReceiptText, Settings } from 'lucide-react';

export interface INavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

/** 侧边栏导航（路由对账：/, /keys, /models, /upstreams, /logs, /settings 均已在 app.tsx 注册） */
export const NAV_ITEMS: INavItem[] = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/keys', label: '访问密钥', icon: KeyRound },
  { path: '/models', label: '模型', icon: Cpu },
  { path: '/upstreams', label: '上游配置', icon: Network },
  { path: '/logs', label: '请求日志', icon: ReceiptText },
  { path: '/settings', label: '系统设置', icon: Settings },
];

export const PAGE_TITLES: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.path, item.label]),
);
