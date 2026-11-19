// A Flow as the Flow page shows it: its main path, the Variants that leave it, and the Parts its Steps name.
// Words follow GLOSSARY.md. Text may mark code, an address or a label on screen between backticks.

export type Anchor = {
  // What this place in the code is, in plain words.
  label: string;
  // The file, and the symbol after `#` when there is one: `src/list/AddItemBox.tsx#AddItemBox`.
  at: string;
  side: "screen" | "backend";
};

export type Part = {
  name: string;
  // The one sentence that says what the Part is.
  is: string;
  anchors: Anchor[];
};

// Any of the three may be empty, but not all.
export type Step = {
  does?: string;
  sees?: string;
  system?: string;
  // The ids of the Parts this Step names, keys of `Flow.parts`.
  parts: string[];
};

export type Variant = {
  name: string;
  // The index of the main path's Step it leaves at.
  divergesAt: number;
};

export type Precondition = {
  text: string;
  // The Flow that brings it about, when it names one.
  flow?: string;
};

export type Flow = {
  app: string;
  area: string;
  name: string;
  // The goal the Flow pursues, in one sentence.
  goal: string;
  lastChange: { sha: string; ago: string };
  actor: { name: string; description: string };
  trigger: string;
  preconditions: Precondition[];
  // The main path.
  steps: Step[];
  variants: Variant[];
  parts: Record<string, Part>;
};
