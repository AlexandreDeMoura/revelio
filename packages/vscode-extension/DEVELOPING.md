# Developing the VS Code extension

The extension is its own package, with its own dependencies, tests and build. Run every command below from `packages/vscode-extension/`. The repo root's `npm test` does not run these tests.

## Two halves

- **The extension host**, in `src/`, runs in VS Code's Node and can use the `vscode` API. `src/extension.ts` registers the **Revelio: Open** command; `src/revelio-panel.ts` opens the Revelio view, a tab in the editor, and keeps at most one open. esbuild bundles it into `dist/extension.js`.
- **The webview**, in `webview/`, is the page inside that tab: React and TypeScript, in a browser with no Node and no `vscode` API. Vite builds it into `dist/webview/webview.js` and `webview.css`.

`src/webview-html.ts` writes the page that joins the two. Its Content Security Policy lets in nothing but the extension's own files and runs only the one script carrying a fresh nonce. For that reason the webview is built as a single script with no chunks, and inline scripts or styles in the page do not run.

The two talk through `webview.postMessage` and `acquireVsCodeApi().postMessage`. `src/messages.ts` types every message, in both directions, and both halves import it, so it holds only types. When the webview sends `ready`, the extension answers with the knowledge base of the first folder open in VS Code, or with why it has none (`src/knowledge-base-message.ts`), then with what git says of each Flow (`src/changes-message.ts`), which takes longer. It sends both again whenever a file under `knowledge-base/` changes, or the open folder does, and sends what git says again when a commit, a checkout or staging moves git, or a file an Anchor points to changes (`src/refresh.ts`). The page's buttons send `openAnchor`, `openFlowFile` and `askAgent`, which `src/actions.ts` carries out: the first two open a file beside the view, at the Anchor's symbol when the editor or the text can find it; `askAgent` fills Claude Code's prompt through its `vscode://anthropic.claude-code/open?prompt=` link when Claude Code is installed, and copies the question otherwise. In the webview, `webview/src/host.ts` is the one place that calls `acquireVsCodeApi`; the page receives it as a `Host`, which tests replace. `webview/src/to-flow.ts` turns the knowledge base into what the Flow page shows.

## Code shared with the web view

The extension reads the knowledge base and what git says of it with the same code as the web view that `git revelio view` serves: `readKnowledgeBase` in the repo root's `src/read-knowledge-base.ts` and `changeReader` in `src/flow-changes.ts`, which esbuild bundles into `dist/extension.js`. The shape it reads is in `src/knowledge-base.ts`, types only, which the webview may import too. A change to that code changes both views.

That code needs the repo root's packages (`yaml`, `web-tree-sitter`) and grammars, so run `npm install` and `npm run grammars` at the repo root as well as `npm install` here. It finds its tree-sitter files from where it runs, so `esbuild.mjs` gives the bundle its own `import.meta.url` and copies `web-tree-sitter.wasm` into `dist/` and the grammars into `grammars/`, both packaged with the extension.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Installs the dependencies. Run it at the repo root too (see "Code shared with the web view"). Commit the `package-lock.json` it writes; CI runs `npm ci`. |
| `npm run build` | Builds both halves into `dist/`. |
| `npm run typecheck` | Checks the types of the host, the webview and the integration tests. |
| `npm test` | Runs the unit tests with vitest: the host's in Node, the webview's in jsdom. |
| `npm run test:integration` | Builds, then runs `test/integration/` inside a VS Code it downloads into `.vscode-test/`. |
| `npm run package` | Typechecks, builds minified, and writes `revelio-<version>.vsix`. |

## Running it

Run `npm install` here first. Then open the repo root in VS Code and press F5 (fn+F5 on a Mac keyboard), or start "Run the Revelio extension" from Run and Debug. It starts both watchers, then opens a second VS Code window, the Extension Development Host, with only this extension loaded and this repo open, so the view shows this repo's own `knowledge-base/` when it has one (see `docs/dogfooding.md`). The repo opens through `.vscode/extension-host.code-workspace`, since VS Code refuses to open a folder another window already has open: for the same reason, opening the repo folder by hand in that window does nothing. To try another app, open its folder in that window. The Revelio view does not open by itself: run **Revelio: Open** from the Command Palette (Cmd+Shift+P) in that window. After a change, run **Developer: Reload Window** in that window.

To try the packaged extension: `npm run package`, then `code --install-extension revelio-0.0.1.vsix`.

## Supported VS Code versions

`engines.vscode` is `^1.105.0`, so forks that trail VS Code, such as Cursor, can install it. `@types/vscode` stays on the same minor version as `engines.vscode`, so the code cannot use an API that version lacks; `vsce` refuses to package if `@types/vscode` is newer. Raise both together.
