// Runs the integration tests, bundled into `out/integration`, inside a downloaded VS Code.
import os from "node:os";
import path from "node:path";
import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "out/integration/**/*.test.js",
  // VS Code puts a socket in its user data folder, and a socket path must stay under 103
  // characters: the default folder, inside `.vscode-test/`, is too long in a deep checkout.
  launchArgs: ["--disable-extensions", `--user-data-dir=${path.join(os.tmpdir(), "revelio-vscode-test")}`],
  mocha: { ui: "bdd", timeout: 20_000 },
});
