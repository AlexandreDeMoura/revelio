# Developing the VS Code extension

The extension is its own package, with its own dependencies, tests and build. Run every command below from `packages/vscode-extension/`. The repo root's `npm test` does not run these tests.

## Two halves

- **The extension host**, in `src/`, runs in VS Code's Node and can use the `vscode` API. `src/extension.ts` registers the **Revelio: Open** command and puts a **Revelio** button that runs it at the right of the status bar, so the extension starts with VS Code; `src/revelio-panel.ts` opens the Revelio view, a tab in the editor, and keeps at most one open. esbuild bundles it into `dist/extension.js`.
- **The webview**, in `webview/`, is the page inside that tab: React and TypeScript, in a browser with no Node and no `vscode` API. Vite builds it into `dist/webview/webview.js` and `webview.css`.

`src/webview-html.ts` writes the page that joins the two. Its Content Security Policy lets in nothing but the extension's own files and runs only the one script carrying a fresh nonce. For that reason the webview is built as a single script with no chunks, and inline scripts or styles in the page do not run.

The two talk through `webview.postMessage` and `acquireVsCodeApi().postMessage`. `src/messages.ts` types every message, in both directions, and both halves import it, so it holds only types. When the webview sends `ready`, the extension answers with the knowledge base of the first folder open in VS Code, or with why it has none (`src/knowledge-base-message.ts`), and with the Builder's QA Results (`src/qa-results-message.ts`), then with what git says of each Flow and of the last commit of the branch (`src/changes-message.ts`), which takes longer. **Read it again**, on the Overview, sends `readAgain`, which the extension answers as it answers `ready`. It sends both again whenever a file under `knowledge-base/` changes, or the open folder does, and sends what git says again when a commit, a checkout or staging moves git, or a file an Anchor points to changes (`src/refresh.ts`). Check by hand sends `recordQaResult`, `noteQaResult` and `resetQaResults`, which `src/qa-results-message.ts` writes with the web view's own code (`src/qa-results.ts` at the repo root), in the same file under `~/.revelio/`, so what one view records the other shows; the extension then sends the QA Results again. It also watches that file, which is outside the open folder, with its own watcher (`src/qa-results-watch.ts`), and sends the QA Results again when the web view writes it. The page's other buttons send `openAnchor`, `openFlowFile`, `openCommit`, `openTerminal` and `askAgent`, which `src/actions.ts` carries out: the first two open a file beside the view, at the Anchor's symbol when the editor or the text can find it; `openCommit` opens beside the view VS Code's changes editor (the `vscode.changes` command) on what the commit that last changed the Flow changed in the files that made it change the Flow, read from git by `src/commit-changes.ts` and given to the editor through the `revelio-commit:` scheme that `src/extension.ts` registers; `askAgent` fills Claude Code's prompt through its `vscode://anthropic.claude-code/open?prompt=` link when Claude Code is installed, and copies the question otherwise. In the webview, `webview/src/host.ts` is the one place that calls `acquireVsCodeApi`; the page receives it as a `Host`, which tests replace. `webview/src/to-flow.ts` turns the knowledge base into what the Flow page shows, and `webview/src/to-overview.ts` into what the Overview shows. The view opens on the Overview (`webview/src/overview-page.tsx`), or on the Flow it last showed; `webview/src/toolbar.tsx` is the bar along the top of both pages.

## Code shared with the web view

The extension reads the knowledge base and what git says of it with the same code as the web view that `npx revelio-ai view` serves: `readKnowledgeBase` in the repo root's `src/read-knowledge-base.ts` and `changeReader` in `src/flow-changes.ts`, which esbuild bundles into `dist/extension.js`. The shape it reads is in `src/knowledge-base.ts`, types only, which the webview may import too. A change to that code changes both views.

That code needs the repo root's packages (`yaml`, `web-tree-sitter`) and grammars, so run `npm install` and `npm run grammars` at the repo root as well as `npm install` here. It finds its tree-sitter files from where it runs, so `esbuild.mjs` gives the bundle its own `import.meta.url` and copies `web-tree-sitter.wasm` into `dist/` and the grammars into `grammars/`, both packaged with the extension.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Installs the dependencies. Run it at the repo root too (see "Code shared with the web view"). Commit the `package-lock.json` it writes; CI runs `npm ci`. |
| `npm run build` | Builds both halves into `dist/`. |
| `npm run typecheck` | Checks the types of the host, the webview and the integration tests. |
| `npm test` | Runs the unit tests with vitest: the host's in Node, the webview's in jsdom. |
| `npm run test:integration` | Builds, then runs `test/integration/` inside a VS Code it downloads into `.vscode-test/`. |
| `npm run package` | Typechecks, bumps the patch version, builds minified, and writes `revelio-<version>.vsix`, removing older ones. |

