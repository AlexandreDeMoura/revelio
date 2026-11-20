#!/usr/bin/env node
// `npm init revelio` runs this, in the folder with the app's package.json: it
// adds the latest Revelio to the app, then runs that copy's `revelio init`
// with the same arguments. It holds no Revelio code, so a Revelio release
// needs no new version of it. Run again, it upgrades Revelio.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const here = process.cwd();

// Node runs `npm.cmd` and `npx.cmd` only through a shell.
const run = (command, commandArgs) =>
  spawnSync(command, commandArgs, { stdio: "inherit", shell: process.platform === "win32" });

// The lockfiles of the other package managers, and the command that adds
// Revelio with each. Only npm runs here: another manager's app is told the
// commands, since npm would write a second lockfile beside its own.
const others = [
  ["pnpm-lock.yaml", "pnpm", "pnpm add -D revelio-ai"],
  ["yarn.lock", "yarn", "yarn add -D revelio-ai"],
  ["bun.lock", "bun", "bun add -d revelio-ai"],
  ["bun.lockb", "bun", "bun add -d revelio-ai"],
];

// The folder and those above it, up to the repo's root, where a workspace
// keeps its lockfile. Without a repo, the folder alone.
function upToTheRepo(folder) {
  const folders = [];
  for (let at = folder; ; at = path.dirname(at)) {
    folders.push(at);
    if (fs.existsSync(path.join(at, ".git"))) return folders;
    if (at === path.dirname(at)) return [folder];
  }
}

function stop(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(path.join(here, "package.json"))) {
  stop(
    "There is no package.json here, and Revelio installs in the app: " +
      "run npm init revelio in the folder with the app's package.json. Nothing was written.",
  );
}

for (const folder of upToTheRepo(here)) {
  if (fs.existsSync(path.join(folder, "package-lock.json"))) break;
  const other = others.find(([lockfile]) => fs.existsSync(path.join(folder, lockfile)));
  if (other) stop(`This app uses ${other[1]}, so npm init revelio wrote nothing. Run:\n  ${other[2]}\n  npx revelio-ai init`);
}

const added = run("npm", ["install", "-D", "--save-exact", "--no-audit", "--no-fund", "revelio-ai@latest"]);
if (added.error || added.status !== 0) {
  stop("npm could not add revelio-ai to the app, so Revelio was not installed.");
}

// `--package=revelio-ai` without a version runs the copy just added to the
// app. It is named, not left to npx: under `npm init`, npm sets
// `npm_config_package` to create-revelio, which this npx would inherit.
// `--yes`: npm already asked to download create-revelio, so do not ask again.
const init = run("npx", ["--yes", "--package=revelio-ai", "--", "revelio", "init", ...args]);

if (init.error) {
  stop(`Could not run npx: ${init.error.message}. Run \`npx revelio-ai init\` yourself.`);
} else {
  process.exitCode = init.status ?? 1;
}
