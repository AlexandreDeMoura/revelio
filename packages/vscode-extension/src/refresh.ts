// What the Revelio view sends again when a file of the app changes: the whole knowledge base
// when one of its files changed, else only what git says of the Flows, when the change can
// change that. Git's answer moves when a commit, a checkout or staging moves git, and when a
// file an Anchor points to changes.
import type { KnowledgeBase } from "./messages";

export type Refresh = "knowledgeBase" | "changes";

// Every file an Anchor of a Part points to, from the app's root, without its symbol.
export function anchoredFiles(kb: KnowledgeBase): Set<string> {
  const files = Object.values(kb.parts).flatMap((part) => (part?.anchors ?? []).map((anchor) => anchor.at.split("#")[0]!));
  return new Set(files.filter(Boolean));
}

// Git's own files that move when a commit, a checkout or staging does.
const gitState = /^\.git\/(HEAD|index|packed-refs|refs\/.+)$/;

// What to send again when the file at `file` changed: its path from the app's root, with `/`.
export function refreshFor(file: string, anchored: Set<string>): Refresh | undefined {
  if (file === "knowledge-base" || file.startsWith("knowledge-base/")) return "knowledgeBase";
  if (gitState.test(file) || anchored.has(file)) return "changes";
  return undefined;
}

// Sends once for files that change together, as an agent or a commit writes several at once:
// `delayMs` after the last, and the whole knowledge base when it changed among them.
export function refresher(send: (what: Refresh) => void, delayMs: number) {
  let pending: Refresh | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    schedule(what: Refresh): void {
      pending = pending === "knowledgeBase" ? pending : what;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const due = pending!;
        pending = undefined;
        send(due);
      }, delayMs);
    },
    stop(): void {
      clearTimeout(timer);
      pending = undefined;
    },
  };
}