## Running it

Run `npm install` here first.

### Try your changes in VS Code

This is how the Builder tries a change: in the VS Code they use, with the extension installed.

1. `npm run package` builds, bumps the patch version in `package.json` (commit that change with the rest) and writes `revelio-<version>.vsix`, keeping only the newest one. A new version is how VS Code knows the installed extension changed.
2. `code --install-extension revelio-*.vsix`. `code` is VS Code's own CLI: ⇧⌘P → **Shell Command: Install 'code' command in PATH**. Without it, use **Extensions: Install from VSIX…**.
3. **Developer: Reload Window** in every window that was already open. Until then, a window runs the extension it had.
4. ⇧⌘P → **Revelio: Open**.

### Run and Debug (optional)

Open the repo root in VS Code and press F5 (fn+F5 on a Mac keyboard), or start "Run the Revelio extension" from Run and Debug. It starts both watchers, then opens a second VS Code window, the Extension Development Host, with only this extension loaded and this repo open, so the view shows this repo's own `knowledge-base/` (see `docs/dogfooding.md`). The repo opens through `.vscode/extension-host.code-workspace`, since VS Code refuses to open a folder another window already has open: for the same reason, opening the repo folder by hand in that window does nothing. To try another app, open its folder in that window. The Revelio view does not open by itself: run **Revelio: Open** from the Command Palette (Cmd+Shift+P) in that window. After a change, run **Developer: Reload Window** in that window.

An agent checking a change in real VS Code from its own shell follows `docs/e2e-vscode.md` instead.

## Manual QA

One checklist per thing the view does. Run them in the installed extension (see "Try your changes in VS Code"), in a window open on an app with a `knowledge-base/`, such as this repo. When a change adds to or changes what the view does, change its checklist here.

### Opening the view

- [ ] ⇧⌘P → **Revelio: Open** opens a Revelio tab in the editor.
- [ ] Once VS Code has started, a **Revelio** button with a map icon is at the right of the status bar. Its tooltip says "Open the Revelio view", and clicking it opens the Revelio tab, as **Revelio: Open** does.
- [ ] Running it again, with the tab open, brings that tab forward instead of opening a second.
- [ ] After closing the tab, **Revelio: Open** opens it again.
- [ ] With the tab open, **Developer: Reload Window** brings it back after the reload, still showing the knowledge base.

### No knowledge base

- [ ] In a window with no folder open, the view says "Open your app's folder in VS Code to see its knowledge base."
- [ ] In a folder with no `knowledge-base/`, or one with no Flow written and no Flow to write, the view says "No Flow is written yet."
- [ ] A Flow file that is not valid YAML makes the view name that file and what is wrong with it.

### The Overview

- [ ] The view opens on the Overview, or on the Flow it last showed when it was hidden or the window reloaded. The breadcrumb says "<app> › Overview", and the toolbar's **Overview** is shown as the page you are on.
- [ ] The Overview says "N Flows are written. M more are waiting to be written.", as `knowledge-base/` says, over a bar with one segment per Flow, the written ones filled. With Flows to write and no Flow written, it says "No Flow is written yet." instead of the first sentence.
- [ ] "Knowledge base read just now" changes as minutes pass. **Read it again** reads it again, and the line says "just now".
- [ ] **In the last commit** shows the branch's last commit, its subject and how long ago, then "It changed no Flow." or the Flows it changed. Clicking a Flow opens it. Clicking the commit id opens beside the view, in VS Code's changes editor, every file that commit changed. Commit a change: the card shows the new commit without a reload.
- [ ] **Still to write** says how many Flows to write each Area has, and names first the Flows to write that a written Flow's "Before it starts" names. **Write them with the agent**, with Claude Code installed, fills its prompt with `/map-the-app`, without sending it; clicking a named Flow to write fills it with `/map-the-app Write the Flow to write "<name>".` The card then says it was handed to the agent. Without Claude Code, it copies the prompt and says so. Without a Flow to write, the card is not there.
- [ ] **Areas** lists every Area of `areas.yaml`, open, with "N written · M to write", each Flow with its Actor, and how many Flows are still to write. Clicking an Area closes it; clicking again opens it. Clicking a Flow opens its Flow page at its top.
- [ ] **Get to know the words** opens the words Area, Flow, Step, Variant and Part, the Area with two Areas of this app as examples.

