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

// Runs `npm init revelio` as npm would, with a fake `npx` first on the PATH
// that records what it was asked to run, and exits with `exitCode`.
function npmInitRevelio(args, { exitCode = 0 } = {}) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "create-revelio-"));
  const app = fs.mkdtempSync(path.join(os.tmpdir(), "create-revelio-app-"));
  folders.push(bin, app);
  const record = path.join(bin, "record.json");
  fs.writeFileSync(
    path.join(bin, "npx"),
    `#!/usr/bin/env node\nrequire("node:fs").writeFileSync(${JSON.stringify(record)}, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));\nprocess.exit(${exitCode});\n`,
    { mode: 0o755 },
  );
  const run = spawnSync(process.execPath, [cli, ...args], {
    cwd: app,
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
    encoding: "utf8",
  });
  const ran = fs.existsSync(record) ? JSON.parse(fs.readFileSync(record, "utf8")) : undefined;
  return { status: run.status, ran, app: fs.realpathSync(app) };
}

describe.skipIf(process.platform === "win32")("npm init revelio", () => {
  it("runs the latest Revelio's init, without asking again to download it", () => {
    const { status, ran } = npmInitRevelio([]);

    expect(status).toBe(0);
    expect(ran.args).toEqual(["--yes", "--package=revelio-ai@latest", "--", "revelio", "init"]);
  });

  it("runs it in the folder the Builder typed the command in", () => {
    const { ran, app } = npmInitRevelio([]);

    expect(fs.realpathSync(ran.cwd)).toBe(app);
  });

  it("for a shared install, runs the Revelio the app depends on, so its skills match its Stop hook", () => {
    const { ran } = npmInitRevelio(["--shared"]);

    expect(ran.args).toEqual(["--yes", "--package=revelio-ai", "--", "revelio", "init", "--shared"]);
  });

  it("ends with the exit code of Revelio's init", () => {
    const { status } = npmInitRevelio([], { exitCode: 3 });

    expect(status).toBe(3);
  });
});
