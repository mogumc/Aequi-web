import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { PAGE_TITLES } from '@/components/nav-items';
import { api } from '@/lib/api';
import type { IHealth } from '@/data/admin';

type HealthState =
  | { phase: 'loading' }
  | { phase: 'ok'; info: IHealth }
  | { phase: 'down' };

export default function Header() {
  const { pathname } = useLocation();
  const [health, setHealth] = useState<HealthState>({ phase: 'loading' });
  const title = PAGE_TITLES[pathname] ?? '';

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then((info) => {
        if (alive) setHealth({ phase: 'ok', info });
      })
      .catch(() => {
        if (alive) setHealth({ phase: 'down' });
      });
    const timer = window.setInterval(() => {
      api
        .health()
        .then((info) => setHealth({ phase: 'ok', info }))
        .catch(() => setHealth({ phase: 'down' }));
    }, 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 bg-background/80 px-4 backdrop-blur-md md:px-6">
      <SidebarTrigger className="size-9 rounded-full" />
      <Separator orientation="vertical" className="mr-2 !h-5" />
      <h1 className="text-lg font-medium">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        {health.phase === 'loading' && (
          <Badge variant="outline" className="rounded-full text-muted-foreground">
            检测中…
          </Badge>
        )}
        {health.phase === 'ok' && (
          <Badge className="gap-1.5 rounded-full bg-success/15 text-success" variant="outline">
            <span className="size-1.5 rounded-full bg-success" />
            服务正常{health.info.version ? ` · v${health.info.version}` : ''}
          </Badge>
        )}
        {health.phase === 'down' && (
          <Badge variant="destructive" className="gap-1.5 rounded-full">
            <span className="size-1.5 rounded-full bg-current" />
            服务异常
          </Badge>
        )}
      </div>
    </header>
  );
}
