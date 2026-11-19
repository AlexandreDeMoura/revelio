import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeBase } from "./messages";
import { anchoredFiles, refreshFor, refresher } from "./refresh";

const kb: KnowledgeBase = {
  repo: { name: "pantry", root: "/apps/pantry" },
  actors: {},
  areas: {},
  flows: {},
  parts: {
    box: {
      name: "Add item box",
      is: "Reads what the Cook types.",
      anchors: [
        { label: "The box", at: "src/list/AddItemBox.tsx#AddItemBox", side: "screen" },
        { label: "Its quantity", at: "src/list/parseQuantity.ts", side: "screen" },
      ],
    },
    sync: { name: "List sync", is: "Sends each change.", anchors: [{ label: "The sync", at: "server/sync.py#push", side: "backend" }] },
    empty: undefined,
  },
};

describe("anchoredFiles", () => {
  it("lists every file an Anchor of a Part points to, without its symbol", () => {
    expect([...anchoredFiles(kb)].sort()).toEqual(["server/sync.py", "src/list/AddItemBox.tsx", "src/list/parseQuantity.ts"]);
  });
});

describe("refreshFor", () => {
  const anchored = anchoredFiles(kb);

  it("sends the whole knowledge base again when one of its files changes", () => {
    expect(refreshFor("knowledge-base/flows/add-an-item.yaml", anchored)).toBe("knowledgeBase");
    expect(refreshFor("knowledge-base", anchored)).toBe("knowledgeBase");
  });

  it("sends what git says again when a file an Anchor points to changes", () => {
    expect(refreshFor("src/list/AddItemBox.tsx", anchored)).toBe("changes");
    expect(refreshFor("server/sync.py", anchored)).toBe("changes");
  });

  it("sends what git says again when a commit, a checkout or staging moves git", () => {
    expect(refreshFor(".git/HEAD", anchored)).toBe("changes");
    expect(refreshFor(".git/index", anchored)).toBe("changes");
    expect(refreshFor(".git/packed-refs", anchored)).toBe("changes");
    expect(refreshFor(".git/refs/heads/main", anchored)).toBe("changes");
  });

  it("sends nothing for a file no Anchor points to, or the rest of git's files", () => {
    expect(refreshFor("src/list/Other.tsx", anchored)).toBeUndefined();
    expect(refreshFor("dist/webview.js", anchored)).toBeUndefined();
    expect(refreshFor(".git/objects/ab/cdef", anchored)).toBeUndefined();
    expect(refreshFor(".git/index.lock", anchored)).toBeUndefined();
    expect(refreshFor("knowledge-base-old/flows/x.yaml", anchored)).toBeUndefined();
  });
});

describe("refresher", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends once for changes that come together", () => {
    const send = vi.fn();
    const refresh = refresher(send, 150);
    refresh.schedule("changes");
    vi.advanceTimersByTime(100);
    refresh.schedule("changes");
    vi.advanceTimersByTime(100);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("changes");
  });

  it("sends the whole knowledge base when it changed among them", () => {
    const send = vi.fn();
    const refresh = refresher(send, 150);
    refresh.schedule("changes");
    refresh.schedule("knowledgeBase");
    refresh.schedule("changes");
    vi.advanceTimersByTime(150);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("knowledgeBase");

    refresh.schedule("changes");
    vi.advanceTimersByTime(150);
    expect(send).toHaveBeenLastCalledWith("changes");
  });

  it("sends nothing once stopped", () => {
    const send = vi.fn();
    const refresh = refresher(send, 150);
    refresh.schedule("knowledgeBase");
    refresh.stop();
    vi.advanceTimersByTime(500);
    expect(send).not.toHaveBeenCalled();
  });
});
