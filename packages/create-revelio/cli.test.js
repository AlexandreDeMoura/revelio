import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const cli = fileURLToPath(new URL("cli.js", import.meta.url));
const folders = [];

afterEach(() => {
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

function folder(prefix) {
  const made = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  folders.push(made);
  return made;
}

// A fake command, first on the PATH, that records what it was asked to run
// and where, then exits with `exitCode`.
function fake(bin, name, record, exitCode) {
  fs.writeFileSync(
    path.join(bin, name),
    "#!/usr/bin/env node\n" +
      `require("node:fs").appendFileSync(${JSON.stringify(record)}, JSON.stringify({ command: ${JSON.stringify(name)}, args: process.argv.slice(2), cwd: process.cwd() }) + "\\n");\n` +
      `process.exit(${exitCode});\n`,
    { mode: 0o755 },
  );
}

// An app's git repo, with `files` in it. Its package.json is at the root
// unless `files` says otherwise.
function app(files = { "package.json": "{}" }) {
  const root = folder("create-revelio-app-");
  fs.mkdirSync(path.join(root, ".git"));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return fs.realpathSync(root);
}

// Runs `npm init revelio` as npm would, in `from`, with fake `npm` and `npx`.
function npmInitRevelio(args, { from = app(), npmExit = 0, initExit = 0 } = {}) {
  const bin = folder("create-revelio-");
  const record = path.join(bin, "record.jsonl");
  fake(bin, "npm", record, npmExit);
  fake(bin, "npx", record, initExit);
  const run = spawnSync(process.execPath, [cli, ...args], {
    cwd: from,
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
    encoding: "utf8",
  });
  const ran = fs.existsSync(record)
    ? fs.readFileSync(record, "utf8").trim().split("\n").map((line) => JSON.parse(line))
    : [];
  return { status: run.status, stderr: run.stderr, ran };
}

const install = ["install", "-D", "--save-exact", "--no-audit", "--no-fund", "revelio-ai@latest"];
const init = ["--yes", "--package=revelio-ai", "--", "revelio", "init"];

describe.skipIf(process.platform === "win32")("npm init revelio", () => {
  it("adds the latest Revelio to the app, at its exact version, then runs that copy's init without asking again to download it", () => {
    const { status, ran } = npmInitRevelio([]);

    expect(status).toBe(0);
    expect(ran.map(({ command, args }) => [command, ...args])).toEqual([
      ["npm", ...install],
      ["npx", ...init],
    ]);
  });

  it("runs both in the folder the Builder typed the command in", () => {
    const from = path.join(app({ "web/package.json": "{}" }), "web");

    const { ran } = npmInitRevelio([], { from });

    expect(ran.map(({ cwd }) => fs.realpathSync(cwd))).toEqual([from, from]);
  });

  it("passes the Builder's words on to init", () => {
    const { ran } = npmInitRevelio(["--shared"]);

    expect(ran[1].args).toEqual([...init, "--shared"]);
  });

  it("ends with the exit code of Revelio's init", () => {
    const { status } = npmInitRevelio([], { initExit: 3 });

    expect(status).toBe(3);
  });

  it("runs no init when npm cannot add Revelio to the app", () => {
    const { status, stderr, ran } = npmInitRevelio([], { npmExit: 1 });

    expect(status).toBe(1);
    expect(ran.map(({ command }) => command)).toEqual(["npm"]);
    expect(stderr).toBe("npm could not add revelio-ai to the app, so Revelio was not installed.\n");
  });

  it("runs nothing where there is no package.json, and says where to run it", () => {
    const { status, stderr, ran } = npmInitRevelio([], { from: app({}) });

    expect(status).toBe(1);
    expect(ran).toEqual([]);
    expect(stderr).toBe(
      "There is no package.json here, and Revelio installs in the app: " +
        "run npm init revelio in the folder with the app's package.json. Nothing was written.\n",
    );
  });

  it.each([
    ["pnpm-lock.yaml", "pnpm", "pnpm add -D revelio-ai"],
    ["yarn.lock", "yarn", "yarn add -D revelio-ai"],
    ["bun.lock", "bun", "bun add -d revelio-ai"],
    ["bun.lockb", "bun", "bun add -d revelio-ai"],
  ])("runs nothing in an app with a %s, and prints the commands for %s", (lockfile, tool, add) => {
    const { status, stderr, ran } = npmInitRevelio([], { from: app({ "package.json": "{}", [lockfile]: "" }) });

    expect(status).toBe(1);
    expect(ran).toEqual([]);
    expect(stderr).toBe(`This app uses ${tool}, so npm init revelio wrote nothing. Run:\n  ${add}\n  npx revelio-ai init\n`);
  });

  it("finds the lockfile of a workspace above the folder, up to the repo's root", () => {
    const root = app({ "pnpm-lock.yaml": "", "package.json": "{}", "web/package.json": "{}" });

    const inWeb = npmInitRevelio([], { from: path.join(root, "web") });

    expect(inWeb.ran).toEqual([]);
    expect(inWeb.stderr).toContain("This app uses pnpm");
  });

  it("looks for no lockfile above the repo's root", () => {
    const outside = folder("create-revelio-outside-");
    fs.writeFileSync(path.join(outside, "pnpm-lock.yaml"), "");
    fs.mkdirSync(path.join(outside, "app", ".git"), { recursive: true });
    fs.writeFileSync(path.join(outside, "app", "package.json"), "{}");

    const { status } = npmInitRevelio([], { from: path.join(outside, "app") });

    expect(status).toBe(0);
  });
});
