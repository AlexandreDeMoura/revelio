// Builds the webview, the page inside the Revelio view, into `dist/webview`: one script and one
// stylesheet with fixed names, which `src/revelio-panel.ts` points the page to. A single script,
// with no chunks, since the page's Content Security Policy runs only the one carrying its nonce.
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("webview", import.meta.url)),
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("dist/webview", import.meta.url)),
    emptyOutDir: true,
    sourcemap: true,
    rolldownOptions: {
      input: fileURLToPath(new URL("webview/src/main.tsx", import.meta.url)),
      output: {
        entryFileNames: "webview.js",
        assetFileNames: "webview[extname]",
        codeSplitting: false,
      },
    },
  },
});
