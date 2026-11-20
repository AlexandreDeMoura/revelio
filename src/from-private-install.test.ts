import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { commitAll, git, hostRepo } from "./testing/host-repo.js";

// Up to 0.3.0, `init` made a private install: Revelio in `.revelio/`, run by a
// `git revelio` alias, and all it wrote hidden from git, the knowledge base
// too. These tests start from what 0.3.0 left in a repo, written here by hand,
// and check that Revelio takes it over or removes it.

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

// The Builder's machine: their own git settings and home folder, kept apart
// from this one's.
function machine(): NodeJS.ProcessEnv {
  const home = hostRepo({ ".gitconfig": "" });
  return { ...process.env, HOME: home, GIT_CONFIG_GLOBAL: path.join(home, ".gitconfig"), GIT_CONFIG_NOSYSTEM: "1" };
}

// Runs the built binary as `npx revelio-ai` does, with no terminal to ask in.
function revelio(env: NodeJS.ProcessEnv, from: string, ...args: string[]) {
  return spawnSync("node", [cli, ...args], { cwd: from, encoding: "utf8", env });
}

// What the Builder typed with a private install: `git revelio <args>`.
function gitRevelio(env: NodeJS.ProcessEnv, from: string, ...args: string[]) {
  return spawnSync("git", ["revelio", ...args], { cwd: from, encoding: "utf8", env });
}

// Reads a git setting of the app as git sees it, or undefined.
function setting(env: NodeJS.ProcessEnv, root: string, ...args: string[]): string | undefined {
  const run = spawnSync("git", ["config", ...args], { cwd: root, encoding: "utf8", env });
  return run.status === 0 ? run.stdout.trim() : undefined;
}

function gitConfig(env: NodeJS.ProcessEnv, root: string, ...args: string[]) {
  expect(spawnSync("git", ["config", ...args], { cwd: root, env }).status).toBe(0);
}

// What `git status` shows, untracked files one by one.
const gitSees = (env: NodeJS.ProcessEnv, root: string) =>
  spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8", env }).stdout;

const read = (root: string, file: string) => fs.readFileSync(path.join(root, file), "utf8");

function write(root: string, file: string, content: string) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
}

// An app with Revelio installed in its `web/`, as `init` needs it.
function app(): string {
  const root = hostRepo({
    "README.md": "# Auxilia\n",
    ".gitignore": "node_modules/\n",
    "web/node_modules/revelio-ai/package.json": "{}",
  });
  commitAll(root, "the app");
  return root;
}

// A second checkout of the app, linked to the first.
function linkedWorktree(env: NodeJS.ProcessEnv, root: string): string {
  const worktree = path.join(hostRepo({}), "the feature");
  expect(spawnSync("git", ["worktree", "add", "--quiet", "-b", "feature", worktree], { cwd: root, env }).status).toBe(0);
  return worktree;
}

// What 0.3.0 wrote.
const privateAlias = String.raw`!f() { cli="$PWD/.revelio/node_modules/.bin/revelio"; [ -x "$cli" ] || { printf '%s\n' "Revelio is not installed in this checkout: .revelio/ is missing, so nothing was run." "To install it again, run: npx revelio-ai init" >&2; exit 1; }; cd "./$GIT_PREFIX" && exec "$cli" "$@"; }; f`;
const privateHook = { type: "command", command: '"$(git rev-parse --show-toplevel)/.revelio/node_modules/.bin/revelio" stop-hook' };
const privateLine =
  "`knowledge-base/` describes this app for the person who ships it without reading the code. " +
  "After changing code, follow the `maintain-knowledge-base` skill, then run `git revelio check` and fix what it reports before you stop. " +
  "`knowledge-base/` is hidden from git: open its files by path, since search won't find them, and never commit them. <!-- revelio -->";

// A private install in `root`, as 0.3.0 left it, whose copy prints `copy`.
// What every checkout of the repo shares, the git alias and the local
// exclude, is written unless `shared` is false.
function privateInstall(env: NodeJS.ProcessEnv, root: string, { copy = "the private copy", shared = true } = {}) {
  write(root, ".revelio/node_modules/.bin/revelio", `#!/bin/sh\necho "${copy} ran"\n`);
  fs.chmodSync(path.join(root, ".revelio/node_modules/.bin/revelio"), 0o755);
  write(root, ".claude/skills/map-the-app/SKILL.md", "an older version of the skill");
  write(root, ".claude/settings.local.json", JSON.stringify({ permissions: { allow: ["Bash(ls)"] }, hooks: { Stop: [{ hooks: [privateHook] }] } }));
  write(root, "CLAUDE.local.md", `Answer in French.\n\n${privateLine}\n`);
  write(root, "knowledge-base/areas.yaml", "chat:\n  name: Chat\n");
  if (!shared) return;
  const exclude = path.resolve(root, git(root, "rev-parse", "--git-path", "info/exclude"));
  fs.appendFileSync(
    exclude,
    [
      "# revelio: hidden from git for a private install",
      "/.revelio/",
      "/.claude/skills/maintain-knowledge-base/",
      "/.claude/skills/map-the-app/",
      "/.claude/skills/write-a-flow/",
      "/.claude/settings.local.json",
      "/CLAUDE.local.md",
      "/knowledge-base/",
      "# end revelio",
      "",
    ].join("\n"),
  );
  gitConfig(env, root, "--local", "alias.revelio", privateAlias);
  gitConfig(env, root, "--local", "revelio.alias", privateAlias);
}

