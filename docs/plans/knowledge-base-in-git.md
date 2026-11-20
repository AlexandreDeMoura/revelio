# Plan: the knowledge base in git

Status: planned, not started. Written on 20 November 2026. Card: [#16](https://github.com/AlexandreDeMoura/revelio/issues/16).

Today `npx revelio-ai init` makes a **Private install**: Revelio in `.revelio/`, and the skills, the Stop hook, the instruction line and `knowledge-base/` hidden from git by the local exclude. This plan removes it. `init` then makes the one install that is left, today's **Shared install**: the app depends on `revelio-ai`, and the skills, the Stop hook, the line in `CLAUDE.md` and `knowledge-base/` are committed with the code.

The Overview plan ([`overview-map-and-list.md`](../../packages/vscode-extension/docs/plans/overview-map-and-list.md)) needs this. Its milestone 5 marks the Flows that git sees as new, and its milestone 6b puts the activity hooks where the Stop hook is, in `.claude/settings.json`.

## What changes for the Builder

| | Today: Private install | After |
| --- | --- | --- |
| Install | `npx revelio-ai init` | `npm init revelio`, or `npm install -D revelio-ai` then `npx revelio-ai init`, in the folder with the app's `package.json` |
| Where Revelio is | `.revelio/`, hidden from git | the app's `devDependencies` |
| Skills, Stop hook, instruction line | `.claude/skills/`, `.claude/settings.local.json`, `CLAUDE.local.md`, hidden from git | `.claude/skills/`, `.claude/settings.json`, `CLAUDE.md`, committed |
| `knowledge-base/` | hidden from git | committed with the code |
| Commands | `git revelio check`, `view`, `uninstall` | `npx revelio-ai check`, `view`, `uninstall`, in the folder with the package |
| Upgrade | `npx revelio-ai@latest init` | `npm install -D revelio-ai@latest`, then `npx revelio-ai init` |
| QA Results, History store | `~/.revelio/<first commit>/` | the same, never committed |

## Decisions

### 1. One install, with no name (a change to `GLOSSARY.md`)

With one way to install, **Private install** and **Shared install** have nothing to tell apart. Remove both entries from `GLOSSARY.md`. "Install" and "commit" are then plain words. The code that takes an old install over calls it "a private install, Revelio's way to install up to 0.3.0", as it calls Fledgy "Revelio's former name". In code, `initShared` becomes `init`.

The Builder accepts this change to the glossary before milestone 1 is committed.

### 2. The History store stays, with a new definition (a change to `GLOSSARY.md`)

Each commit that changes `knowledge-base/` is a Knowledge base version already: `knowledgeBaseVersions` in `src/history.ts` reads them from git. The History store keeps the versions that git does not have: one at the end of each agent session, and those from before the knowledge base was committed. The new entry:

> **History store**:
> Where one **Builder**'s **Knowledge base versions** of one app that are not in its commits are kept, on their computer, next to their **QA Results**: the one saved at the end of each agent session, and those saved before the **Knowledge base** was committed. Like QA Results, it is not part of the Knowledge base and is never committed to the app.

### 3. `init` is today's `init --shared`

- `init` finds `revelio-ai` in the app's `node_modules`, from the folder it runs in up to the git root, as `initShared` does today. A package in `web/` gives a Stop hook on `web/node_modules/.bin/revelio` and the line "run `npx revelio-ai check` in `web/`".
- Without the package, it stops and writes nothing. It says: "Revelio installs in the app now: run `npm install -D revelio-ai`, then `npx revelio-ai init` from the same folder. Or run `npm init revelio`, which does both." `init` does not run a package manager itself: the app can use pnpm, yarn or bun. A Builder who types the old `npx revelio-ai@latest init` gets this message.
- `--shared` is still accepted, and changes nothing, so old commands still work.
- It prints "Revelio is installed in this app: commit what it added, and `knowledge-base/` with the code once it is written." and the list of what it wrote.

### 4. `init` takes a private install over

It does what `init --shared` does today (`removePrivate` with `keepHidden: false`):

- It removes `.revelio/`, its Stop hook from `.claude/settings.local.json`, its line from `CLAUDE.local.md`, the `git revelio` alias, and Revelio's lines in the local exclude. The Builder's own hooks and lines stay. A file left empty is removed.
- Git then sees `knowledge-base/`. It prints "Your private install is gone, and git now sees `knowledge-base/`: commit it with the rest."
- The QA Results and the History store stay where they are.
- When another checkout of the repo (a linked worktree) has a private install, it stops and writes nothing, as today: the two share the local exclude.
- A Fledgy install, private or shared, is taken over as today.

### 5. `uninstall` and `git revelio`

- `uninstall` removes the install, as it removes a shared install today, and what is left of a private install, as today. The knowledge base is kept.
- `init` writes no `git revelio` alias any more. Docs and messages say `npx revelio-ai <command>`.

### 6. The agent commits the knowledge base with the code it describes

A commit whose knowledge base describes its own code is a true Knowledge base version. So `maintain-knowledge-base` says: "`knowledge-base/` is committed with the code. When you commit, or suggest a commit, put the knowledge base changes in the same commit as the code they describe."

`git status` and `git diff` now list the files in `knowledge-base/` too. The skills that read them for code changes leave those files out:

- `maintain-knowledge-base`, step 1: the code you changed, outside `knowledge-base/`.
- `map-the-app`, `end.md`, step 1: `git diff --name-status <the inventory's commit> -- . ':!knowledge-base'`, and the untracked files of `git status` outside `knowledge-base/`.

While a mapping goes on, the Mapping record is committed too, and is removed in a commit when the app is mapped.

### 7. `npm init revelio` does both steps

`create-revelio` runs `npm install -D --save-exact revelio-ai@latest` in the folder it runs in, then that copy's `revelio init` with the same arguments. Without a `package.json` in the folder, or with the lockfile of another package manager (`pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `bun.lockb`), it stops and prints the two commands for that manager. It then needs a new version, `0.2.0`.

### 8. This repo's own install

This repo is `revelio-ai`, so it cannot depend on itself. The released copy goes in `.revelio/` again, with its own `package.json`, and `init` runs from there:

```sh
npm install --prefix .revelio --save-exact revelio-ai@<version>
cd .revelio && node_modules/.bin/revelio init
```

`init` finds the package in `.revelio/` as it finds one in `web/`, so this needs no special case. `.revelio/` goes in `.gitignore`. The Stop hook in `.claude/settings.json`, the line in `CLAUDE.md` ("run `npx revelio-ai check` in `.revelio/`"), `.claude/skills/` and `knowledge-base/` are committed. A contributor who did not run the install sees a "hook error" when the agent stops: `docs/dogfooding.md` says to run it after a clone.

## Milestones

Each milestone is one commit that the Builder can review alone, with its tests written first. Milestones 2 to 5 go out together, in the next minor release (`0.4.0`, see `docs/releasing.md`): they change how Revelio is installed. Milestone 6 comes after that release.

### 1. The words

- Files: `GLOSSARY.md`.
- Remove **Private install** and **Shared install**, and change **History store** (decisions 1 and 2).

### 2. `init` installs in the app only

- Files: `src/init.ts`, `src/init.test.ts`, `src/git-revelio.test.ts`, `src/from-fledgy.test.ts`, `src/cli.ts`, `src/cli.test.ts`, and comments in `src/history.ts`, `src/flow-changes.ts` and `src/stop-hook.ts`.
- Remove `initPrivate`, `installLibrary`, `setAlias`, `refuseAnotherAlias`, `teamHas` and the `private`, `team-has-it` and `team-has-fledgy` results. Remove `packageSpec` and `REVELIO_PACKAGE` from `src/cli.ts`. The usage line says `revelio init`.
- Keep what takes a private install over and what uninstalls it: `removePrivate`, `removeAlias`, the local exclude helpers, `otherPrivateInstalls`, `leaveFledgy` and `moveAppData`.
- Tests: a fixture writes a private install as 0.3.0 left it (`.revelio/node_modules/.bin/revelio`, the exclude block, the alias and its note, the local hook, the `CLAUDE.local.md` line). The tests of a private install become tests of its takeover and of its uninstall. The tests of the alias that `init` wrote go, except those of its removal.

### 3. The skills

- Files: `skills/maintain-knowledge-base/SKILL.md`, `skills/map-the-app/end.md`.
- Decision 6.

### 4. The docs

- Files: `README.md` (*Get started*, the commands, and *For a team* goes), `docs/words.md` (the *Knowledge base*'s "Good to know"), `docs/releasing.md` (the upgrade line), `.github/ISSUE_TEMPLATE/bug-report.yml` (the *Install* field goes).
- README, *Not yet*: "The app needs a `package.json`. An app without one (Python only, for example) gets one with `npm init -y` at its root."

### 5. `npm init revelio`

- Files: `packages/create-revelio/cli.js`, `cli.test.js`, `README.md`, `package.json` (`0.2.0`).
- Decision 7. It is published after `revelio-ai` 0.4.0, since it installs the latest one.

### 6. This repo's install (after the release)

- Files: `.gitignore`, `docs/dogfooding.md`, `CLAUDE.md` and `AGENTS.md` (the *Dogfooding* line), and what `init` writes (decision 8). `init` removes the line of `CLAUDE.local.md`, and the file with it, since it has nothing else. `.claude/settings.local.json` keeps the Builder's other hooks.
- The Builder reads `knowledge-base/` before its first commit: this repo is public.
- Then tick milestone 0 of the Overview plan.

## Checks by hand, before the release

On a scratch repo with a `package.json`, with the packed tarballs of `revelio-ai` and `create-revelio`:

- A first install with `npm init revelio`, then `npx revelio-ai check`, `view` and `uninstall`.
- A 0.3.0 private install (`npx revelio-ai@0.3.0 init`), then the new `init`: `git status` shows `knowledge-base/`, `.revelio/` and `git revelio` are gone, the Builder's own lines in `CLAUDE.local.md` stay, and `npx revelio-ai view` still shows the QA Results and the history.
- `npx revelio-ai init` without the package: it writes nothing and prints the two commands.

`../auxilia` has a private install, so it is the first real takeover. The Builder decides when to commit its knowledge base there.

## Open questions

- **An app without a `package.json`.** A private install works there today, since `.revelio/` has its own. After this plan, the Builder adds one at the root. Milestone 4 says so in the README. If Builders ask for more, `init` could put a `package.json` of its own in `.revelio/`, committed, as decision 8 does for this repo but with only `node_modules/` ignored.
- **The History store, later.** With every commit holding its own knowledge base, the view could read the Anchors of each commit from that commit, and keep the History store only for the end of each agent session. That is not in this plan.
