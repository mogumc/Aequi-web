import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import DashboardPage from "@/pages/DashboardPage/DashboardPage";
import AccessKeysPage from "@/pages/AccessKeysPage/AccessKeysPage";
import UpstreamBlocksPage from "@/pages/UpstreamBlocksPage/UpstreamBlocksPage";
import RequestLogsPage from "@/pages/RequestLogsPage/RequestLogsPage";
import SettingsPage from "@/pages/SettingsPage/SettingsPage";
import LoginPage from "@/pages/LoginPage/LoginPage";
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
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
