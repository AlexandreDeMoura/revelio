// The extension, as the webview talks to it. The page receives a Host, so tests can stand in for VS Code.
import type { ExtensionMessage, WebviewMessage } from "../../src/messages";

export type Host = {
  post(message: WebviewMessage): void;
  // Calls `listener` with every message from the extension, until the returned function is called.
  onMessage(listener: (message: ExtensionMessage) => void): () => void;
  // The Flow the view showed, kept by VS Code while the view is hidden or reloaded.
  savedFlow(): string | undefined;
  saveFlow(id: string): void;
};

type SavedState = { flow?: string };

// Given to the webview by VS Code. It can be called only once per page.
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): SavedState | undefined;
  setState(state: SavedState): void;
};

export function vscodeHost(): Host {
  const vscode = acquireVsCodeApi();
  return {
    post: (message) => vscode.postMessage(message),
    onMessage: (listener) => {
      const receive = (event: MessageEvent<ExtensionMessage>) => listener(event.data);
      window.addEventListener("message", receive);
      return () => window.removeEventListener("message", receive);
    },
    savedFlow: () => vscode.getState()?.flow,
    saveFlow: (flow) => vscode.setState({ ...vscode.getState(), flow }),
  };
}
