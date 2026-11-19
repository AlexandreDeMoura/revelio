import os from "node:os";
import path from "node:path";
import * as vscode from "vscode";
import { qaResultsFile } from "../../../src/qa-results.js";
import { askAgent, openAnchor, openCommit, openFlowFile, openTerminal } from "./actions";
import { changesMessage } from "./changes-message";
import { knowledgeBaseMessage } from "./knowledge-base-message";
import type { ExtensionMessage, FlowChange, WebviewMessage } from "./messages";
import { changeQaResults, qaResultsMessage, type QaChange } from "./qa-results-message";
import { watchQaResults } from "./qa-results-watch";
import { anchoredFiles, refreshFor, refresher, type Refresh } from "./refresh";
import { newNonce, webviewHtml } from "./webview-html";

// The Revelio view: a tab in the editor that shows the webview built into `dist/webview`.
// There is at most one. Opening it again brings the one already open to the front.
export class RevelioPanel {
  static readonly viewType = "revelio.view";
  private static current: RevelioPanel | undefined;

  static show(extensionUri: vscode.Uri): void {
    if (RevelioPanel.current) {
      RevelioPanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      RevelioPanel.viewType,
      "Revelio",
      vscode.ViewColumn.Active,
      webviewOptions(extensionUri),
    );
    RevelioPanel.current = new RevelioPanel(panel, extensionUri);
  }

  // Takes over a Revelio view that VS Code restored after a reload or a restart.
  static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): void {
    RevelioPanel.current?.panel.dispose();
    RevelioPanel.current = new RevelioPanel(panel, extensionUri);
  }

  private readonly disposables: vscode.Disposable[] = [];
  private watcher: vscode.FileSystemWatcher | undefined;
  // Watches the Builder's QA Results file, so what the web view records shows here too.
  private qaWatch: { file: string; watcher: vscode.Disposable } | undefined;
  private readonly refresh = refresher((what) => void this.send(what), 150);
  // The files the Anchors of the knowledge base last sent point to.
  private anchored = new Set<string>();
  // Counts the sends, so changes read for an older one are not sent after a newer one's.
  private sends = 0;
  // What git said of each Flow last, which a QA Result records as it is recorded.
  private flowChanges: Record<string, FlowChange> | null = null;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
  ) {
    // A restored panel comes back without its options, so they are set here every time.
    panel.webview.options = webviewOptions(extensionUri);
    const asset = (file: string) =>
      panel.webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot(extensionUri), file)).toString();
    panel.webview.html = webviewHtml({
      cspSource: panel.webview.cspSource,
      scriptUri: asset("webview.js"),
      styleUri: asset("webview.css"),
      nonce: newNonce(),
    });
    panel.webview.onDidReceiveMessage((message: WebviewMessage) => this.answer(message), null, this.disposables);
    panel.onDidDispose(() => this.dispose(), null, this.disposables);
    vscode.workspace.onDidChangeWorkspaceFolders(
      () => {
        this.watch();
        void this.send("knowledgeBase");
      },
      null,
      this.disposables,
    );
    this.watch();
  }

  private answer(message: WebviewMessage): void {
    const root = appRoot();
    switch (message.type) {
      case "ready":
        return void this.send("knowledgeBase");
      case "openAnchor":
        return void (root && openAnchor(root, message.at));
      case "openFlowFile":
        return void (root && openFlowFile(root, message.flow));
      case "askAgent":
        return void askAgent(message.prompt);
      case "openCommit":
        return void (root && openCommit(root, message.sha, message.files));
      case "openTerminal":
        return openTerminal(root);
      case "recordQaResult":
      case "noteQaResult":
      case "resetQaResults":
        return void (root && this.changeQaResults(root, message));
    }
  }

  // Writes the change, then sends the QA Results again: the page shows what the file holds.
  private changeQaResults(root: string, change: QaChange): void {
    let refused: string | undefined;
    try {
      refused = changeQaResults(root, os.homedir(), change, this.flowChanges?.[change.flow]?.uncommitted ?? false);
    } catch (error) {
      refused = (error as Error).message;
    }
    if (refused) void vscode.window.showErrorMessage(`Revelio did not record the QA Result: ${refused}`);
    this.postQaResults(root);
  }

  private postQaResults(root: string | undefined): void {
    try {
      this.post(qaResultsMessage(root, os.homedir()));
    } catch (error) {
      void vscode.window.showErrorMessage(`Revelio cannot read your QA Results: ${(error as Error).message}`);
    }
  }

  // The knowledge base and the QA Results first, unless only what git says is asked for, then
  // what git says of its Flows, which takes longer.
  private async send(what: Refresh): Promise<void> {
    const send = ++this.sends;
    const root = appRoot();
    this.watchQaResults(root);
    if (what === "knowledgeBase") {
      const message = knowledgeBaseMessage(root);
      this.anchored = message.type === "knowledgeBase" ? anchoredFiles(message.knowledgeBase) : new Set();
      this.post(message);
      this.postQaResults(root);
    }
    const changes = await changesMessage(root, os.homedir());
    if (send !== this.sends) return;
    this.flowChanges = changes.flows;
    this.post(changes);
  }

  // Sends the knowledge base again when a file of it is written, added or removed, so what an
  // agent just wrote shows, and what git says again when a commit moves git or the code an
  // Anchor points to changes, so the Flow page's last change and changes not committed hold.
  private watch(): void {
    this.watcher?.dispose();
    const folder = vscode.workspace.workspaceFolders?.[0];
    this.watcher = folder ? vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, "**")) : undefined;
    const changed = (uri: vscode.Uri) => {
      if (!folder) return;
      const file = path.relative(folder.uri.fsPath, uri.fsPath).split(path.sep).join("/");
      const what = refreshFor(file, this.anchored);
      if (what) this.refresh.schedule(what);
    };
    this.watcher?.onDidCreate(changed);
    this.watcher?.onDidChange(changed);
    this.watcher?.onDidDelete(changed);
  }

  // Watches the QA Results file of the app open now. It moves with the app's first commit, so it
  // is found again each time the view sends, as a first commit or another folder can change it.
  private watchQaResults(root: string | undefined): void {
    const file = root && qaResultsFile(root, os.homedir());
    if (file === this.qaWatch?.file) return;
    this.qaWatch?.watcher.dispose();
    this.qaWatch = undefined;
    if (!file) return;
    try {
      this.qaWatch = { file, watcher: watchQaResults(file, () => this.postQaResults(appRoot())) };
    } catch (error) {
      void vscode.window.showErrorMessage(`Revelio cannot watch your QA Results: ${(error as Error).message}`);
    }
  }

  private post(message: ExtensionMessage): void {
    void this.panel.webview.postMessage(message);
  }

  private dispose(): void {
    if (RevelioPanel.current === this) RevelioPanel.current = undefined;
    this.refresh.stop();
    this.watcher?.dispose();
    this.qaWatch?.watcher.dispose();
    for (const disposable of this.disposables.splice(0)) disposable.dispose();
  }
}

// The app whose knowledge base the view shows: the first folder open in VS Code.
function appRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

// Where the webview is built: the only folder it may load files from.
function webviewRoot(extensionUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(extensionUri, "dist", "webview");
}

function webviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
  return { enableScripts: true, localResourceRoots: [webviewRoot(extensionUri)] };
}
