// What the buttons of the Revelio view do in VS Code: open a place in the code or a Flow file
// beside the view, show what a commit changed, and hand the agent a question.
import nodePath from "node:path";
import * as vscode from "vscode";
import { anchorTarget, definitionOffset } from "./anchor-target";
import { commitChanges, fileAt } from "./commit-changes";

// Opens beside the view the place `at` names, at its symbol when it names one.
export async function openAnchor(appRoot: string, at: string): Promise<void> {
  const target = anchorTarget(appRoot, at);
  if (!target) {
    void vscode.window.showErrorMessage(`Revelio cannot open ${at}: it is not a file of this app.`);
    return;
  }
  let document: vscode.TextDocument;
  try {
    document = await vscode.workspace.openTextDocument(vscode.Uri.file(target.file));
  } catch {
    void vscode.window.showErrorMessage(`Revelio cannot open ${at}: the file is not there.`);
    return;
  }
  const position = target.symbol ? await symbolPosition(document, target.symbol) : undefined;
  const selection = position && new vscode.Range(position, position);
  await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, selection });
  if (target.symbol && !position) {
    void vscode.window.showWarningMessage(`Revelio cannot find ${target.symbol} in ${path(at)}: it opened the file at its top.`);
  }
}

// Opens beside the view the file of a Flow.
export function openFlowFile(appRoot: string, flow: string): Promise<void> {
  return openAnchor(appRoot, `knowledge-base/flows/${flow}.yaml`);
}

// Shows beside the active editor, in VS Code's changes editor, what the commit `sha` changed in
// `files`, from the app's root: in every file it changed when it changed none of them.
export async function openCommit(appRoot: string, sha: string, files: string[]): Promise<void> {
  const short = sha.slice(0, 7);
  let changes: ReturnType<typeof commitChanges>;
  try {
    changes = commitChanges(appRoot, sha, files);
  } catch {
    void vscode.window.showErrorMessage(`Revelio cannot show commit ${short}: git does not have it.`);
    return;
  }
  const { subject, parent, files: changed } = changes;
  const resources = changed.map((file) => [
    vscode.Uri.file(nodePath.join(appRoot, file.path)),
    parent && file.before !== undefined ? commitFileUri(appRoot, parent, file.before) : undefined,
    file.after !== undefined ? commitFileUri(appRoot, sha, file.after) : undefined,
  ]);
  await focusBeside();
  await vscode.commands.executeCommand("vscode.changes", `${short} · ${subject}`, resources);
}

// The scheme of a file as a commit has it, which `commitContent` reads from git.
export const commitScheme = "revelio-commit";

// The file `file`, from the app's root, as the commit `ref` has it. Its path is the file's own,
// so the editor colours it as it colours the file.
export function commitFileUri(appRoot: string, ref: string, file: string): vscode.Uri {
  return vscode.Uri.file(nodePath.join(appRoot, file)).with({
    scheme: commitScheme,
    query: new URLSearchParams({ root: appRoot, ref, file }).toString(),
  });
}

export const commitContent: vscode.TextDocumentContentProvider = {
  provideTextDocumentContent(uri) {
    const query = new URLSearchParams(uri.query);
    const [root, ref, file] = [query.get("root"), query.get("ref"), query.get("file")];
    return root && ref && file ? fileAt(root, ref, file) : "";
  },
};

// Makes the editor group beside the active one the active group, as `ViewColumn.Beside` does,
// making that group when there is none: the changes editor opens in the active group only.
async function focusBeside(): Promise<void> {
  const from = vscode.window.tabGroups.activeTabGroup;
  await vscode.commands.executeCommand("workbench.action.focusRightGroup");
  if (vscode.window.tabGroups.activeTabGroup === from) {
    await vscode.commands.executeCommand("workbench.action.newGroupRight");
  }
}

const claudeCode = "anthropic.claude-code";

// Fills Claude Code's prompt with the question, for the Builder to finish and send. Without
// Claude Code, the question goes to the clipboard, to paste to whichever agent they use.
export async function askAgent(prompt: string): Promise<void> {
  if (vscode.extensions.getExtension(claudeCode)) {
    const opened = await vscode.env.openExternal(
      vscode.Uri.from({
        scheme: vscode.env.uriScheme,
        authority: claudeCode,
        path: "/open",
        query: new URLSearchParams({ prompt }).toString(),
      }),
    );
    if (opened) return;
  }
  await vscode.env.clipboard.writeText(prompt);
  void vscode.window.showInformationMessage("Revelio copied the question. Paste it to your agent, finish it and send it.");
}

// Where the document defines `symbol` (`name` or `Class.member`): from the editor's symbols for
// the file, else from the text.
async function symbolPosition(document: vscode.TextDocument, symbol: string): Promise<vscode.Position | undefined> {
  const symbols = await vscode.commands
    .executeCommand<(vscode.DocumentSymbol | vscode.SymbolInformation)[] | undefined>(
      "vscode.executeDocumentSymbolProvider",
      document.uri,
    )
    .then(
      (found) => found ?? [],
      () => [],
    );
  const found = findSymbol(symbols, symbol.split("."));
  if (found) return found;
  const offset = definitionOffset(document.getText(), symbol);
  return offset === undefined ? undefined : document.positionAt(offset);
}

function findSymbol(
  symbols: (vscode.DocumentSymbol | vscode.SymbolInformation)[],
  [name, ...rest]: string[],
): vscode.Position | undefined {
  for (const symbol of symbols) {
    if (symbol.name !== name) continue;
    if ("selectionRange" in symbol) {
      if (rest.length === 0) return symbol.selectionRange.start;
      const inner = findSymbol(symbol.children, rest);
      if (inner) return inner;
    } else if (rest.length === 0) {
      return symbol.location.range.start;
    }
  }
  // A list of SymbolInformation is flat: a member is found by its own name, inside its class.
  if (rest.length === 1) {
    const member = symbols.find(
      (symbol) => !("selectionRange" in symbol) && symbol.name === rest[0] && symbol.containerName === name,
    ) as vscode.SymbolInformation | undefined;
    return member?.location.range.start;
  }
  return undefined;
}

const path = (at: string) => at.split("#")[0];
