import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { commitAll, hostRepo, knowledgeBase } from "./testing/host-repo.js";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

// A stand-in for the published package that says which copy ran, with what,
// and from where, then exits with the code it is told to.
function fakePackage(copy: string): string {
  return hostRepo({
    "package.json": JSON.stringify({ name: "revelio-ai", version: "0.0.0-test", bin: { revelio: "cli.js" } }),
    "cli.js":
      "#!/usr/bin/env node\n" +
      `console.log(JSON.stringify({ copy: ${JSON.stringify(copy)}, args: process.argv.slice(2), cwd: process.cwd() }));\n` +
      "process.exitCode = Number(process.env.FAKE_EXIT || 0);\n",
  });
}

const theCopy = fakePackage("the private copy");

// The Builder's own git settings, kept apart from the machine's.
function machine(): NodeJS.ProcessEnv {
  const global = path.join(hostRepo({ ".gitconfig": "" }), ".gitconfig");
  return { ...process.env, GIT_CONFIG_GLOBAL: global, GIT_CONFIG_NOSYSTEM: "1" };
}

// Runs the built binary as `npx revelio-ai` does, with no terminal to ask in.
function revelio(env: NodeJS.ProcessEnv, from: string, args: string[], copy = theCopy) {
  return spawnSync("node", [cli, ...args], { cwd: from, encoding: "utf8", env: { ...env, REVELIO_PACKAGE: copy } });
}

// What the Builder types: `git revelio <args>`.
function gitRevelio(env: NodeJS.ProcessEnv, from: string, args: string[], extra: NodeJS.ProcessEnv = {}) {
  return spawnSync("git", ["revelio", ...args], { cwd: from, encoding: "utf8", env: { ...env, ...extra } });
}

// An app checked out in a folder whose path has a space, with a nested one too.
function app(): string {
  const root = path.join(hostRepo({ "my app/README.md": "# Auxilia\n", "my app/web/src a/page.ts": "export {};\n" }), "my app");
  commitAll(root, "the app");
  return root;
}

const ran = (run: { stdout: string }) => JSON.parse(run.stdout) as { copy: string; args: string[]; cwd: string };

test("git revelio runs the private copy from the repo root and from a nested folder, passing on arguments and the exit code", () => {
  const env = machine();
  const root = app();
  expect(revelio(env, root, ["init"]).status).toBe(0);

  const atRoot = gitRevelio(env, root, ["check"]);
  const nested = gitRevelio(env, path.join(root, "web/src a"), ["view", "--port", "two words", 'a "quote"'], { FAKE_EXIT: "3" });

  expect(atRoot.stderr).toBe("");
  expect(atRoot.status).toBe(0);
  expect(ran(atRoot)).toEqual({ copy: "the private copy", args: ["check"], cwd: fs.realpathSync(root) });
  expect(nested.status).toBe(3);
  expect(ran(nested)).toEqual({
    copy: "the private copy",
    args: ["view", "--port", "two words", 'a "quote"'],
    cwd: fs.realpathSync(path.join(root, "web/src a")),
  });  expect(gitSees(env, root)).toBe("");
});

test("git revelio without the private copy says how to get it back, and neither downloads Revelio nor runs another copy", () => {
  const env = machine();
  const root = app();
  revelio(env, root, ["init"]);
  fs.rmSync(path.join(root, ".revelio"), { recursive: true });
  // Other copies the command could fall back on: one on the PATH, and npx.
  const elsewhere = hostRepo({ "revelio": "#!/bin/sh\necho another copy\n", "npx": "#!/bin/sh\necho npx ran\n" });
  for (const bin of ["revelio", "npx"]) fs.chmodSync(path.join(elsewhere, bin), 0o755);

  const run = gitRevelio(env, path.join(root, "web"), ["check"], { PATH: `${elsewhere}${path.delimiter}${env.PATH}` });

  expect(run.status).toBe(1);
  expect(run.stdout).toBe("");
  expect(run.stderr).toBe(
    "Revelio is not installed in this checkout: .revelio/ is missing, so nothing was run.\n" +
      "To install it again, run: npx revelio-ai init\n",
  );
  expect(fs.existsSync(path.join(root, ".revelio"))).toBe(false);
});

