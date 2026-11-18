import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { appDataDirectory } from "./qa-results.js";

// The npm package, as npm and `npx` name it.
const packageName = "revelio-ai";
// The command the package puts on the path, which also names everything init
// writes: the git alias, the Stop hook's binary, the markers.
const command = "revelio";
// The skills are plain files kept beside `src` and `dist`, where a Claude Code
// plugin has them.
const skills = new URL("../skills/", import.meta.url);
// Ends the instruction line, and finds it again on the next run.
const marker = `<!-- ${command} -->`;
// Where a private install puts the library, at the git root.
const privateFolder = ".revelio";
// The `git revelio` command of a private install: a git alias in the repo's
// local config. Git runs it at the root of the checkout it is typed in, so it
// runs that checkout's own copy, then goes back to the folder the Builder was
// in and passes on their arguments and the exit code. Without the copy it
// stops: it never downloads Revelio or runs another copy.
const aliasKey = `alias.${command}`;
const alias =
  `!f() { cli="$PWD/${privateFolder}/node_modules/.bin/${command}"; ` +
  `[ -x "$cli" ] || { printf '%s\\n' ` +
  `"Revelio is not installed in this checkout: ${privateFolder}/ is missing, so nothing was run." ` +
  `"To install it again, run: npx ${packageName} init" >&2; exit 1; }; ` +
  `cd "./$GIT_PREFIX" && exec "$cli" "$@"; }; f`;
// Revelio's note, in the same config, of the alias it wrote. The alias is
// Revelio's only while the two match, so one the Builder had before init, or
// changed since, is never replaced or removed.
const ownedKey = `${command}.alias`;

// What Fledgy, Revelio's former name, wrote. Init and uninstall take a Fledgy
// install over once, so nothing else reads these.
const fledgy = {
  folder: ".fledgy",
  marker: "<!-- fledgy -->",
  hookEnd: 'fledgy" stop-hook',
  aliasKey: "alias.fledgy",
  ownedKey: "fledgy.alias",
  blockStart: "# fledgy: hidden from git for a private install",
  blockEnd: "# end fledgy",
};

// `fromFledgy` says a private Fledgy install was taken over. `fledgyPackageIn`
// is where the app still depends on Fledgy, from the git root.
export type Installed =
  | { mode: "private"; wrote: string[]; fromFledgy: boolean }
  | { mode: "shared"; wrote: string[]; installedIn: string; privateRemoved: boolean; fledgyPackageIn: string | undefined }
  | { mode: "team-has-it" }
  | { mode: "team-has-fledgy" };

// The private install: everything in the app's checkout and hidden from git
// by the local exclude, so nothing reaches the team. `packageSpec` is what npm
// installs into `.revelio/`. Safe to run again: it refreshes what it wrote
// before, which is how an upgrade happens, from Fledgy too. `home` is the
// Builder's home folder.
export function initPrivate(repoRoot: string, packageSpec: string, home: string): Installed {
  const team = teamHas(repoRoot);
  if (team) return { mode: team === "fledgy" ? "team-has-fledgy" : "team-has-it" };
  const tracked = git(repoRoot, "ls-files", "--", ...privatePaths().filter((p) => p !== "knowledge-base/"));
  if (tracked) {
    const first = tracked.split("\n")[0]!;
    throw new Error(`${first} is committed in this repo, and a private install would replace it. Nothing was written.`);
  }
  refuseAnotherAlias(repoRoot);
  // Read before anything is written: it is the one file that can refuse.
  const settings = readSettings(repoRoot, ".claude/settings.local.json");
  installLibrary(repoRoot, packageSpec);
  const left = leaveFledgy(repoRoot, home);
  hideFromGit(repoRoot, privatePaths());
  setAlias(repoRoot);
  copySkills(repoRoot);
  writeSettings(settings, withStopHook(settings.content, privateFolder));
  writeInstruction(
    repoRoot,
    "CLAUDE.local.md",
    instruction(`\`git ${command} check\``) +
      " `knowledge-base/` is hidden from git: open its files by path, since search won't find them, and never commit them.",
  );
  return {
    mode: "private",
    wrote: [`${privateFolder}/`, ".claude/skills/", ".claude/settings.local.json", "CLAUDE.local.md"],
    fromFledgy: left.folder || left.command,
  };
}

