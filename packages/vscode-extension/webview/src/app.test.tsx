// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
      flows: { "add-an-item": { uncommitted: false, last: { sha: "7c2e9a4b5d", subject: "Parse", date: new Date().toISOString() } } },
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
});
