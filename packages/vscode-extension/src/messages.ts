// The messages between the extension and the webview, in both directions. Both halves import
// this file, so it holds only types: the webview runs in a browser, with no Node.
import type { KnowledgeBase } from "../../../src/knowledge-base.js";

export type { KnowledgeBase };

// What git says of one Flow: whether the code its Parts' Anchors point to has changes not
// committed, and the last commit that changed it, if one did, with the files (from the app's
// root) whose change in that commit changed the Flow.
export type FlowChange = {
  uncommitted: boolean;
  last?: { sha: string; subject: string; date: string; files: string[] };
};

// A QA Result, as the page shows it.
export type QaState = "passed" | "failed" | "could-not-perform";
export type QaResult = { state: QaState; note: string; date: string };
// Flow id, then path id, then QA Step id. A QA Step with no entry is not checked.
export type QaResults = Record<string, Record<string, Record<string, QaResult>>>;

// A QA Step of one path of one Flow, by their ids.
type QaStepRef = { flow: string; path: string; step: string };

// From the webview to the extension.
export type WebviewMessage =
  // The page has loaded and listens: the extension answers with the knowledge base, then its changes.
  | { type: "ready" }
  // Opens beside the view the place in the code an Anchor's `at` names: `path#Symbol`, from the app's root.
  | { type: "openAnchor"; at: string }
  // Opens beside the view the file of the Flow with this id.
  | { type: "openFlowFile"; flow: string }
  // Hands the agent a question to finish and send.
  | { type: "askAgent"; prompt: string }
  // Shows beside the view what the commit `sha` changed in these files, from the app's root:
  // in every file it changed when it changed none of them.
  | { type: "openCommit"; sha: string; files: string[] }
  // Records the Builder's QA Result on a QA Step, with their note.
  | ({ type: "recordQaResult"; state: QaState; note: string } & QaStepRef)
  // Changes the note of a QA Result already recorded.
  | ({ type: "noteQaResult"; note: string } & QaStepRef)
  // Sets every QA Step of a path back to not checked.
  | { type: "resetQaResults"; flow: string; path: string }
  // Opens a terminal in the app's folder.
  | { type: "openTerminal" };

// From the extension to the webview.
export type ExtensionMessage =
  | { type: "knowledgeBase"; knowledgeBase: KnowledgeBase }
  // Sent after the knowledge base, since git takes longer. Null when git cannot say, outside a repo for one.
  | { type: "changes"; flows: Record<string, FlowChange> | null }
  // The Builder's QA Results. Null when they cannot be recorded: outside a git repo, or in one with no commit.
  | { type: "qaResults"; results: QaResults | null }
  // Why there is no knowledge base to show, in words for the Builder.
  | { type: "error"; message: string };
