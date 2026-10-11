import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import DashboardPage from "@/pages/DashboardPage/DashboardPage";
import AccessKeysPage from "@/pages/AccessKeysPage/AccessKeysPage";
import UpstreamBlocksPage from "@/pages/UpstreamBlocksPage/UpstreamBlocksPage";
import RequestLogsPage from "@/pages/RequestLogsPage/RequestLogsPage";
import SettingsPage from "@/pages/SettingsPage/SettingsPage";
import LoginPage from "@/pages/LoginPage/LoginPage";
import KeyPortalPage from "@/pages/KeyPortalPage/KeyPortalPage";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="keys" element={<AccessKeysPage />} />
        <Route path="upstreams" element={<UpstreamBlocksPage />} />
        <Route path="logs" element={<RequestLogsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="login" element={<LoginPage />} />
      {/* 用访问密钥登录后的落地页，独立于管理员布局 */}
      <Route path="portal" element={<KeyPortalPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
