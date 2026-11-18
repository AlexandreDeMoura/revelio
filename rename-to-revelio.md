# Renaming Fledgy to Revelio

How to go from `fledgy` to `revelio-ai`, step by step. [naming-revelio.md](naming-revelio.md) explains why these names were chosen. This guide covers how to do it.

**What changes, in short.** An npm package cannot be renamed. Instead you publish a new package, `revelio-ai`, from this same repo, and deprecate `fledgy`. Neither the repo nor an npm org needs to change. npm takes the package name from `package.json` alone.

**Target names**

| Surface | Today | After |
|---|---|---|
| npm package | `fledgy` | `revelio-ai` |
| Command | `fledgy`, `git fledgy …` | `revelio`, `git revelio …` |
| Claude Code plugin | `fledgy` | `revelio` |
| Private install folder | `.fledgy/` | `.revelio/` |
| Per-Builder data | `~/.fledgy/<first commit>/` | `~/.revelio/<first commit>/` |
| Version | `0.2.0` | `0.3.0` (the rename breaks how Fledgy is used) |

---

## Step 0: Settle what could stop the rename

- [x] **Trademark check** on "Revelio" (EUIPO, USPTO). The name comes from a work licensed by Warner Bros. Of all the steps, only this one can cancel the rename, so do it first.
- [ ] **Domain** to replace `fledgy.dev` (`revelio.dev` is taken): `revelio-ai.dev` chosen, set as `homepage`, still to buy.

## Step 1: Claim what costs nothing

- [ ] Create the VS Code Marketplace publisher `revelio-ai`. Do not publish an extension yet: the name of a removed extension can never be used again.
- [ ] Optional: create the npm org `@revelio-ai`, kept spare for future scoped packages. `revelio-ai` itself is unscoped and does not need it.

You cannot claim `revelio-ai` on npm yet, because npm forbids publishing only to reserve a name. It gets claimed by the real release in step 6.

## Step 2: Rename inside the code

Work on a branch. Write each test before the change (`npm test`).

Almost every name in `src/init.ts` comes from one constant, `packageName`. The alias, the Stop hook, the instruction marker and the messages all follow from it. Change it, then fix whatever `npm test` reports.

- [x] **Manifests**
  - `package.json`: `name: "revelio-ai"`, `bin: { "revelio": "dist/cli.js" }`, `homepage` (the new domain), and `description`.
  - `package-lock.json`: run `npm install --package-lock-only` so the name at its top matches.
  - `.claude-plugin/plugin.json`: `name: "revelio"` and `description`. Plugin users have to reinstall, because the skills are now namespaced under the new plugin name.
- [x] **CLI, `src/`**
  - `src/init.ts`: `packageName` and `privateFolder` (`.revelio`).
  - `src/cli.ts`: the usage text, the messages, and `FLEDGY_PACKAGE` → `REVELIO_PACKAGE`.
  - `src/qa-results.ts`: `~/.fledgy` → `~/.revelio`. `history.ts` uses the same folder.
  - `src/history.ts`: the temp folder prefix and the commit identity (`Fledgy`, `fledgy@localhost`).
  - `src/stop-hook.ts`, `src/first-run.ts`: messages and the guide link.
  - `src/code-changes.ts`: `FLEDGY-COMMIT` is internal, so renaming it is only for consistency.
  - Rename `src/git-fledgy.test.ts` to `src/git-revelio.test.ts` and update all the tests.
- [x] **Web view, `view/`**: the `<title>`, the logo text, the document titles, the guide link, and the `fledgy-theme` key in localStorage. Renaming that key resets each Builder's chosen theme once, which is acceptable.
- [x] **Skills, `skills/`**: the places where the text says "Fledgy". Edit `skills/`, never `.claude/skills/`.
- [x] **Links**: `github.com/AlexandreDeMoura/revelio`, since the repo is renamed (see step 5).

## Step 3: Move existing installs over

This step is the real work. With `packageName` changed, `revelio init` no longer recognizes anything Fledgy wrote. On a repo with a Fledgy install it would add a second Stop hook, a second instruction line and a second alias. The old hook would keep running the old `.fledgy/` copy.

So `init` has to find a Fledgy install and replace it. `uninstall` has to remove a Fledgy install too.

A box here is ticked once the code does it. This repo's own Fledgy install moves over later, in step 8.

- [x] **Private install**: move or replace `.fledgy/` with `.revelio/`, and update the local exclude (`.git/info/exclude`).
- [x] **`git fledgy` alias**: remove it only if it is still the one Fledgy wrote (the `fledgy.alias` note matches), then write `git revelio`.
- [x] **Stop hook**: replace the hook whose command ends in `fledgy" stop-hook`, in `.claude/settings.local.json` (private) or `.claude/settings.json` (shared).
- [x] **Instruction line**: replace the line ending in `<!-- fledgy -->` in `CLAUDE.local.md` (private) or `CLAUDE.md` (shared).
- [x] **Skills**: `.claude/skills/` is refreshed as usual.
- [x] **Per-Builder data**: move `~/.fledgy/<first commit>/`, which holds `history.git` and `qa-results.json`, to `~/.revelio/<first commit>/` when the new folder does not exist yet. This keeps each Builder's history and QA Results.
- [x] **Shared install**: the app's `package.json` still depends on `fledgy`. Print the command to switch it (`npm uninstall fledgy && npm install -D revelio-ai`), but do not run it.
- [x] `knowledge-base/` does not change.

