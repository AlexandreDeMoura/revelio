import * as vscode from "vscode";
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
  }

  private answer(message: WebviewMessage): void {
    if (message.type === "ready") this.post(knowledgeBaseMessage(appRoot()));
  }

  private post(message: ExtensionMessage): void {
    void this.panel.webview.postMessage(message);
  }

  private dispose(): void {
    if (RevelioPanel.current === this) RevelioPanel.current = undefined;
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
