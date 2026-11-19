// Runs inside a real VS Code, with the extension loaded, through `npm run test:integration`.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as vscode from "vscode";
import { recordQaResult } from "../../../../src/qa-results.js";
import { commitFileUri, openCommit } from "../../src/actions";
import { watchQaResults } from "../../src/qa-results-watch";

const VIEW_TYPE = "revelio.view";

// The Revelio view's tabs, across every editor group. VS Code may prefix a webview's
// view type, so a tab is matched on how its view type ends.
function revelioTabs(): vscode.Tab[] {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter((tab) => tab.input instanceof vscode.TabInputWebview && tab.input.viewType.endsWith(VIEW_TYPE));
}

function activeTabIsRevelio(): boolean {
  return revelioTabs().some((tab) => tab.isActive && tab.group.isActive);
}

// Tabs reach the extension a moment after the editor changes, so a check waits for them.
async function until(condition: () => boolean, what: string, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) assert.fail(`Timed out waiting until ${what}.`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

const open = () => vscode.commands.executeCommand("revelio.open");
const closeAllEditors = () => vscode.commands.executeCommand("workbench.action.closeAllEditors");

// Runs first, before any test runs Revelio: Open, which would start the extension itself.
describe("The Revelio button in the status bar", () => {
  it("is there once VS Code has started, before Revelio: Open is run", async () => {
    const extension = vscode.extensions.getExtension("revelio-ai.revelio");
    assert.ok(extension, "the extension is installed");
    // The button exists only while the extension is active.
    await until(() => extension.isActive, "the extension is active", 10_000);
  });
});

describe("The Revelio view", () => {
  afterEach(async () => {
    await closeAllEditors();
    await until(() => revelioTabs().length === 0, "every Revelio tab is closed");
  });

  it("opens in the editor from the Revelio: Open command", async () => {
    await open();
    await until(activeTabIsRevelio, "the Revelio view is the active tab");
    assert.equal(revelioTabs().length, 1);
    assert.equal(revelioTabs()[0]?.label, "Revelio");
  });

  it("comes back to the front when opened again, rather than opening a second one", async () => {
    await open();
    await until(activeTabIsRevelio, "the Revelio view is the active tab");
    await vscode.commands.executeCommand("workbench.action.files.newUntitledFile");
    await until(() => !activeTabIsRevelio(), "another tab is active");

    await open();
    await until(activeTabIsRevelio, "the Revelio view is the active tab again");
    assert.equal(revelioTabs().length, 1);
  });

  it("opens again after it was closed", async () => {
    await open();
    await until(activeTabIsRevelio, "the Revelio view is the active tab");
    await closeAllEditors();
    await until(() => revelioTabs().length === 0, "the Revelio view is closed");

    await open();
    await until(activeTabIsRevelio, "the Revelio view is open again");
    assert.equal(revelioTabs().length, 1);
  });
});

// A git repo with two commits: the second changes `list.ts` and adds `sync.ts`.
function appWithTwoCommits() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "revelio-commit-"));
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "user.name=Builder", "-c", "user.email=builder@example.com", ...args], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  git("init", "--quiet");
  fs.writeFileSync(path.join(root, "list.ts"), "export const list = [];\n");
  git("add", "--all");
  git("commit", "--quiet", "--message", "first");
  const first = git("rev-parse", "HEAD");
  fs.writeFileSync(path.join(root, "list.ts"), "export const list = [1];\n");
  fs.writeFileSync(path.join(root, "sync.ts"), "export function sync() {}\n");
  git("add", "--all");
  git("commit", "--quiet", "--message", "Change the list");
  return { root, first, second: git("rev-parse", "HEAD") };
}

// The changes editor adds to its tab's label how many files it shows.
const tabsLabelled = (label: string) =>
  vscode.window.tabGroups.all.flatMap((group) => group.tabs).filter((tab) => tab.label.startsWith(label));

describe("A commit's changes", () => {
  afterEach(async () => {
    await closeAllEditors();
    await until(() => vscode.window.tabGroups.all.every((group) => group.tabs.length === 0), "every tab is closed");
  });

  it("open beside the active editor, in VS Code's changes editor, named by the commit", async () => {
    const { root, second } = appWithTwoCommits();
    await vscode.commands.executeCommand("workbench.action.files.newUntitledFile");

    await openCommit(root, second, ["list.ts"]);

    const title = `${second.slice(0, 7)} · Change the list (1 file)`;
    await until(() => tabsLabelled(title).length === 1, "the commit's changes are open");
    assert.equal(tabsLabelled(title)[0]?.group.viewColumn, vscode.ViewColumn.Two);
  });

  it("open in the editor group already beside the active one, not in a new one", async () => {
    const { root, second } = appWithTwoCommits();
    await vscode.commands.executeCommand("workbench.action.files.newUntitledFile");
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ content: "beside" }), {
      viewColumn: vscode.ViewColumn.Beside,
    });
    await vscode.commands.executeCommand("workbench.action.focusFirstEditorGroup");
    await until(() => vscode.window.tabGroups.activeTabGroup.viewColumn === vscode.ViewColumn.One, "the first group is active");

    await openCommit(root, second, ["list.ts"]);

    const title = `${second.slice(0, 7)} · Change the list (1 file)`;
    await until(() => tabsLabelled(title).length === 1, "the commit's changes are open");
    assert.equal(tabsLabelled(title)[0]?.group.viewColumn, vscode.ViewColumn.Two);
    assert.equal(vscode.window.tabGroups.all.length, 2);
  });

  it("show each file as the commit and its parent have it, and nothing where they have no such file", async () => {
    const { root, first, second } = appWithTwoCommits();
    const text = async (ref: string, file: string) =>
      (await vscode.workspace.openTextDocument(commitFileUri(root, ref, file))).getText();

    assert.equal(await text(first, "list.ts"), "export const list = [];\n");
    assert.equal(await text(second, "list.ts"), "export const list = [1];\n");
    assert.equal(await text(first, "sync.ts"), "");
  });

  it("say so when git does not have the commit, and open nothing", async () => {
    const { root } = appWithTwoCommits();
    await openCommit(root, "0".repeat(40), ["list.ts"]);
    assert.ok(vscode.window.tabGroups.all.every((group) => group.tabs.length === 0));
  });
});

// The web view writes the QA Results in the Builder's home folder, outside the folder open in
// VS Code, so the Revelio view must watch that file itself to show what the web view records.
describe("The QA Results file", () => {
  let watch: vscode.Disposable | undefined;
  afterEach(() => watch?.dispose());

  it("tells when the web view records a QA Result, even when its folder did not exist yet", async () => {
    const { root } = appWithTwoCommits();
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "revelio-home-")), ".revelio", "app", "qa-results.json");
    let changes = 0;
    watch = watchQaResults(file, () => changes++);
    // The watcher starts a moment after it is made.
    await new Promise((resolve) => setTimeout(resolve, 500));

    recordQaResult(root, file, { flow: "list", path: "main", step: "open" }, false, { state: "passed", note: "" });

    await until(() => changes > 0, "the watcher tells of the new QA Result");
    const seen = changes;
    recordQaResult(root, file, { flow: "list", path: "main", step: "open" }, false, { state: "failed", note: "" });
    await until(() => changes > seen, "the watcher tells of the changed QA Result");
  });
});
