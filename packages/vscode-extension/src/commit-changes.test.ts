import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { commitAll, git, hostRepo } from "../../../src/testing/host-repo.js";
import { commitChanges, fileAt } from "./commit-changes";

const write = (root: string, file: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};

// An app with three code files, committed once.
function app() {
  const root = hostRepo({
    "src/list.ts": "export const list = [];\n",
    "src/sync.ts": "export function sync() {}\n",
    "src/old-name.ts": "export const kept = 1;\n",
  });
  const first = commitAll(root, "first");
  return { root, first };
}

describe("commitChanges", () => {
  it("gives the commit's subject, its parent, and each file it changed, before and after", () => {
    const { root, first } = app();
    write(root, "src/list.ts", "export const list = [1];\n");
    write(root, "src/added.ts", "export const added = 1;\n");
    fs.rmSync(path.join(root, "src/sync.ts"));
    fs.renameSync(path.join(root, "src/old-name.ts"), path.join(root, "src/new-name.ts"));
    const sha = commitAll(root, "Change the list");

    const changes = commitChanges(root, sha, []);

    expect(changes.subject).toBe("Change the list");
    expect(changes.parent).toBe(first);
    expect(changes.files).toEqual(
      expect.arrayContaining([
        { path: "src/list.ts", before: "src/list.ts", after: "src/list.ts" },
        { path: "src/added.ts", after: "src/added.ts" },
        { path: "src/sync.ts", before: "src/sync.ts" },
        { path: "src/new-name.ts", before: "src/old-name.ts", after: "src/new-name.ts" },
      ]),
    );
    expect(changes.files).toHaveLength(4);
  });

  it("keeps only the files it is given, found before or after the commit", () => {
    const { root } = app();
    write(root, "src/list.ts", "export const list = [1];\n");
    write(root, "src/sync.ts", "export function sync() { return 1; }\n");
    fs.renameSync(path.join(root, "src/old-name.ts"), path.join(root, "src/new-name.ts"));
    const sha = commitAll(root, "Change three files");

    const changes = commitChanges(root, sha, ["src/list.ts", "src/old-name.ts"]);

    expect(changes.files.map((file) => file.path).sort()).toEqual(["src/list.ts", "src/new-name.ts"]);
  });

  it("keeps every file when none of the files it is given changed", () => {
    const { root } = app();
    write(root, "src/list.ts", "export const list = [1];\n");
    const sha = commitAll(root, "Change the list");

    expect(commitChanges(root, sha, ["src/sync.ts"]).files.map((file) => file.path)).toEqual(["src/list.ts"]);
  });

  it("shows every file of the first commit as added", () => {
    const { root, first } = app();

    const changes = commitChanges(root, first, []);

    expect(changes.parent).toBeUndefined();
    expect(changes.files).toContainEqual({ path: "src/list.ts", after: "src/list.ts" });
    expect(changes.files.every((file) => file.before === undefined)).toBe(true);
  });

  it("compares a merge with its first parent", () => {
    const { root, first } = app();
    git(root, "checkout", "--quiet", "-b", "side");
    write(root, "src/sync.ts", "export function sync() { return 1; }\n");
    commitAll(root, "Change sync on a branch");
    git(root, "checkout", "--quiet", "-");
    write(root, "src/list.ts", "export const list = [1];\n");
    const main = commitAll(root, "Change the list");
    git(root, "merge", "--quiet", "--no-edit", "side");
    const merge = git(root, "rev-parse", "HEAD");

    const changes = commitChanges(root, merge, []);

    expect(changes.parent).toBe(main);
    expect(changes.parent).not.toBe(first);
    expect(changes.files).toEqual([{ path: "src/sync.ts", before: "src/sync.ts", after: "src/sync.ts" }]);
  });

  it("fails for a commit git does not have", () => {
    const { root } = app();
    expect(() => commitChanges(root, "0".repeat(40), [])).toThrow();
  });
});

describe("fileAt", () => {
  it("gives a file as a commit has it, and nothing where the commit has no such file", () => {
    const { root, first } = app();
    write(root, "src/list.ts", "export const list = [1];\n");
    commitAll(root, "Change the list");

    expect(fileAt(root, first, "src/list.ts")).toBe("export const list = [];\n");
    expect(fileAt(root, first, "src/nothing.ts")).toBe("");
  });
});
