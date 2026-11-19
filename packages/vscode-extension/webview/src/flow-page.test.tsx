// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Flow } from "./flow";
import { FlowPage, type FlowActions } from "./flow-page";

afterEach(cleanup);

const flow: Flow = {
  id: "add-an-item",
  app: "pantry",
  area: "Grocery list",
  name: "Add an item to the list",
  goal: "Put something on the household's grocery list so nobody forgets it.",
  lastChange: { sha: "7c2e9a4", subject: "Parse quantities", ago: "5 hours ago" },
  uncommitted: false,
  actor: { name: "Cook", description: "The person who does the shopping." },
  trigger: "The Cook taps `Add item` at the top of the grocery list.",
  preconditions: [
    { text: "The Cook has an account.", flow: "Sign up with an email", flowId: "sign-up" },
    { text: "The household has a list on `/list`." },
    { text: "Someone shared the list.", flow: "Share the list", toWrite: true },
  ],
  parts: {
    box: {
      name: "Add item box",
      is: "Reads what the Cook types.",
      anchors: [{ label: "The box at the top of the list", at: "src/list/AddItemBox.tsx#AddItemBox", side: "screen" }],
    },
    sync: { name: "List sync", is: "Sends each change to every phone.", anchors: [] },
  },
  paths: [
    {
      id: "main",
      name: "Main path",
      outcome: "The item is on the list for everyone.",
      steps: [
        { does: "Types an item.", sees: "The item appears.", system: "Saves the item.", parts: ["box", "sync"] },
        { does: "Opens the list on a second phone.", system: "Sends the list.", parts: ["sync"] },
        { does: "Closes the list.", parts: [] },
      ],
    },
    {
      id: "already-there",
      name: "The item is already on the list",
      when: "The Cook types an item the list has.",
      outcome: "The list keeps one of it.",
      divergesAt: 0,
      steps: [{ sees: "A warning says it is there.", parts: ["box"] }],
    },
    {
      id: "offline",
      name: "The phone is offline",
      when: "The second phone has no network.",
      outcome: "The phone shows the list it last had.",
      divergesAt: 1,
      steps: [
        { does: "Types an item.", sees: "The item appears.", system: "Saves the item.", parts: ["box", "sync"], shared: true },
        { does: "Opens the list on a second phone.", sees: "An offline banner.", parts: ["sync"] },
      ],
    },
    {
      id: "cannot-load",
      name: "The list cannot be loaded",
      when: "The server does not answer.",
      outcome: "The phone says the list cannot be loaded.",
      divergesAt: 1,
      steps: [
        { does: "Types an item.", sees: "The item appears.", system: "Saves the item.", parts: ["box", "sync"], shared: true },
        { sees: "An error.", parts: [] },
      ],
    },
  ],
};

// Renders the page with every action recorded.
function page(shown: Flow = flow) {
  const actions: FlowActions = {
    openFlow: vi.fn(),
    openFlowFile: vi.fn(),
    openAnchor: vi.fn(),
    askAbout: vi.fn(),
    openLastChange: vi.fn(),
  };
  return { ...render(<FlowPage flow={shown} actions={actions} />), actions };
}

const steps = () => within(screen.getByRole("list", { name: "Steps" })).getAllByRole("listitem");
const picker = () => screen.getByRole("button", { name: /^Choose a path/ });
const pathMenu = () => screen.getByRole("group", { name: "Choose a path" });
const choosePath = (name: RegExp) => {
  fireEvent.click(picker());
  fireEvent.click(within(pathMenu()).getByRole("button", { name }));
};

