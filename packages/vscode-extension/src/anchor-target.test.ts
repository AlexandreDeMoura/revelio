import path from "node:path";
import { describe, expect, it } from "vitest";
import { anchorTarget, definitionOffset } from "./anchor-target";

const root = path.resolve("/apps/pantry");

describe("anchorTarget", () => {
  it("finds the file from the app's root, and the symbol after #", () => {
    expect(anchorTarget(root, "src/list/AddItemBox.tsx#AddItemBox")).toEqual({
      file: path.join(root, "src/list/AddItemBox.tsx"),
      symbol: "AddItemBox",
    });
  });

  it("points at the whole file when no symbol is named", () => {
    expect(anchorTarget(root, "src/list/AddItemBox.tsx")).toEqual({ file: path.join(root, "src/list/AddItemBox.tsx") });
  });

  it("opens nothing outside the app", () => {
    expect(anchorTarget(root, "../secrets.txt")).toBeUndefined();
    expect(anchorTarget(root, "/etc/passwd")).toBeUndefined();
    expect(anchorTarget(root, "")).toBeUndefined();
  });
});

describe("definitionOffset", () => {
  it("finds where a function, class, constant or type is defined", () => {
    const text = "import x from 'x';\n\nconst used = AddItemBox;\nexport function AddItemBox() {}\n";
    expect(definitionOffset(text, "AddItemBox")).toBe(text.indexOf("export function AddItemBox"));
    expect(definitionOffset("type Row = {};\nexport const rows = 1;\n", "rows")).toBe(15);
    expect(definitionOffset("class Panel:\n    def show(self):\n        pass\n", "show")).toBe(17);
  });

  it("finds a member inside its class", () => {
    const text = "function show() {}\nclass Panel {\n  show() {}\n}\n";
    expect(definitionOffset(text, "Panel.show")).toBe(text.indexOf("  show() {}") + 2);
  });

  it("finds nothing for a symbol the file does not define", () => {
    expect(definitionOffset("export const a = 1;\n", "b")).toBeUndefined();
  });
});