// Reads a git setting of the app as git sees it, or undefined.
function setting(env: NodeJS.ProcessEnv, root: string, ...args: string[]): string | undefined {
  const run = spawnSync("git", ["config", ...args], { cwd: root, encoding: "utf8", env });
  return run.status === 0 ? run.stdout.trim() : undefined;
}

function gitConfig(env: NodeJS.ProcessEnv, root: string, ...args: string[]) {
  expect(spawnSync("git", ["config", ...args], { cwd: root, env }).status).toBe(0);
}

test("init refuses, and writes nothing, when the repo already has its own git revelio alias", () => {
  const env = machine();
  const root = app();
  gitConfig(env, root, "--local", "alias.revelio", "log --oneline");

  const run = revelio(env, root, ["init"]);

  expect(run.status).toBe(1);
  expect(run.stderr).toBe(
    "This repo already has a git alias named revelio (alias.revelio = log --oneline, in its local git config), " +
      "and a private install needs that name for its git revelio command. Nothing was written. " +
      "To install Revelio, remove that alias first: git config --local --unset alias.revelio\n",
  );
  expect(setting(env, root, "--local", "--get", "alias.revelio")).toBe("log --oneline");
  expect(fs.existsSync(path.join(root, ".revelio"))).toBe(false);
  expect(fs.existsSync(path.join(root, ".claude"))).toBe(false);
  expect(fs.readFileSync(path.join(root, ".git/info/exclude"), "utf8")).not.toContain("revelio");
});

test("init refuses, and writes nothing, rather than hide a git revelio alias the Builder set for every repo", () => {
  const env = machine();
  const root = app();
  gitConfig(env, root, "--global", "alias.revelio", "!echo mine");

  const run = revelio(env, root, ["init"]);

  expect(run.status).toBe(1);
  expect(run.stderr).toContain("(alias.revelio = !echo mine, in its global git config)");
  expect(run.stderr).toContain("git config --global --unset alias.revelio");
  expect(setting(env, root, "--local", "--get", "alias.revelio")).toBeUndefined();
  expect(setting(env, root, "--global", "--get", "alias.revelio")).toBe("!echo mine");
  expect(fs.existsSync(path.join(root, ".revelio"))).toBe(false);
});

test("uninstall removes the git revelio alias that init set", () => {
  const env = machine();
  const root = app();
  revelio(env, root, ["init"]);

  const run = revelio(env, path.join(root, "web"), ["uninstall"]);

  expect(run.status).toBe(0);
  expect(run.stdout).toMatch(/^Revelio is removed\.\n {2}\.claude\/skills\/ {2}\.revelio\/ {2}\.claude\/settings\.local\.json {2}CLAUDE\.local\.md {2}git revelio\n/);
  expect(setting(env, root, "--get", "alias.revelio")).toBeUndefined();
  expect(setting(env, root, "--local", "--get-regexp", "^revelio\\.")).toBeUndefined();
  expect(gitRevelio(env, root, ["check"]).stderr).toContain("'revelio' is not a git command");
});

test("uninstall keeps a git revelio alias the Builder had before init, or changed after it", () => {
  const env = machine();
  const elsewhere = app();
  revelio(env, elsewhere, ["init"]);
  const reveliosAlias = setting(env, elsewhere, "--get", "alias.revelio")!;
  const hadIt = app();
  gitConfig(env, hadIt, "--local", "alias.revelio", reveliosAlias);
  const changedIt = app();

  expect(revelio(env, hadIt, ["init"]).status).toBe(0);
  revelio(env, changedIt, ["init"]);
  gitConfig(env, changedIt, "--local", "alias.revelio", `${reveliosAlias} # mine now`);
  revelio(env, hadIt, ["uninstall"]);
  revelio(env, changedIt, ["uninstall"]);

  expect(setting(env, hadIt, "--local", "--get", "alias.revelio")).toBe(reveliosAlias);
  expect(setting(env, changedIt, "--local", "--get", "alias.revelio")).toBe(`${reveliosAlias} # mine now`);
  expect(revelio(env, changedIt, ["init"]).stderr).toContain("already has a git alias named revelio");
});

