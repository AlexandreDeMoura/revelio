// Tells when the Builder's QA Results file is written, added or removed, as the web view does
// when the Builder records a QA Result there. The file is in the Builder's home folder, outside
// the folder open in VS Code, so the watcher of that folder never sees it.
import fs from "node:fs";
import path from "node:path";
import * as vscode from "vscode";

export function watchQaResults(file: string, changed: () => void): vscode.Disposable {
  // VS Code cannot watch in a folder that does not exist yet, as before the first QA Result.
  const folder = path.dirname(file);
  fs.mkdirSync(folder, { recursive: true });
  // Only the file itself: the file written beside it and moved into place does not match.
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.Uri.file(folder), path.basename(file)),
  );
  watcher.onDidCreate(changed);
  watcher.onDidChange(changed);
  watcher.onDidDelete(changed);
  return watcher;
}
