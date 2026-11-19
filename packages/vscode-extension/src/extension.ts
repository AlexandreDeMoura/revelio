import * as vscode from "vscode";
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
  );
}

export function deactivate(): void {}