// The shared install: into the host's `.claude/` and `CLAUDE.md`, at the git
// root, for the team to commit. `from` is the folder the command was run in.
// It replaces a private install, and stops hiding `knowledge-base/` so it can
// be committed.
export function initShared(repoRoot: string, from: string, home: string): Installed {
  const installedIn = path.relative(repoRoot, folderWithThePackage(repoRoot, from));
  const settings = readSettings(repoRoot, ".claude/settings.json");
  // The local exclude is shared by every checkout of the repo: it cannot stop
  // hiding the shared install here and keep hiding another private one.
  const [other] = [...otherPrivateInstalls(repoRoot), ...otherCheckoutsWith(repoRoot, fledgy.folder)];
  if (other) {
    throw new Error(
      `Another checkout of this repo has a private install, in ${other}. ` +
        "The two share what git hides, so a shared install here would show its files to git. Nothing was written. " +
        `To go on, first run git ${command} uninstall in that checkout.`,
    );
  }
  leaveFledgy(repoRoot, home);
  const privateRemoved = removePrivate(repoRoot, { keepHidden: false }).had;
  copySkills(repoRoot);
  writeSettings(settings, withStopHook(settings.content, installedIn));
  const where = installedIn ? `in \`${posix(installedIn)}/\`` : "at the repo root";
  writeInstruction(repoRoot, "CLAUDE.md", instruction(`\`npx ${packageName} check\` ${where}`));
  return {
    mode: "shared",
    wrote: [".claude/skills/", ".claude/settings.json", "CLAUDE.md"],
    installedIn,
    privateRemoved,
    fledgyPackageIn: dependencyIn(repoRoot, from, "fledgy"),
  };
}

// `sharedPackageIn` is where the app's own dependency on Revelio was found,
// and `fledgyPackageIn` where one on Fledgy was, from the git root, which
// the Builder removes with npm.
// `commandKeptFor` is another checkout whose private install still needs the
// `git revelio` command.
export type Uninstalled = {
  removed: string[];
  knowledgeBase: boolean;
  sharedPackageIn: string | undefined;
  fledgyPackageIn: string | undefined;
  commandKeptFor: string | undefined;
};

// Removes what either install added. The knowledge base is never deleted, and
// whatever is left of a private install stays hidden from git. `from` is the
// folder the command was run in, and `home` the Builder's home folder.
export function uninstall(repoRoot: string, from: string, home: string): Uninstalled {
  const shared = readSettings(repoRoot, ".claude/settings.json");
  const removed: string[] = [];
  if (removeSkills(repoRoot)) removed.push(".claude/skills/");
  const left = leaveFledgy(repoRoot, home);
  if (left.folder) removed.push(`${fledgy.folder}/`);
  if (left.command) removed.push("git fledgy");
  const local = removePrivate(repoRoot, { keepHidden: true });
  if (local.had) removed.push(`${privateFolder}/`, ".claude/settings.local.json", "CLAUDE.local.md");
  if (local.command) removed.push(`git ${command}`);
  if (writeSettings(shared, withStopHook(shared.content, undefined))) removed.push(".claude/settings.json");
  if (removeInstruction(repoRoot, "CLAUDE.md")) removed.push("CLAUDE.md");
  // A folder left empty is one the install made.
  for (const folder of [".claude/skills", ".claude"]) {
    const full = path.join(repoRoot, folder);
    if (fs.existsSync(full) && fs.readdirSync(full).length === 0) fs.rmdirSync(full);
  }
  return {
    removed,
    knowledgeBase: fs.existsSync(path.join(repoRoot, "knowledge-base")),
    sharedPackageIn: dependencyIn(repoRoot, from, packageName),
    fledgyPackageIn: dependencyIn(repoRoot, from, "fledgy"),
    commandKeptFor: local.commandKeptFor,
  };
}

// Where the app depends on the npm package `name`, from the git root, as
// `npx` looks for it from `from`; undefined when it does not.
export function dependencyIn(repoRoot: string, from: string, name: string): string | undefined {
  const folder = folderWithPackage(repoRoot, from, name);
  return folder === undefined ? undefined : posix(path.relative(repoRoot, folder));
}

