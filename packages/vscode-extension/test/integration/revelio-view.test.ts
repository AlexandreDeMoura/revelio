// Runs inside a real VS Code, with the extension loaded, through `npm run test:integration`.
import assert from "node:assert/strict";
import * as vscode from "vscode";

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
