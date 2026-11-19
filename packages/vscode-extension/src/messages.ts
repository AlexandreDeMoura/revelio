// The messages between the extension and the webview, in both directions. Both halves import
// this file, so it holds only types: the webview runs in a browser, with no Node.
import type { KnowledgeBase } from "../../../src/knowledge-base.js";

export type { KnowledgeBase };

// What git says of one Flow: whether the code its Parts' Anchors point to has changes not
// committed, and the last commit that changed it, if one did.
export type FlowChange = {
  uncommitted: boolean;
  last?: { sha: string; subject: string; date: string };
};

// From the webview to the extension.
export type WebviewMessage =
  // The page has loaded and listens: the extension answers with the knowledge base, then its changes.
  | { type: "ready" }
  // Opens beside the view the place in the code an Anchor's `at` names: `path#Symbol`, from the app's root.
  | { type: "openAnchor"; at: string }
  // Opens beside the view the file of the Flow with this id.
  | { type: "openFlowFile"; flow: string }
  // Hands the agent a question to finish and send.
  | { type: "askAgent"; prompt: string };

// From the extension to the webview.
export type ExtensionMessage =
  | { type: "knowledgeBase"; knowledgeBase: KnowledgeBase }
  // Sent after the knowledge base, since git takes longer. Null when git cannot say, outside a repo for one.
  | { type: "changes"; flows: Record<string, FlowChange> | null }
  // Why there is no knowledge base to show, in words for the Builder.
  | { type: "error"; message: string };
