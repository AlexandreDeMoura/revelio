import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { commitAll, hostRepo, knowledgeBase } from "../../../src/testing/host-repo.js";
import { changesMessage } from "./changes-message";

const flowId = "approve-a-tool-call";
const codeFile = "web/src/tool-step.tsx";
const home = () => fs.mkdtempSync(path.join(os.tmpdir(), "revelio-home-"));

// An app whose one Flow names a Part pointing into one code file.
function app() {
  return hostRepo({ ...knowledgeBase(`${codeFile}#ToolStep`, "screen"), [codeFile]: "export function ToolStep() {}\n" });
}

const changeTheCode = (root: string) =>
  fs.writeFileSync(path.join(root, codeFile), "export function ToolStep() {\n  return 1;\n}\n");

describe("changesMessage", () => {
  it("sends the last commit that changed each Flow, read as the web view reads it", async () => {
    const root = app();
    commitAll(root, "first");
    changeTheCode(root);
    const second = commitAll(root, "Make the tool step return one");

    const message = await changesMessage(root, home());

    expect(message.type).toBe("changes");
    expect(message.flows?.[flowId]).toMatchObject({
      uncommitted: false,
      last: { sha: second, subject: "Make the tool step return one" },
    });
    expect(Date.parse(message.flows?.[flowId]?.last?.date ?? "")).not.toBeNaN();
  });

  it("says a Flow has changes not committed", async () => {
    const root = app();
    commitAll(root, "first");
    changeTheCode(root);

    const message = await changesMessage(root, home());

    expect(message.flows?.[flowId]?.uncommitted).toBe(true);
  });

  it("sends only what the page shows of each commit", async () => {
    const root = app();
    commitAll(root, "first");

    const message = await changesMessage(root, home());

    expect(Object.keys(message.flows?.[flowId]?.last ?? {}).sort()).toEqual(["date", "sha", "subject"]);
  });

  it("sends no commit and no change outside a git repo", async () => {
    const message = await changesMessage(app(), home());
    expect(message.flows?.[flowId] ?? { uncommitted: false }).toEqual({ uncommitted: false });
  });

  it("sends no changes with no folder open", async () => {
    expect(await changesMessage(undefined, home())).toEqual({ type: "changes", flows: null });
  });
});
