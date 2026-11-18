#!/usr/bin/env node
// `npm init revelio` runs this, which runs `revelio-ai init` with the same
// arguments, in the same folder. It holds no Revelio code, so it never needs a
// new version when Revelio has one.
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);

// A private install fetches the latest Revelio, as `npx revelio-ai@latest init`
// does. A shared install runs the Revelio the app depends on: the latest one
// would copy its own skills next to a Stop hook that runs the app's older one.
// `--yes`: npm already asked to download create-revelio, so do not ask again.
// `--package` is named, not left to npx: under `npm init`, npm sets
// `npm_config_package` to create-revelio, which this npx would inherit.
const revelio = args.includes("--shared") ? "revelio-ai" : "revelio-ai@latest";

const run = spawnSync("npx", ["--yes", `--package=${revelio}`, "--", "revelio", "init", ...args], {
  stdio: "inherit",
  // Node runs `npx.cmd` only through a shell.
  shell: process.platform === "win32",
});

if (run.error) {
  console.error(`Could not run npx: ${run.error.message}. Run \`npx ${revelio} init\` yourself.`);
  process.exitCode = 1;
} else {
  process.exitCode = run.status ?? 1;
}
