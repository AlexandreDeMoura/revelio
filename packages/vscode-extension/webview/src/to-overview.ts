// Turns the knowledge base the extension sends into what the Overview shows: how far the map has
// come, what the last commit changed, what is still to write, and the Areas with their Flows.
import type { FlowChange, KnowledgeBase, LastCommit } from "../../src/messages";
import { ago } from "./to-flow";

export type OverviewFlow = { id: string; name: string; actor: string };

export type OverviewArea = {
  id: string;
  name: string;
  flows: OverviewFlow[];
  // How many Flows to write it names.
  toWrite: number;
};

// A Flow to write that written Flows depend on: their preconditions name it.
export type WaitedFlowToWrite = { id: string; name: string; dependents: number };

export type Overview = {
  app: string;
  // How many Flows are written, and how many are Flows to write.
  written: number;
  toWrite: number;
  // How many written Flows have changes not committed in the code their Anchors point to.
  uncommitted: number;
  // Every Area of areas.yaml, in its order, even one with no Flow, then the Areas a Flow names that areas.yaml lacks.
  areas: OverviewArea[];
  // The most depended on first.
  waited: WaitedFlowToWrite[];
  // Once git has said: the last commit of the branch, and the written Flows it changed.
  lastCommit?: { sha: string; short: string; subject: string; ago: string; flows: { id: string; name: string }[] };
  // Names of Areas, at most two, to explain what an Area is.
  areaExamples: string[];
};

export function toOverview(
  kb: KnowledgeBase,
  changes?: Record<string, FlowChange> | null,
  lastCommit?: LastCommit,
  now = Date.now(),
): Overview {
  const flowIds = Object.keys(kb.flows).filter((id) => kb.flows[id]);
  const flow = (id: string) => kb.flows[id]!;
  const areaIds = [...new Set([...Object.keys(kb.areas), ...flowIds.map((id) => flow(id).area)])];
  const areas = areaIds.map((areaId) => ({
    id: areaId,
    name: kb.areas[areaId]?.name ?? areaId,
    flows: flowIds
      .filter((id) => flow(id).area === areaId)
      .map((id) => ({ id, name: flow(id).name, actor: kb.actors[flow(id).actor]?.name ?? flow(id).actor })),
    toWrite: Object.keys(kb.areas[areaId]?.flows_to_write ?? {}).length,
  }));

  const waited = Object.values(kb.areas)
    .flatMap((area) => Object.entries(area.flows_to_write ?? {}))
    .map(([id, entry]) => ({
      id,
      name: entry?.name ?? id,
      dependents: flowIds.filter((fid) =>
        (flow(fid).preconditions ?? []).some((pre) => typeof pre === "object" && "flow_to_write" in pre && pre.flow_to_write === id),
      ).length,
    }))
    .filter((entry) => entry.dependents > 0)
    .sort((a, b) => b.dependents - a.dependents);

  return {
    app: kb.repo.name,
    written: flowIds.length,
    toWrite: areas.reduce((sum, area) => sum + area.toWrite, 0),
    uncommitted: flowIds.filter((id) => changes?.[id]?.uncommitted).length,
    areas,
    waited,
    ...(lastCommit && {
      lastCommit: {
        sha: lastCommit.sha,
        short: lastCommit.sha.slice(0, 7),
        subject: lastCommit.subject,
        ago: ago(lastCommit.date, now),
        flows: lastCommit.flows.filter((id) => kb.flows[id]).map((id) => ({ id, name: flow(id).name })),
      },
    }),
    areaExamples: Object.values(kb.areas)
      .map((area) => area.name)
      .slice(0, 2),
  };
}

// What the Overview puts in the agent's chat to write the Flows to write: all of them, one Area
// at a time, or the one it names.
export function writePrompt(flowToWrite?: string): string {
  return flowToWrite === undefined ? "/map-the-app" : `/map-the-app Write the Flow to write “${flowToWrite}”.`;
}
