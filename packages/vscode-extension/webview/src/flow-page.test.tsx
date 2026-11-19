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
  steps: [
    { does: "Types an item.", sees: "The item appears.", system: "Saves the item.", parts: ["box", "sync"] },
    { does: "Opens the list on a second phone.", system: "Sends the list.", parts: ["sync"] },
    { does: "Closes the list.", parts: [] },
  ],
  variants: [
    { name: "The item is already on the list", divergesAt: 0 },
    { name: "The phone is offline", divergesAt: 1 },
    { name: "The list cannot be loaded", divergesAt: 1 },
  ],
};

// Renders the page with every action recorded.
function page(shown: Flow = flow) {
  const actions: FlowActions = { openFlow: vi.fn(), openFlowFile: vi.fn(), openAnchor: vi.fn(), askAbout: vi.fn() };
  return { ...render(<FlowPage flow={shown} actions={actions} />), actions };
}

const steps = () => within(screen.getByRole("list", { name: "Steps" })).getAllByRole("listitem");

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
});
