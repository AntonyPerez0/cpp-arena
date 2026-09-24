import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// Old links used hash routing (#/learn/c-hello/1). Turn them into real paths.
if (location.hash.startsWith("#/")) {
  history.replaceState(null, "", import.meta.env.BASE_URL + location.hash.slice(2));
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
