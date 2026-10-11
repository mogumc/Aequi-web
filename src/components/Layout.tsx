import { Navigate, Outlet } from 'react-router-dom';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import AppSidebar from '@/components/AppSidebar';
import Header from '@/components/Header';
import { getToken } from '@/lib/api';

export function Layout() {
  // 登录守卫：未携带管理员令牌时一律跳转登录页
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex min-w-0 flex-col overflow-x-hidden">
        <Header />
        <main className="w-full flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
          <Outlet />
        </main>
        <Toaster position="top-center" richColors />
      </SidebarInset>
    </SidebarProvider>
  );
}