const installedHook = { hooks: [{ type: "command", command: '"$(git rev-parse --show-toplevel)/web/node_modules/.bin/revelio" stop-hook' }] };

test("init takes a private install over: git sees the knowledge base, and the agent is checked once", () => {
  const env = machine();
  const root = app();
  privateInstall(env, root);
  expect(gitSees(env, root)).toBe("");

  const run = revelio(env, path.join(root, "web"), "init");

  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(run.stdout).toContain("Your private install is gone, and git now sees knowledge-base/: commit it with the rest.\n");
  expect(fs.existsSync(path.join(root, ".revelio"))).toBe(false);
  expect(JSON.parse(read(root, ".claude/settings.local.json"))).toEqual({ permissions: { allow: ["Bash(ls)"] } });
  expect(read(root, "CLAUDE.local.md")).toBe("Answer in French.\n");
  expect(JSON.parse(read(root, ".claude/settings.json"))).toEqual({ hooks: { Stop: [installedHook] } });
  expect(read(root, "CLAUDE.md")).toContain("run `npx revelio-ai check` in `web/`");
  expect(read(root, ".claude/skills/map-the-app/SKILL.md")).toMatch(/^---\nname: map-the-app\n/);
  expect(setting(env, root, "--get", "alias.revelio")).toBeUndefined();
  expect(setting(env, root, "--local", "--get-regexp", "^revelio\\.")).toBeUndefined();
  const seen = gitSees(env, root);
  for (const file of ["knowledge-base/areas.yaml", ".claude/settings.json", ".claude/skills/map-the-app/SKILL.md", "CLAUDE.md"]) {
    expect(seen).toContain(`?? ${file}\n`);
  }
  expect(seen).not.toContain(".revelio");
});

test("init keeps hiding from git the Builder's own CLAUDE.local.md and local settings that a private install hid", () => {
  const env = machine();
  const root = app();
  privateInstall(env, root);

  expect(revelio(env, path.join(root, "web"), "init").status).toBe(0);

  const seen = gitSees(env, root);
  expect(seen).not.toContain("CLAUDE.local.md");
  expect(seen).not.toContain("settings.local.json");
  expect(seen).toContain("?? knowledge-base/areas.yaml\n");
  const exclude = read(root, ".git/info/exclude");
  expect(exclude).toContain("\n/.claude/settings.local.json\n/CLAUDE.local.md\n");
  expect(exclude).not.toContain("/knowledge-base/");
  expect(exclude).not.toContain("/.revelio/");
  expect(exclude).not.toContain("/.claude/skills/");

  expect(revelio(env, path.join(root, "web"), "init").status).toBe(0);
  expect(read(root, ".git/info/exclude")).toBe(exclude);
  expect(revelio(env, root, "uninstall").status).toBe(0);
  expect(read(root, ".git/info/exclude")).toBe(exclude);
  expect(gitSees(env, root)).toBe("?? knowledge-base/areas.yaml\n");
});

test("init hides nothing more from git when a private install's CLAUDE.local.md and local settings held only Revelio's lines", () => {
  const env = machine();
  const root = app();
  privateInstall(env, root);
  write(root, "CLAUDE.local.md", `${privateLine}\n`);
  write(root, ".claude/settings.local.json", JSON.stringify({ hooks: { Stop: [{ hooks: [privateHook] }] } }));

  expect(revelio(env, path.join(root, "web"), "init").status).toBe(0);

  expect(fs.existsSync(path.join(root, "CLAUDE.local.md"))).toBe(false);
  expect(fs.existsSync(path.join(root, ".claude/settings.local.json"))).toBe(false);
  expect(read(root, ".git/info/exclude")).not.toContain("revelio");
});

test("init refuses, and writes nothing, while another checkout of the repo has a private install, and goes on once that one is uninstalled", () => {
  const env = machine();
  const root = app();
  const worktree = linkedWorktree(env, root);
  privateInstall(env, root);
  privateInstall(env, worktree, { copy: "the feature's copy", shared: false });
  const exclude = read(root, ".git/info/exclude");

  const refused = revelio(env, path.join(root, "web"), "init");

  expect(refused.status).toBe(1);
  expect(refused.stderr).toBe(
    `Another checkout of this repo has a private install, in ${fs.realpathSync(worktree)}. ` +
      "The two share what git hides, so installing here would show its files to git. Nothing was written. " +
      "To go on, first run npx revelio-ai uninstall in that checkout.\n",
  );
  expect(read(root, ".git/info/exclude")).toBe(exclude);
  expect(fs.existsSync(path.join(root, ".revelio"))).toBe(true);
  expect(fs.existsSync(path.join(root, ".claude/settings.json"))).toBe(false);
  expect(fs.existsSync(path.join(root, "CLAUDE.md"))).toBe(false);
  expect(gitRevelio(env, worktree, "check").stdout).toBe("the feature's copy ran\n");
  expect(gitSees(env, worktree)).toBe("");

  expect(revelio(env, worktree, "uninstall").status).toBe(0);
  const run = revelio(env, path.join(root, "web"), "init");

  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(setting(env, root, "--get", "alias.revelio")).toBeUndefined();
  expect(read(root, ".git/info/exclude")).not.toContain("/knowledge-base/");
});

