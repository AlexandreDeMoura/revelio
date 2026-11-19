// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Flow } from "./flow";
import { FlowPage } from "./flow-page";

afterEach(cleanup);

const flow: Flow = {
  app: "pantry",
  area: "Grocery list",
  name: "Add an item to the list",
  goal: "Put something on the household's grocery list so nobody forgets it.",
  lastChange: { sha: "7c2e9a4", ago: "5 hours ago" },
  actor: { name: "Cook", description: "The person who does the shopping." },
  trigger: "The Cook taps `Add item` at the top of the grocery list.",
  preconditions: [
    { text: "The Cook has an account.", flow: "Sign up with an email" },
    { text: "The household has a list on `/list`." },
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

const steps = () => within(screen.getByRole("list", { name: "Steps" })).getAllByRole("listitem");

describe("FlowPage", () => {
  it("names the Flow, where it sits in the app, and what it is for", () => {
    render(<FlowPage flow={flow} />);
    expect(screen.getByRole("heading", { level: 1, name: "Add an item to the list" })).toBeTruthy();
    expect(screen.getByText(flow.goal)).toBeTruthy();
    const where = screen.getByRole("navigation", { name: "Where you are" });
    expect(within(where).getByText("pantry")).toBeTruthy();
    expect(within(where).getByText("Grocery list")).toBeTruthy();
  });

  it("states the Actor, the Trigger and what holds before it starts", () => {
    render(<FlowPage flow={flow} />);
    const about = screen.getByRole("region", { name: "About this Flow" });
    expect(within(about).getByText("Cook")).toBeTruthy();
    expect(within(about).getByText("Add item").tagName).toBe("CODE");
    expect(within(about).getByRole("button", { name: "Sign up with an email" })).toBeTruthy();
    expect(within(about).getByText("/list").tagName).toBe("CODE");
  });

  it("opens on Read the Flow, with its Steps counted", () => {
    render(<FlowPage flow={flow} />);
    expect(screen.getByRole("tab", { name: /Read the Flow/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("3 Steps")).toBeTruthy();
    expect(screen.getByText("3 Variants")).toBeTruthy();
  });

  it("shows each Step's Does, Sees and System, leaving out what is empty", () => {
    render(<FlowPage flow={flow} />);
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
    render(<FlowPage flow={flow} />);
    const [first, second, third] = steps();
    expect(within(first!).getByText(/A Variant leaves here/)).toBeTruthy();
    expect(within(second!).getByText(/Variants leave here/)).toBeTruthy();
    expect(within(second!).getByRole("button", { name: "The phone is offline" })).toBeTruthy();
    expect(within(third!).queryByText(/leaves? here/)).toBeNull();
  });

  it("opens one Part at a time, with where it lives in the code", () => {
    render(<FlowPage flow={flow} />);
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
    render(<FlowPage flow={flow} />);
    const [first] = steps();
    const box = within(first!).getByRole("button", { name: "Add item box" });
    fireEvent.click(box);
    fireEvent.click(box);
    expect(box.getAttribute("aria-expanded")).toBe("false");
    expect(within(first!).queryByText("Reads what the Cook types.")).toBeNull();
  });
});
