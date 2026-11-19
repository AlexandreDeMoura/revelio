// The messages between the extension and the webview, in both directions. Both halves import
// this file, so it holds only types: the webview runs in a browser, with no Node.
import type { KnowledgeBase } from "../../../src/knowledge-base.js";

export type { KnowledgeBase };

// From the webview to the extension.
export type WebviewMessage =
  // The page has loaded and listens: the extension answers with the knowledge base.
  { type: "ready" };

// From the extension to the webview.
export type ExtensionMessage =
  | { type: "knowledgeBase"; knowledgeBase: KnowledgeBase }
  // Why there is no knowledge base to show, in words for the Builder.
  | { type: "error"; message: string };
