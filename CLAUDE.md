# Revelio

Revelio keeps a plain-words map of an app (its Flows, Areas and Parts) true to the code, for a Builder who rarely reads that code.

- **Words**: `GLOSSARY.md` defines every term. Use them exactly as defined, in code, skills and docs. If a change needs a new term or changes what one means, say so instead of inventing one.
- **Where things are**: `src/` is the CLI (`init`, `check`, `view`, `uninstall`, the Stop hook), with its tests beside each file. `skills/` holds the Claude Code skills that write and maintain the map. `view/` is the web view, served as it is, with no build step. `.claude-plugin/` is the plugin manifest. `packages/vscode-extension/` is the VS Code extension, a package of its own with its own install, tests and build (see its `DEVELOPING.md`).
- **Tests**: run `npm test`. It builds first, then runs vitest. Write the test before the change.
- **Releases**: before preparing a release or changing a version, read and follow `docs/releasing.md`. Keep the Claude Code plugin version in `.claude-plugin/plugin.json` equal to the npm package version in `package.json` and `package-lock.json`.
- **Dogfooding**: `.revelio/`, `.claude/skills/` and `knowledge-base/` may be a private install of released Revelio on this repo (see `docs/dogfooding.md`). Change skills in `skills/`, never in `.claude/skills/`.
- **Packages**: pin exact versions. Ask before adding one.
- **Commits**: give the Builder a suggested commit message; leave staging and committing to the Builder.

## Finishing a change to the VS Code extension

1. In `packages/vscode-extension/`: `npm test`, `npm run typecheck`, and `npm run test:integration` when `src/` changed.
2. Drive the change in real VS Code, following `packages/vscode-extension/docs/e2e-vscode.md`.
3. When behaviour changes, update the *Manual QA* section of `packages/vscode-extension/DEVELOPING.md`.
4. End with the checks you ran, the ones you skipped and why, and a **manual QA checklist** for the Builder to run before committing: 3–6 steps specific to this change, in the installed extension. The Builder doesn't use Run and Debug (F5): don't send them there.
5. Close your message with the steps to try it in VS Code (`DEVELOPING.md`, *Try your changes in VS Code*), spelled out, including the reload:
   1. `cd packages/vscode-extension && npm run package`
   2. `code --install-extension revelio-*.vsix`
   3. **Reload VS Code** (⇧⌘P → **Developer: Reload Window**) in every open window: until then it runs the old extension.
   4. ⇧⌘P → **Revelio: Open**.

## Talking with the human 
Once you have finished your work and it is time to explain what was done to the human, use ASD-STE100 Simplified Technical English + the words from the GLOSSARY.