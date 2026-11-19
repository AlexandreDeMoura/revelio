// The page inside the Revelio view. The extension loads it through `src/webview-html.ts`.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { vscodeHost } from "./host";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("The Revelio view has no #root element to render into.");

// Made here, once: VS Code lets a page ask for its API only once.
const host = vscodeHost();

createRoot(root).render(
  <StrictMode>
    <App host={host} />
  </StrictMode>,
);