### The Flows and the Flow page

- [ ] The toolbar's **Overview**, and the app's name in the breadcrumb, open the Overview.
- [ ] The previous and next arrows go through every Flow in order: the first Flow's previous arrow and the last Flow's next arrow are greyed out, and hovering an arrow names the Flow it goes to.
- [ ] The breadcrumb names the app, the Area and the Flow.
- [ ] The Flow page shows the Flow's goal, Actor, Trigger, what comes before it, its Steps and its Outcome, as the Flow file says. A Flow named under "Before it starts" opens when clicked.
- [ ] The header says "Last changed in" with the commit and how long ago, and "Changes not committed" when code one of the Flow's Anchors points to has changes not yet committed.
- [ ] The path picker lists the main path and the Variants, each with only its name and its Steps (how many, and where a Variant leaves the main path). Choosing a Variant shows its Steps and Outcome; a Variant link under a Step does the same.
- [ ] Clicking a Part opens it under its Step; clicking it again closes it.

### Check by hand

- [ ] On a Flow page, **C** opens **Check by hand** and **R** goes back to **Read the Flow**. Clicking the two tabs does the same. While the note box has the focus, R and C type into it.
- [ ] Check by hand shows "Manual QA Check · <path>", how many QA Steps are left to check, a bar with one segment per QA Step, and "Prepare" with each setup line of the path's Manual QA Check. The tab line says "N of M QA Steps passed".
- [ ] The first QA Step not checked is open, with what to do, what to expect, **Passed**, **Failed**, **Could not perform** and a note box. Picking a result closes it with its result and its note, and opens the next QA Step not checked.
- [ ] `~/.revelio/<first commit of the app>/qa-results.json` holds each result picked, with its note. `npx revelio-ai view` shows the same results.
- [ ] With Check by hand open on a Flow, record a QA Result of that Flow in `npx revelio-ai view`: without a reload or a click, the Revelio view shows it, and the tab line's "N of M QA Steps passed" changes. **Start over** in the web view sets the QA Steps back to not checked here too.
- [ ] Clicking a QA Step already checked opens it again with its result picked. Changing its note and leaving the box saves the note.
- [ ] Choosing a Variant in the path picker shows its Manual QA Check.
- [ ] Once every QA Step has a result, the page says "<path> checked" and offers **Check the next path: <name>**, which opens that path's Manual QA Check.
- [ ] **Ask the agent to fix this**, under a failed QA Step, and **Ask the agent to fix the failed QA Steps** fill Claude Code's prompt with what you did, expected and saw, without sending it. The QA Step then says it was handed to the agent.
- [ ] **Open a terminal here** opens a terminal in the app's folder.
- [ ] **Start over** sets every QA Step of the path back to not checked, in the file too.
- [ ] In a folder that is not a git repo, Check by hand says results cannot be recorded yet, and offers no result.

### The buttons

- [ ] **Open the Flow file** opens `knowledge-base/flows/<flow>.yaml` beside the view.
- [ ] The commit id after "Last changed in" opens beside the view, in VS Code's changes editor, a tab named with the commit id, its subject and how many files it shows. It shows only the files whose change in that commit changed the Flow, each before and after the commit, coloured as code. Clicking it again opens it in that same group, not in a new one.
- [ ] An Anchor in an open Part opens its file beside the view, at its symbol. An Anchor whose symbol has moved opens the file at its top, with a warning saying so.
- [ ] **Ask the agent about this Part**, with Claude Code installed, fills Claude Code's prompt with a question about that Part, without sending it. Without Claude Code, it copies the question and says so: paste it to check.

### Refresh

- [ ] Edit a Flow's `goal` in its file under `knowledge-base/flows/` and save: the view shows the new goal without being reopened.
- [ ] Change and save the code at one of a Flow's Anchors (inside the function it names, not elsewhere in the file): that Flow shows "Changes not committed".
- [ ] Commit that change: "Changes not committed" goes away and "Last changed in" shows the new commit.

### Reinstalling

- [ ] After `npm run package`, `code --install-extension revelio-*.vsix` and **Developer: Reload Window**, the Extensions view shows Revelio AI at the version now in `package.json`, and the view has the change.

## Supported VS Code versions

`engines.vscode` is `^1.105.0`, so forks that trail VS Code, such as Cursor, can install it. `@types/vscode` stays on the same minor version as `engines.vscode`, so the code cannot use an API that version lacks; `vsce` refuses to package if `@types/vscode` is newer. Raise both together.
