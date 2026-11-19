// The Builder's QA Results on the app open in VS Code, read and written by the same code as the
// web view's, in the same file: what one view records, the other shows.
import { noteQaResult, qaResultsFile, readQaResults, recordQaResult, removeQaResults } from "../../../src/qa-results.js";
import { readKnowledgeBase } from "../../../src/read-knowledge-base.js";
import type { ExtensionMessage, QaResults, WebviewMessage } from "./messages";

export type QaChange = Extract<WebviewMessage, { type: "recordQaResult" | "noteQaResult" | "resetQaResults" }>;

// `appRoot` is the folder open in VS Code, or undefined when none is. `home` is the Builder's
// home folder, where Revelio keeps their QA Results.
export function qaResultsMessage(appRoot: string | undefined, home: string): Extract<ExtensionMessage, { type: "qaResults" }> {
  const file = appRoot && qaResultsFile(appRoot, home);
  if (!file) return { type: "qaResults", results: null };
  const results: QaResults = {};
  for (const [flow, paths] of Object.entries(readQaResults(file)))
    for (const [path, steps] of Object.entries(paths))
      for (const [step, { state, note, date }] of Object.entries(steps))
        ((results[flow] ??= {})[path] ??= {})[step] = { state, note, date };
  return { type: "qaResults", results };
}

// Writes the change, and returns undefined, or returns why it was refused, in words for the
// Builder. A result is only taken for a QA Step the knowledge base has. `uncommitted` says
// whether the Flow has changes not committed now.
export function changeQaResults(appRoot: string, home: string, change: QaChange, uncommitted: boolean): string | undefined {
  const file = qaResultsFile(appRoot, home);
  if (!file) return "QA Results need a git repo with at least one commit.";
  const kb = readKnowledgeBase(appRoot);
  const { flow, path } = change;
  const onPath = Object.hasOwn(kb.flows, flow) ? kb.flows[flow]?.paths.find((candidate) => candidate.id === path) : undefined;
  if (!onPath) return `No path ${path} on the Flow ${flow}.`;
  if (change.type === "resetQaResults") return void removeQaResults(file, { flow, path });

  const ref = { flow, path, step: change.step };
  if (!onPath.qa.steps.some((qaStep) => qaStep.id === change.step))
    return `No QA Step ${change.step} on the path ${path} of the Flow ${flow}.`;
  if (change.type === "noteQaResult") noteQaResult(file, ref, change.note);
  else recordQaResult(appRoot, file, ref, uncommitted, { state: change.state, note: change.note });
  return undefined;
}
