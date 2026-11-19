import * as vscode from "vscode";
import { commitContent, commitScheme } from "./actions";
import { RevelioPanel } from "./revelio-panel";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("revelio.open", () => RevelioPanel.show(context.extensionUri)),
    // Lets VS Code reopen the Revelio view after a reload, where the Builder left it.
    vscode.window.registerWebviewPanelSerializer(RevelioPanel.viewType, {
      async deserializeWebviewPanel(panel) {
        RevelioPanel.revive(panel, context.extensionUri);
      },
    }),
    openButton(),
    // Gives the changes editor each file as a commit has it, when the Flow page shows what a commit changed.
    vscode.workspace.registerTextDocumentContentProvider(commitScheme, commitContent),
  );
}

// The Revelio button at the right of the status bar, which opens the Revelio view.
function openButton(): vscode.StatusBarItem {
  const button = vscode.window.createStatusBarItem("revelio.open", vscode.StatusBarAlignment.Right);
  button.name = "Revelio";
  button.text = "$(map) Revelio";
  button.tooltip = "Open the Revelio view";
  button.accessibilityInformation = { label: "Open the Revelio view" };
  button.command = "revelio.open";
  button.show();
  return button;
}

export function deactivate(): void {}