Prefer moving the files once, in `init`, over reading old locations forever. That way the old paths do not stay in the code.

## Step 4: Words and docs

- [x] `README.md`: the new name, `npx revelio-ai init`, and a clear line on what Revelio is (user flows and manual QA, not a code graph). That line sets it apart from `@revelio-tools/revelio`. Pair the name with a qualifier: "Revelio AI", "Revelio for Claude Code".
- [x] `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`.
- [x] `GLOSSARY.md`: its title is the product name. Rename it, and check that no definition depends on the name.
- [x] `docs/words.md` and `docs/dogfooding.md`: `git revelio`, `.revelio/` and `REVELIO_PACKAGE`.
- [x] `docs/releasing.md`: `npm view revelio-ai …`, `npx revelio-ai@latest init`, and the trusted publisher settings of the new package.
- [x] `.github/ISSUE_TEMPLATE/`: the product name and the commands.
- [x] Leave `prototypes/`, `experiments/`, `.scratch/` and `docs/research/` as they are. They record past work.

## Step 5: Set up publishing for `revelio-ai`

npm's trusted publishing is set per package, with an owner, a repo and a workflow. The repo is now `revelio`.

- [x] npm only lets you add a trusted publisher to a package that already exists. Create `revelio-ai` the way you created `fledgy` (see the `0.0.1-bootstrap` note in [docs/releasing.md](docs/releasing.md)), or publish `0.3.0` once by hand in step 6.
- [x] On npmjs.com, in the `revelio-ai` Settings:
  - **Trusted Publisher**: GitHub Actions, owner `AlexandreDeMoura`, repository `revelio`, workflow `release.yml`, with `npm publish` allowed (a new one allows only `npm stage publish` by default). A new trusted publisher expires if it has not published within 2 days, so add it on the day of the release in step 6.
  - **Publishing access**: "Require two-factor authentication and disallow tokens".
- [x] `.github/workflows/release.yml` needs no change. It publishes whatever `package.json` names.

- [x] **The GitHub repo is renamed to `revelio`**, and `repository` in `package.json` and `.claude-plugin/plugin.json`, the links in `src/first-run.ts`, `view/view.js`, the issue templates and the docs follow it.
- [x] Remove the trusted publisher of `fledgy`, which still names the repo `fledgy`: CI no longer publishes `fledgy`, and its last version is published by hand in step 7.

GitHub redirects the old URL, but do not rely on that.

## Step 6: Release `revelio-ai` 0.3.0

- [x] Follow [docs/releasing.md](docs/releasing.md), with `0.3.0` set in `package.json`, `package-lock.json` and `.claude-plugin/plugin.json`.
- [x] Check it: `npm view revelio-ai --prefer-online dist-tags`.
- [x] Try it on a test repo that has a Fledgy install, both private and shared: `npx revelio-ai@latest init`. Then check `git revelio check`, `git revelio view`, the history and the QA Results.

## Step 7: Retire `fledgy`

- [x] Skipped: publish one last `fledgy` 0.3.0 that forwards to `npx revelio-ai@latest`. Nobody but the Builder used Fledgy before the rename, so `fledgy` stops at 0.2.0.
- [x] Deprecate the package:
  ```sh
  npm deprecate fledgy "Fledgy is now Revelio: run npx revelio-ai init"
  ```
- [x] Existing private installs keep working as they are. `git fledgy` runs the copy in `.fledgy/` until the Builder runs `npx revelio-ai init`.

## Step 8: Move this repo's own install

This repo has a private Fledgy install (`.fledgy/`, `.claude/skills/`, the `<!-- fledgy -->` line in `CLAUDE.local.md`), so it is the first real test of step 3.

- [x] On the release commit: `npm run build && node dist/cli.js init`. As with Fledgy, `npx revelio-ai init` does not work inside the package itself.
- [ ] Check that `.fledgy/` is gone, that `git revelio check` passes, and that `git revelio view` still shows the history and the QA Results.

## Step 9: Later

- [ ] `create-revelio`: a small package whose `bin` runs `revelio-ai init`, so `npm init revelio` works. It can live in `packages/create-revelio/` and be published by hand, since it will rarely change.
  - [x] Built in `packages/create-revelio/`, with its tests run by `npm test`.
  - [ ] Published by hand (see the `create-revelio` section of [docs/releasing.md](docs/releasing.md)), then `npm init revelio` added to `README.md`.
- [ ] The VS Code extension under the publisher `revelio-ai` (`name: "revelio"`, `displayName: "Revelio AI"`), published only when it is ready.
- [ ] If the owner of `revelio` agrees to transfer it, make `npx revelio init` the main command and keep `revelio-ai` working.

---

## Order that matters

1. Do the trademark check before anything public.
2. Move existing installs over (step 3) in the same release as the rename (step 2). Otherwise Builders who upgrade end up with two Stop hooks.
3. Release `revelio-ai` (step 6) before the last `fledgy` (step 7), because the last `fledgy` forwards to it.
4. If you rename the GitHub repo, update both trusted publishers on the same day.
