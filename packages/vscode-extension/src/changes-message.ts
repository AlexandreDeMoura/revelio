// What git says of each Flow, read by the same code as the web view's.
import { changeReader } from "../../../src/flow-changes.js";
import type { ExtensionMessage, FlowChange } from "./messages";

// `appRoot` is the folder open in VS Code, or undefined when none is. `home` is the Builder's
// home folder, where Revelio keeps its Knowledge base versions of the app.
export async function changesMessage(
  appRoot: string | undefined,
  home: string,
): Promise<Extract<ExtensionMessage, { type: "changes" }>> {
  if (!appRoot) return { type: "changes", flows: null };
  let reader: Awaited<ReturnType<typeof changeReader>> | undefined;
  try {
    reader = await changeReader(appRoot, home);
    const flows: Record<string, FlowChange> = {};
    for (const [flow, { uncommitted, last }] of Object.entries(reader.changes.flows)) {
      flows[flow] = last
        ? { uncommitted, last: { sha: last.sha, subject: last.subject, date: last.date } }
        : { uncommitted };
    }
    return { type: "changes", flows };
  } catch {
    // Outside a git repo, or in one with no commit, git has nothing to say: the page shows the Flow without it.
    return { type: "changes", flows: null };
  } finally {
    reader?.close();
  }
}
