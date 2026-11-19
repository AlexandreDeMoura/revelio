import os from "node:os";
import * as vscode from "vscode";
import { askAgent, openAnchor, openFlowFile } from "./actions";
import { changesMessage } from "./changes-message";
import { knowledgeBaseMessage } from "./knowledge-base-message";
import type { ExtensionMessage, WebviewMessage } from "./messages";
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
  private pending: ReturnType<typeof setTimeout> | undefined;
  // Counts the sends, so changes read for an older one are not sent after a newer one's.
  private sends = 0;

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
        void this.sendKnowledgeBase();
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
        return void this.sendKnowledgeBase();
      case "openAnchor":
        return void (root && openAnchor(root, message.at));
      case "openFlowFile":
        return void (root && openFlowFile(root, message.flow));
      case "askAgent":
        return void askAgent(message.prompt);
    }
  }

  // The knowledge base first, then what git says of its Flows, which takes longer.
  private async sendKnowledgeBase(): Promise<void> {
    const send = ++this.sends;
    const root = appRoot();
    this.post(knowledgeBaseMessage(root));
    const changes = await changesMessage(root, os.homedir());
    if (send === this.sends) this.post(changes);
  }

  // Sends the knowledge base again when a file of it is written, added or removed, so what an
  // agent just wrote shows. An agent writes several files at once: they are sent once, together.
  private watch(): void {
    this.watcher?.dispose();
    const folder = vscode.workspace.workspaceFolders?.[0];
    this.watcher = folder
      ? vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, "knowledge-base{,/**}"))
      : undefined;
    const changed = () => {
      clearTimeout(this.pending);
      this.pending = setTimeout(() => void this.sendKnowledgeBase(), 150);
    };
    this.watcher?.onDidCreate(changed);
    this.watcher?.onDidChange(changed);
    this.watcher?.onDidDelete(changed);
  }

  private post(message: ExtensionMessage): void {
    void this.panel.webview.postMessage(message);
  }

  private dispose(): void {
    if (RevelioPanel.current === this) RevelioPanel.current = undefined;
    clearTimeout(this.pending);
    this.watcher?.dispose();
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
