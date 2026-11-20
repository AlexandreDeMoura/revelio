import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { commitAll, git, hostRepo } from "./testing/host-repo.js";

// Fledgy is Revelio's former name. These tests start from what Fledgy 0.2.0
// left in a repo, written here by hand, and check that Revelio takes it over.

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

// The Builder's machine: their own git settings and home folder, kept apart
// from this one's.
function machine(): NodeJS.ProcessEnv {
  const home = hostRepo({ ".gitconfig": "" });
  return { ...process.env, HOME: home, GIT_CONFIG_GLOBAL: path.join(home, ".gitconfig"), GIT_CONFIG_NOSYSTEM: "1" };
}

function revelio(env: NodeJS.ProcessEnv, from: string, ...args: string[]) {
  return spawnSync("node", [cli, ...args], { cwd: from, encoding: "utf8", env });
}

function setting(env: NodeJS.ProcessEnv, root: string, ...args: string[]): string | undefined {
  const run = spawnSync("git", ["config", ...args], { cwd: root, encoding: "utf8", env });
  return run.status === 0 ? run.stdout.trim() : undefined;
}

function gitConfig(env: NodeJS.ProcessEnv, root: string, ...args: string[]) {
  expect(spawnSync("git", ["config", ...args], { cwd: root, env }).status).toBe(0);
}

const gitSees = (env: NodeJS.ProcessEnv, root: string) =>
  spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8", env }).stdout;

const read = (root: string, file: string) => fs.readFileSync(path.join(root, file), "utf8");

function write(root: string, file: string, content: string) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
}

// An app with Revelio installed at its root, as `init` needs it. `name` sets
// the first commit apart from another app's.
function app(name = "Auxilia"): string {
  const root = hostRepo({ "README.md": `# ${name}\n`, ".gitignore": "node_modules/\n", "node_modules/revelio-ai/package.json": "{}" });
  commitAll(root, "the app");
  return root;
}

const fledgyHook = (installedIn: string) => ({
  type: "command",
  command: `"$(git rev-parse --show-toplevel)/${installedIn}node_modules/.bin/fledgy" stop-hook`,
});
const revelioHook = (installedIn: string) => ({
  type: "command",
  command: `"$(git rev-parse --show-toplevel)/${installedIn}node_modules/.bin/revelio" stop-hook`,
});
const fledgyLine = (check: string) =>
  "`knowledge-base/` describes this app for the person who ships it without reading the code. " +
  `After changing code, follow the \`maintain-knowledge-base\` skill, then run ${check} and fix what it reports before you stop. <!-- fledgy -->`;
const fledgyAlias = '!f() { cli="$PWD/.fledgy/node_modules/.bin/fledgy"; cd "./$GIT_PREFIX" && exec "$cli" "$@"; }; f';

// A private Fledgy install in `root`, as Fledgy wrote it. What every checkout
// of the repo shares, the git alias and the local exclude, is written unless
// `shared` is false.
function fledgyPrivate(env: NodeJS.ProcessEnv, root: string, { shared = true } = {}) {
  write(root, ".fledgy/node_modules/.bin/fledgy", "#!/bin/sh\necho fledgy ran\n");
  fs.chmodSync(path.join(root, ".fledgy/node_modules/.bin/fledgy"), 0o755);
  write(root, ".claude/skills/map-the-app/SKILL.md", "an older version of the skill");
  write(root, ".claude/settings.local.json", JSON.stringify({ permissions: { allow: ["Bash(ls)"] }, hooks: { Stop: [{ hooks: [fledgyHook(".fledgy/")] }] } }));
  write(root, "CLAUDE.local.md", `Answer in French.\n\n${fledgyLine("`git fledgy check`")}\n`);
  write(root, "knowledge-base/areas.yaml", "chat:\n  name: Chat\n");
  if (!shared) return;
  const exclude = path.resolve(root, git(root, "rev-parse", "--git-path", "info/exclude"));
  fs.appendFileSync(
    exclude,
    [
      "# fledgy: hidden from git for a private install",
      "/.fledgy/",
      "/.claude/skills/maintain-knowledge-base/",
      "/.claude/skills/map-the-app/",
      "/.claude/skills/write-a-flow/",
      "/.claude/settings.local.json",
      "/CLAUDE.local.md",
      "/knowledge-base/",
      "# end fledgy",
      "",
    ].join("\n"),
  );
  gitConfig(env, root, "--local", "alias.fledgy", fledgyAlias);
  gitConfig(env, root, "--local", "fledgy.alias", fledgyAlias);
}

