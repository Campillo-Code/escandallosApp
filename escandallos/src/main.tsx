import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { check } from "@tauri-apps/plugin-updater";
import App from "./App";
import "./index.css";

async function checkForUpdates() {
  try {
    const update = await check();
    if (update) {
      const shouldUpdate = window.confirm(
        `Nueva versión disponible: v${update.version}\n\n¿Deseas descargar e instalar ahora?\nLa app se reiniciará automáticamente.`
      );
      if (shouldUpdate) {
        await update.downloadAndInstall();
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      }
    }
  } catch (error) {
    console.log("Error checking for updates:", error);
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

setTimeout(checkForUpdates, 3000);
