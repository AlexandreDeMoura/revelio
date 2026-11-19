import { describe, expect, it } from "vitest";
import type { KnowledgeBase } from "../../src/messages";
import { askPrompt, fixPrompt, flowOrder, toFlow } from "./to-flow";

const qa = { setup: [], steps: [] };
const mainQa = {
  setup: ["Sign in as a Cook."],
  steps: [
    { id: "add", do: "Add `Milk x2`.", expect: "Milk appears with a quantity of 2." },
    { do: "Close the list.", expect: "It closes." },
  ],
};

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
          qa: mainQa,
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
          steps: [
            { id: "type", does: "Types an item.", parts: ["add-item-box"], shared: true },
            { id: "warned", sees: "A warning.", parts: ["warning"] },
          ],
        },
        {
          id: "lost",
          name: "The Step it leaves at is gone",
          outcome: "Unknown.",
          when: "Someone removed that Step.",
          qa,
          steps: [{ id: "own", does: "Does its own thing." }],
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
    warning: { name: "Already there warning", is: "Says the item is on the list.", anchors: [] },
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

  it("takes the main path, then each Variant with the Steps it shares with the main path", () => {
    expect(flow.paths).toEqual([
      {
        id: "main",
        name: "Main path",
        outcome: "The item is on the list.",
        qa: mainQa,
        steps: [
          { does: "Types an item.", sees: "It appears.", system: "Saves it.", parts: ["add-item-box", "list-sync"] },
          { does: "Closes the list.", parts: [] },
        ],
      },
      {
        id: "already-there",
        name: "The item is already on the list",
        when: "The item is there.",
        outcome: "Nothing changes.",
        divergesAt: 1,
        qa,
        steps: [
          { does: "Types an item.", parts: ["add-item-box"], shared: true },
          { sees: "A warning.", parts: ["warning"] },
        ],
      },
      {
        id: "lost",
        name: "The Step it leaves at is gone",
        when: "Someone removed that Step.",
        outcome: "Unknown.",
        qa,
        steps: [{ does: "Does its own thing.", parts: [] }],
      },
    ]);
  });

  it("takes a path with no Manual QA Check as one with nothing to set up and no QA Step", () => {
    const read = kb.flows["add-an-item"]!;
    const [main, ...variants] = read.paths;
    const without = { ...main!, qa: undefined } as unknown as typeof main & {};
    const flowWithout = toFlow({ ...kb, flows: { "add-an-item": { ...read, paths: [without, ...variants] } } }, "add-an-item")!;
    expect(flowWithout.paths[0].qa).toEqual({ setup: [], steps: [] });
  });

  it("brings only the Parts its paths' Steps name", () => {
    expect(Object.keys(flow.parts)).toEqual(["add-item-box", "list-sync", "warning"]);
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
        last: { sha: "7c2e9a4b5d", subject: "Parse quantities", date: "2026-11-19T10:00:00Z", files: ["src/list.ts"] },
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

describe("fixPrompt", () => {
  const flow = toFlow(kb, "add-an-item")!;
  const failed = { do: "Add `Milk x2`.", expect: "Milk appears with a quantity of 2.", note: "It shows Milk x2 as the name." };

  it("asks the agent to fix a failed QA Step, with what the Builder did, expected and saw", () => {
    expect(fixPrompt(flow, flow.paths[0], [failed])).toBe(
      'In the Flow "Add an item to the list" of the Revelio knowledge base, a QA Step of the Manual QA Check of the main path failed.\n\n' +
        "I did: Add `Milk x2`.\n" +
        "I expected: Milk appears with a quantity of 2.\n" +
        "I saw: It shows Milk x2 as the name.\n\n" +
        "Find why, and fix it.",
    );
  });

  it("names the Variant, numbers each failed QA Step, and leaves out a note not written", () => {
    const prompt = fixPrompt(flow, flow.paths[1]!, [failed, { do: "Close the list.", expect: "It closes.", note: "" }]);
    expect(prompt).toContain('2 QA Steps of the Manual QA Check of the Variant "The item is already on the list" failed.');
    expect(prompt).toContain("1. I did: Add `Milk x2`.\n   I expected: Milk appears with a quantity of 2.\n   I saw: It shows Milk x2 as the name.\n\n");
    expect(prompt).toContain("2. I did: Close the list.\n   I expected: It closes.\n\nFind why, and fix them.");
  });
});
