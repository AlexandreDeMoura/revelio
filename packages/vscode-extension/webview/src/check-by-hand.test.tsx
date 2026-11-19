// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { QaResult } from "../../src/messages";
import type { Flow } from "./flow";
import { FlowPage } from "./flow-page";
import { fakeFlowActions } from "./testing/fake-flow-actions";

afterEach(cleanup);

const flow: Flow = {
  id: "add-an-item",
  app: "pantry",
  area: "Grocery list",
  name: "Add an item to the list",
  goal: "Put something on the list.",
  uncommitted: false,
  actor: { name: "Cook", description: "Does the shopping." },
  trigger: "The Cook taps `Add item`.",
  preconditions: [],
  parts: {},
  paths: [
    {
      id: "main",
      name: "Main path",
      outcome: "The item is on the list.",
      steps: [{ does: "Types an item.", parts: [] }],
      qa: {
        setup: ["Start the app, then sign in as a Cook on two phones."],
        steps: [
          { id: "open", do: "Open `/list`.", expect: "The list shows the household's items." },
          { id: "second", do: "Open the list on a second phone.", expect: "Both phones show the same list." },
          { id: "add", do: "Add Milk x2 on the first phone.", expect: "Milk appears at the top." },
          { id: "look", do: "Look at the second phone.", expect: "The new item shows up there." },
        ],
      },
    },
    {
      id: "already-there",
      name: "The item is already on the list",
      when: "The list has the item.",
      outcome: "The list keeps one of it.",
      divergesAt: 0,
      steps: [{ sees: "A warning.", parts: [] }],
      qa: { setup: [], steps: [{ id: "again", do: "Add Milk again.", expect: "A warning says it is there." }] },
    },
  ],
};

const result = (state: QaResult["state"], note = ""): QaResult => ({ state, note, date: new Date().toISOString() });

// Renders the page with every action recorded, and the QA Results of the Flow by path.
function page({ results = {}, recordable = true }: { results?: Record<string, Record<string, QaResult>>; recordable?: boolean } = {}) {
  const actions = fakeFlowActions();
  return { ...render(<FlowPage flow={flow} actions={actions} results={results} recordable={recordable} />), actions };
}

const press = (key: string, target: Element = document.body, more = {}) => fireEvent.keyDown(target, { key, ...more });
const tab = (name: RegExp) => screen.getByRole("tab", { name });
const qaSteps = () => within(screen.getByRole("list", { name: "QA Steps" })).getAllByRole("listitem");
const note = () => screen.getByRole("textbox", { name: "Note about what you saw" });
const checkByHand = (results?: Record<string, Record<string, QaResult>>, recordable?: boolean) => {
  const shown = page({ results, recordable });
  fireEvent.click(tab(/Check by hand/));
  return shown;
};

