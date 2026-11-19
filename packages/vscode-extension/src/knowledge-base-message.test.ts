import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { knowledgeBaseMessage } from "./knowledge-base-message";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

// A throwaway app folder holding the given files.
function app(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "revelio-extension-"));
  roots.push(root);
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

const flow = `name: Add an item to the list
area: grocery-list
actor: cook
goal: Put something on the household's grocery list.
trigger: The Cook taps Add item.
outcome: The item is on the list.
steps:
  - id: type
    does: Types an item.
    parts: [add-item-box]
  - id: close
    does: Closes the list.
qa:
  setup: []
  steps: []
variants:
  - id: already-there
    name: The item is already on the list
    diverges_at: close
    when: The item is on the list already.
    outcome: The list is unchanged.
    steps:
      - id: warned
        sees: A message says the item is there.
    qa: { setup: [], steps: [] }
`;

describe("knowledgeBaseMessage", () => {
  it("sends the knowledge base of the app folder, as the web view receives it", () => {
    const root = app({
      "knowledge-base/actors.yaml": "cook:\n  name: Cook\n  is: The person who does the shopping.\n",
      "knowledge-base/flows/add-an-item.yaml": flow,
      "knowledge-base/parts/add-item-box.yaml": "name: Add item box\nis: Reads what the Cook types.\nanchors: []\n",
    });

    const message = knowledgeBaseMessage(root);

    expect(message.type).toBe("knowledgeBase");
    if (message.type !== "knowledgeBase") return;
    const { knowledgeBase } = message;
    expect(knowledgeBase.repo).toEqual({ name: path.basename(root), root });
    expect(knowledgeBase.actors.cook?.name).toBe("Cook");
    expect(knowledgeBase.parts["add-item-box"]?.name).toBe("Add item box");
    const sent = knowledgeBase.flows["add-an-item"];
    expect(sent?.name).toBe("Add an item to the list");
    expect(sent?.paths.map((p) => p.id)).toEqual(["main", "already-there"]);
    expect(sent?.paths[1]?.divergesAt).toBe(1);
    expect(sent?.paths[1]?.steps.map((step) => step.id)).toEqual(["type", "warned"]);
  });

  it("says which file it cannot read", () => {
    const root = app({ "knowledge-base/flows/broken.yaml": "name: [unclosed\n" });

    const message = knowledgeBaseMessage(root);

    expect(message.type).toBe("error");
    if (message.type !== "error") return;
    expect(message.message).toContain(path.join("knowledge-base", "flows", "broken.yaml"));
  });

  it("asks for a folder when none is open", () => {
    expect(knowledgeBaseMessage(undefined)).toEqual({
      type: "error",
      message: "Open your app's folder in VS Code to see its knowledge base.",
    });
  });
});
