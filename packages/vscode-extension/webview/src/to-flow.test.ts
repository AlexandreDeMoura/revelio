import { describe, expect, it } from "vitest";
import type { KnowledgeBase } from "../../src/messages";
import { askPrompt, flowOrder, toFlow } from "./to-flow";

const qa = { setup: [], steps: [] };

const kb: KnowledgeBase = {
  repo: { name: "pantry", root: "/apps/pantry" },
  actors: { cook: { name: "Cook", is: "The person who does the shopping." } },
  areas: {
    list: {
      name: "Grocery list",
      is: "The household's list.",
      flows_to_write: { "share-the-list": { name: "Share the list", is: "The Cook shares the list." } },
    },
    account: { name: "Account", is: "Signing up and in." },
  },
  flows: {
    "add-an-item": {
      name: "Add an item to the list",
      area: "list",
      actor: "cook",
      goal: "Put something on the list.",
      trigger: "The Cook taps `Add item`.",
      preconditions: [
        "The household has a list.",
        { flow: "sign-up", so_that: "The Cook has an account." },
        { flow_to_write: "share-the-list", so_that: "Someone shared the list." },
      ],
      paths: [
        {
          id: "main",
          name: "Main path",
          outcome: "The item is on the list.",
          qa,
          steps: [
            { id: "type", does: "Types an item.", sees: "It appears.", system: "Saves it.", parts: ["add-item-box", "list-sync"] },
            { id: "close", does: "Closes the list." },
          ],
        },
        {
          id: "already-there",
          name: "The item is already on the list",
          outcome: "Nothing changes.",
          when: "The item is there.",
          divergesAt: 1,
          qa,
          steps: [{ id: "type", does: "Types an item.", shared: true }, { id: "warned", sees: "A warning." }],
        },
      ],
    },
    "sign-up": {
      name: "Sign up with an email",
      area: "account",
      actor: "cook",
      goal: "Get an account.",
      trigger: "The Cook opens the app.",
      paths: [{ id: "main", name: "Main path", outcome: "Signed up.", qa, steps: [] }],
    },
    "remove-an-item": {
      name: "Remove an item",
      area: "list",
      actor: "cook",
      goal: "Take an item off.",
      trigger: "The Cook swipes an item.",
      paths: [{ id: "main", name: "Main path", outcome: "Gone.", qa, steps: [] }],
    },
  },
  parts: {
    "add-item-box": {
      name: "Add item box",
      is: "Reads what the Cook types.",
      anchors: [{ label: "The box", at: "src/AddItemBox.tsx#AddItemBox", side: "screen" }],
    },
    "list-sync": { name: "List sync", is: "Sends each change.", anchors: [] },
    unused: { name: "Unused", is: "Named by no Step of this Flow.", anchors: [] },
  },
};

describe("toFlow", () => {
  const flow = toFlow(kb, "add-an-item")!;

  it("names the app, the Area and the Actor as the knowledge base does", () => {
    expect(flow.id).toBe("add-an-item");
    expect(flow.app).toBe("pantry");
    expect(flow.area).toBe("Grocery list");
    expect(flow.name).toBe("Add an item to the list");
    expect(flow.goal).toBe("Put something on the list.");
    expect(flow.trigger).toBe("The Cook taps `Add item`.");
    expect(flow.actor).toEqual({ name: "Cook", description: "The person who does the shopping." });
  });

  it("names the Flow or the Flow to write a precondition waits for", () => {
    expect(flow.preconditions).toEqual([
      { text: "The household has a list." },
      { text: "The Cook has an account.", flow: "Sign up with an email", flowId: "sign-up" },
      { text: "Someone shared the list.", flow: "Share the list", toWrite: true },
    ]);
  });

  it("takes the main path's Steps, and where each Variant leaves it", () => {
    expect(flow.steps).toEqual([
      { does: "Types an item.", sees: "It appears.", system: "Saves it.", parts: ["add-item-box", "list-sync"] },
      { does: "Closes the list.", parts: [] },
    ]);
    expect(flow.variants).toEqual([{ name: "The item is already on the list", divergesAt: 1 }]);
  });

  it("brings only the Parts its Steps name", () => {
    expect(Object.keys(flow.parts)).toEqual(["add-item-box", "list-sync"]);
    expect(flow.parts["add-item-box"]?.anchors[0]?.at).toBe("src/AddItemBox.tsx#AddItemBox");
  });

  it("falls back to the ids when the Area or the Actor is missing", () => {
    const missing = toFlow({ ...kb, actors: {}, areas: {} }, "add-an-item")!;
    expect(missing.area).toBe("list");
    expect(missing.actor).toEqual({ name: "cook", description: "" });
  });

  it("leaves a precondition's Flow without an id when the knowledge base has no file for it", () => {
    const gone = toFlow({ ...kb, flows: { "add-an-item": kb.flows["add-an-item"] } }, "add-an-item")!;
    expect(gone.preconditions[1]).toEqual({ text: "The Cook has an account.", flow: "sign-up" });
  });

  it("says when git has not said anything of the Flow", () => {
    expect(flow.lastChange).toBeUndefined();
    expect(flow.uncommitted).toBe(false);
  });

  it("takes from git the last commit that changed the Flow, and how long ago", () => {
    const now = Date.parse("2026-11-19T15:00:00Z");
    const changes = {
      "add-an-item": {
        uncommitted: true,
        last: { sha: "7c2e9a4b5d", subject: "Parse quantities", date: "2026-11-19T10:00:00Z" },
      },
    };
    const changed = toFlow(kb, "add-an-item", changes, now)!;
    expect(changed.lastChange).toEqual({ sha: "7c2e9a4", subject: "Parse quantities", ago: "5 hours ago" });
    expect(changed.uncommitted).toBe(true);
  });

  it("finds no Flow for an id the knowledge base lacks", () => {
    expect(toFlow(kb, "nothing")).toBeUndefined();
  });
});

describe("flowOrder", () => {
  it("lists the Flows Area by Area, in the order of areas.yaml, as the web view's sidebar does", () => {
    expect(flowOrder(kb)).toEqual(["add-an-item", "remove-an-item", "sign-up"]);
  });

  it("puts last the Flows of an Area that areas.yaml lacks", () => {
    expect(flowOrder({ ...kb, areas: { account: kb.areas.account! } })).toEqual(["sign-up", "add-an-item", "remove-an-item"]);
  });
});

describe("askPrompt", () => {
  it("names the Part, its Flow, what it is and where it lives, and leaves the question to the Builder", () => {
    const flow = toFlow(kb, "add-an-item")!;
    expect(askPrompt(flow, flow.parts["add-item-box"]!)).toBe(
      'About the Part "Add item box" in the Flow "Add an item to the list" of the Revelio knowledge base: ' +
        "Reads what the Cook types. It lives in src/AddItemBox.tsx#AddItemBox.\n\n",
    );
  });
});
