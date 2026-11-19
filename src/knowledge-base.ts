// The knowledge base as the web view and the VS Code extension's view receive it, read from
// `knowledge-base/` by `readKnowledgeBase`. Only types: the extension's webview, which runs in a
// browser, imports this file too. The shapes are those the Deterministic Check verifies; reading
// does not verify them.

export type Actor = { name: string; is: string };

export type FlowToWrite = { name: string; is: string };

export type Area = { name: string; is: string; flows_to_write?: Record<string, FlowToWrite> };

export type Anchor = { label: string; at: string; side: "screen" | "backend" };

// An Entity is a Part with `entity: true`, and only an Entity has `relations`.
export type Part = { name: string; is: string; entity?: true; relations?: string[]; anchors: Anchor[] };

export type Step = { id: string; does?: string; sees?: string; system?: string; parts?: string[] };

export type QaStep = { id?: string; do: string; expect: string };

export type ManualQaCheck = { setup: string[]; steps: QaStep[] };

export type Precondition =
  | string
  | { flow: string; so_that: string }
  | { flow_to_write: string; so_that: string };

// A Variant as its file holds it: only the Steps from where it diverges.
export type VariantFile = {
  id: string;
  name: string;
  diverges_at: string;
  when: string;
  outcome: string;
  steps: Step[];
  qa: ManualQaCheck;
};

export type FlowFile = {
  name: string;
  area: string;
  actor: string;
  goal: string;
  trigger: string;
  outcome: string;
  preconditions?: Precondition[];
  steps: Step[];
  qa: ManualQaCheck;
  variants?: VariantFile[];
};

// One way through a Flow, start to end: the main path or a Variant. A Variant's Steps start
// with those it shares with the main path, marked `shared`, and `divergesAt` is the index of
// the Step where it leaves.
export type Path = {
  id: string;
  name: string;
  outcome: string;
  steps: (Step & { shared?: true })[];
  qa: ManualQaCheck;
  when?: string;
  divergesAt?: number;
};

// A Flow as it is sent: its file, with the main path and the Variants made into `paths`.
export type Flow = Omit<FlowFile, "outcome" | "steps" | "qa" | "variants"> & { paths: Path[] };

// Flows and Parts are keyed by id, their file name without `.yaml`. A file that is empty reads as undefined.
export type KnowledgeBase = {
  repo: { name: string; root: string };
  actors: Record<string, Actor>;
  areas: Record<string, Area>;
  flows: Record<string, Flow | undefined>;
  parts: Record<string, Part | undefined>;
};
