import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import App from "./app";
import "./index.css";

/**
 * 路由前缀跟着 vite 的 base 走（默认 /web/）。
 *
 * 面板嵌在后端 /web 下，react-router 的 basename 不能带尾斜杠。
 */
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <ErrorBoundary
        fallbackRender={({ error, resetErrorBoundary }) => (
          <div
            style={{
              display: "flex",
              minHeight: "100vh",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              padding: 32,
              textAlign: "center",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <h1 style={{ fontSize: 18, fontWeight: 600 }}>页面出错了</h1>
            <pre
              style={{
                maxWidth: "100%",
                overflow: "auto",
                padding: 16,
                borderRadius: 8,
                background: "rgba(127,127,127,.12)",
                fontSize: 12,
                textAlign: "left",
              }}
            >
              {String(error)}
            </pre>
            <button
              onClick={resetErrorBoundary}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: "1px solid currentColor",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              重试
            </button>
          </div>
        )}
      >
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
