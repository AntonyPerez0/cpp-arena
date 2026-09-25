import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { startAutoSync } from "./lib/sync";

// Old links used hash routing (#/learn/c-hello/1). Turn them into real paths.
if (location.hash.startsWith("#/")) {
  history.replaceState(null, "", import.meta.env.BASE_URL + location.hash.slice(2));
}

startAutoSync();

// Offline support and "Add to Home screen" (production builds only).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js", { scope: import.meta.env.BASE_URL }).catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