function instruction(check: string): string {
  return (
    "`knowledge-base/` describes this app for the person who ships it without reading the code. " +
    `After changing code, follow the \`maintain-knowledge-base\` skill, then run ${check} and fix what it reports before you stop.`
  );
}

// A shared install is there once its line is in `CLAUDE.md` or its hook in
// the shared settings, committed or about to be. Says whether it is Revelio's
// or still Fledgy's.
function teamHas(repoRoot: string): "revelio" | "fledgy" | undefined {
  const claudeMd = path.join(repoRoot, "CLAUDE.md");
  const lines = fs.existsSync(claudeMd) ? fs.readFileSync(claudeMd, "utf8") : "";
  const settingsFile = path.join(repoRoot, ".claude", "settings.json");
  let hooks: Hook[] = [];
  try {
    if (fs.existsSync(settingsFile)) hooks = stopHooks(JSON.parse(fs.readFileSync(settingsFile, "utf8")) as Settings);
  } catch {
    // Unreadable settings are no install.
  }
  if (lines.includes(marker) || hooks.some((hook) => hook.command?.endsWith(hookEnd))) return "revelio";
  if (lines.includes(fledgy.marker) || hooks.some((hook) => hook.command?.endsWith(fledgy.hookEnd))) return "fledgy";
  return undefined;
}

// Every path a private install hides, from the git root.
function privatePaths(): string[] {
  return [
    `${privateFolder}/`,
    ...fs.readdirSync(skills).map((skill) => `.claude/skills/${skill}/`),
    ".claude/settings.local.json",
    "CLAUDE.local.md",
    "knowledge-base/",
  ];
}

// The library pinned to the version that ran `init`, never in the app's
// `package.json`.
function installLibrary(repoRoot: string, packageSpec: string) {
  const into = path.join(repoRoot, privateFolder);
  const first = !fs.existsSync(into);
  const run = spawnSync(
    "npm",
    ["install", "--prefix", into, "--save-exact", "--no-audit", "--no-fund", "--loglevel=error", packageSpec],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  if (run.status !== 0) {
    if (first) fs.rmSync(into, { recursive: true, force: true });
    throw new Error(`npm could not install ${packageSpec} into ${privateFolder}/:\n${run.stderr || run.error?.message}`);
  }
}

// Removes the private install's own pieces. With `keepHidden`, what is left
// of it (the knowledge base, a file with the Builder's own lines) stays hidden
// from git; without it, nothing stays hidden, so the knowledge base can be
// committed. Another checkout's private install keeps all it shares with this
// one: the alias, and everything the local exclude hides. Says whether there
// was a private install here, and what became of the `git revelio` command.
function removePrivate(repoRoot: string, { keepHidden }: { keepHidden: boolean }): { had: boolean; command: boolean; commandKeptFor: string | undefined } {
  const others = otherPrivateInstalls(repoRoot);
  const local = readSettings(repoRoot, ".claude/settings.local.json");
  const folder = path.join(repoRoot, privateFolder);
  const had = fs.existsSync(folder);
  fs.rmSync(folder, { recursive: true, force: true });
  const hook = writeSettings(local, withStopHook(local.content, undefined));
  const line = removeInstruction(repoRoot, "CLAUDE.local.md");
  const command = removeAlias(repoRoot, others);
  const hiding = hidesFromGit(repoRoot);
  const stillHidden = others.length > 0 ? privatePaths() : privatePaths().filter((p) => fs.existsSync(path.join(repoRoot, p)));
  if (hiding) hideFromGit(repoRoot, keepHidden ? stillHidden : []);
  return { had: had || hook || line || hiding, command: command === "removed", commandKeptFor: command === "kept" ? others[0] : undefined };
}

// The package is looked for as `npx` looks for it: in `node_modules` of the
// folder the command is run in, then of each folder above it.
function folderWithPackage(repoRoot: string, from: string, name: string): string | undefined {
  for (let folder = from; ; folder = path.dirname(folder)) {
    if (fs.existsSync(path.join(folder, "node_modules", name, "package.json"))) return folder;
    if (folder === repoRoot || folder === path.dirname(folder)) return undefined;
  }
}

function folderWithThePackage(repoRoot: string, from: string): string {
  const folder = folderWithPackage(repoRoot, from, packageName);
  if (folder !== undefined) return folder;
  throw new Error(
    `${packageName} is not installed here. A shared install needs it in the app: ` +
      `run \`npm install -D ${packageName}\`, then \`npx ${packageName} init --shared\` from the same folder.`,
  );
}

// A skill folder is replaced whole, so a file dropped by an upgrade goes too.
function copySkills(repoRoot: string) {
  const to = path.join(repoRoot, ".claude", "skills");
  for (const skill of fs.readdirSync(skills)) {
    fs.rmSync(path.join(to, skill), { recursive: true, force: true });
    fs.cpSync(new URL(skill, skills), path.join(to, skill), { recursive: true });
  }
}

function removeSkills(repoRoot: string): boolean {
  let removed = false;
  for (const skill of fs.readdirSync(skills)) {
    const folder = path.join(repoRoot, ".claude", "skills", skill);
    removed ||= fs.existsSync(folder);
    fs.rmSync(folder, { recursive: true, force: true });
  }
  return removed;
}

type Hook = { type: string; command?: string };
type Settings = { hooks?: { Stop?: { hooks?: Hook[] }[] } };
type SettingsFile = { file: string; before: string | undefined; content: Settings };

function readSettings(repoRoot: string, name: string): SettingsFile {
  const file = path.join(repoRoot, name);
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined;
  try {
    return { file, before, content: JSON.parse(before ?? "{}") as Settings };
  } catch (error) {
    throw new Error(`${name} is not valid JSON and was left as it is: ${(error as Error).message}`);
  }
}

// Writes the settings when they changed, keeping the file's indentation. A
// file left with nothing in it is removed. Says whether anything changed.
function writeSettings({ file, before }: SettingsFile, after: Settings): boolean {
  const empty = Object.keys(after).length === 0;
  if (before === undefined ? empty : JSON.stringify(JSON.parse(before)) === JSON.stringify(after)) return false;
  if (empty) {
    fs.rmSync(file);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(after, null, before && /^\t/m.test(before) ? "\t" : 2) + "\n");
  }
  return true;
}