describe("FlowPage", () => {
  it("names the Flow, where it sits in the app, and what it is for", () => {
    page();
    expect(screen.getByRole("heading", { level: 1, name: "Add an item to the list" })).toBeTruthy();
    expect(screen.getByText(flow.goal)).toBeTruthy();
    const where = screen.getByRole("navigation", { name: "Where you are" });
    expect(within(where).getByText("pantry")).toBeTruthy();
    expect(within(where).getByText("Grocery list")).toBeTruthy();
  });

  it("states the Actor, the Trigger and what holds before it starts", () => {
    page();
    const about = screen.getByRole("region", { name: "About this Flow" });
    expect(within(about).getByText("Cook")).toBeTruthy();
    expect(within(about).getByText("Add item").tagName).toBe("CODE");
    expect(within(about).getByRole("button", { name: "Sign up with an email" })).toBeTruthy();
    expect(within(about).getByText("/list").tagName).toBe("CODE");
    expect(within(about).getByText("Share the list · to write").closest("button")).toBeNull();
  });

  it("opens the Flow a precondition names", () => {
    const { actions } = page();
    fireEvent.click(screen.getByRole("button", { name: "Sign up with an email" }));
    expect(actions.openFlow).toHaveBeenCalledWith("sign-up");
  });

  it("opens the Flow file", () => {
    const { actions } = page();
    fireEvent.click(screen.getByRole("button", { name: "Open the Flow file" }));
    expect(actions.openFlowFile).toHaveBeenCalled();
  });

  it("opens where a Part lives in the code, and asks the agent about it", () => {
    const { actions } = page();
    fireEvent.click(within(steps()[0]!).getByRole("button", { name: "Add item box" }));
    fireEvent.click(screen.getByRole("button", { name: /The box at the top of the list/ }));
    expect(actions.openAnchor).toHaveBeenCalledWith("src/list/AddItemBox.tsx#AddItemBox");
    fireEvent.click(screen.getByRole("button", { name: "Ask the agent about this Part" }));
    expect(actions.askAbout).toHaveBeenCalledWith(flow.parts.box);
  });

  it("says which commit last changed the Flow, only when it is known", () => {
    const { unmount } = page();
    expect(screen.getByTitle("Parse quantities").textContent).toBe("7c2e9a4");
    expect(screen.queryByText("Changes not committed")).toBeNull();
    unmount();
    page({ ...flow, lastChange: undefined, uncommitted: true });
    expect(screen.queryByText(/Last changed in/)).toBeNull();
    expect(screen.getByText("Changes not committed")).toBeTruthy();
  });

  it("shows what the commit that last changed the Flow changed, when its id is clicked", () => {
    const { actions } = page();
    fireEvent.click(screen.getByRole("button", { name: "7c2e9a4" }));
    expect(actions.openLastChange).toHaveBeenCalled();
  });

  it("opens on Read the Flow, with its Steps counted", () => {
    page();
    expect(screen.getByRole("tab", { name: /Read the Flow/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("3 Steps")).toBeTruthy();
    expect(screen.getByText("3 Variants")).toBeTruthy();
  });

  it("shows each Step's Does, Sees and System, leaving out what is empty", () => {
    page();
    const [first, , third] = steps();
    expect(within(first!).getByText("Types an item.")).toBeTruthy();
    expect(within(first!).getByText("The item appears.")).toBeTruthy();
    expect(within(first!).getByText("Saves the item.")).toBeTruthy();
    expect(within(third!).getByText("Does")).toBeTruthy();
    expect(within(third!).queryByText("Sees")).toBeNull();
    expect(within(third!).queryByText("System")).toBeNull();
    expect(within(third!).queryByText("Parts")).toBeNull();
  });

  it("names the Variants that leave the main path at a Step", () => {
    page();
    const [first, second, third] = steps();
    expect(within(first!).getByText(/A Variant leaves here/)).toBeTruthy();
    expect(within(second!).getByText(/Variants leave here/)).toBeTruthy();
    expect(within(second!).getByRole("button", { name: "The phone is offline" })).toBeTruthy();
    expect(within(third!).queryByText(/leaves? here/)).toBeNull();
  });

  it("opens one Part at a time, with where it lives in the code", () => {
    page();
    const [first, second] = steps();
    const box = within(first!).getByRole("button", { name: "Add item box" });
    expect(box.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(box);
    expect(box.getAttribute("aria-expanded")).toBe("true");
    expect(within(first!).getByText("Reads what the Cook types.")).toBeTruthy();
    expect(within(first!).getByText("The box at the top of the list")).toBeTruthy();
    expect(within(first!).getByText("src/list/AddItemBox.tsx")).toBeTruthy();

    fireEvent.click(within(second!).getByRole("button", { name: "List sync" }));
    expect(box.getAttribute("aria-expanded")).toBe("false");
    expect(within(first!).queryByText("Reads what the Cook types.")).toBeNull();
    expect(within(second!).getByText("Sends each change to every phone.")).toBeTruthy();
  });

  it("closes an open Part when it is clicked again", () => {
    page();
    const [first] = steps();
    const box = within(first!).getByRole("button", { name: "Add item box" });
    fireEvent.click(box);
    fireEvent.click(box);
    expect(box.getAttribute("aria-expanded")).toBe("false");
    expect(within(first!).queryByText("Reads what the Cook types.")).toBeNull();
  });

  it("ends the main path with its outcome", () => {
    page();
    expect(screen.getByText("The item is on the list for everyone.")).toBeTruthy();
  });

  it("lists the main path and every Variant in the path picker, with only their name and Steps", () => {
    page();
    expect(picker().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("group", { name: "Choose a path" })).toBeNull();

    fireEvent.click(picker());
    expect(picker().getAttribute("aria-expanded")).toBe("true");
    const options = within(pathMenu()).getAllByRole("button");
    expect(options.map((option) => option.getAttribute("aria-pressed"))).toEqual(["true", "false", "false", "false"]);
    expect(options[0]!.textContent).toContain("Main path");
    expect(options[0]!.textContent).not.toContain("The item is on the list for everyone.");
    expect(options[2]!.textContent).toContain("The phone is offline");
    expect(options[2]!.textContent).not.toContain("The second phone has no network.");
    expect(options[2]!.textContent).toContain("2 Steps · leaves at Step 2");
  });

  it("shows the Variant chosen: the Steps it shares, where it leaves the main path, and how it ends", () => {
    page();
    choosePath(/The phone is offline/);

    expect(screen.queryByRole("group", { name: "Choose a path" })).toBeNull();
    expect(picker().textContent).toContain("The phone is offline");
    expect(screen.getByText("2 Steps · leaves at Step 2")).toBeTruthy();
    const [shared, leaves] = steps();
    expect(steps()).toHaveLength(2);
    expect(within(shared!).getByText("Same as main path")).toBeTruthy();
    expect(within(shared!).getByText("Types an item.")).toBeTruthy();
    expect(within(leaves!).getByText("Leaves the main path")).toBeTruthy();
    expect(within(leaves!).getByText("when The second phone has no network.")).toBeTruthy();
    expect(within(leaves!).getByText("An offline banner.")).toBeTruthy();
    expect(screen.getByText("The phone shows the list it last had.")).toBeTruthy();
    expect(screen.queryByText(/leaves? here/)).toBeNull();
  });

  it("opens a Variant from the Step where it leaves the main path", () => {
    page();
    fireEvent.click(within(steps()[1]!).getByRole("button", { name: "The list cannot be loaded" }));
    expect(picker().textContent).toContain("The list cannot be loaded");
    expect(within(steps()[1]!).getByText("An error.")).toBeTruthy();
  });

  it("goes back to the main path from the path picker", () => {
    page();
    choosePath(/The phone is offline/);
    choosePath(/^Main path/);
    expect(picker().textContent).toContain("Follow the main path");
    expect(steps()).toHaveLength(3);
  });

  it("closes the path picker on Escape, back on its button", () => {
    page();
    fireEvent.click(picker());
    fireEvent.keyDown(within(pathMenu()).getAllByRole("button")[1]!, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Choose a path" })).toBeNull();
    expect(document.activeElement).toBe(picker());
  });

  it("closes a Part open on one path when another path is chosen", () => {
    page();
    fireEvent.click(within(steps()[0]!).getByRole("button", { name: "Add item box" }));
    choosePath(/The phone is offline/);
    expect(screen.queryByText("Reads what the Cook types.")).toBeNull();
  });

  it("says so when a Variant leaves at a Step the main path does not have", () => {
    const lost = { id: "lost", name: "Lost its Step", when: "Someone removed that Step.", outcome: "Unknown.", steps: [{ does: "Its own.", parts: [] }] };
    page({ ...flow, paths: [...flow.paths, lost] });
    choosePath(/Lost its Step/);
    expect(screen.getByText("It leaves at a Step the main path does not have.")).toBeTruthy();
    expect(screen.getByText("Someone removed that Step.")).toBeTruthy();
    expect(screen.getByText("1 Step")).toBeTruthy();
  });
});