test("init takes a private Fledgy install over: the agent is checked once, and git sees the knowledge base", () => {
  const env = machine();
  const root = app();
  fledgyPrivate(env, root);
  expect(gitSees(env, root)).toBe("");

  const run = revelio(env, root, "init");

  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(run.stdout).toContain("Fledgy is now Revelio: your Fledgy install is replaced, so type npx revelio-ai where you typed git fledgy.\n");
  expect(run.stdout).toContain("Your private install is gone");
  expect(fs.existsSync(path.join(root, ".fledgy"))).toBe(false);
  expect(fs.existsSync(path.join(root, ".revelio"))).toBe(false);
  expect(read(root, ".claude/skills/map-the-app/SKILL.md")).toMatch(/^---\nname: map-the-app\n/);
  expect(JSON.parse(read(root, ".claude/settings.local.json"))).toEqual({ permissions: { allow: ["Bash(ls)"] } });
  expect(read(root, "CLAUDE.local.md")).toBe("Answer in French.\n");
  expect(JSON.parse(read(root, ".claude/settings.json"))).toEqual({ hooks: { Stop: [{ hooks: [revelioHook("")] }] } });
  expect(read(root, "CLAUDE.md")).toMatch(/^`knowledge-base\/` describes .*`npx revelio-ai check` at the repo root.* <!-- revelio -->\n$/);
  expect(setting(env, root, "--get", "alias.fledgy")).toBeUndefined();
  expect(setting(env, root, "--local", "--get-regexp", "^fledgy\\.")).toBeUndefined();
  expect(setting(env, root, "--get", "alias.revelio")).toBeUndefined();
  expect(read(root, ".git/info/exclude")).not.toContain("fledgy");
  expect(read(root, ".git/info/exclude")).not.toContain("revelio");
  expect(gitSees(env, root)).toContain("?? knowledge-base/areas.yaml\n");
});

test("init moves the Builder's history and QA Results out of Fledgy's folder, but never over Revelio's", () => {
  const env = machine();
  const home = env.HOME!;
  const moved = app();
  const kept = app("Pantry");
  const first = (root: string) => git(root, "rev-list", "--max-parents=0", "HEAD");
  write(home, `.fledgy/${first(moved)}/qa-results.json`, "the QA Results\n");
  write(home, `.fledgy/${first(moved)}/history.git/HEAD`, "ref: refs/heads/main\n");
  write(home, `.fledgy/${first(kept)}/qa-results.json`, "Fledgy's QA Results\n");
  write(home, `.revelio/${first(kept)}/qa-results.json`, "Revelio's QA Results\n");
  write(home, ".fledgy/another-repo/qa-results.json", "another repo's QA Results\n");

  expect(revelio(env, moved, "init").status).toBe(0);
  expect(revelio(env, kept, "init").status).toBe(0);

  expect(read(home, `.revelio/${first(moved)}/qa-results.json`)).toBe("the QA Results\n");
  expect(read(home, `.revelio/${first(moved)}/history.git/HEAD`)).toBe("ref: refs/heads/main\n");
  expect(fs.existsSync(path.join(home, ".fledgy", first(moved)))).toBe(false);
  expect(read(home, `.revelio/${first(kept)}/qa-results.json`)).toBe("Revelio's QA Results\n");
  expect(read(home, `.fledgy/${first(kept)}/qa-results.json`)).toBe("Fledgy's QA Results\n");
  expect(read(home, ".fledgy/another-repo/qa-results.json")).toBe("another repo's QA Results\n");
});

test("init leaves Fledgy's folder in the home folder once it is empty", () => {
  const env = machine();
  const root = app();
  write(env.HOME!, `.fledgy/${git(root, "rev-list", "--max-parents=0", "HEAD")}/qa-results.json`, "{}\n");

  expect(revelio(env, root, "init").status).toBe(0);

  expect(fs.existsSync(path.join(env.HOME!, ".fledgy"))).toBe(false);
});

test("init keeps a git fledgy alias the Builder changed after Fledgy wrote it", () => {
  const env = machine();
  const root = app();
  fledgyPrivate(env, root);
  gitConfig(env, root, "--local", "alias.fledgy", "log --oneline");

  expect(revelio(env, root, "init").status).toBe(0);

  expect(setting(env, root, "--local", "--get", "alias.fledgy")).toBe("log --oneline");
  expect(setting(env, root, "--local", "--get", "fledgy.alias")).toBeUndefined();
});

