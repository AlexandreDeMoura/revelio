// Reads `knowledge-base/` for the two views of it: the web view (`src/view.ts`) and the
// VS Code extension's view (`packages/vscode-extension`), which bundles this file.
import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import type { FlowFile, KnowledgeBase, Path } from "./knowledge-base.js";

// Reads every file again on each call, so what an agent just wrote shows.
// Whatever goes wrong with a file, the error says which file.
export function readKnowledgeBase(repoRoot: string): KnowledgeBase {
  const kb = (...below: string[]) => path.join(repoRoot, "knowledge-base", ...below);
  return {
    repo: { name: path.basename(repoRoot), root: repoRoot },
    actors: readYaml(kb("actors.yaml"), (actors) => actors) ?? {},
    areas: readYaml(kb("areas.yaml"), (areas) => areas) ?? {},
    flows: readById(kb("flows"), ({ outcome, steps, qa, variants, ...facts }: FlowFile) => ({
      ...facts,
      paths: paths({ outcome, steps, qa, variants }),
    })),
    parts: readById(kb("parts"), (part) => part),
  };

  function readYaml<Out>(file: string, shape: (content: any) => Out): Out | undefined {
    if (!fs.existsSync(file)) return undefined;
    try {
      return shape(parse(fs.readFileSync(file, "utf8")));
    } catch (error) {
      throw new Error(`${path.relative(repoRoot, file)}: ${(error as Error).message}`);
    }
  }

  // Every `.yaml` file under `dir`, keyed by its id: its path from `dir`
  // without the extension.
  function readById<Out>(dir: string, shape: (content: any) => Out): Record<string, Out | undefined> {
    if (!fs.existsSync(dir)) return {};
    const files = fs.readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".yaml"));
    return Object.fromEntries(
      files.sort().map((file) => [file.slice(0, -5).split(path.sep).join("/"), readYaml(path.join(dir, file), shape)]),
    );
  }
}

// A Variant file holds only the Steps from where it diverges; the Steps it
// shares with the main path are put back in front, so every path reads whole.
export function paths({ outcome, steps, qa, variants = [] }: Pick<FlowFile, "outcome" | "steps" | "qa" | "variants">): Path[] {
  return [
    { id: "main", name: "Main path", outcome, steps, qa },
    ...variants.map(({ diverges_at, steps: own, ...variant }) => {
      const at = steps.findIndex((step) => step.id === diverges_at);
      if (at === -1) return { ...variant, steps: own };
      const shared = steps.slice(0, at).map((step) => ({ ...step, shared: true as const }));
      return { ...variant, divergesAt: at, steps: [...shared, ...own] };
    }),
  ];
}