test("init run again keeps one git revelio alias, and an upgrade replaces the alias an older Revelio wrote", () => {
  const env = machine();
  const root = app();
  revelio(env, root, ["init"]);
  const once = setting(env, root, "--local", "--get-regexp", "revelio");
  expect(revelio(env, root, ["init"]).status).toBe(0);
  expect(setting(env, root, "--local", "--get-regexp", "revelio")).toBe(once);
  // As an older Revelio would have left it.
  gitConfig(env, root, "--local", "alias.revelio", "!echo older");
  gitConfig(env, root, "--local", "revelio.alias", "!echo older");

  const run = revelio(env, root, ["init"]);

  expect(run.status).toBe(0);
  expect(setting(env, root, "--local", "--get-regexp", "revelio")).toBe(once);
  expect(ran(gitRevelio(env, root, ["check"])).copy).toBe("the private copy");
});

// A second checkout of the app, linked to the first.
function linkedWorktree(env: NodeJS.ProcessEnv, root: string): string {
  const worktree = path.join(hostRepo({}), "the feature");
  expect(spawnSync("git", ["worktree", "add", "--quiet", "-b", "feature", worktree], { cwd: root, env }).status).toBe(0);
  return worktree;
}

const gitSees = (env: NodeJS.ProcessEnv, root: string) =>
  spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8", env }).stdout;

test("in linked worktrees, git revelio runs each checkout's own copy, and uninstalling one leaves the other working and hidden from git", () => {
  const env = machine();
  const root = app();
  const worktree = linkedWorktree(env, root);
  revelio(env, root, ["init"]);
  revelio(env, worktree, ["init"], fakePackage("the feature's copy"));
  fs.mkdirSync(path.join(worktree, "knowledge-base"));
  fs.writeFileSync(path.join(worktree, "knowledge-base/areas.yaml"), "chat:\n  name: Chat\n");
  expect(ran(gitRevelio(env, root, ["check"])).copy).toBe("the private copy");
  expect(ran(gitRevelio(env, path.join(worktree, "web"), ["check"])).copy).toBe("the feature's copy");

  const first = revelio(env, root, ["uninstall"]);

  expect(first.status).toBe(0);
  expect(first.stdout).not.toContain("git revelio\n");
  expect(first.stdout).toContain(`git revelio is kept: the private install in ${fs.realpathSync(worktree)} uses it.`);
  expect(ran(gitRevelio(env, worktree, ["check"])).copy).toBe("the feature's copy");
  expect(gitSees(env, worktree)).toBe("");
  expect(gitRevelio(env, root, ["check"]).stderr).toContain("Revelio is not installed in this checkout");

  const last = revelio(env, worktree, ["uninstall"]);

  expect(last.stdout).toMatch(/ {2}git revelio\n/);
  expect(setting(env, root, "--get", "alias.revelio")).toBeUndefined();
  expect(gitSees(env, worktree)).toBe("");
});

// Makes the package installed in the app's `web/`, as a shared install needs.
function installedInWeb(root: string) {
  fs.mkdirSync(path.join(root, "web/node_modules/revelio-ai"), { recursive: true });
  fs.writeFileSync(path.join(root, "web/node_modules/revelio-ai/package.json"), "{}");
}

test("init --shared removes the git revelio alias of the private install it replaces", () => {
  const env = machine();
  const root = app();
  revelio(env, root, ["init"]);
  installedInWeb(root);

  const run = revelio(env, path.join(root, "web"), ["init", "--shared"]);

  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(setting(env, root, "--get", "alias.revelio")).toBeUndefined();
  expect(setting(env, root, "--local", "--get-regexp", "^revelio\\.")).toBeUndefined();
});

