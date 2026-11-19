// What one commit changed, read from git, for VS Code's changes editor to show.
import { readGit } from "../../../src/change-git.js";

// One file the commit changed, from the app's root: where it was before the commit (none when
// the commit added it) and where it is after (none when the commit deleted it).
export type ChangedFile = { path: string; before?: string; after?: string };

export type CommitChanges = {
  subject: string;
  // The commit it is compared with: the first parent, as for the Flow's last change. None for
  // the first commit, whose files are all added.
  parent?: string;
  files: ChangedFile[];
};

// The files the commit `sha` changed that are among `only`, before or after it: every file it
// changed when none is. Throws when git does not have the commit.
export function commitChanges(root: string, sha: string, only: string[]): CommitChanges {
  const subject = readGit(root, "log", "-1", "--format=%s", `${sha}^{commit}`).trim();
  const parent = firstParent(root, sha);
  const status = parent
    ? readGit(root, "diff-tree", "-r", "-M", "--name-status", "-z", parent, sha)
    : readGit(root, "diff-tree", "-r", "--root", "--no-commit-id", "--name-status", "-z", sha);
  const files = changedFiles(status);
  const wanted = new Set(only);
  const kept = files.filter((file) => wanted.has(file.before ?? "") || wanted.has(file.after ?? ""));
  return { subject, ...(parent && { parent }), files: kept.length ? kept : files };
}

// The file as the commit `ref` has it, or nothing when it has no such file.
export function fileAt(root: string, ref: string, file: string): string {
  try {
    return readGit(root, "show", `${ref}:${file}`);
  } catch {
    return "";
  }
}

function firstParent(root: string, sha: string): string | undefined {
  try {
    return readGit(root, "rev-parse", "--verify", "--quiet", `${sha}^1`).trim() || undefined;
  } catch {
    return undefined;
  }
}

// Reads `git diff-tree --name-status -z`: a status, then one path, or two for a rename or a copy.
function changedFiles(status: string): ChangedFile[] {
  const fields = status.split("\0").filter(Boolean);
  const files: ChangedFile[] = [];
  for (let i = 0; i < fields.length; ) {
    const kind = fields[i++]![0];
    if (kind === "R" || kind === "C") {
      const before = fields[i++]!;
      const after = fields[i++]!;
      files.push({ path: after, before, after });
    } else {
      const file = fields[i++]!;
      if (kind === "A") files.push({ path: file, after: file });
      else if (kind === "D") files.push({ path: file, before: file });
      else files.push({ path: file, before: file, after: file });
    }
  }
  return files;
}
