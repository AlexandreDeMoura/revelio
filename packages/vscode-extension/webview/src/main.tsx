// The page inside the Revelio view. The extension loads it through `src/webview-html.ts`.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("The Revelio view has no #root element to render into.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
