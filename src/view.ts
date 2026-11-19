import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import { changeReader, type ChangedSince } from "./flow-changes.js";
import type { KnowledgeBase } from "./knowledge-base.js";
import {
  noteQaResult,
  qaResultAt,
  qaResultsFile,
  readQaResults,
  recordQaResult,
  removeQaResults,
  type QaResult,
  type QaResults,
} from "./qa-results.js";
import { readKnowledgeBase } from "./read-knowledge-base.js";

// The page is plain files with no build step, kept beside `src` and `dist`.
const pages = new URL("../view/", import.meta.url);
const served: Record<string, [file: string, type: string]> = {
  "/": ["index.html", "text/html"],
  "/view.js": ["view.js", "text/javascript"],
  "/view.css": ["view.css", "text/css"],
  "/themes.css": ["themes.css", "text/css"],
};

export type View = { url: string; close: () => Promise<void> };

// Serves the web view of the knowledge base at the root of `repoRoot`. The
// files are read again on every request, so an edit shows on the next load.
// QA Results are kept under `home`, the Builder's home folder.
export async function startView(
  repoRoot: string,
  { port, home = os.homedir() }: { port: number; home?: string },
): Promise<View> {
  const server = http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    if (pathname.startsWith("/api/")) {
      // A file caught half-written must not stop the view: the page shows
      // the error and the next load reads again.
      try {
        const file = qaResultsFile(repoRoot, home);
        const reader = await changeReader(repoRoot, home);
        try {
          if (pathname !== "/api/data") await change(repoRoot, file, pathname, req, reader.changes);
          const kb = readKnowledgeBase(repoRoot);
          sendJson(res, 200, {
            ...kb,
            changes: reader.changes,
            results: await shown(kb, reader, readQaResults(file)),
            resultsFile: file ?? null,
          });
        } finally { reader.close(); }
      } catch (error) {
        sendJson(res, error instanceof Refused ? error.status : 500, { error: (error as Error).message });
      }
      return;
    }
    const [file, type] = served[pathname] ?? [];
    if (!file) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": `${type}; charset=utf-8` }).end(fs.readFileSync(new URL(file, pages)));
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    url: `http://localhost:${(server.address() as AddressInfo).port}/`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}

class Refused extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const states = ["passed", "failed", "could-not-perform"] as const;

// The one thing the web view writes: a Builder's QA Results. A result is
// only taken for a QA Step the knowledge base has.
async function change(repoRoot: string, file: string | undefined, pathname: string, req: http.IncomingMessage, changes: Awaited<ReturnType<typeof changeReader>>["changes"]) {
  if (!["/api/result", "/api/note", "/api/result-reset"].includes(pathname) || req.method !== "POST")
    throw new Refused(404, "Not found.");
  // Another web page can post to this server without asking, but not as JSON.
  if (req.headers["content-type"] !== "application/json") throw new Refused(415, "Send JSON.");
  if (!file) throw new Refused(409, "QA Results need a git repo with at least one commit.");
  const { flow, path: pathId, step, state, note = "" } = await body(req);
  if (typeof note !== "string") throw new Refused(400, "A note is text.");

  const kb = readKnowledgeBase(repoRoot);
  const onPath = Object.hasOwn(kb.flows, String(flow)) ? kb.flows[flow]?.paths.find((path) => path.id === pathId) : undefined;
  if (!onPath) throw new Refused(400, `No path ${pathId} on the Flow ${flow}.`);
  if (pathname === "/api/result-reset") return removeQaResults(file, { flow, path: pathId });
  if (!onPath.qa.steps.some((qaStep) => qaStep.id === step))
    throw new Refused(400, `No QA Step ${step} on the path ${pathId} of the Flow ${flow}.`);

  const ref = { flow, path: pathId, step };
  if (pathname === "/api/note") noteQaResult(file, ref, note);
  else if (state === "not-checked") removeQaResults(file, ref);
  else if (states.includes(state)) recordQaResult(repoRoot, file, ref, changes.flows[flow]?.uncommitted ?? false, { state, note });
  else throw new Refused(400, `A QA Step is not-checked, ${states.join(", ")}.`);
}

async function body(req: http.IncomingMessage) {
  let text = "";
  for await (const chunk of req) text += chunk;
  try {
    return JSON.parse(text);
  } catch {
    throw new Refused(400, "Send JSON.");
  }
}

// The results of the QA Steps the knowledge base has now, each with what has
// happened to its Flow since. A result whose Flow, path or QA Step is gone
// stays in the file and is not shown.
async function shown(
  kb: KnowledgeBase,
  reader: Awaited<ReturnType<typeof changeReader>>,
  results: QaResults,
) {
  const since = reader.sinceReader;
  const out: Record<string, Record<string, Record<string, QaResult & { since: ChangedSince }>>> = {};
  for (const [flow, content] of Object.entries(kb.flows))
    for (const path of content?.paths ?? [])
      for (const { id: step } of path.qa?.steps ?? []) {
        const result = step === undefined ? undefined : qaResultAt(results, { flow, path: path.id, step });
        if (result)
          ((out[flow] ??= {})[path.id] ??= {})[step!] = {
            ...result,
            since: await since(flow, result),
          };
      }
  return out;
}

// Flow change data uses code Anchors from each commit's Knowledge base
// version; edits to Flow and Part YAML files never count as code changes.