// How the Stop hook's command ends: the binary it runs, then the hook's name.
const hookEnd = `${command}" stop-hook`;

function stopHooks(settings: Settings): Hook[] {
  return (settings.hooks?.Stop ?? []).flatMap((group) => group.hooks ?? []);
}

// Our Stop hook, or the one Fledgy wrote, which it replaces.
const isOurs = (hook: Hook) => hook.command?.endsWith(hookEnd) || hook.command?.endsWith(fledgy.hookEnd);

// The settings with the Stop hook pointing at the package installed in
// `installedIn` (from the git root), or without it when `installedIn` is
// undefined. The hook finds the binary through git, so it runs whatever
// folder the session is in. A Fledgy hook is replaced in place, and any
// second one dropped, so the agent is never checked twice.
function withStopHook(settings: Settings, installedIn: string | undefined): Settings {
  const after = structuredClone(settings);
  const binary = installedIn === undefined ? undefined : path.posix.join(posix(installedIn), "node_modules", ".bin", command);
  const hookCommand = binary && `"$(git rev-parse --show-toplevel)/${binary}" stop-hook`;
  const ours = stopHooks(after).filter(isOurs);
  const kept = hookCommand === undefined ? undefined : ours[0];
  if (kept) kept.command = hookCommand;
  if (ours.length > (kept ? 1 : 0)) {
    const stop = after.hooks!.Stop!;
    for (const group of stop) group.hooks = group.hooks?.filter((hook) => hook === kept || !isOurs(hook));
    after.hooks!.Stop = stop.filter((group) => group.hooks === undefined || group.hooks.length > 0);
    if (after.hooks!.Stop.length === 0) delete after.hooks!.Stop;
    if (Object.keys(after.hooks!).length === 0) delete after.hooks;
  }
  if (hookCommand !== undefined && !kept) ((after.hooks ??= {}).Stop ??= []).push({ hooks: [{ type: "command", command: hookCommand }] });
  return after;
}

// Our instruction line, or the one Fledgy wrote, which it replaces.
const isOurLine = (line: string) => line.includes(marker) || line.includes(fledgy.marker);

