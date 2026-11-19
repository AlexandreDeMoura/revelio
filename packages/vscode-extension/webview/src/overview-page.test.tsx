// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OverviewPage, type OverviewActions } from "./overview-page";
import type { Overview } from "./to-overview";

afterEach(cleanup);

const overview: Overview = {
  app: "pantry",
  written: 4,
  toWrite: 5,
  uncommitted: 0,
  areas: [
    {
      id: "list",
      name: "Grocery list",
      toWrite: 4,
      flows: [
        { id: "add-an-item", name: "Add an item to the list", actor: "Cook" },
        { id: "share", name: "Share the list with the household", actor: "Cook" },
        { id: "check-off", name: "Check off items in the store", actor: "Cook" },
      ],
    },
    { id: "account", name: "Account", toWrite: 0, flows: [{ id: "sign-up", name: "Sign up with an email", actor: "Cook" }] },
    { id: "meals", name: "Meal plan", toWrite: 1, flows: [] },
  ],
  waited: [{ id: "plan-meals", name: "Plan the week’s meals", dependents: 1 }],
  lastCommit: { sha: "e94d1c7a2b", short: "e94d1c7", subject: "chore: release 1.4.0", ago: "2 hours ago", flows: [] },
  areaExamples: ["Grocery list", "Account"],
};

function page(shown: Overview = overview, readAt = Date.now() - 2 * 3600_000) {
  const actions: OverviewActions = { openFlow: vi.fn(), openCommit: vi.fn(), readAgain: vi.fn(), askToWrite: vi.fn() };
  return { ...render(<OverviewPage overview={shown} readAt={readAt} actions={actions} />), actions };
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, " ").trim();

describe("OverviewPage", () => {
  it("names the app and says how far the map has come", () => {
    page();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("pantry");
    expect(screen.getByText(/are written\./).textContent).toBe("4 Flows are written. 5 more are waiting to be written.");
    expect(screen.getByRole("img", { name: "4 of 9 Flows written" })).toBeTruthy();
  });

  it("says when no Flow is written yet", () => {
    page({ ...overview, written: 0, areas: [{ id: "meals", name: "Meal plan", toWrite: 1, flows: [] }] });
    expect(screen.getByText(/No Flow is written yet/).textContent).toBe("No Flow is written yet. 5 are waiting to be written.");
  });

  it("says how many Flows have changes not committed", () => {
    page({ ...overview, uncommitted: 2 });
    expect(screen.getByText(/changed on your computer/).textContent).toBe("2 changed on your computer since the last commit.");
  });

  it("says when it read the knowledge base, and reads it again", () => {
    const { actions } = page();
    expect(screen.getByText(/Knowledge base read/).textContent).toContain("Knowledge base read 2 hours ago");
    fireEvent.click(screen.getByRole("button", { name: "Read it again" }));
    expect(actions.readAgain).toHaveBeenCalled();
  });

  it("shows the last commit, which changed no Flow, and opens it", () => {
    const { actions } = page();
    const card = screen.getByRole("region", { name: "In the last commit" });
    expect(text(card)).toContain("e94d1c7 “chore: release 1.4.0” · 2 hours ago");
    expect(within(card).getByText("It changed no Flow.")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "e94d1c7" }));
    expect(actions.openCommit).toHaveBeenCalledWith("e94d1c7a2b");
  });

  it("opens a Flow the last commit changed", () => {
    const lastCommit = { ...overview.lastCommit!, flows: [{ id: "add-an-item", name: "Add an item to the list" }] };
    const { actions } = page({ ...overview, lastCommit });
    const card = screen.getByRole("region", { name: "In the last commit" });
    expect(text(card)).toContain("It changed Add an item to the list.");
    fireEvent.click(within(card).getByRole("button", { name: "Add an item to the list" }));
    expect(actions.openFlow).toHaveBeenCalledWith("add-an-item");
  });

  it("shows no last commit until git has said", () => {
    page({ ...overview, lastCommit: undefined });
    expect(screen.queryByRole("region", { name: "In the last commit" })).toBeNull();
  });

  it("says what is still to write, and which Flow to write first", () => {
    const { actions } = page();
    const card = screen.getByRole("region", { name: "Still to write" });
    expect(text(card)).toContain("4 in Grocery list, 1 in Meal plan. Start with Plan the week’s meals: a written Flow already depends on it.");
    fireEvent.click(within(card).getByRole("button", { name: "Plan the week’s meals" }));
    expect(actions.askToWrite).toHaveBeenCalledWith("Plan the week’s meals");
  });

  it("names three Flows to write at most, the others by their number", () => {
    const waited = ["One", "Two", "Three", "Four", "Five"].map((name) => ({ id: name, name, dependents: 1 }));
    page({ ...overview, waited });
    const card = screen.getByRole("region", { name: "Still to write" });
    expect(text(card)).toContain("Start with One, Two, Three and 2 others: written Flows already depend on them.");
  });

  it("puts /map-the-app in the agent's chat, then says so", () => {
    const { actions } = page();
    fireEvent.click(screen.getByRole("button", { name: "Write them with the agent" }));
    expect(actions.askToWrite).toHaveBeenCalledWith();
    expect(screen.queryByRole("button", { name: "Write them with the agent" })).toBeNull();
    expect(screen.getByText(/New Flows show up here/)).toBeTruthy();
  });

  it("has nothing still to write when every Flow is written", () => {
    page({ ...overview, toWrite: 0, waited: [], areas: overview.areas.map((area) => ({ ...area, toWrite: 0 })) });
    expect(screen.queryByRole("region", { name: "Still to write" })).toBeNull();
  });

  it("lists the Areas with their Flows, and opens a Flow", () => {
    const { actions } = page();
    const areas = screen.getByRole("region", { name: "Areas" });
    expect(text(areas)).toContain("3 Areas · 9 Flows");
    expect(within(within(areas).getByRole("button", { name: /Grocery list/ })).getByText("3 written · 4 to write")).toBeTruthy();
    expect(within(within(areas).getByRole("button", { name: /Account/ })).getByText("1 written")).toBeTruthy();
    expect(within(within(areas).getByRole("button", { name: /Meal plan/ })).getByText("0 written · 1 to write")).toBeTruthy();
    expect(within(areas).getByText("4 Flows still to write")).toBeTruthy();
    expect(within(areas).getByText("1 Flow still to write")).toBeTruthy();

    fireEvent.click(within(areas).getByRole("button", { name: /Sign up with an email/ }));
    expect(actions.openFlow).toHaveBeenCalledWith("sign-up");
  });

  it("closes an Area and opens it again", () => {
    page();
    const list = screen.getByRole("button", { name: /Grocery list/ });
    expect(list.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(list);
    expect(list.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: /Add an item to the list/ })).toBeNull();
    fireEvent.click(list);
    expect(screen.getByRole("button", { name: /Add an item to the list/ })).toBeTruthy();
  });

  it("explains the words, with Areas of this app as examples", () => {
    page();
    expect(screen.getByText("Get to know the words")).toBeTruthy();
    expect(screen.getByText("A region of your app that groups Flows, such as Grocery list or Account.")).toBeTruthy();
  });
});
