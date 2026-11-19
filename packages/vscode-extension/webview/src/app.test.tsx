// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ExtensionMessage, KnowledgeBase, WebviewMessage } from "../../src/messages";
import { App } from "./app";
import type { Host } from "./host";

afterEach(cleanup);

// Stands in for the extension: records what the page sends, and sends it messages.
function fakeHost(saved?: string) {
  const sent: WebviewMessage[] = [];
  const listeners = new Set<(message: ExtensionMessage) => void>();
  const kept = { flow: saved };
  const host: Host = {
    post: (message) => sent.push(message),
    savedFlow: () => kept.flow,
    saveFlow: (id) => (kept.flow = id),
    onMessage: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const send = (message: ExtensionMessage) => act(() => listeners.forEach((listener) => listener(message)));
  return { host, sent, send, kept };
}

const qa = { setup: [], steps: [] };
const flow = (name: string, area: string, more: Partial<NonNullable<KnowledgeBase["flows"][string]>> = {}) => ({
  name,
  area,
  actor: "cook",
  goal: `The goal of ${name}.`,
  trigger: "Something happens.",
  paths: [
    { id: "main", name: "Main path", outcome: "Done.", qa, steps: [{ id: "one", does: `Starts ${name}.`, parts: ["box"] }] },
  ],
  ...more,
});

const kb = (flows: KnowledgeBase["flows"]): KnowledgeBase => ({
  repo: { name: "pantry", root: "/apps/pantry" },
  actors: { cook: { name: "Cook", is: "Does the shopping." } },
  areas: { list: { name: "Grocery list", is: "The list." } },
  flows,
  parts: {
    box: { name: "Add item box", is: "Reads what the Cook types.", anchors: [{ label: "The box", at: "src/Box.tsx#Box", side: "screen" }] },
  },
});

const withQa = { id: "main", name: "Main path", outcome: "Done.", qa, steps: [{ id: "one", does: "Starts it." }] };
const twoQaSteps = {
  setup: [],
  steps: [
    { id: "open", do: "Open the list.", expect: "It opens." },
    { id: "close", do: "Close the list.", expect: "It closes." },
  ],
};

const twoFlows = kb({ "add-an-item": flow("Add an item", "list"), "remove-an-item": flow("Remove an item", "list") });
const heading = () => screen.getByRole("heading", { level: 1 }).textContent;

describe("App", () => {
  it("asks the extension for the knowledge base once it listens", () => {
    const { host, sent } = fakeHost();
    render(<App host={host} />);
    expect(sent).toContainEqual({ type: "ready" });
    expect(screen.getByText("Reading the knowledge base…")).toBeTruthy();
  });

  it("opens on the first Flow of the knowledge base it receives", () => {
    const { host, send } = fakeHost();
    render(<App host={host} />);
    send({ type: "knowledgeBase", knowledgeBase: twoFlows });
    expect(heading()).toBe("Add an item");
    expect(screen.getByText("The goal of Add an item.")).toBeTruthy();
  });

  it("moves to the next Flow and back", () => {
    const { host, send } = fakeHost();
    render(<App host={host} />);
    send({ type: "knowledgeBase", knowledgeBase: twoFlows });

    expect((screen.getByRole("button", { name: "Previous Flow" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next Flow: Remove an item" }));
    expect(heading()).toBe("Remove an item");
    expect((screen.getByRole("button", { name: "Next Flow" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Previous Flow: Add an item" }));
    expect(heading()).toBe("Add an item");
  });

  it("stays on its Flow when the knowledge base is sent again, and shows what changed", () => {
    const { host, send } = fakeHost();
    render(<App host={host} />);
    send({ type: "knowledgeBase", knowledgeBase: twoFlows });
    fireEvent.click(screen.getByRole("button", { name: "Next Flow: Remove an item" }));

    send({
      type: "knowledgeBase",
      knowledgeBase: kb({ "add-an-item": flow("Add an item", "list"), "remove-an-item": flow("Take an item off", "list") }),
    });
    expect(heading()).toBe("Take an item off");
  });

  it("goes back to the first Flow when its Flow is gone", () => {
    const { host, send } = fakeHost();
    render(<App host={host} />);
    send({ type: "knowledgeBase", knowledgeBase: twoFlows });
    fireEvent.click(screen.getByRole("button", { name: "Next Flow: Remove an item" }));

    send({ type: "knowledgeBase", knowledgeBase: kb({ "add-an-item": flow("Add an item", "list") }) });
    expect(heading()).toBe("Add an item");
  });

  it("says so when no Flow is written yet", () => {
    const { host, send } = fakeHost();
    render(<App host={host} />);
    send({ type: "knowledgeBase", knowledgeBase: kb({}) });
    expect(screen.getByText("No Flow is written yet.")).toBeTruthy();
  });

  it("shows why there is no knowledge base", () => {
    const { host, send } = fakeHost();
    render(<App host={host} />);
    send({ type: "error", message: "knowledge-base/flows/broken.yaml: bad indentation" });
    expect(screen.getByText("knowledge-base/flows/broken.yaml: bad indentation")).toBeTruthy();
  });

  it("shows what git says of the Flow once the extension sends it", () => {
    const { host, send } = fakeHost();
    render(<App host={host} />);
    send({ type: "knowledgeBase", knowledgeBase: twoFlows });
    expect(screen.queryByText(/Last changed in/)).toBeNull();

    send({
      type: "changes",
      flows: { "add-an-item": { uncommitted: false, last: { sha: "7c2e9a4b5d", subject: "Parse", date: new Date().toISOString(), files: ["src/Box.tsx"] } } },
    });
    expect(screen.getByTitle("Parse").textContent).toBe("7c2e9a4");
  });

  it("asks the extension to open the Flow file, a place in the code, and the agent", () => {
    const { host, send, sent } = fakeHost();
    render(<App host={host} />);
    send({ type: "knowledgeBase", knowledgeBase: twoFlows });

    fireEvent.click(screen.getByRole("button", { name: "Open the Flow file" }));
    fireEvent.click(screen.getByRole("button", { name: "Add item box" }));
    fireEvent.click(screen.getByRole("button", { name: /The box/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ask the agent about this Part" }));

    expect(sent).toContainEqual({ type: "openFlowFile", flow: "add-an-item" });
    expect(sent).toContainEqual({ type: "openAnchor", at: "src/Box.tsx#Box" });
    expect(sent).toContainEqual({ type: "askAgent", prompt: expect.stringContaining('the Part "Add item box"') });
  });

  it("asks the extension to show what the commit that last changed the Flow changed in its files", () => {
    const { host, send, sent } = fakeHost();
    render(<App host={host} />);
    send({ type: "knowledgeBase", knowledgeBase: twoFlows });
    send({
      type: "changes",
      flows: { "add-an-item": { uncommitted: false, last: { sha: "7c2e9a4b5d", subject: "Parse", date: new Date().toISOString(), files: ["src/Box.tsx"] } } },
    });

    fireEvent.click(screen.getByRole("button", { name: "7c2e9a4" }));

    expect(sent).toContainEqual({ type: "openCommit", sha: "7c2e9a4b5d", files: ["src/Box.tsx"] });
  });

  it("opens the Flow a precondition names", () => {
    const { host, send } = fakeHost();
    render(<App host={host} />);
    send({
      type: "knowledgeBase",
      knowledgeBase: kb({
        "add-an-item": flow("Add an item", "list", { preconditions: [{ flow: "remove-an-item", so_that: "Room is made." }] }),
        "remove-an-item": flow("Remove an item", "list"),
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove an item" }));
    expect(heading()).toBe("Remove an item");
  });

  it("opens again on the Flow it showed before VS Code reloaded the view", () => {
    const { host, send, kept } = fakeHost("remove-an-item");
    render(<App host={host} />);
    send({ type: "knowledgeBase", knowledgeBase: twoFlows });
    expect(heading()).toBe("Remove an item");

    fireEvent.click(screen.getByRole("button", { name: "Previous Flow: Add an item" }));
    expect(kept.flow).toBe("add-an-item");
  });

  it("shows the QA Results the extension sends, and records the one picked at once", () => {
    const { host, send, sent } = fakeHost();
    const checked = kb({ "add-an-item": flow("Add an item", "list", { paths: [{ ...withQa, qa: twoQaSteps }] }) });
    render(<App host={host} />);
    send({ type: "knowledgeBase", knowledgeBase: checked });
    send({ type: "qaResults", results: { "add-an-item": { main: { open: { state: "passed", note: "", date: new Date().toISOString() } } } } });
    fireEvent.keyDown(document.body, { key: "c" });
    expect(screen.getByText("1 passed · 1 to check")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Note about what you saw" }), { target: { value: "Gone." } });
    fireEvent.click(screen.getByRole("button", { name: "Failed" }));

    expect(sent).toContainEqual({ type: "recordQaResult", flow: "add-an-item", path: "main", step: "close", state: "failed", note: "Gone." });
    expect(screen.getByText("Main path checked")).toBeTruthy();
    expect(screen.getByText("“Gone.”")).toBeTruthy();
  });

  it("asks the extension to save a note, start the path over, open a terminal, and the agent to fix a failed QA Step", () => {
    const { host, send, sent } = fakeHost();
    const checked = kb({ "add-an-item": flow("Add an item", "list", { paths: [{ ...withQa, qa: twoQaSteps }] }) });
    render(<App host={host} />);
    send({ type: "knowledgeBase", knowledgeBase: checked });
    send({ type: "qaResults", results: { "add-an-item": { main: { open: { state: "failed", note: "", date: new Date().toISOString() } } } } });
    fireEvent.keyDown(document.body, { key: "c" });

    fireEvent.click(screen.getByRole("button", { name: "Open a terminal here" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask the agent to fix this" }));
    fireEvent.click(screen.getByRole("button", { name: "Open the list." }));
    const note = screen.getByRole("textbox", { name: "Note about what you saw" });
    fireEvent.change(note, { target: { value: "Empty." } });
    fireEvent.blur(note);
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));

    expect(sent).toContainEqual({ type: "openTerminal" });
    expect(sent).toContainEqual({ type: "askAgent", prompt: expect.stringContaining("I did: Open the list.") });
    expect(sent).toContainEqual({ type: "noteQaResult", flow: "add-an-item", path: "main", step: "open", note: "Empty." });
    expect(sent).toContainEqual({ type: "resetQaResults", flow: "add-an-item", path: "main" });
    expect(screen.getByText("2 QA Steps to check")).toBeTruthy();
  });

  it("says results cannot be recorded when the extension says so", () => {
    const { host, send } = fakeHost();
    render(<App host={host} />);
    send({ type: "knowledgeBase", knowledgeBase: twoFlows });
    send({ type: "qaResults", results: null });
    fireEvent.keyDown(document.body, { key: "c" });
    expect(screen.getByText("Results cannot be recorded yet: they need a git repo with at least one commit.")).toBeTruthy();
  });

  it("stays on the Variant it shows when the knowledge base is sent again", () => {
    const { host, send } = fakeHost();
    const withVariant = () =>
      kb({
        "add-an-item": flow("Add an item", "list", {
          paths: [
            { id: "main", name: "Main path", outcome: "Done.", qa, steps: [{ id: "one", does: "Starts it." }] },
            { id: "full", name: "The list is full", when: "It has 100 items.", outcome: "Refused.", divergesAt: 0, qa, steps: [{ id: "refused", sees: "A refusal." }] },
          ],
        }),
      });
    render(<App host={host} />);
    send({ type: "knowledgeBase", knowledgeBase: withVariant() });
    fireEvent.click(screen.getByRole("button", { name: /^Choose a path/ }));
    fireEvent.click(within(screen.getByRole("group", { name: "Choose a path" })).getByRole("button", { name: /The list is full/ }));

    send({ type: "knowledgeBase", knowledgeBase: withVariant() });
    expect(screen.getByText("A refusal.")).toBeTruthy();
  });
});