// One line, ended by the marker, replaced in place on the next run.
function writeInstruction(repoRoot: string, name: string, text: string) {
  const line = `${text} ${marker}`;
  const file = path.join(repoRoot, name);
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const lines = before.split("\n");
  const at = lines.findIndex(isOurLine);
  const after =
    at >= 0
      ? lines.flatMap((existing, n) => (n === at ? [line] : isOurLine(existing) ? [] : [existing])).join("\n")
      : before + (before === "" ? "" : before.endsWith("\n") ? "\n" : "\n\n") + line + "\n";
  fs.writeFileSync(file, after);
}

// Takes the line out, with the blank line that set it apart. A file left
// empty is removed. Says whether the line was there.
function removeInstruction(repoRoot: string, name: string): boolean {
  const file = path.join(repoRoot, name);
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, "utf8");
  const lines = before.split("\n");
  if (!lines.some(isOurLine)) return false;
  const kept = lines.filter((line) => !isOurLine(line)).join("\n").replace(/\n+$/, "");
  if (kept.trim() === "") fs.rmSync(file);
  else fs.writeFileSync(file, kept + "\n");
  return true;
}

const blockStart = `# ${command}: hidden from git for a private install`;
const blockEnd = `# end ${command}`;

// Our lines in the local exclude, which git reads like a `.gitignore` that is
// never committed. They are kept between two markers and rewritten whole; no
// paths removes them.
function hideFromGit(repoRoot: string, paths: string[]) {
  const block = paths.length === 0 ? "" : [blockStart, ...paths.map((p) => `/${p}`), blockEnd].join("\n") + "\n";
  writeBlock(repoRoot, blockStart, blockEnd, block);
}

// Rewrites the block between `start` and `end` in the local exclude, at its
// end: an empty `block` removes it.
function writeBlock(repoRoot: string, start: string, end: string, block: string) {
  const { file, before, at, after } = excludeFile(repoRoot, start, end);
  const outside = at >= 0 ? before.slice(0, at) + before.slice(after) : before;
  const kept = outside === "" || outside.endsWith("\n") ? outside : outside + "\n";
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, kept + block);
}

function hidesFromGit(repoRoot: string, start = blockStart, end = blockEnd): boolean {
  return excludeFile(repoRoot, start, end).at >= 0;
}

// The local exclude, and where the block between `start` and `end` starts
// and ends in it (`at` is -1 when it has none).
function excludeFile(repoRoot: string, start: string, end: string) {
  const file = path.resolve(repoRoot, git(repoRoot, "rev-parse", "--git-path", "info/exclude"));
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const at = before.indexOf(start);
  const close = at >= 0 ? before.indexOf(end, at) : -1;
  if (close < 0) return { file, before, at: -1, after: -1 };
  return { file, before, at, after: before.indexOf("\n", close) < 0 ? before.length : before.indexOf("\n", close) + 1 };
}

// A `revelio` alias that is not the one a private install needs, wherever git
// finds it, is the Builder's: init stops before writing anything. One an
// older Revelio wrote is replaced.
function refuseAnotherAlias(repoRoot: string) {
  const found = gitConfig(repoRoot, "--show-scope", "--get", aliasKey);
  if (found === undefined) return;
  const [scope, value] = found.split(/\t(.*)/s) as [string, string];
  if (value === alias) return;
  if (scope === "local" && value === gitConfig(repoRoot, "--local", "--get", ownedKey)) return;
  throw new Error(
    `This repo already has a git alias named ${command} (${aliasKey} = ${value}, in its ${scope} git config), ` +
      `and a private install needs that name for its git ${command} command. Nothing was written. ` +
      `To install Revelio, remove that alias first: git config --${scope} --unset ${aliasKey}`,
  );
}

// Writes the alias, and notes it as Revelio's, unless git already finds it.
function setAlias(repoRoot: string) {
  if (gitConfig(repoRoot, "--get", aliasKey) === alias) return;
  git(repoRoot, "config", "--local", aliasKey, alias);
  git(repoRoot, "config", "--local", ownedKey, alias);
}

