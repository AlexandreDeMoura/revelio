// Runs the integration tests, bundled into `out/integration`, inside a downloaded VS Code.
import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "out/integration/**/*.test.js",
  launchArgs: ["--disable-extensions"],
  mocha: { ui: "bdd", timeout: 20_000 },
});