test("init --shared refuses, and writes nothing, while another checkout of the repo has a private install", () => {
  const env = machine();
  const root = app();
  const worktree = linkedWorktree(env, root);
  revelio(env, root, ["init"]);
  revelio(env, worktree, ["init"]);
  installedInWeb(root);
  const exclude = fs.readFileSync(path.join(root, ".git/info/exclude"), "utf8");

  const run = revelio(env, path.join(root, "web"), ["init", "--shared"]);

  expect(run.status).toBe(1);
  expect(run.stderr).toBe(
    `Another checkout of this repo has a private install, in ${fs.realpathSync(worktree)}. ` +
      "The two share what git hides, so a shared install here would show its files to git. Nothing was written. " +
      "To go on, first run git revelio uninstall in that checkout.\n",
  );
  expect(fs.readFileSync(path.join(root, ".git/info/exclude"), "utf8")).toBe(exclude);
  expect(fs.existsSync(path.join(root, ".revelio"))).toBe(true);
  expect(fs.existsSync(path.join(root, ".claude/settings.json"))).toBe(false);
  expect(fs.existsSync(path.join(root, "CLAUDE.md"))).toBe(false);
  expect(ran(gitRevelio(env, worktree, ["check"])).copy).toBe("the private copy");
  expect(gitSees(env, worktree)).toBe("");
});

test("a linked worktree whose folder was deleted does not keep the git revelio alias", () => {
  const env = machine();
  const root = app();
  const worktree = linkedWorktree(env, root);
  revelio(env, root, ["init"]);
  revelio(env, worktree, ["init"]);
  fs.rmSync(worktree, { recursive: true });

  const run = revelio(env, root, ["uninstall"]);

  expect(run.stdout).toMatch(/ {2}git revelio\n/);
  expect(setting(env, root, "--get", "alias.revelio")).toBeUndefined();
});

test("each repo's private install is its own: uninstalling one leaves another repo's git revelio as it was", () => {
  const env = machine();
  const one = app();
  const other = app();
  revelio(env, one, ["init"]);
  revelio(env, other, ["init"], fakePackage("the other repo's copy"));

  revelio(env, one, ["uninstall"]);

  expect(ran(gitRevelio(env, other, ["check"])).copy).toBe("the other repo's copy");
  expect(gitSees(env, other)).toBe("");
});

// This very package, as npm installs it from its folder.
const thisPackage = fileURLToPath(new URL("..", import.meta.url));

test("with the real package as the private copy, git revelio check and git revelio uninstall work from a nested folder", () => {
  const env = machine();
  const root = app();
  fs.mkdirSync(path.join(root, "web/src"), { recursive: true });
  fs.writeFileSync(path.join(root, "web/src/tool-step.tsx"), "export function ToolStep() {\n  return <div />;\n}\n");
  for (const [file, content] of Object.entries(knowledgeBase("web/src/tool-step.tsx#ToolStep", "screen"))) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  commitAll(root, "the app and its knowledge base");
  expect(revelio(env, root, ["init"], thisPackage).status).toBe(0);
  const nested = path.join(root, "web/src a");

  const passes = gitRevelio(env, nested, ["check"]);
  fs.writeFileSync(path.join(root, "web/src/tool-step.tsx"), "export function ToolCard() {\n  return <div />;\n}\n");
  const fails = gitRevelio(env, nested, ["check"]);
  const unknown = gitRevelio(env, nested, ["no such command"]);
  const removed = gitRevelio(env, nested, ["uninstall"]);

  expect(passes.stdout).toBe("Knowledge base check passed.\n");
  expect(passes.status).toBe(0);
  expect(fails.status).toBe(1);
  expect(fails.stdout).toContain("symbol gone");
  expect(unknown.status).toBe(2);
  expect(unknown.stderr).toMatch(/^Usage: revelio init/);
  expect(removed.status).toBe(0);
  expect(removed.stdout).toMatch(/^Revelio is removed\.\n.* {2}git revelio\n/);
  expect(fs.existsSync(path.join(root, ".revelio"))).toBe(false);
  expect(setting(env, root, "--get", "alias.revelio")).toBeUndefined();
});
