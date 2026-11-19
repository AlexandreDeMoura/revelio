// Turns the knowledge base the extension sends into the Flows the Flow page shows.
import type { FlowChange, KnowledgeBase } from "../../src/messages";
import type { Flow, Part, Path, Precondition, QaStep, Step } from "./flow";

type Read = KnowledgeBase["flows"][string] & {};
type ReadPrecondition = NonNullable<Read["preconditions"]>[number];
type ReadPath = Read["paths"][number];

// The Flow with this id, or undefined when the knowledge base has none. `changes` is what git
// said of each Flow, once the extension has sent it.
export function toFlow(
  kb: KnowledgeBase,
  id: string,
  changes?: Record<string, FlowChange> | null,
  now = Date.now(),
): Flow | undefined {
  const flow = kb.flows[id];
  if (!flow) return undefined;
  const [main = { id: "main", name: "Main path", outcome: "", steps: [], qa: { setup: [], steps: [] } }, ...variants] = flow.paths;
  const paths: Flow["paths"] = [toPath(main), ...variants.map(toPath)];
  const actor = kb.actors[flow.actor];
  const change = changes?.[id];

  return {
    id,
    app: kb.repo.name,
    area: kb.areas[flow.area]?.name ?? flow.area,
    name: flow.name,
    goal: flow.goal,
    ...(change?.last && {
      lastChange: { sha: change.last.sha.slice(0, 7), subject: change.last.subject, ago: ago(change.last.date, now) },
    }),
    uncommitted: change?.uncommitted ?? false,
    actor: { name: actor?.name ?? flow.actor, description: actor?.is ?? "" },
    trigger: flow.trigger,
    preconditions: (flow.preconditions ?? []).map((pre) => precondition(kb, pre)),
    paths,
    parts: partsNamed(kb, paths.flatMap((path) => path.steps.flatMap((step) => step.parts))),
  };
}

function toPath({ id, name, outcome, when, divergesAt, steps, qa }: ReadPath): Path {
  return {
    id,
    name,
    outcome,
    ...(when !== undefined && { when }),
    ...(divergesAt !== undefined && { divergesAt }),
    steps: steps.map(toStep),
    // A file that breaks the rules may have no Manual QA Check: the page then has nothing to check.
    qa: { setup: qa?.setup ?? [], steps: qa?.steps ?? [] },
  };
}

function toStep({ does, sees, system, parts = [], shared }: ReadPath["steps"][number]): Step {
  return {
    ...(does !== undefined && { does }),
    ...(sees !== undefined && { sees }),
    ...(system !== undefined && { system }),
    parts,
    ...(shared && { shared }),
  };
}

// Every Flow id, Area by Area in the order of areas.yaml, then the Areas a Flow names that
// areas.yaml lacks: the order of the web view's sidebar.
export function flowOrder(kb: KnowledgeBase): string[] {
  const flowIds = Object.keys(kb.flows);
  const areaOf = (id: string) => kb.flows[id]?.area;
  const areas = [...new Set([...Object.keys(kb.areas), ...flowIds.map(areaOf)])];
  return areas.flatMap((area) => flowIds.filter((id) => areaOf(id) === area));
}

// The start of a question to the agent about a Part: which Part, of which Flow, what it is and
// where it lives. The Builder writes the question after it.
export function askPrompt(flow: Flow, part: Part): string {
  const where = part.anchors.length ? ` It lives in ${part.anchors.map((anchor) => anchor.at).join(", ")}.` : "";
  return `About the Part "${part.name}" in the Flow "${flow.name}" of the Revelio knowledge base: ${part.is}${where}\n\n`;
}

// A failed QA Step, as the Builder recorded it.
export type FailedQaStep = Pick<QaStep, "do" | "expect"> & { note: string };

// A request to the agent to fix the QA Steps that failed on a path: what the Builder did,
// expected and saw on each. The Builder reads it before they send it.
export function fixPrompt(flow: Flow, path: Path, failed: FailedQaStep[]): string {
  const onPath = path.id === "main" ? "the main path" : `the Variant "${path.name}"`;
  const which = failed.length === 1 ? "a QA Step" : `${failed.length} QA Steps`;
  const one = (step: FailedQaStep, number: string, indent: string) =>
    [`${number}I did: ${step.do}`, `${indent}I expected: ${step.expect}`, ...(step.note ? [`${indent}I saw: ${step.note}`] : [])].join("\n");
  const steps = failed.length === 1 ? one(failed[0]!, "", "") : failed.map((step, i) => one(step, `${i + 1}. `, "   ")).join("\n\n");
  return (
    `In the Flow "${flow.name}" of the Revelio knowledge base, ${which} of the Manual QA Check of ${onPath} failed.\n\n` +
    `${steps}\n\nFind why, and fix ${failed.length === 1 ? "it" : "them"}.`
  );
}

function precondition(kb: KnowledgeBase, pre: ReadPrecondition): Precondition {
  if (typeof pre === "string") return { text: pre };
  if ("flow" in pre) {
    const named = kb.flows[pre.flow];
    return named ? { text: pre.so_that, flow: named.name, flowId: pre.flow } : { text: pre.so_that, flow: pre.flow };
  }
  const entry = Object.values(kb.areas)
    .map((area) => area.flows_to_write?.[pre.flow_to_write])
    .find((found) => found !== undefined);
  return { text: pre.so_that, flow: entry?.name ?? pre.flow_to_write, toWrite: true };
}

// The Parts these ids name, once each. An id with no Part file is left out: the page shows the id.
function partsNamed(kb: KnowledgeBase, ids: string[]): Record<string, Part> {
  const named: Record<string, Part> = {};
  for (const id of ids) {
    const part = kb.parts[id];
    if (part) named[id] = { name: part.name, is: part.is, anchors: part.anchors ?? [] };
  }
  return named;
}

// How long ago `date` was, in the words of the web view.
export function ago(date: string, now: number): string {
  const minutes = Math.round((now - Date.parse(date)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${plural(minutes, "minute")} ago`;
  if (minutes < 1440) return `${plural(Math.round(minutes / 60), "hour")} ago`;
  return `${plural(Math.round(minutes / 1440), "day")} ago`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