test("uninstall removes a private Fledgy install, and keeps the knowledge base hidden from git", () => {
  const env = machine();
  const root = app();
  fledgyPrivate(env, root);

  const run = revelio(env, root, "uninstall");

  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(run.stdout).toMatch(/^Revelio is removed\.\n {2}\.claude\/skills\/ {2}\.fledgy\/ {2}git fledgy {2}/);
  expect(run.stdout).toContain("knowledge-base/ is kept, still hidden from git");
  expect(fs.existsSync(path.join(root, ".fledgy"))).toBe(false);
  expect(fs.existsSync(path.join(root, ".claude/skills/map-the-app"))).toBe(false);
  expect(JSON.parse(read(root, ".claude/settings.local.json"))).toEqual({ permissions: { allow: ["Bash(ls)"] } });
  expect(read(root, "CLAUDE.local.md")).toBe("Answer in French.\n");
  expect(setting(env, root, "--get", "alias.fledgy")).toBeUndefined();
  expect(read(root, ".git/info/exclude")).not.toContain("fledgy");
  expect(gitSees(env, root)).toBe("");
});

test("init in an app that depends on Fledgy, not Revelio, writes nothing and says how to move over", () => {
  const env = machine();
  const root = hostRepo({
    "web/node_modules/fledgy/package.json": "{}",
    "CLAUDE.md": `# Auxilia\n\n${fledgyLine("`npx fledgy check` in `web/`")}\n`,
    ".claude/settings.json": JSON.stringify({ hooks: { Stop: [{ hooks: [fledgyHook("web/")] }] } }),
  });
  commitAll(root, "the team installs Fledgy");

  const run = revelio(env, path.join(root, "web"), "init");

  expect(run.status).toBe(1);
  expect(run.stderr).toBe(
    "This app depends on Fledgy, which is now Revelio. Nothing was written. To move over, run:\n" +
      "  npm uninstall fledgy && npm install -D revelio-ai && npx revelio-ai init\n" +
      "then commit what changed.\n",
  );
  expect(gitSees(env, root)).toBe("");
});

test("init replaces the team's Fledgy hook and line, and says to remove fledgy from the app", () => {
  const env = machine();
  const notify = { hooks: [{ type: "command", command: "say done" }] };
  const root = hostRepo({
    "web/node_modules/revelio-ai/package.json": "{}",
    "web/node_modules/fledgy/package.json": "{}",
    "CLAUDE.md": `# Auxilia\n\n${fledgyLine("`npx fledgy check` in `web/`")}\n\nUse pnpm.\n`,
    ".claude/settings.json": JSON.stringify({ hooks: { Stop: [notify, { hooks: [fledgyHook("web/")] }] } }),
  });
  commitAll(root, "the team installs Fledgy");

  const run = revelio(env, path.join(root, "web"), "init");

  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(run.stdout).toContain("Fledgy, Revelio's former name, is still in the app's package.json: run `npm uninstall fledgy` in web/.\n");
  expect(JSON.parse(read(root, ".claude/settings.json"))).toEqual({ hooks: { Stop: [notify, { hooks: [revelioHook("web/")] }] } });
  expect(read(root, "CLAUDE.md")).toMatch(/^# Auxilia\n\n`knowledge-base\/` describes .*`npx revelio-ai check` in `web\/`.* <!-- revelio -->\n\nUse pnpm\.\n$/);
});

test("while another checkout has a Fledgy install, init refuses and leaves it working and hidden from git, then goes on once that one is uninstalled", () => {
  const env = machine();
  const root = app();
  const worktree = path.join(hostRepo({}), "the feature");
  expect(spawnSync("git", ["worktree", "add", "--quiet", "-b", "feature", worktree], { cwd: root, env }).status).toBe(0);
  fledgyPrivate(env, root);
  fledgyPrivate(env, worktree, { shared: false });

  const refused = revelio(env, root, "init");

  expect(refused.status).toBe(1);
  expect(refused.stderr).toContain(`Another checkout of this repo has a private install, in ${fs.realpathSync(worktree)}.`);
  expect(spawnSync("git", ["fledgy"], { cwd: worktree, encoding: "utf8", env }).stdout).toBe("fledgy ran\n");
  expect(gitSees(env, worktree)).toBe("");
  expect(gitSees(env, root)).toBe("");

  expect(revelio(env, worktree, "uninstall").status).toBe(0);
  expect(gitSees(env, root)).toBe("");
  expect(revelio(env, root, "init").status).toBe(0);

  expect(setting(env, root, "--get", "alias.fledgy")).toBeUndefined();
  expect(read(root, ".git/info/exclude")).not.toContain("fledgy");
  expect(gitSees(env, root)).toContain("?? knowledge-base/areas.yaml\n");
});
