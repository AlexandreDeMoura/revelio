import { describe, expect, it } from "vitest";
import type { KnowledgeBase } from "../../src/messages";
import { toOverview, writePrompt } from "./to-overview";

const qa = { setup: [], steps: [] };
const flow = (name: string, area: string, more: Partial<NonNullable<KnowledgeBase["flows"][string]>> = {}) => ({
  name,
  area,
  actor: "cook",
  goal: `The goal of ${name}.`,
  trigger: "Something happens.",
  paths: [{ id: "main", name: "Main path", outcome: "Done.", qa, steps: [] }],
  ...more,
});

const kb: KnowledgeBase = {
  repo: { name: "pantry", root: "/apps/pantry" },
  actors: { cook: { name: "Cook", is: "Does the shopping." } },
  areas: {
    list: {
      name: "Grocery list",
      is: "The list.",
      flows_to_write: {
        "share-the-list": { name: "Share the list", is: "Gives the list to the household." },
        "sort-the-list": { name: "Sort the list", is: "Puts the list in aisle order." },
      },
    },
    account: { name: "Account", is: "Who the Cook is." },
    meals: { name: "Meal plan", is: "The week's meals.", flows_to_write: { "plan-meals": { name: "Plan the week's meals", is: "Picks a meal a day." } } },
  },
  flows: {
    "add-an-item": flow("Add an item", "list", { preconditions: [{ flow_to_write: "plan-meals", so_that: "Meals are planned." }] }),
    "sign-up": flow("Sign up with an email", "account", { actor: "stranger" }),
    "check-off": flow("Check off an item", "list"),
    "export-list": flow("Export the list", "printing"),
  },
  parts: {},
};

const now = Date.parse("2026-11-19T12:00:00Z");

describe("toOverview", () => {
  it("counts the Flows written and the Flows to write", () => {
    const overview = toOverview(kb);
    expect(overview).toMatchObject({ app: "pantry", written: 4, toWrite: 3 });
  });

  it("lists the Areas of areas.yaml in order, then the Areas a Flow names that areas.yaml lacks", () => {
    const { areas } = toOverview(kb);
    expect(areas.map((area) => [area.name, area.flows.map((each) => each.name), area.toWrite])).toEqual([
      ["Grocery list", ["Add an item", "Check off an item"], 2],
      ["Account", ["Sign up with an email"], 0],
      ["Meal plan", [], 1],
      ["printing", ["Export the list"], 0],
    ]);
  });

  it("names each Flow's Actor, or its id when actors.yaml lacks it", () => {
    const { areas } = toOverview(kb);
    expect(areas[0]?.flows[0]).toEqual({ id: "add-an-item", name: "Add an item", actor: "Cook" });
    expect(areas[1]?.flows[0]?.actor).toBe("stranger");
  });

  it("puts first the Flows to write that written Flows depend on, the most depended on first", () => {
    const depended = {
      ...kb,
      flows: {
        ...kb.flows,
        "remove-an-item": flow("Remove an item", "list", { preconditions: [{ flow_to_write: "share-the-list", so_that: "Shared." }] }),
        "rename-an-item": flow("Rename an item", "list", { preconditions: [{ flow_to_write: "share-the-list", so_that: "Shared." }] }),
      },
    };
    expect(toOverview(depended).waited).toEqual([
      { id: "share-the-list", name: "Share the list", dependents: 2 },
      { id: "plan-meals", name: "Plan the week's meals", dependents: 1 },
    ]);
  });

  it("counts the Flows whose code has changes not committed", () => {
    const changes = { "add-an-item": { uncommitted: true }, "sign-up": { uncommitted: false }, gone: { uncommitted: true } };
    expect(toOverview(kb, changes).uncommitted).toBe(1);
  });

  it("says what the last commit changed, once git has said", () => {
    expect(toOverview(kb).lastCommit).toBeUndefined();
    const lastCommit = { sha: "e94d1c7a2b", subject: "Parse", date: "2026-11-19T10:00:00Z", flows: ["check-off", "gone"] };
    expect(toOverview(kb, {}, lastCommit, now).lastCommit).toEqual({
      sha: "e94d1c7a2b",
      short: "e94d1c7",
      subject: "Parse",
      ago: "2 hours ago",
      flows: [{ id: "check-off", name: "Check off an item" }],
    });
  });

  it("gives an Area of areas.yaml as an example of what an Area is", () => {
    expect(toOverview(kb).areaExamples).toEqual(["Grocery list", "Account"]);
  });
});

describe("writePrompt", () => {
  it("asks the agent to carry on mapping the app, or to write one Flow to write", () => {
    expect(writePrompt()).toBe("/map-the-app");
    expect(writePrompt("Share the list")).toBe("/map-the-app Write the Flow to write “Share the list”.");
  });
});
