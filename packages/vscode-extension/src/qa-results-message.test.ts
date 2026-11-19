import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { qaResultsFile, readQaResults } from "../../../src/qa-results.js";
import { commitAll, hostRepo, knowledgeBase } from "../../../src/testing/host-repo.js";
import { changeQaResults, qaResultsMessage } from "./qa-results-message";

const flow = "approve-a-tool-call";
const home = () => fs.mkdtempSync(path.join(os.tmpdir(), "revelio-home-"));

// An app whose one Flow has the QA Step `approve` on its main path and `deny` on its Variant.
function app() {
  return hostRepo(knowledgeBase("web/src/tool-step.tsx#ToolStep", "screen"));
}

describe("qaResultsMessage", () => {
  it("says results cannot be recorded outside a git repo, or with no folder open", () => {
    expect(qaResultsMessage(app(), home())).toEqual({ type: "qaResults", results: null });
    expect(qaResultsMessage(undefined, home())).toEqual({ type: "qaResults", results: null });
  });

  it("sends no result before the Builder records one", () => {
    const root = app();
    commitAll(root, "first");
    expect(qaResultsMessage(root, home())).toEqual({ type: "qaResults", results: {} });
  });

  it("sends each result recorded, with its state, its note and when it was recorded", () => {
    const root = app();
    commitAll(root, "first");
    const builder = home();
    changeQaResults(root, builder, { type: "recordQaResult", flow, path: "main", step: "approve", state: "failed", note: "Nothing ran." }, false);

    const message = qaResultsMessage(root, builder);

    expect(message.results?.[flow]?.main?.approve).toEqual({ state: "failed", note: "Nothing ran.", date: expect.any(String) });
  });
});

describe("changeQaResults", () => {
  it("records a result where the web view records it, with the commit and whether the Flow had changes not committed", () => {
    const root = app();
    const head = commitAll(root, "first");
    const builder = home();

    const refused = changeQaResults(root, builder, { type: "recordQaResult", flow, path: "deny", step: "deny", state: "passed", note: "" }, true);

    expect(refused).toBeUndefined();
    expect(readQaResults(qaResultsFile(root, builder))[flow]?.deny?.deny).toMatchObject({ state: "passed", commit: head, uncommitted: true });
  });

  it("changes the note of a result, and nothing else", () => {
    const root = app();
    commitAll(root, "first");
    const builder = home();
    const ref = { flow, path: "main", step: "approve" };
    changeQaResults(root, builder, { type: "recordQaResult", ...ref, state: "could-not-perform", note: "" }, false);

    changeQaResults(root, builder, { type: "noteQaResult", ...ref, note: "Needs a second account." }, false);

    expect(qaResultsMessage(root, builder).results?.[flow]?.main?.approve).toMatchObject({
      state: "could-not-perform",
      note: "Needs a second account.",
    });
  });

  it("sets every QA Step of a path back to not checked", () => {
    const root = app();
    commitAll(root, "first");
    const builder = home();
    changeQaResults(root, builder, { type: "recordQaResult", flow, path: "main", step: "approve", state: "passed", note: "" }, false);
    changeQaResults(root, builder, { type: "recordQaResult", flow, path: "deny", step: "deny", state: "passed", note: "" }, false);

    changeQaResults(root, builder, { type: "resetQaResults", flow, path: "main" }, false);

    const results = qaResultsMessage(root, builder).results;
    expect(results?.[flow]?.main).toBeUndefined();
    expect(results?.[flow]?.deny?.deny?.state).toBe("passed");
  });

  it("refuses a path or a QA Step the knowledge base does not have", () => {
    const root = app();
    commitAll(root, "first");
    const builder = home();
    const record = { type: "recordQaResult", flow, state: "passed", note: "" } as const;

    expect(changeQaResults(root, builder, { ...record, path: "gone", step: "approve" }, false)).toBe(
      `No path gone on the Flow ${flow}.`,
    );
    expect(changeQaResults(root, builder, { ...record, path: "main", step: "gone" }, false)).toBe(
      `No QA Step gone on the path main of the Flow ${flow}.`,
    );
    expect(qaResultsMessage(root, builder).results).toEqual({});
  });

  it("refuses to record outside a git repo", () => {
    const refused = changeQaResults(app(), home(), { type: "resetQaResults", flow, path: "main" }, false);
    expect(refused).toBe("QA Results need a git repo with at least one commit.");
  });
});
