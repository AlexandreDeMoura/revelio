import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { commitAll, git, hostRepo } from "./testing/host-repo.js";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

// A host as Auxilia is: the package installed in `web/`, the git root above it.
function host(files: Record<string, string> = {}): string {
  const root = hostRepo({ "web/node_modules/revelio-ai/package.json": "{}", ...files });
  spawnSync("git", ["init", "--quiet"], { cwd: root });
  return root;
}

// Runs the built binary from `web/`, where `npx` finds it.
function init(root: string, ...args: string[]) {
  return spawnSync("node", [cli, "init", ...args], { cwd: path.join(root, "web"), encoding: "utf8" });
}

// Runs the built binary as a Builder runs `npx revelio-ai`, from wherever in the
// repo, with no terminal to ask in.
function revelio(root: string, ...args: string[]) {
  return spawnSync("node", [cli, ...args], { cwd: root, encoding: "utf8" });
}

// What `git status` shows, untracked files one by one.
const gitSees = (root: string) => git(root, "status", "--porcelain", "--untracked-files=all");

const read = (root: string, file: string) => fs.readFileSync(path.join(root, file), "utf8");
const settings = (root: string) => JSON.parse(read(root, ".claude/settings.json"));

const stopHook = {
  hooks: [{ type: "command", command: '"$(git rev-parse --show-toplevel)/web/node_modules/.bin/revelio" stop-hook' }],
};

test("init on a repo with no .claude/ installs the skills, the Stop hook and the CLAUDE.md line at the git root", () => {
  const root = host();

  const run = init(root);

  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(read(root, ".claude/skills/maintain-knowledge-base/SKILL.md")).toMatch(/^---\nname: maintain-knowledge-base\n/);
  expect(read(root, ".claude/skills/write-a-flow/SKILL.md")).toMatch(/^---\nname: write-a-flow\n/);
  expect(read(root, ".claude/skills/map-the-app/SKILL.md")).toMatch(/^---\nname: map-the-app\n/);
  expect(settings(root)).toEqual({ hooks: { Stop: [stopHook] } });
  expect(read(root, "CLAUDE.md")).toContain("run `npx revelio-ai check` in `web/`");
  expect(run.stdout).toBe(
    "Revelio is installed in this app: commit what it added, and knowledge-base/ with the code once it is written.\n" +
      "  .claude/skills/  .claude/settings.json  CLAUDE.md\n\n" +
      "Next: open Claude Code at the repo root and type /map-the-app\n" +
      "Then: npx revelio-ai view in web/, to read what it writes.   Guide: https://github.com/AlexandreDeMoura/revelio/tree/main/docs\n",
  );
});

test("init hides nothing from git and writes nothing for the Builder only", () => {
  const root = host({ "README.md": "# Auxilia\n", ".gitignore": "node_modules/\n" });
  commitAll(root, "the app");

  const run = init(root);
  fs.mkdirSync(path.join(root, "knowledge-base"));
  fs.writeFileSync(path.join(root, "knowledge-base/areas.yaml"), "chat:\n  name: Chat\n");

  expect(run.status).toBe(0);
  expect(fs.existsSync(path.join(root, ".revelio"))).toBe(false);
  expect(fs.existsSync(path.join(root, ".claude/settings.local.json"))).toBe(false);
  expect(fs.existsSync(path.join(root, "CLAUDE.local.md"))).toBe(false);
  expect(read(root, ".git/info/exclude")).not.toContain("revelio");
  expect(gitSees(root).split("\n").sort()).toEqual([
    "?? .claude/settings.json",
    "?? .claude/skills/maintain-knowledge-base/SKILL.md",
    "?? .claude/skills/map-the-app/SKILL.md",
    "?? .claude/skills/map-the-app/area.md",
    "?? .claude/skills/map-the-app/end.md",
    "?? .claude/skills/map-the-app/inventory.md",
    "?? .claude/skills/write-a-flow/SKILL.md",
    "?? CLAUDE.md",
    "?? knowledge-base/areas.yaml",
  ]);
});

test("init --shared, as Revelio up to 0.3.0 spelled it, does what init does", () => {
  const plain = host();
  const shared = host();

  const run = init(shared, "--shared");
  init(plain);

  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(settings(shared)).toEqual(settings(plain));
  expect(read(shared, "CLAUDE.md")).toBe(read(plain, "CLAUDE.md"));
});