describe("Check by hand", () => {
  it("opens with C and goes back to Read the Flow with R", () => {
    page();
    press("c");
    expect(tab(/Check by hand/).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Manual QA Check · Main path")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Steps" })).toBeNull();

    press("R");
    expect(tab(/Read the Flow/).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("list", { name: "Steps" })).toBeTruthy();
  });

  it("opens from its tab too", () => {
    page();
    fireEvent.click(tab(/Check by hand/));
    expect(tab(/Check by hand/).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(tab(/Read the Flow/));
    expect(tab(/Read the Flow/).getAttribute("aria-selected")).toBe("true");
  });

  it("leaves R and C alone while a note is typed, or with Cmd, Ctrl or Alt held", () => {
    checkByHand();
    press("r", note());
    expect(tab(/Check by hand/).getAttribute("aria-selected")).toBe("true");
    press("r", document.body, { metaKey: true });
    press("r", document.body, { ctrlKey: true });
    press("r", document.body, { altKey: true });
    expect(tab(/Check by hand/).getAttribute("aria-selected")).toBe("true");
  });

  it("counts the QA Steps to check, and says where the results stay", () => {
    checkByHand();
    expect(screen.getAllByText("4 QA Steps to check")).toBeTruthy();
    expect(screen.getByText("0 of 4 QA Steps passed")).toBeTruthy();
    expect(screen.getByText("Results stay on this machine, outside the repo")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Start over/ })).toBeNull();
  });

  it("opens on the first QA Step not checked, with what to do and what to expect", () => {
    checkByHand({ main: { open: result("passed") } });
    const [first, second] = qaSteps();
    expect(within(first!).getByText("Passed")).toBeTruthy();
    expect(within(first!).queryByText("Expect")).toBeNull();
    expect(within(second!).getByText("Do")).toBeTruthy();
    expect(within(second!).getByText("Open the list on a second phone.")).toBeTruthy();
    expect(within(second!).getByText("Both phones show the same list.")).toBeTruthy();
    expect(within(second!).getByRole("group", { name: "Result" })).toBeTruthy();
    expect(screen.getByText("1 passed · 3 to check")).toBeTruthy();
    expect(screen.getByText("1 of 4 QA Steps passed")).toBeTruthy();
  });

  it("records the result picked, with the note, and moves to the next QA Step", () => {
    const { actions } = checkByHand();
    expect(within(qaSteps()[0]!).getByText("/list").tagName).toBe("CODE");
    fireEvent.change(note(), { target: { value: "It showed an empty list." } });
    fireEvent.click(screen.getByRole("button", { name: "Failed" }));

    expect(actions.recordQaResult).toHaveBeenCalledWith("main", "open", "failed", "It showed an empty list.");
    expect(within(qaSteps()[1]!).getByRole("group", { name: "Result" })).toBeTruthy();
    expect((note() as HTMLInputElement).value).toBe("");
  });

  it("opens a QA Step clicked, and shows its result picked", () => {
    checkByHand({ main: { open: result("could-not-perform") } });
    fireEvent.click(within(qaSteps()[0]!).getByRole("button", { name: "Open /list." }));
    const [first] = qaSteps();
    expect(within(first!).getByRole("button", { name: "Could not perform" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(first!).getByRole("button", { name: "Passed" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("saves a note changed on a QA Step already recorded, once the note is left", () => {
    const { actions } = checkByHand({ main: { open: result("failed", "Empty.") } });
    fireEvent.click(within(qaSteps()[0]!).getByRole("button", { name: "Open /list." }));
    expect((note() as HTMLInputElement).value).toBe("Empty.");
    fireEvent.change(note(), { target: { value: "Empty until reloaded." } });
    expect(actions.noteQaResult).not.toHaveBeenCalled();
    fireEvent.blur(note());
    expect(actions.noteQaResult).toHaveBeenCalledWith("main", "open", "Empty until reloaded.");
  });

  it("shows a failed QA Step's note, and asks the agent to fix it", () => {
    const { actions } = checkByHand({ main: { open: result("failed", "Empty.") } });
    const [first] = qaSteps();
    expect(within(first!).getByText("Failed")).toBeTruthy();
    expect(within(first!).getByText("“Empty.”")).toBeTruthy();

    fireEvent.click(within(first!).getByRole("button", { name: "Ask the agent to fix this" }));

    expect(actions.askToFix).toHaveBeenCalledWith(flow.paths[0], [
      { do: "Open `/list`.", expect: "The list shows the household's items.", note: "Empty." },
    ]);
    expect(within(first!).queryByRole("button", { name: "Ask the agent to fix this" })).toBeNull();
    expect(within(first!).getByText("Handed to the agent, with what you expected and your note")).toBeTruthy();
  });

  it("says the path is checked once every QA Step has a result, and offers the next path", () => {
    const { actions } = checkByHand({
      main: { open: result("passed"), second: result("failed", "Empty."), add: result("passed"), look: result("failed") },
    });
    expect(screen.getByText("Main path checked")).toBeTruthy();
    expect(screen.getByText("2 passed · 2 failed · just now. The results stay on this machine.")).toBeTruthy();
    expect(screen.queryByText(/Prepare/)).toBeNull();
    expect(screen.queryByRole("group", { name: "Result" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Ask the agent to fix the failed QA Steps" }));
    expect(actions.askToFix).toHaveBeenCalledWith(flow.paths[0], [
      { do: "Open the list on a second phone.", expect: "Both phones show the same list.", note: "Empty." },
      { do: "Look at the second phone.", expect: "The new item shows up there.", note: "" },
    ]);
    expect(screen.queryByRole("button", { name: /Ask the agent to fix/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Check the next path: The item is already on the list" }));
    expect(screen.getByText("Manual QA Check · The item is already on the list")).toBeTruthy();
    expect(screen.getByText("A warning says it is there.")).toBeTruthy();
  });

  it("sets every QA Step of the path back to not checked with Start over", () => {
    const { actions } = checkByHand({ main: { open: result("passed") } });
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(actions.resetQaResults).toHaveBeenCalledWith("main");
  });

  it("lists what to prepare, and opens a terminal", () => {
    const { actions } = checkByHand();
    expect(screen.getByText("Prepare · 1 thing")).toBeTruthy();
    const thing = screen.getByRole("checkbox", { name: "Start the app, then sign in as a Cook on two phones." });
    expect((thing as HTMLInputElement).checked).toBe(false);
    fireEvent.click(thing);
    expect((thing as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Open a terminal here" }));
    expect(actions.openTerminal).toHaveBeenCalled();
  });

  it("says results cannot be recorded outside a git repo, and offers no result", () => {
    checkByHand({}, false);
    expect(screen.getByText("Results cannot be recorded yet: they need a git repo with at least one commit.")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Result" })).toBeNull();
  });

  it("says no result can be recorded on a QA Step with no id", () => {
    const [main, variant] = flow.paths;
    const noId = { ...main, qa: { setup: [], steps: [{ do: "Look.", expect: "It is there." }] } };
    render(<FlowPage flow={{ ...flow, paths: [noId, variant!] }} actions={fakeFlowActions()} results={{}} recordable />);
    press("c");
    expect(screen.getByText("This QA Step has no id, so no result can be recorded on it.")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Result" })).toBeNull();
  });
});
