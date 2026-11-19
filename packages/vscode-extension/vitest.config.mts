// Unit tests: the extension host code in `src` runs in Node, the webview's in jsdom (set per file).
// The integration tests in `test/integration` run in VS Code instead, through `npm run test:integration`.
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.ts", "webview/src/**/*.test.tsx"],
  },
});