test("init keeps the settings, hooks and CLAUDE.md the host already has", () => {
  const formatter = { matcher: "Edit", hooks: [{ type: "command", command: "npm run format" }] };
  const notify = { hooks: [{ type: "command", command: "say done" }] };
  const root = host({
    ".claude/settings.json": JSON.stringify({
      permissions: { allow: ["Bash(npm test)"] },
      hooks: { PostToolUse: [formatter], Stop: [notify] },
    }),
    ".claude/skills/deploy/SKILL.md": "---\nname: deploy\n---\n",
    "CLAUDE.md": "# Auxilia\n\nUse pnpm.\n",
  });

  const run = init(root);

  expect(run.status).toBe(0);
  expect(settings(root)).toEqual({
    permissions: { allow: ["Bash(npm test)"] },
    hooks: { PostToolUse: [formatter], Stop: [notify, stopHook] },
  });
  expect(read(root, ".claude/skills/deploy/SKILL.md")).toBe("---\nname: deploy\n---\n");
  expect(read(root, "CLAUDE.md")).toMatch(/^# Auxilia\n\nUse pnpm\.\n\n`knowledge-base\/` describes/);
});

test("init run again after an upgrade refreshes its copies and adds nothing twice", () => {
  const root = host({ "CLAUDE.md": "# Auxilia\n" });
  init(root);
  const skill = path.join(root, ".claude/skills/maintain-knowledge-base");
  fs.writeFileSync(path.join(skill, "SKILL.md"), "an older version of the skill");
  fs.writeFileSync(path.join(skill, "DROPPED.md"), "a file the new version no longer has");
  const claudeMd = read(root, "CLAUDE.md");
  fs.writeFileSync(path.join(root, "CLAUDE.md"), claudeMd.replace("npx revelio-ai check", "npx revelio-ai old-check"));

  const run = init(root);

  expect(run.status).toBe(0);
  expect(read(root, ".claude/skills/maintain-knowledge-base/SKILL.md")).toMatch(/^---\nname: maintain-knowledge-base\n/);
  expect(fs.existsSync(path.join(skill, "DROPPED.md"))).toBe(false);
  expect(settings(root)).toEqual({ hooks: { Stop: [stopHook] } });
  expect(read(root, "CLAUDE.md")).toBe(claudeMd);
});

test("init with the package installed at the git root points the hook and the instruction there", () => {
  const root = hostRepo({ "node_modules/revelio-ai/package.json": "{}" });
  spawnSync("git", ["init", "--quiet"], { cwd: root });

  const run = spawnSync("node", [cli, "init"], { cwd: root, encoding: "utf8" });

  expect(run.status).toBe(0);
  expect(settings(root).hooks.Stop[0].hooks[0].command).toBe(
    '"$(git rev-parse --show-toplevel)/node_modules/.bin/revelio" stop-hook',
  );
  expect(read(root, "CLAUDE.md")).toContain("run `npx revelio-ai check` at the repo root");
});

test("init refuses, and writes nothing, where the package is not installed", () => {
  const root = hostRepo({ "web/package.json": "{}" });
  spawnSync("git", ["init", "--quiet"], { cwd: root });

  const run = init(root);

  expect(run.status).toBe(1);
  expect(run.stderr).toBe(
    "revelio-ai is not installed here, and Revelio installs in the app: " +
      "run `npm install -D revelio-ai`, then `npx revelio-ai init` from the same folder, or `npm init revelio`, which does both. " +
      "Nothing was written.\n",
  );
  expect(fs.existsSync(path.join(root, ".claude"))).toBe(false);
  expect(fs.existsSync(path.join(root, "CLAUDE.md"))).toBe(false);
});

test("init leaves a settings file it cannot read as it was", () => {
  const root = host({ ".claude/settings.json": "{ not json" });

  const run = init(root);

  expect(run.status).toBe(1);
  expect(run.stderr).toContain(".claude/settings.json");
  expect(read(root, ".claude/settings.json")).toBe("{ not json");
  expect(fs.existsSync(path.join(root, ".claude/skills"))).toBe(false);
});

test("init copies every file of the map-the-app skill that its SKILL.md points at", () => {
  const root = host();

  init(root);

  const skill = ".claude/skills/map-the-app";
  const pointedAt = [...read(root, `${skill}/SKILL.md`).matchAll(/`([a-z-]+\.md)`/g)].map(([, file]) => file!);
  expect(pointedAt.length).toBeGreaterThan(0);
  for (const file of pointedAt) expect(fs.existsSync(path.join(root, skill, file)), file).toBe(true);
});

test("uninstall removes a shared install and keeps the knowledge base", () => {
  const root = host({ "CLAUDE.md": "# Auxilia\n", "knowledge-base/areas.yaml": "chat:\n  name: Chat\n" });
  init(root);
  commitAll(root, "the team installs Revelio");

  const run = revelio(path.join(root, "web"), "uninstall");

  expect(run.status).toBe(0);
  expect(run.stdout).toContain("npm uninstall revelio-ai");
  expect(read(root, "CLAUDE.md")).toBe("# Auxilia\n");
  expect(fs.existsSync(path.join(root, ".claude"))).toBe(false);
  expect(read(root, "knowledge-base/areas.yaml")).toBe("chat:\n  name: Chat\n");
  expect(gitSees(root).split("\n").map((line) => line.trim()).sort()).toEqual([
    "D .claude/settings.json",
    "D .claude/skills/maintain-knowledge-base/SKILL.md",
    "D .claude/skills/map-the-app/SKILL.md",
    "D .claude/skills/map-the-app/area.md",
    "D .claude/skills/map-the-app/end.md",
    "D .claude/skills/map-the-app/inventory.md",
    "D .claude/skills/write-a-flow/SKILL.md",
    "M CLAUDE.md",
  ]);
});