// Removes the alias noted under `owned` when it is still the one written
// there and no other checkout's private install (`usedBy`) needs it. Says
// whether it was removed or kept for another; undefined when there was none.
function removeAlias(
  repoRoot: string,
  usedBy: string[],
  { key, owned: ownedAt }: { key: string; owned: string } = { key: aliasKey, owned: ownedKey },
): "removed" | "kept" | undefined {
  const owned = gitConfig(repoRoot, "--local", "--get", ownedAt);
  if (owned === undefined) return undefined;
  const ours = gitConfig(repoRoot, "--local", "--get", key) === owned;
  if (ours && usedBy.length > 0) return "kept";
  git(repoRoot, "config", "--local", "--unset", ownedAt);
  if (!ours) return undefined;
  git(repoRoot, "config", "--local", "--unset", key);
  return "removed";
}

// Takes a Fledgy install over, in this checkout. Its Stop hook and its
// instruction line are replaced by the Revelio ones where they are written.
// Here go its folder, its `git fledgy` alias and its lines in the local
// exclude, which become Revelio's, so whatever they hid stays hidden. The
// Builder's history and QA Results move to Revelio's folder in `home`. The
// alias and the exclude are shared with the other checkouts of the repo, so
// they are left while another checkout still has a Fledgy install. Says
// whether there was a Fledgy folder here, and whether `git fledgy` is gone.
function leaveFledgy(repoRoot: string, home: string): { folder: boolean; command: boolean } {
  moveAppData(repoRoot, home);
  const folder = path.join(repoRoot, fledgy.folder);
  const had = fs.existsSync(folder);
  fs.rmSync(folder, { recursive: true, force: true });
  if (otherCheckoutsWith(repoRoot, fledgy.folder).length > 0) return { folder: had, command: false };
  const command = removeAlias(repoRoot, [], { key: fledgy.aliasKey, owned: fledgy.ownedKey }) === "removed";
  if (hidesFromGit(repoRoot, fledgy.blockStart, fledgy.blockEnd)) {
    writeBlock(repoRoot, fledgy.blockStart, fledgy.blockEnd, "");
    if (!hidesFromGit(repoRoot)) hideFromGit(repoRoot, privatePaths());
  }
  return { folder: had, command };
}

// Fledgy kept a Builder's history and QA Results for the repo in
// `~/.fledgy/<first commit>/`. They move to Revelio's folder, unless Revelio
// already has one for the repo.
function moveAppData(repoRoot: string, home: string) {
  const to = appDataDirectory(repoRoot, home);
  if (!to) return;
  const from = path.join(home, fledgy.folder, path.basename(to));
  if (!fs.existsSync(from) || fs.existsSync(to)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  const fledgyHome = path.dirname(from);
  if (fs.readdirSync(fledgyHome).length === 0) fs.rmdirSync(fledgyHome);
}

// The other checkouts of this repo, linked worktrees, that have a private
// install. They share the local git config and the local exclude with this
// one.
function otherPrivateInstalls(repoRoot: string): string[] {
  return otherCheckoutsWith(repoRoot, privateFolder);
}

// The other checkouts of this repo that have `folder` at their root. A
// checkout whose folder cannot be found, but which git has not marked as
// gone, counts as having one, to be safe.
function otherCheckoutsWith(repoRoot: string, folder: string): string[] {
  const here = fs.realpathSync(repoRoot);
  return git(repoRoot, "worktree", "list", "--porcelain")
    .split(/\n\n+/)
    .flatMap((block) => {
      const lines = block.split("\n");
      const at = lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length);
      if (!at || lines.includes("bare") || lines.some((line) => /^prunable( |$)/.test(line))) return [];
      if (!fs.existsSync(at)) return [at];
      const real = fs.realpathSync(at);
      return real !== here && fs.existsSync(path.join(real, folder)) ? [real] : [];
    });
}

// A git setting, or undefined when there is none.
function gitConfig(repoRoot: string, ...args: string[]): string | undefined {
  const run = spawnSync("git", ["config", ...args], { cwd: repoRoot, encoding: "utf8" });
  if (run.status === 1) return undefined;
  if (run.status !== 0) throw new Error(`git config ${args.join(" ")} failed:\n${run.stderr}`);
  return run.stdout.replace(/\n$/, "");
}

function git(repoRoot: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

const posix = (relative: string) => relative.split(path.sep).join("/");
