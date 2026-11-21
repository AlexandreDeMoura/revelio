# Dogfooding

Revelio maps Revelio itself: a released copy, installed on this repo, gives it a **Knowledge base** of its own Flows, Areas and Parts, kept true by the same Stop hook a **Builder** gets. The knowledge base is committed with the code, as in any app.

## Two copies of Revelio

Keep them apart:

- **The copy you use** is a released version, installed in `.dogfood/`, with its skills copied into `.claude/skills/`. This is what runs when you type `/map-the-app` or when the Stop hook fires.
- **The copy you change** is the source: `src/`, `skills/`, `view/`.

Editing `skills/` changes nothing in how Revelio behaves on this repo until you install that copy (see below). Never edit `.claude/skills/`: the next install replaces it.

This repo is `revelio-ai`, so it cannot depend on itself. `.dogfood/` is a small package of its own, whose one dependency is the released `revelio-ai`. Its `package.json` and `package-lock.json` are committed; its `node_modules/` is not. It is not `.revelio/`: `init` takes that folder for a private install from 0.3.0 or before, and removes it.

## What is committed

- `.dogfood/package.json` and `.dogfood/package-lock.json`: the version in use.
- `.claude/settings.json`: the Stop hook, which runs `.dogfood/node_modules/.bin/revelio`.
- `.claude/skills/`: the skills of that version.
- The last line of `CLAUDE.md`: run `npx revelio-ai check` in `.dogfood/`.
- `knowledge-base/`. This repo is public: read what the agent wrote there before you commit it.

## After a clone

```sh
npm ci --prefix .dogfood
```

Without it, Claude Code shows a "hook error" each time the agent stops, since the Stop hook finds no `revelio` to run.

Then type `/map-the-app` in Claude Code to carry on the mapping, if `knowledge-base/mapping-record.md` is there. Read the knowledge base with `npx revelio-ai view`, run in `.dogfood/`.

## Upgrade

After a release is published on npm:

```sh
npm install --prefix .dogfood --save-exact revelio-ai@latest
cd .dogfood && npx revelio-ai init
```

Commit what changed: `.dogfood/package.json`, `.dogfood/package-lock.json`, `.claude/skills/`, and `.claude/settings.json` or `CLAUDE.md` if `init` changed them.

## Try unreleased skills or code

From the repo root:

```sh
npm pack
cd .dogfood
npm install --no-save ../revelio-ai-X.Y.Z.tgz
npx revelio-ai init
```

`--no-save` leaves `.dogfood/package.json` and `.dogfood/package-lock.json` as they are. `init` still copies the new skills into `.claude/skills/`. To go back to the released version, in `.dogfood/`: `npm ci`, then `npx revelio-ai init`. Do not commit the skills of a copy that is not released.

## What to expect

- Every coding session on this repo ends with the agent following `maintain-knowledge-base` and running `npx revelio-ai check` in `.dogfood/`. That cost is part of what you are testing.
- Revelio is a CLI and a set of agent skills, not the web app the glossary has in mind. When a word does not fit (an Anchor's side for terminal output, an agent as **Actor**, a skill as **Entry point**), write it down and raise it as a question about `GLOSSARY.md` instead of bending the word.

## Remove

`npx revelio-ai uninstall`, run in `.dogfood/`, removes the install and keeps `knowledge-base/`. Then remove `.dogfood/`.
