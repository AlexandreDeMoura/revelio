// The knowledge base of the app open in VS Code, read by the same code as the web view's.
import { readKnowledgeBase } from "../../../src/read-knowledge-base.js";
import type { ExtensionMessage } from "./messages";

// `appRoot` is the folder open in VS Code, or undefined when none is.
export function knowledgeBaseMessage(appRoot: string | undefined): ExtensionMessage {
  if (!appRoot) return { type: "error", message: "Open your app's folder in VS Code to see its knowledge base." };
  try {
    return { type: "knowledgeBase", knowledgeBase: readKnowledgeBase(appRoot) };
  } catch (error) {
    return { type: "error", message: (error as Error).message };
  }
}