test("uninstall removes a private install and its git revelio alias, and keeps the knowledge base hidden from git", () => {
  const env = machine();
  const root = app();
  privateInstall(env, root);

  const run = revelio(env, root, "uninstall");

  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(run.stdout).toMatch(/^Revelio is removed\.\n {2}\.claude\/skills\/ {2}\.revelio\/ {2}\.claude\/settings\.local\.json {2}CLAUDE\.local\.md {2}git revelio\n/);
  expect(run.stdout).toContain("knowledge-base/ is kept, still hidden from git");
  expect(fs.existsSync(path.join(root, ".revelio"))).toBe(false);
  expect(fs.existsSync(path.join(root, ".claude/skills/map-the-app"))).toBe(false);
  expect(JSON.parse(read(root, ".claude/settings.local.json"))).toEqual({ permissions: { allow: ["Bash(ls)"] } });
  expect(read(root, "CLAUDE.local.md")).toBe("Answer in French.\n");
  expect(read(root, "knowledge-base/areas.yaml")).toBe("chat:\n  name: Chat\n");
  expect(setting(env, root, "--get", "alias.revelio")).toBeUndefined();
  expect(setting(env, root, "--local", "--get-regexp", "^revelio\\.")).toBeUndefined();
  expect(gitRevelio(env, root, "check").stderr).toContain("'revelio' is not a git command");
  expect(gitSees(env, root)).toBe("");
});

test("uninstall keeps a git revelio alias the Builder had, or changed after a private install wrote it", () => {
  const env = machine();
  const hadIt = app();
  gitConfig(env, hadIt, "--local", "alias.revelio", privateAlias);
  const changedIt = app();
  privateInstall(env, changedIt);
  gitConfig(env, changedIt, "--local", "alias.revelio", `${privateAlias} # mine now`);

  revelio(env, hadIt, "uninstall");
  revelio(env, changedIt, "uninstall");

  expect(setting(env, hadIt, "--local", "--get", "alias.revelio")).toBe(privateAlias);
  expect(setting(env, changedIt, "--local", "--get", "alias.revelio")).toBe(`${privateAlias} # mine now`);
  expect(setting(env, changedIt, "--local", "--get", "revelio.alias")).toBeUndefined();
});

test("init writes no git revelio alias, and leaves the one the Builder has", () => {
  const env = machine();
  const none = app();
  const local = app();
  gitConfig(env, local, "--local", "alias.revelio", "log --oneline");
  gitConfig(env, local, "--global", "alias.revelio", "!echo mine");

  expect(revelio(env, path.join(none, "web"), "init").status).toBe(0);
  expect(revelio(env, path.join(local, "web"), "init").status).toBe(0);

  expect(setting(env, none, "--local", "--get-regexp", "revelio")).toBeUndefined();
  expect(setting(env, local, "--local", "--get", "alias.revelio")).toBe("log --oneline");
  expect(setting(env, local, "--global", "--get", "alias.revelio")).toBe("!echo mine");
});

test("in linked worktrees, uninstalling one private install leaves the other working and hidden from git", () => {
  const env = machine();
  const root = app();
  const worktree = linkedWorktree(env, root);
  privateInstall(env, root);
  privateInstall(env, worktree, { copy: "the feature's copy", shared: false });

  const first = revelio(env, root, "uninstall");

  expect(first.status).toBe(0);
  expect(first.stdout).not.toContain("git revelio\n");
  expect(first.stdout).toContain(`git revelio is kept: the private install in ${fs.realpathSync(worktree)} uses it.`);
  expect(gitRevelio(env, worktree, "check").stdout).toBe("the feature's copy ran\n");
  expect(gitSees(env, worktree)).toBe("");
  expect(gitRevelio(env, root, "check").stderr).toContain("Revelio is not installed in this checkout");

  const last = revelio(env, worktree, "uninstall");

  expect(last.stdout).toMatch(/ {2}git revelio\n/);
  expect(setting(env, root, "--get", "alias.revelio")).toBeUndefined();
  expect(gitSees(env, worktree)).toBe("");
});

test("a linked worktree whose folder was deleted does not keep the git revelio alias", () => {
  const env = machine();
  const root = app();
  const worktree = linkedWorktree(env, root);
  privateInstall(env, root);
  privateInstall(env, worktree, { shared: false });
  fs.rmSync(worktree, { recursive: true });

  const run = revelio(env, root, "uninstall");

  expect(run.stdout).toMatch(/ {2}git revelio\n/);
  expect(setting(env, root, "--get", "alias.revelio")).toBeUndefined();
});
