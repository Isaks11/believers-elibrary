import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/theme.css";
import App from "./App.tsx";
import { registerOfflineServiceWorker } from "./lib/offlineStorage";
import { installErrorMonitoring } from "./lib/errorMonitoring";
import { initTheme } from "./lib/theme";
import { ErrorBoundary } from "./components/ErrorBoundary";

installErrorMonitoring();

// Apply the persisted accent palette + light/dark mode before first render.
initTheme();

registerOfflineServiceWorker(() => {
  window.dispatchEvent(new CustomEvent("sw-update-available"));
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
